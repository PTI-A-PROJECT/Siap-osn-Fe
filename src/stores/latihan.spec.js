import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { latihanService } from '@/services/latihan.js'
import { STATUS_LATIHAN, useLatihanStore } from '@/stores/latihan.js'

vi.mock('@/services/latihan.js', () => ({
  latihanService: { mulai: vi.fn(), lihat: vi.fn(), simpanJawaban: vi.fn(), kumpulkan: vi.fn() },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  localStorage.clear()
})

const PAKET = {
  jenis: 'pengerjaan',
  id: 31,
  quizId: 7,
  materiId: 3,
  materiJudul: 'Struktur Data',
  soal: [{ id: 201, tipe: 'ganda', jawaban: null }],
}

describe('useLatihanStore', () => {
  it('mulai menyimpan paket + id tersimpan', async () => {
    latihanService.mulai.mockResolvedValue(PAKET)
    const latihan = useLatihanStore()
    await latihan.mulai({ quizId: 7 })
    expect(latihan.status).toBe(STATUS_LATIHAN.MENGERJAKAN)
    expect(latihan.pengerjaanId).toBe(31)
    expect(latihan.idTersimpan()).toEqual({ id: 31 })
  })

  it('kumpulkan menyimpan hasil bernilai benar per soal', async () => {
    latihanService.mulai.mockResolvedValue(PAKET)
    latihanService.kumpulkan.mockResolvedValue({ id: 31, nilai: 90, jawaban: [{ soalId: 201, benar: true }] })
    const latihan = useLatihanStore()
    await latihan.mulai({ quizId: 7 })
    await latihan.kumpulkan()
    expect(latihan.status).toBe(STATUS_LATIHAN.SELESAI)
    expect(latihan.hasil.jawaban[0].benar).toBe(true)
    expect(latihan.idTersimpan()).toBeNull()
  })

  it('$reset membersihkan state dan simpanan', async () => {
    latihanService.mulai.mockResolvedValue(PAKET)
    const latihan = useLatihanStore()
    await latihan.mulai({ quizId: 7 })
    latihan.$reset()
    expect(latihan.status).toBe(STATUS_LATIHAN.IDLE)
    expect(latihan.soal).toEqual([])
  })
})
