import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { belajarService } from '@/services/belajar.js'
import { siswaService } from '@/services/siswa.js'
import { useProgressStore } from '@/stores/progress.js'

vi.mock('@/services/siswa.js', () => ({
  siswaService: { dashboard: vi.fn() },
}))

vi.mock('@/services/belajar.js', () => ({
  belajarService: { daftar: vi.fn(async () => []), detail: vi.fn(), tandaiSelesai: vi.fn() },
}))

vi.mock('@/stores/pretest.js', () => ({
  usePretestStore: () => ({
    tingkatList: [{ id: 1, nama: 'Kabupaten', terbuka: true }],
    muatTingkat: vi.fn(async () => {}),
  }),
}))

vi.mock('@/stores/riwayat.js', () => ({
  useRiwayatStore: () => ({ terbaris: vi.fn(async () => []) }),
}))

const hasil = { preTestSelesai: false, materiSelesai: 0, materiTotal: 0 }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('progress store', () => {
  it('fetchDashboard menyimpan hasil dan menandai loaded', async () => {
    siswaService.dashboard.mockResolvedValue(hasil)
    const progress = useProgressStore()
    await progress.fetchDashboard()
    expect(progress.data).toEqual({ ...hasil, riwayat: [], kompetensi: [], rekomendasi: [] })
    expect(progress.loaded).toBe(true)
    expect(progress.loading).toBe(false)
  })

  it('data segar tidak memicu request ulang kecuali force', async () => {
    siswaService.dashboard.mockResolvedValue(hasil)
    const progress = useProgressStore()
    await progress.fetchDashboard()
    await progress.fetchDashboard()
    expect(siswaService.dashboard).toHaveBeenCalledTimes(1)
    await progress.fetchDashboard({ force: true })
    expect(siswaService.dashboard).toHaveBeenCalledTimes(2)
  })

  it('gagal request menandai error tanpa menghapus data lama', async () => {
    siswaService.dashboard.mockRejectedValue(new Error('putus'))
    const progress = useProgressStore()
    await progress.fetchDashboard()
    expect(progress.error).toBe(true)
    expect(progress.loaded).toBe(false)
  })

  it('markPreTestCompleted membuka akses pre-test di dashboard', () => {
    const progress = useProgressStore()
    progress.markPreTestCompleted()
    expect(progress.data.preTestSelesai).toBe(true)
  })

  it('fetchDashboard tidak mengunci ulang dashboard setelah pre-test lokal dikumpulkan', async () => {
    siswaService.dashboard.mockResolvedValue(hasil)
    const progress = useProgressStore()
    progress.markPreTestCompleted()
    await progress.fetchDashboard()
    expect(progress.data.preTestSelesai).toBe(true)
  })

  it('fetchDashboard mengisi statistik materi dari tingkat terbuka', async () => {
    siswaService.dashboard.mockResolvedValue(hasil)
    belajarService.daftar.mockResolvedValue([
      { id: 1, judul: 'A', wajib: true, prioritas: 1, progress: { status: 'selesai' }, nilaiTerbaik: 80 },
      { id: 2, judul: 'B', wajib: false, prioritas: null, progress: null, nilaiTerbaik: null },
    ])
    const progress = useProgressStore()
    await progress.fetchDashboard()
    await vi.waitFor(() => expect(progress.data.materiTotal).toBe(2))
    expect(progress.data.materiSelesai).toBe(1)
    expect(progress.data.kompetensi).toEqual([{ nama: 'A', skor: 80, target: null }])
    expect(progress.data.rekomendasi).toEqual([{ judul: 'A', sub: 'Prioritas 1', badge: 'Wajib' }])
  })

  it('$reset mengosongkan state', async () => {
    siswaService.dashboard.mockResolvedValue(hasil)
    const progress = useProgressStore()
    await progress.fetchDashboard()
    progress.$reset()
    expect(progress.loaded).toBe(false)
    expect(progress.error).toBe(false)
  })
})
