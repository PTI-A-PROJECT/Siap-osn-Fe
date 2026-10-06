import { expect, test } from '@playwright/test'
import {
  buatSiswaBaru,
  loginSiswa,
  penuhiSyaratSimulasi,
  seedPutaranSelesai,
  tokenUntuk,
} from './helpers.js'

// Spec simulasi. Alur backend sudah diverifikasi lewat API:
//   GET  /simulasi/syarat?tingkat_id=1 -> { terpenuhi, alasan, rincian[] }
//   POST /simulasi/{id}/mulai         -> 201, batas_pada = mulai_pada + durasi_menit
//   PUT  /hasil-simulasi/{id}/jawaban  -> 200
//   POST /hasil-simulasi/{id}/submit   -> 200 { nilai, lulus, ... }
//
// Bagian yang paling rapuh dan jadi alasan spec ini ada: countdown dihitung dari
// `batas_pada` milik server, bukan dari hitungan lokal, jadi reload di tengah
// ujian tidak boleh menambah waktu.

const TINGKAT = 1

/** Pecah "MM:SS" jadi detik. */
function keDetik(mm) {
  const t = (mm.match(/\d+/g) ?? ['0', '0']).map(Number)
  return t[0] * 60 + t[1]
}

/** Ambil angka detik dari teks "Sisa Waktu: 119:58". */
async function sisaWaktu(page) {
  const teks = await page.locator('text=/sisa waktu/i').first().innerText()
  const mm = teks.match(/\d{1,3}:\d{2}/)
  expect(mm, `harus ada format MM:SS di "${teks}"`).not.toBeNull()
  return keDetik(mm[0])
}

/** Buat akun + penuhi seluruh syarat simulasi lewat API. */
async function akunSiapSimulasi(request, label) {
  const akun = await buatSiswaBaru(request, label)
  const token = await tokenUntuk(request, akun)
  await seedPutaranSelesai(request, token)
  await penuhiSyaratSimulasi(request, token, TINGKAT)
  return akun
}

test.describe('simulasi', () => {
  test('syarat belum terpenuhi memblokir tombol mulai', async ({ page, request }) => {
    // Akun baru: belum pretest, jadi syarat harus menggagalkan.
    const akun = await buatSiswaBaru(request, 'simulasi.belum')
    await loginSiswa(page, akun)
    await page.goto('/siswa/simulasi')

    await expect(page.locator('.syarat-status')).toHaveText(/belum terpenuhi/i)
    await expect(page.locator('.syarat-alasan')).toContainText(
      /belum menyelesaikan pre-test di tingkat ini/i,
    )

    const mulai = page.getByRole('button', { name: /mulai simulasi/i })
    await expect(mulai).toBeDisabled()
  })

  test('syarat terpenuhi membuka tombol mulai', async ({ page, request }) => {
    const akun = await akunSiapSimulasi(request, 'simulasi.siap')
    await loginSiswa(page, akun)
    await page.goto('/siswa/simulasi')

    await expect(page.locator('.syarat-status')).toHaveText(/terpenuhi/i)
    // Rincian per materi wajib harus tampil, bukan sekadar status hijau.
    await expect(page.locator('.syarat-daftar li')).not.toHaveCount(0)

    const mulai = page.getByRole('button', { name: /mulai simulasi/i })
    await expect(mulai).toBeEnabled()
  })

  test('modal aturan mewajibkan persetujuan sebelum ujian dimulai', async ({ page, request }) => {
    const akun = await akunSiapSimulasi(request, 'simulasi.modal')
    await loginSiswa(page, akun)
    await page.goto('/siswa/simulasi')

    await page.getByRole('button', { name: /mulai simulasi/i }).first().click()
    await expect(page.locator('.setuju')).toBeVisible()

    // Tombol Mulai di modal terkunci sampai persetujuan dicentang.
    const tombolMulai = page.locator('.btn-modal.btn-mulai')
    await expect(tombolMulai).toBeDisabled()
    await page.locator('.setuju input[type="checkbox"]').check()
    await expect(tombolMulai).toBeEnabled()
  })

  test('countdown berjalan dari batas_pada server', async ({ page, request }) => {
    const akun = await akunSiapSimulasi(request, 'simulasi.timer')
    await loginSiswa(page, akun)
    await page.goto('/siswa/simulasi')

    await page.getByRole('button', { name: /mulai simulasi/i }).first().click()
    await page.locator('.setuju input[type="checkbox"]').check()
    await page.locator('.btn-modal.btn-mulai').click()

    // Berpindah ke halaman ujian.
    // NB: kelas di halaman ini BEDA dari PretestView (yang pakai .chip-blue).
    // Yang dipakai di sini adalah teksnya, dan TANPA anchor ^...$: interpolasi
    // Vue memecah "Soal {{ ... }}" jadi beberapa text node, sehingga pola
    // ber-anchor tidak pernah cocok meski teksnya terlihat benar.
    await expect(page.getByText('Sisa Waktu:')).toBeVisible()
    await expect(page.getByText('Soal 1 dari 30').first()).toBeVisible()

    const pertama = await sisaWaktu(page)
    // Durasi bawaan seeder 120 menit; toleransi longgar karena sudah lewat
    // beberapa detik sejak batas_pada dibuat server.
    expect(pertama, 'timer harus mendekati durasi 120 menit').toBeGreaterThan(115 * 60)

    // Timer harus benar-benar berkurang.
    await page.waitForTimeout(3000)
    const kedua = await sisaWaktu(page)
    expect(kedua, 'timer harus berkurang').toBeLessThan(pertama)
    expect(pertama - kedua, 'penurunan harus wajar (bukan lompat besar)').toBeLessThanOrEqual(15)
  })

  test('reload tidak mereset countdown', async ({ page, request }) => {
    const akun = await akunSiapSimulasi(request, 'simulasi.reload')
    await loginSiswa(page, akun)
    await page.goto('/siswa/simulasi')

    await page.getByRole('button', { name: /mulai simulasi/i }).first().click()
    await page.locator('.setuju input[type="checkbox"]').check()
    await page.locator('.btn-modal.btn-mulai').click()
    await expect(page.getByText('Soal 1 dari 30').first()).toBeVisible()

    const sebelum = await sisaWaktu(page)
    await page.waitForTimeout(3000)
    await page.reload()
    await expect(page.getByText('Soal 1 dari 30').first()).toBeVisible()

    const sesudah = await sisaWaktu(page)
    // Kalau timer dihitung ulang dari durasi penuh, nilai sesudah akan LEBIH
    // BESAR dari sebelum. Yang benar: lanjut dari sisa waktu yang sama.
    expect(sesudah, 'reload tidak boleh menambah sisa waktu').toBeLessThanOrEqual(sebelum)
    expect(Math.abs(sesudah - sebelum), 'sisa waktu harus berlanjut, bukan reset').toBeLessThanOrEqual(20)
  })
})
