import { expect, test } from '@playwright/test'
import {
  AKUN_ADMIN,
  buatSiswaBaru,
  emailUnik,
  isiFormLogin,
  isiFormRegister,
  loginAdmin,
  loginSiswa,
  logout,
} from './helpers.js'

// Fase autentikasi: register, login, guard rute, session, dan form yang
// belum punya endpoint backend.

test.describe('auth', () => {
  test('register akun baru, lalu login dan melihat banner belum pre-test', async ({ page }) => {
    const email = emailUnik('auth.daftar')
    await page.goto('/register')
    await isiFormRegister(page, { nama: 'Siswa E2E', email, password: 'password123' })

    // RegisterForm mengalihkan ke /login (bukan langsung dashboard), jadi
    // alurnya disalin apa adanya: register -> login -> dashboard.
    await page.waitForURL(/\/login/, { timeout: 20_000 })
    await isiFormLogin(page, { email, password: 'password123' })

    await page.waitForURL(/\/siswa/)
    await expect(page.getByText(/belum mengikuti tes pemetaan awal/i)).toBeVisible()
  })

  test('register menolak email yang sudah dipakai', async ({ page }) => {
    await page.goto('/register')
    await isiFormRegister(page, {
      nama: 'Duplikat',
      email: 'siswa@example.com',
      password: 'password123',
    })

    await expect(page.getByText(/email sudah terdaftar/i)).toBeVisible()
  })

  test('login salah memberi pesan jelas, bukan crashing', async ({ page }) => {
    await page.goto('/login')
    await isiFormLogin(page, { ...AKUN_ADMIN, password: 'password-salah' })

    await expect(page.getByText(/email atau password salah/i)).toBeVisible()
  })

  test('guard menahan anonim dari halaman siswa dan admin', async ({ page }) => {
    for (const path of ['/siswa/pretest', '/siswa/materi', '/admin']) {
      await page.goto(path)
      await page.waitForURL(/\/login/, { timeout: 20_000 })
      await expect(page.locator('#email')).toBeVisible()
    }
  })

  test('guard menahan siswa dari halaman admin', async ({ page }) => {
    const akun = await buatSiswaBaru(page.request, 'auth.guard')
    await loginSiswa(page, akun)
    await page.goto('/admin')
    await page.waitForURL(/\/forbidden/)
    await expect(page.getByText(/403|terolak|tidak diizinkan/i).first()).toBeVisible()
  })

  test('guard menahan admin dari halaman siswa', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/siswa/materi')
    await page.waitForURL(/\/forbidden/)
  })

  test('logout mengosongkan session lalu halaman terlindungi kembali', async ({ page }) => {
    await loginAdmin(page)
    await logout(page)

    await page.goto('/admin')
    await page.waitForURL(/\/login/)
  })

  test('ganti akun tidak meninggalkan sisa data pre-test', async ({ page }) => {
    const pertama = await buatSiswaBaru(page.request, 'auth.sisa')
    await loginSiswa(page, pertama)
    await page.goto('/siswa/pretest')
    await page.getByRole('button', { name: /mulai pre-test/i }).click()
    await expect(page.getByText(/soal 1 dari 30/i)).toBeVisible()

    // Logout dari halaman yang pakai sidebar UserMenu. PretestView punya
    // menu miliknya sendiri, jadi pindah dulu supaya menu yang dipakai
    // adalah UserMenu yang sama dengan halaman siswa lain.
    await page.goto('/siswa/progress')
    await logout(page)

    const kedua = await buatSiswaBaru(page.request, 'auth.baru')
    await loginSiswa(page, kedua)
    await page.goto('/siswa/pretest')

    // Akun kedua belum punya pre-test, jadi harus tampil pemilih tingkat —
    // bukan lanjutkan milik akun pertama (regresi reset store).
    await expect(page.getByText(/tidak dapat membuka pre-test tersimpan/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /mulai pre-test/i })).toBeVisible()
  })
})

// Tiga form ini masih palsu: `await new Promise(r => setTimeout(r, 500))`
// lalu toast sukses, tanpa request ke backend. Backend juga belum punya
// endpoint-nya (keputusan #1 di PLAN-INTEGRASI-LANJUTAN.md §7.2).
// Spec ini mengunci perilaku tersebut supaya tidak diam-diam berubah jadi
// lebih rendah tanpa ada yang memperbarui test ini.
test.describe('form yang belum punya endpoint backend', () => {
  test('lupa kata sandi tidak pernah mengirim request', async ({ page }) => {
    const requests = []
    page.on('request', (r) => {
      if (r.url().includes('/api/')) requests.push(r.url())
    })

    await page.goto('/lupa-kata-sandi')
    await page.locator('#email').fill('siswa@example.com')
    await page.getByRole('button', { name: /kirim|kirim link/i }).click()

    await expect(page.getByText(/tautan.*dikirim|periksa email/i).first()).toBeVisible()
    expect(requests, 'form ini belum integrasi ke backend').toEqual([])
  })

  test('ubah kata sandi di halaman profil tidak mengirim request', async ({ page, request }) => {
    const akun = await buatSiswaBaru(request, 'auth.sandi')
    await loginSiswa(page, akun)

    const requests = []
    page.on('request', (r) => {
      if (r.url().includes('/api/')) requests.push(r.url())
    })

    await page.goto('/siswa/profil')
    // Samakan basal: login + dashboard memang memanggil /auth/me dan
    // /dashboard, jadi yang dibandingkan adalah request SETELAH halaman siap.
    await expect(page.getByRole('heading', { name: /profil akun/i })).toBeVisible()
    requests.length = 0

    await page.locator('#pw-now').fill('password123')
    await page.locator('#pw-new').fill('password456')
    await page.locator('#pw-confirm').fill('password456')
    await page.getByRole('button', { name: /perbarui kata sandi/i }).click()

    // Perilaku saat ini: field dikosongkan tanpa request apa pun dan tanpa
    // toast — `updatePassword()` masih `// TODO: panggil API ubah kata sandi`.
    await expect(page.locator('#pw-new')).toHaveValue('')
    expect(requests, 'ubah kata sandi belum integrasi ke backend').toEqual([])
  })
})
