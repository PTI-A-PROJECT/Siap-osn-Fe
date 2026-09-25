# ARCHITECTURE RULES — siap-osn-fe

Aturan arsitektur + kontrak integrasi frontend ↔ backend.
Semua kode baru wajib mengikuti file ini.
Detail tooling Bun: `docs/PLAN-TOOLING-BUN.md`.
Rencana auth: `docs/PLAN-FE-VUE-AUTH.md`.

## 1. Lapisan arsitektur

```text
views/ / layouts/ / components/   (UI: render + validasi form + toast)
        ↓ memakai
router/ (routes, meta, guard)  +  stores/ (state + aksi API)
        ↓ memakai
lib/api.js  (satu-satunya tempat membuat axios instance)
lib/errors.js (satu-satunya cara membaca pesan error backend)
```

Aturan arah dependensi:

1. UI boleh memakai `stores/`, `router/`, `lib/`. Tidak boleh sebaliknya.
2. `stores/` dan `router/` hanya boleh bicara HTTP lewat `lib/api.js`.
   Dilarang `axios.create` / `fetch` langsung di luar `lib/api.js`.
3. `lib/api.js` **dilarang import statis** ke `router/` atau `stores/`
   (circular import). Interceptor memakai `await import()` lazy.
4. Satu konsep satu tempat: pemetaan role→dashboard hanya di
   `dashboardFor()` (`router/index.js`).

## 2. Kontrak integrasi dengan siap-osn-be (terverifikasi 2026-09-25)

Base URL dev: `http://localhost:8080/api/v1` (langsung, tanpa proxy Vite).

| Method + path | Auth | Sukses | Data |
|---|---|---|---|
| `POST /auth/register` | — | 201 "Registrasi berhasil" | user `{id, nama, email, role, created_at}` |
| `POST /auth/login` | — | 200 "Login berhasil" | `{user}` + `Set-Cookie` |
| `POST /auth/logout` | cookie | 200 "Logout berhasil" | cookie di-expire |
| `GET /auth/me` | cookie | 200 "Data user berhasil diambil" | user |
| `GET /admin/ping` | cookie + `super_admin` | 200, `data.message: "pong"` | — |

Aturan kontrak:

1. Envelope sukses: `{success: true, message, data}`.
   Envelope error: `{success: false, message}` — pesan selalu Bahasa Indonesia,
   dibaca via `pesanError()` (`lib/errors.js`), jangan parsing string manual.
2. Token hanya lewat cookie httpOnly `siap_osn_token`
   (`HttpOnly; SameSite=Lax`, tanpa `Secure` di HTTP dev).
   **Dilarang** menyimpan token di store / localStorage / URL.
3. Setiap request wajib `withCredentials: true` (sudah default di `lib/api.js`).
4. Dev WAJIB di `http://localhost:5173` persis (bukan `127.0.0.1`, bukan port
   lain) — `strictPort: true`. Origin lain ditolak backend (403).
5. Role persis: `siswa`, `super_admin`. Role baru dari backend harus
   didaftarkan di `dashboardFor()` + `meta.role` sebelum dipakai.
6. Pesan yang ditempel ke UI: "Email sudah terdaftar" (400, di field email),
   "Email atau password salah" (401, toast), selebihnya via `pesanError()`.

## 3. Auth flow (jangan diubah tanpa alasan)

1. Guard: `fetchMe()` sekali per load → `requiresAuth` → `guestOnly` →
   cek `meta.role` → redirect `/` ke dashboard per role.
2. Interceptor 401: redirect ke `login` **kecuali** dari `/auth/me`
   dan kecuali posisi sudah di halaman login (anti-loop).
3. `logout()` menelan error request — sesi lokal selalu dibersihkan
   agar user tetap kembali ke `/login`.
4. Register tidak auto-login — selalu redirect ke `/login` + toast sukses.

## 4. UI

1. PrimeVue **4.5.5** + `@primeuix/themes@2.0.3` + `primeicons@7.0.0`,
   dikunci via `overrides`. Dilarang `primevue@latest` (v5 komersial).
2. Styling: Tailwind v4 (`@import "tailwindcss"` di `assets/main.css`).
   Tanpa `tailwind.config.js`.
3. Semua teks UI Bahasa Indonesia.
4. Input form baru wajib pakai `components/FormField.vue`
   (label + error merah). Validasi manual di view, bukan vee-validate/zod.
5. Feedback error/sukses selalu via Toast (`life: 4000`), bukan `alert()`.

## 5. Tooling & quality gate

1. Package manager: Bun. `dev`/`build`/`preview` via `bunx --bun vite`.
   `test:unit` (`vitest run` + jsdom) dan lint jalan di Node — tanpa `--bun`.
2. Dilarang `bun test` untuk test komponen (tidak support SFC `.vue`).
3. Setiap perubahan wajib lolos sebelum commit:
   `bunx eslint . && bun run test:unit && bun run build`.
4. Test baru: logika store di `*.spec.js` (mock `@/lib/api`),
   aturan guard di `router/guard.spec.js` (tanpa backend).

## 6. Larangan ringkas

- Token di JS/localStorage/URL. ❌
- `axios`/`fetch` di luar `lib/api.js`. ❌
- Import statis `router`/`stores` dari `lib/`. ❌
- `primevue@latest`, `tailwind.config.js`, teks UI Inggris. ❌
- Route terproteksi tanpa `meta.requiresAuth`/`meta.role`. ❌
- `bunx --bun vitest`. ❌ (hang — lihat PLAN-TOOLING-BUN.md §5)
