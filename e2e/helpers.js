import { expect } from '@playwright/test'

// Helper bersama untuk seluruh spec E2E. Tujuannya: spec tetap ringkas dan
// enak dibaca, sementara detail login/seed angka ada di satu tempat.

// Akun seed dari backend seeder (database dev).
export const AKUN_SISWA = { email: 'siswa@example.com', password: 'password' }
export const AKUN_ADMIN = { email: 'admin@example.com', password: 'password' }

// Penting: `request` fixture memakai baseURL Playwright, yaitu Vite di :5173.
// Vite tidak mem-proxy /api ke Laravel, jadi seeding lewat API harus
// langsung ke :8000 — persis seperti yang dilakukan browser lewat
// VITE_API_BASE_URL. Nilai ini dibaca dari .env supaya tidak drift.
const API_BASE = (
  process.env.VITE_API_BASE_URL ||
  'http://localhost:8000/api'
).replace(/\/api\/?$/, '')

const api = (path) => `${API_BASE}/api${path}`

let urutan = 0

/** Email unik per test supaya tidak bentrok saat test dijalankan berulang. */
export function emailUnik(label = 'e2e') {
  urutan += 1
  return `${label}.${Date.now()}.${urutan}@example.com`
}

/**
 * Buat akun siswa baru lewat API (bukan UI) lalu login di browser.
 * Pendaftaran lewat UI diuji terpisah di spec auth; di spec fitur kita hanya
 * butuh akun yang sudah punya pre-test tertentu.
 */
export async function buatSiswaBaru(request, label = 'e2e') {
  const email = emailUnik(label)
  const password = 'password123'
  const res = await request.post(api('/auth/register'), {
    data: {
      name: `Siswa ${label}`,
      email,
      password,
      password_confirmation: password,
    },
  })
  expect(res.status(), 'registrasi akun E2E harus berhasil').toBe(201)
  return { email, password }
}

/**
 * Isi form login pakai id yang sudah jadi markah HTML di LoginForm.vue.
 * `getByLabel(/kata sandi/i)` tidak bisa dipakai: label itu juga cocok dengan
 * tombol "Tampilkan kata sandi", jadi strict mode menemukan dua elemen.
 */
export async function isiFormLogin(page, akun) {
  await page.locator('#email').fill(akun.email)
  await page.locator('#password').fill(akun.password)
  // Tombolnya `type="submit"` tanpa nama yang cocok /masuk/i — teksnya
  // "Masuk ke Akun", dan isinya ikut berubah saat loading/berhasil. Karena itu
  // diklik lewat form submit, bukan getByRole.
  await page.locator('#login-form button[type="submit"]').click()
}

/**
 * Isi dan kirim form register. Checkbox persetujuan layanan wajib dicentang
 * dulu — tanpa itu submit ditolak dengan "Persetujuan wajib dicentang".
 */
export async function isiFormRegister(page, { nama, email, password }) {
  await page.locator('#nama').fill(nama)
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.locator('#konfirmasi').fill(password)
  await page.locator('input[type="checkbox"]').check()
  await page.locator('#register-form button[type="submit"]').click()
}

/**
 * Buka menu user lalu pilih Keluar. Tombolnya tidak punya nama yang stabil
 * (teknya berisi nama akun), jadi diklik lewat `aria-haspopup="menu"`;
 * item menunya memakai role="menuitem".
 */
export async function logout(page) {
  // Dua bentuk tombol Keluar ada di aplikasi: UserMenu di sidebar (butuh
  // klik tombol akun dulu, lalu item role=menuitem), dan tombol langsung di
  // DashboardView admin.
  const tombolAkun = page.locator('button[aria-haspopup="menu"]').first()
  if (await tombolAkun.count()) {
    await tombolAkun.click()
    await page.getByRole('menuitem', { name: /^keluar$/i }).click()
  } else {
    await page.getByRole('button', { name: /^keluar$/i }).first().click()
  }
  await page.waitForURL(/\/login/)
}

/** Login lewat UI dan tunggu dashboard selesai render. */
export async function loginSiswa(page, akun) {
  await page.goto('/login')
  await isiFormLogin(page, akun)
  await page.waitForURL(/\/siswa/)
}

/** Sama seperti loginSiswa, tapi untuk Super Admin. */
export async function loginAdmin(page) {
  await page.goto('/login')
  await isiFormLogin(page, AKUN_ADMIN)
  await page.waitForURL(/\/admin/)
}

/** Seed satu putaran lengkap lewat API supaya UI punya state siap. */
export async function seedPutaranSelesai(request, token, { tingkatId = 1 } = {}) {
  const mulai = await request.post(api('/pretest'), {
    headers: { Authorization: `Bearer ${token}` },
    data: { tingkat_id: tingkatId },
  })
  expect(mulai.status(), 'mulai pre-test').toBe(201)

  const pretest = mulai.json().data
  await jawabSemua(request, token, '/pretest', pretest.id, pretest.soal)
  const submit = await request.post(api(`/pretest/${pretest.id}/submit`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(submit.status(), 'submit pre-test').toBe(200)
  return submit.json().data
}

/** Isi jawaban semua soal dengan opsi pertama (pilihan ganda) atau teks. */
export async function jawabSemua(request, token, basePath, pengerjaanId, soal) {
  for (const s of soal) {
    const jawaban =
      s.tipe_soal === 'pilihan_ganda'
        ? Object.keys(s.pilihan_jawaban)[0]
        : 'jawaban e2e'
    const res = await request.put(api(`${basePath}/${pengerjaanId}/jawaban`), {
      headers: { Authorization: `Bearer ${token}` },
      data: { soal_id: s.id, jawaban_user: jawaban },
    })
    // 409 = soal sudah terkunci karena submit sebelumnya; abaikan.
    if (![200, 409].includes(res.status())) {
      throw new Error(`simpan jawaban soal ${s.id} gagal: HTTP ${res.status()}`)
    }
  }
}

/** Ambil token Bearer untuk seeding lewat API. */
export async function tokenUntuk(request, akun) {
  const res = await request.post(api('/auth/login'), {
    data: { email: akun.email, password: akun.password },
  })
  expect(res.status(), `login ${akun.email}`).toBe(200)
  return res.json().data.token
}

/**
 * Tandai semua materi wajib selesai + kerjakan latihannya, supaya syarat
 * simulasi terpenuhi dan halaman progress punya isi.
 */
export async function penuhiSyaratSimulasi(request, token, tingkatId = 1) {
  const headers = { Authorization: `Bearer ${token}` }
  const materi = (await request.get(api(`/materi?tingkat_id=${tingkatId}`), { headers })).json().data

  for (const m of materi.filter((x) => x.wajib)) {
    await request.put(api(`/materi/${m.id}/progress`), {
      headers,
      data: { status: 'selesai' },
    })
    if (!m.quiz_id) continue
    const mulai = await request.post(api(`/quiz/${m.quiz_id}/mulai`), { headers })
    if (![200, 201].includes(mulai.status())) continue
    const pj = mulai.json().data
    await jawabSemua(request, token, '/quiz-pengerjaan', pj.id, pj.soal)
    await request.post(api(`/quiz-pengerjaan/${pj.id}/submit`), { headers })
  }
  return materi
}
