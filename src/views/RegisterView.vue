<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useAuthStore } from '@/stores/auth.js'
import { pesanError } from '@/lib/errors.js'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const nama = ref('')
const email = ref('')
const password = ref('')
const konfirmasi = ref('')
const setuju = ref(false)
const namaError = ref('')
const emailError = ref('')
const passwordError = ref('')
const konfirmasiError = ref('')
const setujuError = ref('')
const loading = ref(false)
const menuOpen = ref(false) // State untuk hamburger menu

function validasi() {
  namaError.value = ''
  emailError.value = ''
  passwordError.value = ''
  konfirmasiError.value = ''
  setujuError.value = ''

  if (nama.value.trim().length < 3) namaError.value = 'Nama minimal 3 karakter'
  
  if (!email.value) {
    emailError.value = 'Email wajib diisi'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    emailError.value = 'Format email tidak valid'
  }

  if (password.value.length < 8) {
    passwordError.value = 'Password minimal 8 karakter'
  } else if (!/[a-zA-Z]/.test(password.value) || !/[0-9]/.test(password.value)) {
    passwordError.value = 'Password harus mengandung huruf dan angka'
  }

  if (konfirmasi.value !== password.value) {
    konfirmasiError.value = 'Konfirmasi password tidak sama'
  }

  if (!setuju.value) setujuError.value = 'Persetujuan wajib dicentang'

  return !namaError.value && !emailError.value && !passwordError.value && !konfirmasiError.value && !setujuError.value
}

async function daftar() {
  if (!validasi()) return
  loading.value = true
  try {
    await auth.register({ nama: nama.value, email: email.value, password: password.value })
    toast.add({ severity: 'success', summary: 'Registrasi berhasil', detail: 'Silakan masuk dengan akun baru', life: 4000 })
    router.push('/login')
  } catch (err) {
    if (err?.response?.status === 400 && err?.response?.data?.message === 'Email sudah terdaftar') {
      emailError.value = 'Email sudah terdaftar'
    } else {
      toast.add({ severity: 'error', summary: 'Registrasi gagal', detail: pesanError(err), life: 4000 })
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-page">
    <!-- Navbar -->
    <header class="navbar">
      <div class="navbar-container">
        <!-- Logo -->
        <RouterLink to="/login" class="brand-logo" aria-label="SIAP OSN">
          <span class="brand-mark" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="6" width="8" height="12" rx="2" fill="#0759a5"/>
              <rect x="14" y="6" width="8" height="12" rx="2" fill="#0759a5"/>
              <circle cx="8" cy="12" r="2" fill="white"/>
              <circle cx="16" cy="12" r="2" fill="white"/>
            </svg>
          </span>
          <span>SIAP OSN</span>
        </RouterLink>

        <!-- Hamburger (Mobile Only) -->
        <button class="hamburger" @click="menuOpen = !menuOpen" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </button>

        <!-- Nav Menu (Desktop) -->
        <nav class="nav-menu" :class="{ 'is-open': menuOpen }" aria-label="Navigasi utama">
          <a href="#keunggulan">Kenapa SIAP OSN</a>
          <a href="#keunggulan">Fitur</a>
          <a href="#register-form">Cara Kerja</a>
          <a href="#register-form">Tingkat Seleksi</a>
          <a href="#register-form">Tim Kami</a>
        </nav>

        <!-- Actions -->
        <div class="nav-actions">
          <RouterLink to="/login" class="btn-login">Masuk</RouterLink>
          <a href="#register-form" class="btn-register">Daftar Gratis</a>
        </div>
      </div>
    </header>

    <main class="main-content">
      <!-- Left Section -->
      <section id="keunggulan" class="left-section">
        <div class="left-content">
          <h1>Selamat Datang!</h1>
          <p class="description">
            Persiapan OSN Informatika yang terarah: dari pemetaan kompetensi sampai simulasi sesuai standar TOKI.
          </p>
          <ul class="feature-list">
            <li><span class="check-icon"></span> Pre-test &amp; pemetaan kompetensi</li>
            <li><span class="check-icon"></span> Materi sesuai kebutuhanmu</li>
            <li><span class="check-icon"></span> Simulasi seleksi standar TOKI</li>
          </ul>
        </div>
      </section>

      <!-- Right Section -->
      <section id="register-form" class="right-section">
        <div class="register-card">
          <div class="card-heading">
            <h2>Daftar Akun Baru</h2>
          </div>

          <form class="register-form" @submit.prevent="daftar">
            <div class="form-group">
              <label for="nama">Nama Lengkap <span class="required">*</span></label>
              <input id="nama" v-model="nama" autocomplete="name" type="text" placeholder="Masukkan nama lengkap" :aria-invalid="Boolean(namaError)" />
              <small v-if="namaError" class="field-error">{{ namaError }}</small>
            </div>

            <div class="form-group">
              <label for="email">Email Aktif <span class="required">*</span></label>
              <input id="email" v-model="email" autocomplete="email" type="email" placeholder="nama@sekolah.sch.id" :aria-invalid="Boolean(emailError)" />
              <small v-if="emailError" class="field-error">{{ emailError }}</small>
            </div>

            <div class="form-group">
              <label for="password">Kata Sandi <span class="required">*</span></label>
              <input id="password" v-model="password" autocomplete="new-password" type="password" placeholder="Kombinasi minimal 8 karakter" :aria-invalid="Boolean(passwordError)" />
              <small v-if="passwordError" class="field-error">{{ passwordError }}</small>
              <small v-else class="field-hint">Minimal 8 karakter, kombinasi huruf dan angka</small>
            </div>

            <div class="form-group">
              <label for="konfirmasi">Konfirmasi Kata Sandi <span class="required">*</span></label>
              <input id="konfirmasi" v-model="konfirmasi" autocomplete="new-password" type="password" placeholder="Ulangi kata sandi Anda" :aria-invalid="Boolean(konfirmasiError)" />
              <small v-if="konfirmasiError" class="field-error">{{ konfirmasiError }}</small>
            </div>

            <div class="agreement">
              <input id="agreement" v-model="setuju" type="checkbox" />
              <label for="agreement">
                Saya menyetujui <a href="#agreement">Ketentuan Layanan</a> dan <a href="#agreement">Kebijakan Privasi</a> SIAP OSN
              </label>
            </div>
            <small v-if="setujuError" class="field-error agreement-error">{{ setujuError }}</small>

            <button class="register-button" type="submit" :disabled="loading">
              <span>{{ loading ? 'Memproses...' : 'Daftar Sekarang' }}</span>
              <span class="arrow-icon">→</span>
            </button>
          </form>

          <p class="login-text">
            Sudah punya akun? <RouterLink to="/login">Masuk di sini</RouterLink>
          </p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* ================================
   VARIABEL & RESET
   ================================ */
.register-page {
  --ink: #1a2b4b;
  --muted: #6b7a90;
  --blue: #0759a5;
  --blue-deep: #064d91;
  --line: #e2e8f0;
  --bg-soft: #f8fafc;

  
  min-height: 100vh;
  color: var(--ink);
  background: #fff;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden; /* Mencegah scroll horizontal */
}

*, *::before, *::after {
  box-sizing: border-box;
}

/* ================================
   NAVBAR
   ================================ */
.navbar {
  position: sticky;
  z-index: 50;
  top: 0;
  height: 72px;
  border-bottom: 1px solid var(--line);
  background: #fff;
}

.navbar-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1200px; /* Batas lebar maksimal */
  height: 100%;
  margin: 0 auto;
  padding: 0 24px; /* Padding kiri-kanan */
}

.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  font-size: 18px;
  font-weight: 800;
  text-decoration: none;
  flex-shrink: 0;
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Hamburger - Hidden by default */
.hamburger {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
}

.hamburger span {
  display: block;
  width: 24px;
  height: 2px;
  background: var(--ink);
  border-radius: 2px;
}

.nav-menu {
  display: flex;
  gap: 28px;
  margin-left: 40px;
  flex: 1;
}

.nav-menu a {
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.2s;
}

.nav-menu a:hover {
  color: var(--blue);
}

.nav-actions {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.btn-login,
.btn-register {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-login {
  border: 1px solid var(--line);
  color: var(--ink);
  background: #fff;
}

.btn-login:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.btn-register {
  border: 1px solid var(--blue);
  background: var(--blue);
  color: white;
}

.btn-register:hover {
  background: var(--blue-deep);
  border-color: var(--blue-deep);
}

/* ================================
   MAIN CONTENT GRID
   ================================ */
.main-content {
  display: grid;
  min-height: calc(100vh - 72px);
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

/* ================================
   LEFT SECTION
   ================================ */
.left-section {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 60px 40px;
  background: radial-gradient(circle at 10% 80%, #eef4fb 0%, transparent 50%), #fff;
}

.left-content {
  width: 100%;
  max-width: 480px;
}

.left-content h1 {
  margin: 0 0 20px;
  color: #0f2442;
  font-size: clamp(32px, 5vw, 56px);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -1px;
}

.description {
  max-width: 420px;
  margin: 0 0 32px;
  color: #3b4b66;
  font-size: clamp(14px, 1.6vw, 16px);
  line-height: 1.6;
}

.feature-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.feature-list li {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #1e293b;
  font-size: 14px;
  font-weight: 700;
}

.check-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #1e293b;
  position: relative;
}

.check-icon::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 7px;
  height: 7px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

/* ================================
   RIGHT SECTION
   ================================ */
.right-section {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 40px;
  background: #f8fafc;
}

.register-card {
  width: 100%;
  max-width: 460px;
  padding: 36px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

.card-heading {
  margin-bottom: 24px;
}

.card-heading h2 {
  margin: 0;
  color: #0f2442;
  font-size: 22px;
  font-weight: 800;
}

/* ================================
   FORM
   ================================ */
.register-form {
  display: grid;
  gap: 16px;
}

.form-group {
  display: grid;
  gap: 6px;
}

.form-group label {
  color: #1e293b;
  font-size: 13px;
  font-weight: 700;
}

.required {
  color: #ef4444;
}

.form-group input {
  width: 100%;
  min-height: 46px;
  padding: 0 14px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #0f2442;
  font: inherit;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input::placeholder {
  color: #94a3b8;
}

.form-group input:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(7, 89, 165, 0.1);
}

.form-group input[aria-invalid='true'] {
  border-color: #ef4444;
}

.field-hint,
.field-error {
  font-size: 12px;
}

.field-hint {
  color: #64748b;
}

.field-error {
  color: #ef4444;
}

/* ================================
   AGREEMENT
   ================================ */
.agreement {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 4px;
}

.agreement input {
  position: relative;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin: 2px 0 0;
  appearance: none;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.agreement input:checked {
  border-color: var(--blue);
  background: var(--blue);
}

.agreement input:checked::after {
  position: absolute;
  top: 2px;
  left: 6px;
  width: 4px;
  height: 8px;
  border-right: 2px solid #fff;
  border-bottom: 2px solid #fff;
  content: '';
  transform: rotate(45deg);
}

.agreement label {
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
}

.agreement a {
  color: var(--blue);
  font-weight: 600;
  text-decoration: none;
}

.agreement a:hover {
  text-decoration: underline;
}

.agreement-error {
  margin-top: -10px;
}

/* ================================
   SUBMIT BUTTON
   ================================ */
.register-button {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 8px;
  border: 0;
  border-radius: 8px;
  background: var(--blue);
  color: white;
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  transition: background 0.2s;
}

.register-button:hover:not(:disabled) {
  background: var(--blue-deep);
}

.register-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.arrow-icon {
  font-size: 18px;
  line-height: 1;
}

.login-text {
  margin: 24px 0 0;
  color: #64748b;
  font-size: 14px;
  text-align: center;
}

.login-text a {
  color: var(--blue);
  font-weight: 700;
  text-decoration: none;
}

.login-text a:hover {
  text-decoration: underline;
}

/* ================================
   RESPONSIVE (Container Queries)
   ================================ */

/* Tablet: ≤ 1024px */
@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;          /* hilangkan ruang kosong di atas judul */
    align-content: start;
  }

  .left-section {
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
  }

  .description {
    margin-left: auto;
    margin-right: auto;
  }

  .feature-list {
    max-width: 480px;
    margin: 0 auto;
    text-align: left;
  }

  .right-section {
    justify-content: center;
    padding: 40px 24px 80px;
  }

  .register-card {
    max-width: 520px;
  }
}

/* Tablet kecil / HP: ≤ 768px */
@container page (max-width: 768px) {
  .navbar {
    height: 64px;
  }

  .navbar-container {
    padding: 0 16px;
  }

  .hamburger {
    display: flex;
    order: 3;
  }

  .nav-actions {
    margin-left: auto;
    margin-right: 8px;
  }

  .nav-menu {
    display: none;
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
    flex: none;
    flex-direction: column;
    gap: 0;
    margin-left: 0;
    padding: 8px 24px 16px;
    background: #fff;
    border-bottom: 1px solid var(--line);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    z-index: 40;
  }

  .nav-menu.is-open {
    display: flex;
  }

  .nav-menu a {
    padding: 12px 0;
    font-size: 15px;
    border-bottom: 1px solid #f1f5f9;
  }

  .nav-menu a:last-child {
    border-bottom: none;
  }

  .nav-actions .btn-login {
    display: none;
  }

  .nav-actions .btn-register {
    min-height: 38px;
    padding: 0 14px;
    font-size: 13px;
  }

  .left-section {
    padding: 40px 20px 32px;
  }

  .left-content h1 {
    font-size: 36px;
  }

  .right-section {
    padding: 24px 16px 64px;
  }

  .register-card {
    padding: 28px 20px;
  }
}

/* HP kecil: ≤ 480px */
@container page (max-width: 480px) {
  .left-content h1 {
    font-size: 30px;
    margin-bottom: 14px;
  }

  .description {
    margin-bottom: 24px;
    font-size: 14px;
  }

  .feature-list li {
    padding: 12px 16px;
    gap: 10px;
    font-size: 13px;
  }

  .check-icon {
    width: 18px;
    height: 18px;
  }

  .check-icon::after {
    width: 6px;
    height: 6px;
  }

  .register-card {
    padding: 24px 16px;
    border-radius: 8px;
  }

  .card-heading h2 {
    font-size: 20px;
  }

  .form-group input {
    min-height: 44px;
    font-size: 15px; /* cegah auto-zoom di iOS */
  }

  .register-button {
    min-height: 46px;
    font-size: 14px;
  }

  .login-text {
    font-size: 13px;
  }
}

/* Aksesibilitas: tetap pakai media query karena ini preferensi sistem */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
</style>
