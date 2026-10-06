# Menjalankan Testing — Panduan untuk Agent Baru

Dokumen ini untuk agent (atau manusia) yang baru pindah ke device atau
mesin lain dan harus menjalankan seluruh pengujian dari nol.

Rujukan utama: `PLAN-INTEGRASI-LANJUTAN.md` di root workspace `bigdata/`
(berisi plan Fase 0–7 dan status tiap fase). Dokumen ini cuma soal
**menjalankan test**.

> **Baca §4 dan §5 lebih dulu.** Empat proses dev harus hidup sebelum
> test apa pun bisa jalan, dan playwright punya preflight yang gagal cepat
> bila salah satunya mati.

---

## 0. TL;DR

```bash
# 1. pastikan DB hidup
docker start osn-readiness-web-pgsql-1

# 2. siapkan env ketiga repo (tidak ikut ter-commit) — lihat §3

# 3. nyalakan empat proses di empat terminal — lihat §4

# 4. install + jalankan test
cd siap-osn-fe && bun install && bunx playwright install chromium
bunx playwright test
```

Kalau preflight gagal, pesan error menyebut proses mana yang kurang.
Tidak perlu menebak.

---

## 1. Peta repo

| Repo | Folder | Branch kerja | Peran |
| --- | --- | --- | --- |
| Backend Laravel | `Osn-Readiness-Web/` | `dev` | API `/api/*`, port 8000 |
| Frontend Vue | `siap-osn-fe/` | `integrasi` | SPA Vite, port 5173 |
| Layanan hitung Python | `data-analytics/` | `integrasi` | `/hitung/*`, port 8000 → **8001** |
| Postgres 16 | container `osn-readiness-web-pgsql-1` | — | port 5432 |

Ketiganya sudah ter-rilis ke `main`. Untuk menjalankan pengujian, checkout
branch `integrasi` (FE) dan `dev` (BE) supaya dapat pekerjaan terbaru
yang belum dirilis.

---

## 2. Prasyarat sistem

| Kebutuhan | Cek dengan | Catatan |
| --- | --- | --- |
| PHP 8.4+ | `php -v` | `AGENTS.md` masih menulis 8.3 — itu usang (keputusan #5 di plan §7.2) |
| Composer | `composer -V` | |
| Bun | `bun -v` | proyek ini pakai bun, jangan npm |
| Python + uv | `uv --version` | |
| Docker | `docker ps` | untuk Postgres |

Install Playwright **sekali saja** per mesin:
```bash
bunx playwright install chromium    # ±94 MB
```

---

## 3. Menyiapkan env (tidak ikut ter-commit)

`.env` tidak masuk git di ketiga repo, jadi di mesin baru harus dibuat
ulang dari nol.

### 3.1 `Osn-Readiness-Web/.env`

Salin dari `.env.example` bila ada, lalu isi:

```ini
APP_KEY=                       # php artisan key:generate
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1              # 127.0.0.1, bukan "pgsql" — itu hanya resolve di dalam Docker
DB_PORT=5432
DB_DATABASE=osn_readiness
DB_USERNAME=sail
DB_PASSWORD=password

FRONTEND_URL=http://localhost:5173,http://127.0.0.1:5173

QUEUE_CONNECTION=database

PERHITUNGAN_URL=http://localhost:8001
PERHITUNGAN_TOKEN=             # WAJIB sama dengan INTERNAL_API_TOKEN di data-analytics
```

> **`DB_HOST`**. Nilai di `.env` bisa dibimpa variabel shell karena Laravel
> memakai env immutable. Makanya perintah test selalu ditulis
> `DB_HOST=127.0.0.1 composer test`.

### 3.2 `data-analytics/.env`

```ini
INTERNAL_API_TOKEN=            # WAJIB sama dengan PERHITUNGAN_TOKEN
```

### 3.3 `siap-osn-fe/.env`

```ini
VITE_API_BASE_URL=http://localhost:8000/api
# VITE_BYPASS_AUTH TIDAK diaktifkan — bypass tidak punya token Sanctum
```

### 3.4 Verifikasi token cocok

Cara paling aman: salin nilai `PERHITUNGAN_TOKEN` dari `.env` Laravel, lalu
tulis **literal** ke `INTERNAL_API_TOKEN` di `.env` Python. Dua baris dengan
nilai identik berarti hash pastinya sama.

Untuk membandingkan tanpa menyalin:

```bash
TOKEN="$(grep '^PERHITUNGAN_TOKEN=' Osn-Readiness-Web/.env | cut -d= -f2-)"
INTERNAL="$(grep '^INTERNAL_API_TOKEN=' data-analytics/.env | cut -d= -f2-)"
[ "$TOKEN" = "$INTERNAL" ] && echo "token sama" || echo "TOKEN BERBEDA"
```

Kalau berbeda → Python membalas 403 → Laravel membalas 502
`LAYANAN_HITUNG_SALAH_KONFIGURASI`, dan semua submit berakhir 503.

---

## 4. Empat proses

Empat terminal terpisah. Semuanya harus hidup sebelum test.

```bash
# T1 — Laravel API
cd Osn-Readiness-Web
DB_HOST=127.0.0.1 php artisan serve --host=127.0.0.1 --port=8000

# T2 — queue worker (wajib: NilaiUlangJob)
cd Osn-Readiness-Web
DB_HOST=127.0.0.1 php artisan queue:work --tries=3

# T3 — layanan hitung Python
cd data-analytics
uv run uvicorn data_analytics.api:app --host 127.0.0.1 --port 8001

# T4 — Vite
cd siap-osn-fe
bun run dev
```

> Jangan pakai `docker-compose.dev.yml` di `data-analytics` — memakai port
> host 8000 dan akan bertabrakan dengan `artisan serve`.

### 4.1 Cek cepat

```bash
lsof -nP -iTCP:8000 -iTCP:8001 -iTCP:5173 -sTCP:LISTEN
pgrep -f "queue:work"
```

Lalu uji masing-masing:

```bash
# Python (harus nilai 100)
curl -s -X POST http://127.0.0.1:8001/hitung/penilaian \
  -H "X-Internal-Token: $(grep '^INTERNAL_API_TOKEN=' data-analytics/.env | cut -d= -f2-)" \
  -H 'Content-Type: application/json' \
  -d '{"soal":[{"soal_id":1,"tipe_soal":"pilihan_ganda","bobot":1,"jawaban_user":"A","kunci_jawaban":"A"}]}'

# Laravel (harus token)
curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d '{"email":"siswa@example.com","password":"password"}'

# Vite
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/
```

### 4.2 Persiapan data (sekali)

```bash
cd Osn-Readiness-Web
php artisan storage:link          # tanpa ini gambar soal/materi 404
DB_HOST=127.0.0.1 php artisan migrate:fresh --seed
```

`--seed` mengisi role, permission, tingkat, aturan pemetaan, akun
Super Admin, dan konten contoh. **Perintah ini menghapus data dev.**

Akun hasil seed:
- siswa: `siswa@example.com` / `password`
- admin: `admin@example.com` / `password`

---

## 5. Menjalankan test

### 5.1 Gate FE (wajib sebelum commit)

```bash
cd siap-osn-fe
bunx eslint . && bun run test:unit && bun run build
```

Jangan pakai `bun test` atau `bunx --bun vitest`.

### 5.2 Gate BE

```bash
cd Osn-Readiness-Web
DB_HOST=127.0.0.1 composer test
vendor/bin/pint --test
```

### 5.3 Kontrak Python

```bash
cd data-analytics
uv run pytest tests/test_api_hitung.py -q     # 19 passed
```

### 5.4 E2E Playwright

```bash
cd siap-osn-fe
bunx playwright test                        # semua spec
bunx playwright test e2e/auth.spec.js       # satu spec
bunx playwright test -g "logout"            # satu test
bunx playwright test --headed               # lihat browsernya
bunx playwright show-report                 # buka laporan HTML
```

### 5.5 Saat test gagal

Artefak ada di `test-results/<nama-test>/`:

| File | Isi |
| --- | --- |
| `screenshot.png` | tampilan layar saat gagal |
| `error-context.md` | **snapshot halaman dalam YAML** — paling berguna, langsung terlihat elemen mana yang tak muncul |
| `trace.zip` | rekaman langkah; buka dengan `npx playwright show-trace <path>` |

Cara baca kegagalan biasa:

| Gejala | Artinya |
| --- | --- |
| `ECONNREFUSED ::1:5173` | Vite mati — nyalakan T4 |
| `expect(201).toBe(201)` dari `buatSiswaBaru` | Laravel mati |
| Preflight gagal di awal | salah satu dari 4 proses mati; pesan menyebut yang mana |
| `strict mode violation` | locator ambigu — pakai `#id` atau persempit regex |
| `waiting for getByRole('button', ...)` | teks tombol berubah saat loading; klik `button[type="submit"]` |

---

## 6. Test case yang tersedia

### 6.1 `e2e/auth.spec.js` — 10 test

| # | Test | Yang diuji |
| --- | --- | --- |
| 1 | register akun baru, lalu login dan melihat banner belum pre-test | `/register` → `/login` → `/siswa`; banner "belum mengikuti tes pemetaan awal" |
| 2 | register menolak email yang sudah dipakai | pesan `Email sudah terdaftar` (422 per kolom) |
| 3 | login salah memberi pesan jelas, bukan crashing | toast "Email atau password salah" |
| 4 | guard menahan anonim dari halaman siswa dan admin | 3 path → semua ke `/login` |
| 5 | guard menahan siswa dari halaman admin | → `/forbidden` |
| 6 | guard menahan admin dari halaman siswa | → `/forbidden` |
| 7 | logout mengosongkan session lalu halaman terlindungi kembali | `/admin` → logout → `/admin` → `/login` |
| 8 | ganti akun tidak meninggalkan sisa data pre-test | **regresi Fase 2.8**: akun kedua tidak boleh mewarisi `siap_osn_pretest_aktif` |
| 9 | lupa kata sandi tidak pernah mengirim request | mengunci perilaku palsu (lihat §8) |
| 10 | ubah kata sandi di halaman profil tidak mengirim request | idem |

### 6.2 Helper di `e2e/helpers.js`

| Fungsi | Gunanya |
| --- | --- |
| `buatSiswaBaru(request, label)` | daftar akun unik lewat API, kembalikan `{ email, password }` |
| `isiFormLogin(page, akun)` | isi + submit `#login-form` |
| `isiFormRegister(page, {...})` | isi + submit; **wajib centang persetujuan layanan** |
| `loginSiswa(page, akun)` / `loginAdmin(page)` | login lalu tunggu URL |
| `logout(page)` | klik menu user → Keluar; menangani dua bentuk tombol |
| `tokenUntuk(request, akun)` | ambil token Bearer untuk seeding |
| `seedPutaranSelesai(request, token)` | pre-test + submit via API |
| `jawabSemua(request, token, basePath, id, soal)` | isi jawaban semua soal |
| `penuhiSyaratSimulasi(request, token)` | tandai materi wajib selesai + kerjakan latihan |

> `basePath` untuk `jawabSemua` **tanpa** prefix `/api` dan tanpa domain,
> mis. `'/pretest'`.

### 6.3 Prasyarat tiap test

Semua test butuh keempat proses hidup dan akun seed sudah ada.

`auth.spec.js` tidak perlu data tambahan: setiap test membuat akunnya
sendiri lewat `buatSiswaBaru()` dengan email unik. Spec fitur berikutnya
kemungkinan butuh seeding (mis. pre-test harus selesai dulu agar dashboard
tidak menampilkan banner "belum pre-test") — pakailah helper yang tersedia,
jangan seeding manual di dalam spec.

---

## 7. Test case yang BELUM ada

Baru autentikasi yang punya spec E2E. Berikutnya belum ditulis:

| Fitur | Yang perlu diuji (prioritas) |
| --- | --- |
| Pre-test | mulai, jawab, **reload mempertahankan jawaban**, submit → pemetaan; status "sedang dinilai" saat 503 |
| Materi + latihan | tombol latihan muncul (butuh `quiz_id`); latihan materi B tidak menampilkan soal materi A |
| Simulasi | **countdown dari `batas_pada`**, reload tidak mereset timer, syarat belum terpenuhi → tombol nonaktif, WAKTU_HABIS → auto-submit, pagination hasil |
| Riwayat | filter jenis, judul memuat nama tingkat, baris simulasi tertaut |
| Progress | ringkasan, rincian syarat per materi wajib |
| Pemetaan | **refresh `/siswa/pemetaan` tanpa id harus tetap terisi** (regresi Fase 5.1) |
| Admin | 6 modul: form tambah/ubah, 409 `*_MASIH_DIGUNAKAN`, pagination |

Tiga bagian di atas yang paling rapuh dan belum pernah dirender:
1. **Countdown simulasi** dihitung dari `batas_pada` server — kalau ada
   kesalahan timezone, hanya terlihat di UI.
2. **Polling "sedang dinilai"** harus berhenti saat `onBeforeUnmount`,
   tidak boleh double-submit.
3. **Submit form admin** — 6 halaman dengan banyak field; belum pernah
   diklik sungguhan.

### Cara menambah spec

```js
import { expect, test } from '@playwright/test'
import { buatSiswaBaru, loginSiswa, seedPutaranSelesai, tokenUntuk } from './helpers.js'

test('contoh: pre-test menampilkan 30 soal', async ({ page, request }) => {
  const akun = await buatSiswaBaru(request, 'pretest.contoh')
  const token = await tokenUntuk(request, akun)
  await seedPutaranSelesai(request, token)     // seeding via API, lalu UI dicek
  await loginSiswa(page, akun)
  await page.goto('/siswa/pretest')
  await expect(page.getByText(/soal 1 dari 30/i)).toBeVisible()
})
```

Aturan yang perlu dijaga:
- **Pakai locator yang stabil**: `#id` lebih baik daripada teks. Teks tombol
  berubah saat loading (mis. "Masuk ke Akun" → "Memproses").
- **Pakai `getByRole`/`getByLabel` hanya bila unik.** Label "Kata Sandi"
  juga cocok dengan tombol "Tampilkan kata sandi".
- **Seeding lewat API, assertion lewat UI.** Lebih cepat dan tidak rapuh
  terhadap perubahan bentuk respons.
- **Pakai satu nama email unik** (lewat `emailUnik()`) supaya spec bisa diulang.
- Kalau memang sedang menguji kondisi tidak ideal (form yang belum
  terintegrasi), **tuliskan alasannya di nama test dan di komentar** —
  supaya tidak berubah diam-diam.

---

## 8. Perilaku yang sengaja dikunci (bukan bug baru)

Tiga hal di bawah **masih salah** dan tesnya sengaja mengunci perilaku
saat ini. Kalau suatu saat diperbaiki, test ini harus ikut diperbarui.

| Yang dipalsukan | Bukti | Test |
| --- | --- | --- |
| Lupa kata sandi | `await new Promise(r => setTimeout(r, 500))` lalu toast sukses — tanpa request | `auth.spec.js` #9 |
| Reset kata sandi | pola `setTimeout` yang sama | belum ada |
| Ubah kata sandi di profil | `// TODO: panggil API ubah kata sandi`, field dikosongkan tanpa request | `auth.spec.js` #10 |

Ketiganya butuh endpoint backend dulu (keputusan #1 di plan §7.2).
Saran di plan: **(b) sembunyikan formnya** untuk rilis ini.

Dua implementasi yang berbeda muncul saat menulis test:

| Observasi | Yang terjadi |
| --- | --- |
| Register tidak langsung ke dashboard | `RegisterForm.vue` mengarahkan ke `/login` setelah 1,2 detik — jadi spec harus login lagi |
| Logout ada dua bentuk | Sidebar `UserMenu` (perlu klik tombol akun dulu) vs tombol langsung di `DashboardView` admin |

---

## 9. Kalau test E2E gagal padahal API sehat

Test E2E paling sering gagal karena hal yang tidak terlihat dari API:

1. **Elemen tidak muncul** → baca `error-context.md`, cari bagian yang
   tidak sesuai harapan.
2. **Waktu habis (timeout 15–30 detik)** → cek Network di trace; mungkin
   request yang menggantung. Buka `trace.zip` dengan
   `npx playwright show-trace`.
3. **Hanya gagal di headed** → biasanya elemen menutupi yang lain (z-index).
4. **Flaky** → coba `--repeat-each=3`. Kalau kadang lulus kadang gagal,
   kemungkinan besar ada race condition di aplikasi — bukan masalah test.

---

## 10. Ringkasan gate sebelum bilang "selesai"

```bash
# FE
cd siap-osn-fe
bunx eslint . && bun run test:unit && bun run build
bunx playwright test

# BE
cd Osn-Readiness-Web
DB_HOST=127.0.0.1 composer test && vendor/bin/pint --test

# Python
cd data-analytics
uv run pytest tests/test_api_hitung.py -q
```

Status terakhir yang tercatat di plan (7 Oktober 2026): FE 159/159 unit,
BE 448/448, Python 19/19. Untuk E2E `auth.spec.js`, hasil terakhir yang
sudah dijalankan adalah **8 dari 10 lulus** — dua test terkait logout sudah
diperbaiki di kode tapi belum sempat dijalankan ulang. Jalankan
`bunx playwright test` lebih dulu untuk melihat status sebenarnya.
