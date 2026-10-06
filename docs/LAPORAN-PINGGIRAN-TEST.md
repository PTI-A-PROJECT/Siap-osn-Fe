# Laporan Pinggiran Test - Device Windows (Docker Desktop)

Hasil satu sesi setup + perbaikan di device **Windows 11 + Docker Desktop**. Isinya
catatan semua yang **tidak** ada di `MENJALANKAN-TESTING.md`, karena dokumen itu ditulis
dengan asumsi Linux/macOS.

> **Status: belum di-commit.** Semua perubahan masih di working tree, menunggu review.
> Setelah disetujui, pecah jadi beberapa commit terpisah (lihat §7).

---

## 1. Ringkasan hasil

| Gate | Catatan di plan | Hasil di device ini |
| --- | --- | --- |
| FE unit test | 159/159 | 159/159 |
| FE eslint | - | bersih |
| FE build | - | OK |
| BE test | 448/448 | 448/448 |
| Pint | - | PASS 395 files |
| Python test | 19/19 | 19/19 |
| E2E `auth.spec.js` | 8/10 | **10/10** |
| E2E `pretest.spec.js` | belum ada | **6/6** (baru) |
| E2E `simulasi.spec.js` | belum ada | **5/5** (baru) |
| Smoke check | belum ada | **21/21** (baru) |

Total E2E **21/21**. Semua service lewat Docker Sail + proses host.

---

## 2. Yang berbeda di device ini

`MENJALANKAN-TESTING.md` mengasumsikan device Unix. Lima hal di sini tidak sesuai:

| Asumsi dokumen | Kenyataan device ini | Dampak |
| --- | --- | --- |
| PHP 8.4+ di host | Hanya **8.3.30** (Laragon) | `composer install` gagal, `composer test` di host mustahil |
| `pgrep` tersedia | Tidak ada di Windows | Preflight E2E selalu gagal |
| `curl -o /dev/null` | `curl.exe` tidak bisa tulis ke `/dev/null` | Preflight salah baca proses hidup sebagai mati |
| Argumen curl single-quote | `cmd.exe` tidak memaknai single quote | `-w '%{http_code}'` keluarkan `'200'` (kutip ikut terbaca) |
| `PERHITUNGAN_URL=http://localhost:8001` | Laravel jalan di dalam container | `localhost` = container itu sendiri, Python tak terjangkau |

### Kenapa PHP host harus 8.4 padahal constraint-nya `^8.3`

`composer.json` masih mendeklarasikan `require.php: ^8.3` dan lockfile tidak memakai
`config.platform`. Yang memaksa 8.4 adalah paket di dalam lock:

- `symfony/console`, `symfony/http-foundation`, `symfony/routing`, dan seterusnya
  terkunci ke `v8.1.x`
- paket-paket itu mensyaratkan `php >= 8.4.1`

Jadi lockfile dan constraint proyek tidak sinkron. Ini bukan masalah device ini saja --
di device mana pun `composer install` akan gagal selama lockfile masih di sana.
Plan §7.2 keputusan #5 sudah membahas kenaikan constraint proyek ke `^8.4`;
perlu dikerjakan agar `composer.json` dan lockfile sinkron.

### Keputusan arsitektur yang dipakai

- **Laravel + Postgres -> Docker Sail** (PHP 8.5, memenuhi lockfile)
- **Python layanan hitung -> proses host** di `127.0.0.1:8001`
- **Vite -> proses host** di `5173`
- Laravel menjangkau Python lewat **`host.docker.internal:8001`**, bukan `localhost`

### Prasyarat di device baru

```bash
# Python: .venv dibuat otomatis oleh uv run
cd data-analytics && uv --version

# Node
bun -v

# Composer TIDAK dipakai di host (PHP 8.3 < 8.4 yang diminta lockfile).
# Dependensi di-install dengan:
#   composer install --no-scripts --ignore-platform-req=php
# lalu semua perintah artisan lewat Sail.
```

---

## 3. Loopbacks dan port

| Service | Port host | Cara jalan |
| --- | --- | --- |
| Laravel | 8000 | Docker Sail (`APP_PORT=8000` -> container 80) |
| Postgres | 5432 | Docker Sail (`FORWARD_DB_PORT=5432`) |
| Python hitung | 8001 | host, `uv run uvicorn` |
| Vite | 5173 | host, `bun run dev` |
| queue worker | - | dalam container Sail |

`VITE_PORT` sengaja diarahkan ke `5174`. Mapping `VITE_PORT` di `compose.yaml` dipakai
untuk menjalankan Vite **di dalam** container; karena kita menjalankannya di host, mapping
itu justru merebut port 5173 dan membuat Vite bind ke alamat non-wildcard -- akibatnya
`http://localhost:5173` gagal (tapi `127.0.0.1:5173` jalan), dan preflight gagal.

---

## 4. Bug yang ditemukan dan diperbaiki

### 4.1 `res.json()` tidak di-`await` - `e2e/helpers.js`

**Gejala:** `TypeError: Cannot read properties of undefined (reading 'token')` padahal
HTTP 200 dan body jelas berisi `data`.

**Penyebab sebenarnya:** `APIResponse.json()` mengembalikan **Promise**
(`json(): Promise<T>` di `playwright-core/types/types.d.ts`). Kode lama
`res.json().data.token` tidak meng-`await` hasilnya, jadi `.data` yang diakses
memang `undefined`. Kode itu tidak pernah bisa jalan sejak awal -- ini bug laten,
bukan sesuatu yang muncul karena perubahan lain.

**Perbaikan:** `const body = await res.json()` lalu `body.data.token`. Diterapkan di
`tokenUntuk`, `seedPutaranSelesai`, dan `penuhiSyaratSimulasi`. Ketiganya sekaligus
sekarang menyertakan body respons di pesan kegagalan supaya mudah didiagnosis.

### 4.2 `count()` tidak auto-wait - `e2e/helpers.js` (`logout`)

**Gejala:** `TimeoutError: waiting for getByRole('button', {name:/keluar/i})`.

**Penyebab:** `locator.count()` mengembalikan jumlah elemen **saat itu juga** tanpa
menunggu. Kalau `UserMenu` belum ter-mount, `count()` = 0, code jatuh ke cabang `else`
yang mencari tombol "Keluar" yang memang tidak ada di halaman siswa.

**Perbaikan:** `waitFor({ state: 'visible', timeout: 5000 })` lalu `isVisible()`.

### 4.3 Indikator "Tersimpan" bersifat optimistic - `src/views/siswa/PretestView.vue`

**Gejala:** test "reload mempertahankan jawaban" gagal, jawaban hilang setelah reload.

**Penyebab:** `.tersimpan` dibaca dari state lokal `jawaban` yang terisi seketika saat
opsi diklik, sementara `simpanJawaban()` di-debounce. Menunggu `.tersimpan` lalu reload
bisa terjadi sebelum `PUT` benar-benar dikirim.

**Status: BELUM diperbaiki di aplikasi.** Yang(done) hanya di sisi test: tunggu respons
API, bukan indikator UI:

```js
const tersimpan = page.waitForResponse(
  (r) => r.request().method() === 'PUT' && /\/api\/pretest\/\d+\/jawaban/.test(r.url()),
)
await opsi.click()
await tersimpan
```

Masalah UX aslinya masih ada untuk pengguna: label "Tersimpan" muncul sebelum data benar
-benar tersimpan. Store sudah punya `simpanError`, tapi belum ada state "menyimpan".
Lihat §8 butir 2.

### 4.4 `PemetaanKompetensiView` tidak pernah memuat hasil - **bug aplikasi**

**Gejala:** `/siswa/pemetaan` tanpa id tersangkut di "Memuat hasil pre-test..." selamanya.
`GET /pretest/{id}` tidak pernah dikirim.

**Penyebab:** halaman memanggil `router.replace({ params: { id } })` dari dalam
`onMounted`. Vue Router **memakai ulang instance komponen** bila yang berubah hanya
param, jadi `onMounted` tidak dipanggil ulang untuk
`/siswa/pemetaan` -> `/siswa/pemetaan/{id}`.

Ini adalah **regresi Fase 5.1** yang sudah dicatat di `MENJALANKAN-TESTING.md` §7
sebagai "belum ada testnya" -- jadi kemungkinan sudah lama ada.

**Perbaikan:** `watch(() => route.params.id, muatHasil, { immediate: true })`.
Sengaja `watch` dan bukan `watchEffect`: `muatHasil()` menulis ke store pretest, dan
kalau dependensinya ikut dipantau, penulisan itu memicu dirinya sendiri tanpa henti.

### 4.5 Preflight tidak jalan di Windows - `e2e/global-setup.js`

Tiga masalah terpisah:

1. `curl.exe` tidak bisa menulis ke `/dev/null` -- dia membuka path itu sebagai file
   biasa (`C:\dev\nul`), gagal, lalu keluar dengan kode bukan 0. `execSync` memakai
   *exit code*, bukan isi stdout, sehingga proses hidup terbaca mati.
2. `execSync` memakai `cmd.exe`, yang **tidak** memaknai single quote.
3. `pgrep` tidak ada di Windows -- dan karena worker queue ada **di dalam container**,
   `pgrep` host tidak akan pernah menemukannya.

**Perbaikan:** null device `NUL` di win32, semua argumen curl memakai double quote,
dan cek queue worker lewat `docker compose exec`. Folder compose bisa dioverride lewat
env `LARAVEL_COMPOSE_DIR`.

### 4.6 Baseline di-reset sebelum `networkidle` - `e2e/auth.spec.js` (test #10)

**Gejala:** flaky -- lulus saat dijalankan sendirian, gagal saat jadi bagian suite penuh.

**Penyebab:** `requests.length = 0` menyisakan request bawaan halaman yang masih
in-flight, lalu ikut terhitung.

**Perbaikan:** `await page.waitForLoadState('networkidle')` **sebelum** mengosongkan basal.

### 4.7 ESLint tidak deklarasikan `globals.node` - `eslint.config.js`

**Gejala:** `bunx eslint .` gagal dengan `'process' is not defined` di
`playwright.config.js`, `e2e/**`, dan `scripts/**`.

**Penyebab:** config hanya mendaftarkan `globals.browser`, padahal file-file itu
dijalankan Node.

**Perbaikan:** blok config terpisah untuk `playwright.config.js`, `e2e/**/*.js`, dan
`scripts/**/*.mjs`.

### 4.8 Akun `siswa@example.com` tidak pernah dibuat

**Gejala:** preflight E2E selalu `401`, dan test "register menolak email yang sudah
dipakai" tidak punya akun yang sudah terdaftar.

**Penyebab:** `KontenContohSeeder` hanya membuat konten (kompetensi, materi, quiz,
simulasi) -- **tidak membuat user**. Satu-satunya user dari seed adalah
`admin@example.com` dari `SuperAdminSeeder`.

Ini membuat klaim `MENJALANKAN-TESTING.md` §4.2 ("siswa: `siswa@example.com`") tidak
benar.

**Perbaikan:** `database/seeders/SiswaContohSeeder.php` baru.

### 4.9 `SiswaContohSeeder` harus di-limit ke local/testing

**Risiko:** kalau `SiswaContohSeeder` dipanggil tanpa syarat, `migrate --seed` di
production akan membuat akun `siswa@example.com` dengan password yang diketahui publik.

**Perbaikan:** dipindahkan ke dalam blok `app()->environment('local', 'testing')` yang
sudah ada di `DatabaseSeeder` (berbaris dengan `KontenContohSeeder`).

### 4.10 `PERHITUNGAN_URL` tidak terjangkau dari container

**Gejala:** `WARNING: Layanan hitung sedang tidak tersedia ... koneksi gagal atau
melewati timeout 5 detik`. Semua submit pre-test berakhir nilai `null`.

**Penyebab:** `.env` memakai `http://localhost:8001`, benar hanya kalau Laravel jalan di
host. Di dalam container, `localhost` adalah container itu sendiri.

**Perbaikan:** `PERHITUNGAN_URL=http://host.docker.internal:8001`. Nilai di
`.env.example` **tidak diubah** (tim lain masih jalan di host); hanya menambah komentar
penjelasan.

### 4.11 OPcache CLI mati - **penyebab utama test lambat**

**Gejala:** request ke Laravel sesekali macet **2-5 detik** secara periodik, dan E2E
gagal karena timeout.

**Penyebab:** Sail menjalankan `php artisan serve` (server built-in `php -S`), dan
`opcache.enable_cli` bawaannya `Off`. Setiap request meng-compile ulang semua file PHP
dari bind-mount Windows (lebih lambat lewat WSL2/virtiofs), termasuk revalidasi
timestamp yang periodik.

Diukur dengan `GET /up`, 25 request berurutan:

| | rata-rata | slowest | lambat > 1s |
| --- | --- | --- | --- |
| tanpa override | 1153 ms | 5416 ms | 6 dari 25 |
| dengan override | **235 ms** | **432 ms** | **0 dari 25** |

Dampaknya: BE suite 669s -> 237s, E2E dari timeout menjadi stabil.

**Perbaikan:** `docker/php-cli-opcache.ini` (ikut ter-commit) +
`docker-compose.override.example.yml` (ikut ter-commit, untuk disalin).
`docker-compose.override.yml` yang aktif sudah masuk `.gitignore`.

> **Tradeoff yang harus disepakati:** `opcache.validate_timestamps=0` berarti
> **perubahan pada file PHP/Blade tidak terlihat** sampai
> `docker compose restart laravel.test`. Kalau lebih suka hot-reload dan siap
> menerima stall sebentar, ubah `validate_timestamps` jadi `1` dan `revalidate_freq`
> jadi `60`.

### 4.12 `public/build` belum pernah di-build

**Gejala:** 7 test BE gagal dengan `ViteManifestNotFoundException: Vite manifest not
found at: public/build/manifest.json`.

**Penyebab:** `node_modules` dan `public/build` tidak ada di device ini.

**Perbaikan:** `npm install && npm run build` di `Osn-Readiness-Web`.

### 4.13 Chromium Playwright gagal diunduh

**Gejala:** `Failed to download Chrome for Testing 153.0.8010.12 ... Download failure,
code=1`, dengan `Socket.onRequestTimeout`.

**CDN tidak rusak.** `https://cdn.playwright.dev/builds/cft/...` membalas `200`/`206`
normal. Yang gagal adalah unduhan lewat Node HTTPS. Menaikkan
`PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT` tidak menolong.

**Workaround:** Chromium + headless shell diunduh manual dengan `curl` (~310 MB),
diekstrak ke `%LOCALAPPDATA%\ms-playwright\`, lalu dibuat file marker
`INSTALLATION_COMPLETE` di masing-masing folder. Akar masalah Node-nya belum ditemukan,
jadi ini solusi praktis, bukan perbaikan.

> Kalau `bunx playwright install chromium` normal di device lain, abaikan workaround ini.

---

## 5. Temuan dari smoke check (`scripts/smoke-report.mjs`)

Alat baru yang menelusuri 21 langkah dari landing sampai 404, screenshot tiap langkah,
lalu menulis `reports/smoke-<timestamp>/laporan.md`. Tiga masalah ditemukan oleh alat
ini yang tidak terlihat dari `playwright test`:

### 5.1 Bug di alatnya sendiri: session hilang di tengah alur

Run pertama melaporkan 6 dari 19 langkah GAGAL, semuanya terlempar ke
`/login?redirect=...`.

**Penyebab:** `langkah()` membuat `browser.newContext()` baru tiap langkah, jadi
session login hilang begitu langkah 04 selesai. Yang "lolos" juga palsu -- langkah yang
hanya `goto` tanpa assert apa pun tetap dihitung sukses meski sudah di-redirect.

**Perbaikan:** satu context dan satu page untuk seluruh alur. Listener juga dipasang
sekali dan menulis ke collector yang di-reset per langkah.

### 5.2 Assertion lemah memberi false OK

Langkah "Mulai simulasi" hanya 580ms dan ditandai OK, padahal screenshot masih
menangkap modal yang belum hilang dan latar "Menyiapkan simulasi...".
`waitFor('Sisa Waktu:')` kena di header, sebelum soal render.

**Perbaikan:** tunggu `.opsi, .uraian` (atau `button:has(b)` untuk simulasi, karena
`UjianSimulasiView` tidak punya class semantik) **dan** tunggu timer bukan `00:00`.
Langkahnaik dari 580ms ke 1271ms setelah diperkeras.

### 5.3 Bug aplikasi (kosmetik): timer flash `00:00` merah

Di `UjianSimulasiView.vue:63`, `const sisaDetik = ref(0)` -- nilai awal 0 tampil sebelum
`batas_pada` termuat, dan styling `sisaDetik <= 300` membuatnya merah. Student melihat
"Sisa Waktu: 00:00" merah sesaat setelah mulai, padahal masih punya 120 menit.

**Status: BELUM diperbaiki.** Tidak berbahaya secara fungsional: auto-submit dijaga
`if (!simulasi.batasPada) return` di `hitungSasa()`. Perbaikan satu baris kalau
disepakati: `v-if="sisaDetik > 0"` di span timer.

---

## 6. File yang berubah (belum di-commit)

### `Siap-osn-Fe/` - branch `integrasi`

```
 M .gitignore                              # + /reports/
 M e2e/auth.spec.js                        # §4.6
 M e2e/global-setup.js                     # §4.5
 M e2e/helpers.js                          # §4.1, §4.2
 M eslint.config.js                        # §4.7
 M src/views/siswa/PemetaanKompetensiView.vue   # §4.4
 ?? docs/LAPORAN-PINGGIRAN-TEST.md         # dokumen ini
 ?? e2e/pretest.spec.js                    # baru, 6 test
 ?? e2e/simulasi.spec.js                   # baru, 5 test
 ?? scripts/smoke-report.mjs               # baru
```

`reports/` sudah di-ignore, jadi folder hasil run tidak ikut muncul.

### `Osn-Readiness-Web/` - branch `dev`

```
 M .env.example                            # §4.10 - 2 variabel baru + komentar
 M .gitignore                              # + /docker-compose.override.yml
 M database/seeders/DatabaseSeeder.php     # §4.9
 ?? database/seeders/SiswaContohSeeder.php  # §4.8, §4.9
 ?? docker/php-cli-opcache.ini             # §4.11
 ?? docker-compose.override.example.yml    # §4.11
```

Tidak ada perubahan di `data-analytics/`.

### Catatan `.env.example`

§4.10 menyebut "nilai tidak diubah", dan itu benar untuk `PERHITUNGAN_URL`. Tapi diff
juga **menambah dua variabel baru** untuk §4.8:

```
SISWA_CONTOH_EMAIL=siswa@example.com
SISWA_CONTOH_PASSWORD=password
```

Jadi ".env.example hanya tambah komentar" adalah tidak benar -- isinya dua variabel
baru plus komentar.

---

## 7. Usulan pemecahan commit

| # | Repo | Pesan |
| --- | --- | --- |
| 1 | `Siap-osn-Fe` | `test(e2e): perbaikan portability Windows dan race condition helper` (§4.1, 4.2, 4.5, 4.6, 4.7) |
| 2 | `Siap-osn-Fe` | `fix(pemetaan): muat ulang hasil saat route berubah` (§4.4) |
| 3 | `Siap-osn-Fe` | `test(e2e): spec pretest dan simulasi` (spec baru) |
| 4 | `Siap-osn-Fe` | `chore(smoke): alat cek alur dengan laporan + screenshot` (§5) |
| 5 | `Osn-Readiness-Web` | `fix(seeder): akun siswa contoh khusus local dan testing` (§4.8, §4.9) |
| 6 | `Osn-Readiness-Web` | `chore(docker): OPcache CLI untuk bind-mount Windows` (§4.11) |

`docker-compose.override.yml` **tidak** ikut commit -- sudah masuk `.gitignore`. Yang
ikut commit `docker-compose.override.example.yml`.

---

## 8. Keputusan yang masih terbuka

1. **`opcache.validate_timestamps=0`** -- cepat dan stabil, tapi edit PHP tidak terlihat
   tanpa restart container. Setuju, atau ganti ke `revalidate_freq=60`?
2. **Label "Tersimpan" menyesatkan** (§4.3) -- test sudah_waiting respons API, tapi
   UX-nya belum diperbaiki. Tambahkan state "menyimpan", atau ubah label?
3. **Timer simulasi flash `00:00` merah** (§5.3) -- perbaiki dengan `v-if="sisaDetik > 0"`?
4. **`npm audit` di `Osn-Readiness-Web`: 8 vulnerability** (2 moderate, 6 high). Tidak
   disentuh karena `npm audit fix --force` berpotensi merusak breaking changes.
5. **Constraint PHP tidak sinkron** (§2) -- lockfile minta 8.4.1 tapi `composer.json`
   masih `^8.3`. Perlu `composer update` untuk menyelaraskan, dan itu menyentuh
   banyak paket.
6. **Preflight wajib Docker** -- dengan `QUEUE_CHECK=host` sudah ada opsi untuk tim yang
   menjalankan Laravel di host, tapi default-nya masih `docker`.
7. **Dokumen ini sebaiknya bagian dari `MENJALANKAN-TESTING.md`, bukan dokumen
   terpisah** -- selama baris `pgrep` dan contoh `curl` single-quote di sana tetap
   menyesatkan.

---

## 9. Cara menjalankan test di device ini

Empat proses harus hidup sebelum test apa pun (preflight di `global-setup.js` akan
memeriksa dan menyebut mana yang kurang):

```bash
# T1 -- Laravel + Postgres (Sail)
cd Osn-Readiness-Web
docker compose up -d
docker compose exec -d laravel.test php artisan queue:work --tries=3

# T2 -- migrate + seed (MENGHAPUS data dev)
docker compose exec laravel.test php artisan migrate:fresh --seed

# T3 -- layanan hitung Python (host)
cd data-analytics
uv run uvicorn data_analytics.api:app --host 127.0.0.1 --port 8001

# T4 -- Vite (host)
cd Siap-osn-Fe
bun run dev
```

Lalu jalankan test:

```bash
# FE
cd Siap-osn-Fe
bunx eslint . && bun run test:unit && bun run build
bunx playwright test

# Smoke check: alur 21 langkah + screenshot + laporan
node scripts/smoke-report.mjs
node scripts/smoke-report.mjs --headed   # lihat browsernya

# BE -- lewat Sail, bukan `composer test` (PHP host 8.3 < 8.4)
cd Osn-Readiness-Web
docker compose exec laravel.test php artisan test
docker compose exec laravel.test vendor/bin/pint --test

# Python
cd data-analytics
uv run pytest tests/test_api_hitung.py -q
```

Akun hasil seed:

| Peran | Email | Password |
| --- | --- | --- |
| Super Admin | `admin@example.com` | `password` |
| Siswa | `siswa@example.com` | `password` |

> Keduanya hanya tercipta di environment `local` dan `testing` (§4.9).

> `queue:work` **mati setiap kali container di-restart**. Kalau restart, jalankan
> ulang perintah `exec -d` -- kalau tidak, preflight akan gagal dengan
> "queue worker".
