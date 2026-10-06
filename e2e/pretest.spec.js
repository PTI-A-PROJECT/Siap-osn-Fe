import { expect, test } from '@playwright/test'
import { buatSiswaBaru, loginSiswa, logout, seedPutaranSelesai, tokenUntuk } from './helpers.js'

// Base URL API dibaca dari .env FE, sama seperti helpers.js, supaya tidak drift.
// Perhatikan: ini sudah termasuk /api -- jangan di-strip seperti helper `api()`
// yang menambahkan prefix sendiri.
const API = process.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

// Spec pre-test. Seluruh alur backend sudah diverifikasi lewat API: 30 soal
// dengan sebaran 15/9/6 per level, jawaban bertahan setelah reload, dan submit
// mengembalikan nilai + pemetaan per materi.
//
// Di spec ini seeding lewat API (cepat, tidak rapuh terhadap bentuk respons),
// assertion lewat UI — sesuai aturan di docs/MENJALANKAN-TESTING.md §7.

/** Pilih tingkat yang terbuka lalu mulai pre-test lewat UI. */
async function mulaiPretest(page) {
  await page.goto('/siswa/pretest')
  await expect(page.getByRole('heading', { name: /pilih tingkat pre-test/i })).toBeVisible()

  const terbuka = page.locator('.tingkat-opsi:not([disabled])')
  await expect(terbuka.first()).toBeVisible()
  await terbuka.first().click()

  // Tombol ini teksnya berubah jadi "Memulai…" saat request jalan, jadi klik
  // lewat class, bukan getByRole.
  await page.locator('.btn-mulai').click()
  await expect(page.locator('.chip-blue')).toContainText(/soal 1 dari \d+ soal/i)
}

test.describe('pre-test', () => {
  test('mulai pre-test menampilkan 30 soal', async ({ page }) => {
    const akun = await buatSiswaBaru(page.request, 'pretest.mulai')
    await loginSiswa(page, akun)

    await mulaiPretest(page)

    await expect(page.getByText('Soal 1 dari 30 soal')).toBeVisible()
    await expect(page.locator('.opsi, .uraian').first()).toBeVisible()
    // Ringkasan kanan harus ikut terisi.
    await expect(page.getByText('30', { exact: true }).first()).toBeVisible()
  })

  test('reload mempertahankan jawaban yang sudah disimpan', async ({ page }) => {
    const akun = await buatSiswaBaru(page.request, 'pretest.reload')
    await loginSiswa(page, akun)

    await mulaiPretest(page)

    // Jawab soal pertama. `.opsi` adalah tombol pilihan; ambil yang pertama
    // supaya tidak bergantung pada teks opsi yang berubah-ubah.
    const opsi = page.locator('.opsi').first()

    // PENTING: `.tersimpan` BUKAN bukti jawaban sudah tersimpan di server.
    // Class itu dibaca dari state lokal `jawaban` yang terisi seketika saat opsi
    // diklik, sedangkan simpanJawaban() di-debounce. Menunggu `.tersimpan`
    // lalu langsung reload bisa terjadi sebelum PUT-nya benar-benar dikirim,
    // sehingga jawabannya hilang -- itu yang membuat test ini gagal sebelumnya.
    // Tunggu respons API-nya, bukan indikator UI.
    const tersimpan = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && /\/api\/pretest\/\d+\/jawaban/.test(r.url()),
      { timeout: 15_000 },
    )
    await opsi.click()
    await tersimpan
    await expect(opsi).toHaveClass(/aktif/)

    const kodeDipilih = (await opsi.locator('b').innerText()).trim()

    // Reload penuh — ini yang diuji: jawaban harus kembali dari server, bukan
    // dari state Pinia yang kebetulan masih ada.
    await page.reload()
    await expect(page.locator('.chip-blue')).toContainText(/soal 1 dari 30 soal/i)

    const opsiSetelahReload = page.locator('.opsi').first()
    await expect(opsiSetelahReload).toHaveClass(/aktif/)
    expect((await opsiSetelahReload.locator('b').innerText()).trim()).toBe(kodeDipilih)
  })

  test('nomer soal melompat ke soal yang dipilih', async ({ page }) => {
    const akun = await buatSiswaBaru(page.request, 'pretest.lompat')
    await loginSiswa(page, akun)

    await mulaiPretest(page)

    // Klik nomer 5 di ringkasan kanan.
    await page.locator('.nomer').nth(4).click()
    await expect(page.locator('.chip-blue')).toContainText(/soal 5 dari 30 soal/i)

    // Tombol Sebelumnya kembali aktif.
    await page.locator('.btn-prev').click()
    await expect(page.locator('.chip-blue')).toContainText(/soal 4 dari 30 soal/i)
  })

  test('kumpulkan jawaban menampilkan modal dengan hitungan status', async ({ page }) => {
    const akun = await buatSiswaBaru(page.request, 'pretest.modal')
    await loginSiswa(page, akun)

    await mulaiPretest(page)

    // Lompat ke soal terakhir supaya tombol "Selesai" muncul (bukan "Berikutnya").
    await page.locator('.nomer').last().click()
    await page.getByRole('button', { name: /^selesai/i }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText(/yakin ingin mengumpulkan pre-test/i)).toBeVisible()
    // Di test ini tidak ada soal yang dijawab, jadi semuanya belum.
    await expect(page.locator('.mstat-green b')).toHaveText('0')
    await expect(page.locator('.mstat-gray b')).toHaveText('30')

    // Tombol batal tidak mengirim apa pun.
    await page.getByRole('button', { name: /kembali mengerjakan/i }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.chip-blue')).toContainText(/soal 30 dari 30 soal/i)
  })

  test('submit pre-test yang sudah dijawab lewat API menampilkan nilai dan pemetaan', async ({
    page,
    request,
  }) => {
    const akun = await buatSiswaBaru(page.request, 'pretest.submit')
    const token = await tokenUntuk(request, akun)

    // Seed lewat API: buat putaran + isi jawaban + submit. Ini yang membuat
    // spec ini cepat dan tidak bergantung pada 30 klik di UI.
    const hasil = await seedPutaranSelesai(request, token)
    expect(hasil.nilai).toBe(100)

    await loginSiswa(page, akun)
    await page.goto('/siswa/pemetaan')

    // Regression Fase 5.1: /siswa/pemetaan tanpa id harus tetap terisi lewat
    // fallback ke riwayat.
    await expect(page.getByText('100', { exact: false }).first()).toBeVisible()
    await expect(page.locator('.card').first()).toBeVisible()
  })

  test('pre-test milik akun lain tidak terbawa setelah ganti akun', async ({ page, request }) => {
    // Risiko nyata: ID pretest yang sedang berjalan disimpan di localStorage
    // (KUNCI_PRETEST_AKTIF di stores/pretest.js) supaya reload di tengah ujian
    // bisa dilanjutkan. Kalau akun berikutnya di browser yang sama tidak
    // membersihkannya, akun kedua akan_me-resume_ soal milik akun pertama.
    const pertama = await buatSiswaBaru(request, 'pretest.pakai1')
    await loginSiswa(page, pertama)
    await mulaiPretest(page)

    // Pastikan benar-benar ada ID yang tersimpan di browser.
    const tersimpan = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.toLowerCase().includes('pretest')),
    )
    expect(tersimpan.length, 'ID pretest aktif harus ada di localStorage').toBeGreaterThan(0)

    // Pindah akun di browser yang sama.
    await page.goto('/siswa/progress')
    await logout(page)
    const kedua = await buatSiswaBaru(request, 'pretest.pakai2')
    await loginSiswa(page, kedua)
    await page.goto('/siswa/pretest')

    // Akun kedua belum punya pre-test, jadi harus dapat pemilih tingkat --
    // bukan soal milik akun pertama.
    await expect(page.getByRole('heading', { name: /pilih tingkat pre-test/i })).toBeVisible()
    await expect(page.locator('.chip-blue')).toHaveCount(0)
  })
})

// BASE URL API dibaca dari .env FE, sama seperti helpers.js, supaya tidak drift.
