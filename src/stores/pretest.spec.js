import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { pretestService } from '@/services/pretest.js'
import { STATUS, usePretestStore } from '@/stores/pretest.js'

vi.mock('@/services/pretest.js', () => ({
  pretestService: {
    tingkat: vi.fn(),
    mulai: vi.fn(),
    lihat: vi.fn(),
    simpanJawaban: vi.fn(),
    kumpulkan: vi.fn(),
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  localStorage.clear()
})

const PAKET = {
  jenis: 'pengerjaan',
  id: 12,
  tingkatId: 1,
  soal: [{ id: 101, tipe: 'ganda', jawaban: null }],
}

describe('usePretestStore', () => {
  it('mulai menyimpan paket pengerjaan + id tersimpan', async () => {
    pretestService.mulai.mockResolvedValue(PAKET)
    const pretest = usePretestStore()
    await pretest.mulai({ tingkatId: 1 })
    expect(pretest.status).toBe(STATUS.MENGERJAKAN)
    expect(pretest.pretestId).toBe(12)
    expect(pretest.soal).toHaveLength(1)
    expect(pretest.idTersimpan()).toEqual({ id: 12, tingkatId: 1 })
  })

  it('lanjutkan bercabang: pengerjaan vs hasil', async () => {
    pretestService.lihat.mockResolvedValue(PAKET)
    const pretest = usePretestStore()
    await pretest.lanjutkan({ id: 12 })
    expect(pretest.status).toBe(STATUS.MENGERJAKAN)

    const hasil = { id: 12, nilai: 80, pemetaan: [], materiWajib: [] }
    pretestService.lihat.mockResolvedValue({ jenis: 'hasil', hasil })
    await pretest.lanjutkan({ id: 12 })
    expect(pretest.status).toBe(STATUS.SELESAI)
    expect(pretest.hasil.nilai).toBe(80)
  })

  it('simpanJawaban optimistis lokal dan menandai gagal simpan', async () => {
    pretestService.mulai.mockResolvedValue(PAKET)
    const pretest = usePretestStore()
    await pretest.mulai({ tingkatId: 1 })

    pretestService.simpanJawaban.mockResolvedValue(undefined)
    await pretest.simpanJawaban({ soalId: 101, jawaban: 'B' })
    expect(pretest.soal[0].jawaban).toBe('B')
    expect(pretest.simpanError).toBe(false)

    pretestService.simpanJawaban.mockRejectedValue(new Error('putus'))
    await pretest.simpanJawaban({ soalId: 101, jawaban: 'C' })
    expect(pretest.soal[0].jawaban).toBe('C')
    expect(pretest.simpanError).toBe(true)
  })

  it('kumpulkan menyimpan hasil dan menghapus id tersimpan', async () => {
    pretestService.mulai.mockResolvedValue(PAKET)
    pretestService.kumpulkan.mockResolvedValue({ id: 12, nilai: 75, pemetaan: [], materiWajib: [] })
    const pretest = usePretestStore()
    await pretest.mulai({ tingkatId: 1 })
    await pretest.kumpulkan()
    expect(pretest.status).toBe(STATUS.SELESAI)
    expect(pretest.hasil.nilai).toBe(75)
    expect(pretest.idTersimpan()).toBeNull()
  })

  it('$reset membersihkan state dan simpanan', async () => {
    pretestService.mulai.mockResolvedValue(PAKET)
    const pretest = usePretestStore()
    await pretest.mulai({ tingkatId: 1 })
    pretest.$reset()
    expect(pretest.status).toBe(STATUS.IDLE)
    expect(pretest.soal).toEqual([])
    expect(pretest.idTersimpan()).toBeNull()
  })
})
