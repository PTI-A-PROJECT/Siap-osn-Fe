import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { latihanService } from '@/services/latihan.js'

// State pengerjaan latihan/quiz. Pola sama dengan pre-test, tanpa pemilih
// tingkat dan tanpa timer (quiz terikat satu materi, backend tanpa durasi).
// ID pengerjaan disimpan agar reload bisa resume via GET.
const KUNCI_LATIHAN_AKTIF = 'siap_osn_latihan_aktif'

export const STATUS_LATIHAN = {
  IDLE: 'idle',
  MENGERJAKAN: 'mengerjakan',
  MENGUMPULKAN: 'mengumpulkan',
  SELESAI: 'selesai',
}

export const useLatihanStore = defineStore('latihan', () => {
  const status = ref(STATUS_LATIHAN.IDLE)
  const quizId = ref(null)
  const materiId = ref(null)
  const materiJudul = ref('')
  const pengerjaanId = ref(null)
  const soal = ref([])
  const hasil = ref(null)
  const loading = ref(false)
  const error = ref(false)
  const simpanError = ref(false)

  let controller = null

  const jumlahTerjawab = computed(
    () => soal.value.filter((s) => s.jawaban !== null && s.jawaban !== undefined && s.jawaban !== '').length,
  )

  function bacaSimpanan() {
    try {
      return JSON.parse(localStorage.getItem(KUNCI_LATIHAN_AKTIF) ?? 'null')
    } catch {
      return null
    }
  }

  function tulisSimpanan(v) {
    if (v) localStorage.setItem(KUNCI_LATIHAN_AKTIF, JSON.stringify(v))
    else localStorage.removeItem(KUNCI_LATIHAN_AKTIF)
  }

  function terapkanPengerjaan(paket) {
    pengerjaanId.value = paket.id
    quizId.value = paket.quizId
    materiId.value = paket.materiId
    materiJudul.value = paket.materiJudul
    soal.value = paket.soal.map((s) => ({ ...s }))
    hasil.value = null
    status.value = STATUS_LATIHAN.MENGERJAKAN
    tulisSimpanan({ id: paket.id })
  }

  function sinyalBaru() {
    controller?.abort()
    controller = new AbortController()
    return controller.signal
  }

  // POST mulai: idempoten — kembalikan pengerjaan berjalan bila ada.
  async function mulai({ quizId: qid } = {}) {
    const signal = sinyalBaru()
    loading.value = true
    error.value = false
    try {
      terapkanPengerjaan(await latihanService.mulai({ quizId: qid, signal }))
    } catch (err) {
      if (!signal.aborted) error.value = true
      throw err
    } finally {
      if (!signal.aborted) loading.value = false
    }
  }

  async function lanjutkan({ id } = {}) {
    const signal = sinyalBaru()
    loading.value = true
    error.value = false
    try {
      const paket = await latihanService.lihat({ id, signal })
      if (paket.jenis === 'pengerjaan') terapkanPengerjaan(paket)
      else {
        hasil.value = paket.hasil
        pengerjaanId.value = paket.hasil.id
        status.value = STATUS_LATIHAN.SELESAI
      }
    } catch (err) {
      if (!signal.aborted) error.value = true
      throw err
    } finally {
      if (!signal.aborted) loading.value = false
    }
  }

  async function simpanJawaban({ soalId, jawaban }) {
    const target = soal.value.find((s) => s.id === soalId)
    if (target) target.jawaban = jawaban ?? null
    try {
      await latihanService.simpanJawaban({ id: pengerjaanId.value, soalId, jawaban })
      simpanError.value = false
    } catch {
      simpanError.value = true
    }
  }

  async function kumpulkan() {
    const signal = sinyalBaru()
    status.value = STATUS_LATIHAN.MENGUMPULKAN
    error.value = false
    try {
      hasil.value = await latihanService.kumpulkan({ id: pengerjaanId.value, signal })
      status.value = STATUS_LATIHAN.SELESAI
      tulisSimpanan(null)
      return hasil.value
    } catch {
      if (!signal.aborted) {
        error.value = true
        status.value = STATUS_LATIHAN.MENGERJAKAN
      }
      throw err
    }
  }

  function $reset() {
    controller?.abort()
    controller = null
    status.value = STATUS_LATIHAN.IDLE
    quizId.value = null
    materiId.value = null
    materiJudul.value = ''
    pengerjaanId.value = null
    soal.value = []
    hasil.value = null
    loading.value = false
    error.value = false
    simpanError.value = false
    tulisSimpanan(null)
  }

  return {
    status,
    quizId,
    materiId,
    materiJudul,
    pengerjaanId,
    soal,
    hasil,
    loading,
    error,
    simpanError,
    jumlahTerjawab,
    idTersimpan: bacaSimpanan,
    mulai,
    lanjutkan,
    simpanJawaban,
    kumpulkan,
    $reset,
  }
})
