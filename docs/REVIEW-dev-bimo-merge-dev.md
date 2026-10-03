# Review PR `dev-bimo` → `dev`

Status: **belum aman di-merge** — ada 2 bug yang memblokir.
Tanggal review: 2026-09-29
Dasar review: `origin/dev-bimo` = commit `9aae7cf`

---

## 1. Ringkasan

`dev-bimo` berisi 2 commit dari 2 orang. Pembagian file-nya bersih,
tidak ada file yang sama disentuh dua orang.

```
9aae7cf  (Bimo)  Menambahkan halaman register
79d9ca3  (Ibra)  landingpage(belum dipisah html,css,jsnya)
5273f55  (main)  chore: lanjutkan                     ← base
```

`dev-ibra` sudah tercakup penuh di `dev-bimo`, dibuktikan dengan:

```bash
git merge-base --is-ancestor origin/dev-ibra origin/dev-bimo   # exit 0
```

Jadi `dev-ibra` tidak perlu di-merge terpisah dan boleh dihapus setelah
PR ini selesai.

### Pembagian file

| File | Commit | Owner | +/− |
|---|---|---|---|
| `src/views/LandingPage.vue` | `79d9ca3` | Ibra | 929 / 0 (baru) |
| `src/App.vue` | `79d9ca3` | Ibra | 1 / 1 |
| `src/router/index.js` | `79d9ca3` | Ibra | 10 / 9 |
| `src/stores/auth.js` | `79d9ca3` | Ibra | 9 / 8 |
| `index.html` | `79d9ca3` | Ibra | 3 / 0 |
| `package-lock.json` | `79d9ca3` | Ibra | 6601 / 0 |
| `src/views/RegisterView.vue` | `9aae7cf` | Bimo | 583 / 15 |
| `src/layouts/AuthLayout.vue` | `9aae7cf` | Bimo | 6 / 2 |

Total terhadap `dev`: 8 file, +8142 / −35.

---

## 2. Hasil verifikasi

Dijalankan di worktree sementara pada commit `9aae7cf`.

| Pemeriksaan | Sebelum | Sesudah patch §4 |
|---|---|---|
| `bun run test:unit` | ❌ 1 gagal / 10 | ✅ 10 / 10 |
| `bun run lint` | ❌ 1 error | ✅ bersih |
| `bun run build` | ✅ | ✅ |

Test yang gagal sebelum patch:

```
FAIL  src/stores/auth.spec.js > auth store > fetchMe sukses mengisi user dan initialized
AssertionError: expected null to deeply equal { id: '1', nama: 'Budi', …(3) }
```

---

## 3. Bug pemblokir

### 3.1 `fetchMe` — semua user ter-logout saat refresh (Ibra)

`src/stores/auth.js:20` pada `dev-bimo`:

```js
// sesuaikan dengan bentuk respons backend-mu, misalnya data.user atau data.data
user.value = data?.user ?? null
```

Bentuk respons yang sebenarnya adalah `data.data`, bukan `data.user`.
Dua bukti:

1. `docs/ARCHITECTURE_RULES.md` §2 menetapkan envelope sukses
   `{ success: true, message, data }`, dan tabel kontrak menyatakan
   `GET /auth/me` → data = `user`.
2. `login()` di file yang sama (`src/stores/auth.js:27`) memakai
   `data.data.user` dan itu benar — keduanya mengikuti envelope yang sama.

Dampak: `user` selalu `null` setelah halaman di-refresh, sehingga guard
melempar semua orang ke `/login` dan dashboard tidak bisa diakses.
Membatalkan login dan sesi yang sedang berjalan.

Komentar di atas baris itu menandakan belum pernah diverifikasi
("sesuaikan dengan bentuk respons backend-mu"), bukan keputusan sadar.

### 3.2 `App.vue` — `<Toast />` tidak bisa resolve (Ibra)

`src/App.vue` pada `dev-bimo`:

```vue
<script setup>
import LandingPage from './views/LandingPage.vue'
</script>

<template>
  <Toast />
  <RouterView />
</template>
```

Dua masalah sekaligus:

- Import `Toast` dihapus, tapi `<Toast />` masih dipakai di template.
  `ToastService` yang diregistrasikan di `src/main.js:16` **tidak**
  mendaftarkan komponen global — `node_modules/primevue/toastservice/index.mjs`
  hanya melakukan `provide` symbol dan menambah `$toast`. Jadi `<Toast />`
  menjadi unresolved component dan **semua notifikasi hilang** di aplikasi.
- Import `LandingPage` ditambahkan tapi tidak pernah dipakai di template.
  Inilah sumber error lint `'LandingPage' is defined but never used`.

Dampak ke fitur Bimo — alurnya putus di tengah:

```
RegisterView.daftar()  → toast.add('Registrasi berhasil', …)
                                              src/views/RegisterView.vue:41
        ↓
App.vue <Toast />      ← import dihapus di 79d9ca3
        ↓
notifikasi tidak pernah tampil
```

User daftar akun → sukses → tidak ada konfirmasi apa pun, hanya redirect
diam ke `/login`. Dan karena 3.1, guard akan melempar balik ke `/login` juga.

---

## 4. Patch perbaikan (sudah diverifikasi)

4 file, +15 / −6611. Tidak menyentuh `LandingPage.vue`,
`RegisterView.vue`, maupun `AuthLayout.vue` — desain kedua orang utuh.

```diff
diff --git a/.gitignore b/.gitignore
@@ -38,3 +38,6 @@ __screenshots__/
 
 # Vite
 *.timestamp-*-*.mjs
+
+# npm (proyek ini pakai bun, jangan commit lockfile npm)
+package-lock.json

diff --git a/src/App.vue b/src/App.vue
 <script setup>
-import LandingPage from './views/LandingPage.vue'
+import Toast from 'primevue/toast'
 </script>
 
 <template>

diff --git a/src/stores/auth.js b/src/stores/auth.js
   // Dipanggil sekali oleh router guard saat aplikasi dibuka.
   async function fetchMe() {
-  try {
-    const { data } = await api.get('/auth/me')
-    // sesuaikan dengan bentuk respons backend-mu, misalnya data.user atau data.data
-    user.value = data?.user ?? null
-  } catch {
-    user.value = null
-  } finally {
-    initialized.value = true
+    try {
+      // lib/api.js tidak melakukan unwrap (interceptor-nya passthrough),
+      // jadi `data` di sini masih envelope penuh { success, message, data }.
+      // Sesuai ARCHITECTURE_RULES.md §2, /auth/me menaruh user di `data`.
+      const { data } = await api.get('/auth/me')
+      user.value = data.data
+    } catch {
+      user.value = null
+    } finally {
+      initialized.value = true
+    }
   }
-}
 
   async function login(payload) {

diff --git a/package-lock.json b/package-lock.json   (6601 baris dihapus)
```

Berkas patch siap pakai:
`/var/folders/2l/j5dkykz91xq6nnsxbx3qx7hh0000gn/T/opencode/siap-fix-ibra.patch`

### Cara menerapkan

```bash
git switch -c fix-ibra origin/dev-bimo
git apply /var/folders/2l/j5dkykz91xq6nnsxbx3qx7hh0000gn/T/opencode/siap-fix-ibra.patch
bun run test:unit && bun run lint
git commit -m "fix: kembalikan bentuk respons auth/me dan import Toast"
git push -u origin fix-ibra-pr
```

Lalu buka PR `fix-ibra-pr` → `dev-bimo`. Setelah itu PR utama
`dev-bimo` → `dev` bisa di-merge.

---

## 5. Catatan untuk Bimo (`9aae7cf`)

Commit ini sendiri **tidak merusak apa pun** — test dan lint tetap hijau
untuk file miliknya, dan `bun run build` lolos.

Yang perlu diketahui: commit "Menambahkan halaman register" sebenarnya
mengganti **tema** halaman register yang sudah ada, bukan menambah halaman
baru. `RegisterView.vue` di `main` sudah ada, 69 baris, sudah rapi.

### 5.1 Yang sudah bagus

Struktur `RegisterView.vue`: `<script setup>` (1-57), `<template>` (59-147),
`<style scoped>` (149-637). Yang ditambahkan:

- Checkbox persetujuan + validasi wajib dicentang
- Aturan password wajib huruf **dan** angka, plus hint
- `autocomplete` yang benar (`name`, `email`, `new-password`)
- `aria-invalid` / `aria-describedby` per field
- Responsif di 3 breakpoint (950 / 720 / 380 px) + `prefers-reduced-motion`

### 5.2 Before / after

Sebelum (`main`, 69 baris, 0 baris CSS) — form di dalam `Card` PrimeVue,
mengikuti `FormField` + Tailwind, konsisten dengan halaman login.

Sesudah — halaman penuh standalone bergaya landing page: navbar, hero
"Selamat Datang!", daftar keunggulan, dan card form di kanan.

Konsekuensinya, register sekarang **tidak konsisten dengan login**.
`LoginView.vue` masih memakai `FormField` + `Button` + Tailwind.

### 5.3 Perlu diperbaiki

#### P1 — sebelum merge

**1. Link legal mati** — `src/views/RegisterView.vue:131`

```html
<label for="agreement">Saya menyetujui <a href="#agreement">Ketentuan Layanan</a>
dan <a href="#agreement">Kebijakan Privasi</a> SIAP OSN</label>
```

Tidak ada elemen `id="agreement"` maupun route `#agreement` di mana pun.
Karena menyangkut privasi, sebaiknya diubah jadi `<span>` inert dulu
sampai halaman legal-nya ada.

**2. Tombol "Daftar Gratis" mengarah ke halaman ini sendiri** — baris 76

```html
<a href="#register-form" class="btn-register">Daftar Gratis</a>
```

Di halaman register, `href="#register-form"` hanya scroll ke form yang
sudah terlihat. Pilihan: hapus tombolnya, atau jadikan
`<RouterLink to="/">` dengan label yang sesuai.

**3. Menu navbar tidak berguna** — baris 69-72

Anchor `#keunggulan` dan `#register-form` hanya menuju hero dan form.
Di bawah 720 px `.nav-menu` di-`display: none` (baris 425-426) tanpa
pengganti hamburger. Pertimbangkan shorten ke 1-2 item.

#### P2 — aksesibilitas

**4. Tombol dan link navbar tidak punya indikator fokus** — CSS baris 64-106, 349-369

Focus style hanya ada di `.form-group input:focus` (269) dan
`.agreement input:focus-visible` (328). Sementara `.register-button` (349),
`.btn-login` / `.btn-register` (82), dan `.nav-menu a` (64) tidak punya
`:focus-visible` sama sekali, padahal `:hover` dan `:disabled` sudah dibuat.

User keyboard yang tab ke tombol "Daftar Sekarang" tidak tahu sedang di
mana. Gagal WCAG 2.4.7 Focus Visible. Tambahkan:

```css
.register-button:focus-visible,
.btn-login:focus-visible,
.btn-register:focus-visible,
.nav-menu a:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
```

#### P3 — konsistensi

**5. Font tidak konsisten dengan landing page**

`font-family: 'Avenir Next', Avenir, 'Segoe UI', sans-serif` — `'Avenir Next'`
adalah font macOS/iOS, tidak ada di Windows dan Android, dan tidak di-load
sebagai webfont di `index.html`. Landing page (Ibra) memakai Inter +
Space Grotesk yang memang di-preload di `index.html`. Ganti ke:

```css
font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
```

**6. `AuthLayout` di-bypass dengan kondisi route** — `src/layouts/AuthLayout.vue:10-13`

```vue
<main :class="route.name === 'register' ? 'min-h-screen' : 'min-h-screen flex items-center justify-center bg-gray-100 p-4'">
  <RouterView v-if="route.name === 'register'" />
  <Card v-else class="w-full max-w-md">
```

Cara ini bekerja, tapi menyisipkan pengetahuan khusus "register" ke layout
generik. Alternatif: tambah meta di router dan jadikan `AuthLayout` tidak
perlu tahu apa-apa.

#### P4 — polish

**7. Komponen bersama tidak dipakai.** `FormField` dan PrimeVue `Button`
di-remove, diganti `<input>` mentah + `button` custom. Kalau redesign ini
mau jadi standar baru, `LoginView` perlu menyusul. Kalau tidak, pertimbangkan
kembali.

**8. Aturan validasi tersebar di 4 tempat.** `validasi()` (21-30) set 5 `ref`
error, template (108-134) punya 5 blok `<small>` manual. Field baru wajib
diingat di `validasi()` + `ref` + `<small>` + `aria-describedby`.

**9. Belum ada test.** 3 fitur baru tanpa coverage: checkbox persetujuan,
aturan huruf+angka password, dan cabang
`err.response.data.message === 'Email sudah terdaftar'` (rapuh — kalau
backend ubah wording, ini diam-diam gagal).

**10. Commit message tidak akurat.** "Menambahkan halaman register"
padahal redesign. Sebaiknya "Redesign halaman register + validasi
persetujuan dan kekuatan password" supaya riwayatnya jelas.

---

## 6. Catatan untuk Ibra (`79d9ca3`)

### 6.1 Commit message tidak akurat

"landingpage(belum dipisah html,css,jsnya)" — padahal `LandingPage.vue`
sudah benar-benar Vue: `<script setup>` berisi 10 array data statis,
`<template>` memakainya dengan `v-for`/`v-if`. Tidak ada HTML/JS inline.
Yang belum dipisah hanya **CSS** — 605 baris `<style scoped>` (324-929).

### 6.2 Bug pemblokir

- `src/stores/auth.js:20` — lihat §3.1
- `src/App.vue` — lihat §3.2

### 6.3 Perlu dibersihkan

**`package-lock.json` 6601 baris.** Proyek ini bun-based: `package.json`
memakai `bunx --bun vite`, dan `bun.lock` sudah ada di root. File ini tidak
ada di `main`, tidak ada di `.gitignore`. Kemungkinan besar tertinggal dari
`npm install` yang tidak sengaja.

**Indentasi `fetchMe` rusak** — `src/stores/auth.js:15-26`, closing brace
ada di kolom 0. Syntax valid, tapi akan ditolak formatter.

### 6.4 Perlu keputusan produk

**Route `home` dihapus** — `src/router/index.js:37`

```js
// route 'home' dihapus
```

Dulu `/` (setelah login) mengarah ke `SiswaDashboardView` via route
`home`. Sekarang `/` jadi `landing`, dan setelah login guard melempar ke
dashboard lewat `dashboardFor()`. Secara alur masih benar, tapi
pertimbangkan apakah `/siswa` perlu alias.

Semua komentar penjelas di dalam guard ikut terhapus padahal masih relevan.

`auth.isAuthenticated` diganti jadi `!!auth.user` — ekuivalen secara
fungsi, tapi tidak perlu diubah karena `isAuthenticated` masih dipakai test.

**`index.html`** memuat font Inter + Space Grotesk dari Google Fonts.
Ini bagus dan dipakai konsisten oleh `LandingPage.vue`.

---

## 7. Di luar kode

**Author `9aae7cf` tercatat sebagai `unknown <bimotaraqie87@gmail.com>`.**
Email itu belum terhubung ke akun GitHub, jasanya tidak akan muncul
sebagai contributor di PR. Perlu connect lewat GitHub Settings → Emails.
Ini di luar repo.

---

## 8. Checklist sebelum merge

- [ ] Patch §4 diterapkan, `bun run test:unit` dan `bun run lint` hijau
- [ ] Notifikasi Toast muncul di halaman register (klik Daftar, cek toast)
- [ ] Refresh halaman setelah login, user tetap masuk (bug §3.1)
- [ ] Link legal §5.3-1 diperbaiki atau dikonfirmasi infeasible
- [ ] Tombol "Daftar Gratis" §5.3-2 diperbaiki
- [ ] Email Bimo terhubung ke akun GitHub
- [ ] Keputusan soal route `home` §6.4

Setelah merged:

```bash
git switch dev && git pull
git push origin --delete dev-ibra
git push origin --delete dev-bimo
```
