import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/lib/api.js'

// Analogi Laravel: Auth::user() di sisi browser.
// Token TIDAK PERNAH disimpan di sini — cookie httpOnly diurus browser.
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const initialized = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const isSuperAdmin = computed(() => user.value?.role === 'super_admin')
  const isSiswa = computed(() => user.value?.role === 'siswa')

  // Dipanggil sekali oleh router guard saat aplikasi dibuka.
  async function fetchMe() {
    try {
      const { data } = await api.get('/auth/me')
      user.value = data.data
    } catch {
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function login(payload) {
    const { data } = await api.post('/auth/login', payload)
    user.value = data.data.user
    return user.value
  }

  // Tidak otomatis login — pemanggil redirect ke /login.
  async function register(payload) {
    const { data } = await api.post('/auth/register', payload)
    return data.data
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // Abaikan: sesi lokal tetap dibersihkan agar user kembali ke /login.
    } finally {
      user.value = null
    }
  }

  function $reset() {
    user.value = null
    initialized.value = false
  }

  return {
    user,
    initialized,
    isAuthenticated,
    isSuperAdmin,
    isSiswa,
    fetchMe,
    login,
    register,
    logout,
    $reset,
  }
})
