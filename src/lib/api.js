import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // wajib: kirim & terima cookie lintas origin
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status
    const url = err.config?.url ?? ''
    // 401 dari /auth/me (pengunjung anonim) dan 401 di halaman login
    // ("Email atau password salah") tidak boleh memicu redirect.
    // Import lazy agar tidak circular: api <- stores/auth <- router.
    if (status === 401 && !url.endsWith('/auth/me')) {
      const { default: router } = await import('@/router/index.js')
      if (router.currentRoute.value.name !== 'login') {
        const { useAuthStore } = await import('@/stores/auth.js')
        const auth = useAuthStore()
        if (typeof auth.$reset === 'function') auth.$reset()
        else auth.user = null
        router.push({
          name: 'login',
          query: { redirect: router.currentRoute.value.fullPath },
        })
      }
    }
    return Promise.reject(err)
  },
)
