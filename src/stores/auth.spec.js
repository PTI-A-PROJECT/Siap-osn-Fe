import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { api } from '@/lib/api.js'
import { useAuthStore } from '@/stores/auth.js'

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

const userSiswa = {
  id: '1',
  nama: 'Budi',
  email: 'budi@example.com',
  role: 'siswa',
  created_at: '2026-09-25T00:00:00Z',
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('auth store', () => {
  it('fetchMe sukses mengisi user dan initialized', async () => {
    api.get.mockResolvedValue({ data: { data: userSiswa } })
    const auth = useAuthStore()
    await auth.fetchMe()
    expect(auth.user).toEqual(userSiswa)
    expect(auth.initialized).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isSiswa).toBe(true)
    expect(auth.isSuperAdmin).toBe(false)
  })

  it('fetchMe 401 mengosongkan user tapi initialized tetap true', async () => {
    api.get.mockRejectedValue({ response: { status: 401 } })
    const auth = useAuthStore()
    await auth.fetchMe()
    expect(auth.user).toBeNull()
    expect(auth.initialized).toBe(true)
    expect(auth.isAuthenticated).toBe(false)
  })

  it('login mengisi user dari data.data.user', async () => {
    api.post.mockResolvedValue({ data: { data: { user: userSiswa } } })
    const auth = useAuthStore()
    const user = await auth.login({ email: 'budi@example.com', password: 'password123' })
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'budi@example.com',
      password: 'password123',
    })
    expect(user).toEqual(userSiswa)
    expect(auth.isAuthenticated).toBe(true)
  })

  it('register mengembalikan data tanpa login', async () => {
    api.post.mockResolvedValue({ data: { data: userSiswa } })
    const auth = useAuthStore()
    const result = await auth.register({ nama: 'Budi', email: 'budi@example.com', password: 'password123' })
    expect(result).toEqual(userSiswa)
    expect(auth.user).toBeNull()
  })

  it('logout mengosongkan user meski request gagal', async () => {
    api.post.mockRejectedValue(new Error('network'))
    const auth = useAuthStore()
    auth.user = userSiswa
    await auth.logout()
    expect(auth.user).toBeNull()
  })
})
