import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { pretestService } from '@/services/pretest.js'

// State pengerjaan pre-test lintas halaman (soal + jawaban + hasil).
// Kontrak API + bentuk data: services/mappers/pretest.js.
//
// - Daftar tingkat di-cache singkat; paket soal selalu diambil fresh
//   (jawaban bisa berubah dari perangkat lain).
// - ID pretest berjalan disimpan di localStorage agar reload di tengah
//   ujian bisa resume (backend tidak punya endpoint "pretest aktif").

const KUNCI_PRETEST_AKTIF = 'siap_osn_pretest_aktif'
const SEGAR_TINGKAT_MS = 5 * 60_000

export const STATUS = {
  IDLE: 'idle',
  MEMILIH: 'memilih',
  MENGERJAKAN: 'mengerjakan',
  MENGUMPULKAN: 'mengumpulkan',
  SELESAI: 'selesai',
}

export const usePretestStore = defineStore('pretest', () => {
  const status = ref(STATUS.IDLE)
  const tingkatList = ref([])
  const tingkatId = ref(null)
  const pretestId = ref(null)
  const soal = ref([])
  const hasil = ref(null)
  const loading = ref(false)
  const error = ref(false)
  const simpanError = ref(false)

  let inflightTingkat = null
  let tingkatDimuatPada = 0
  let controller = null

  const jumlahTerjawab = computed(
    () => soal.value.filter((s) => s.jawaban !== null && s.jawaban !== undefined && s.jawaban !== '').length,
  )

  function bacaSimpanan() {
    try {
      return JSON.parse(localStorage.getItem(KUNCI_PRETEST_AKTIF) ?? 'null')
    } catch {
      return null
    }
  }

  function tulisSimpanan(v) {
    if (v) localStorage.setItem(KUNCI_PRETEST_AKTIF, JSON.stringify(v))
    else localStorage.removeItem(KUNCI_PRETEST_AKTIF)
  }

  function terapkanPengerjaan(paket) {
    pretestId.value = paket.id
    tingkatId.value = paket.tingkatId
    soal.value = paket.soal.map((s) => ({ ...s }))
    hasil.value = null
    status.value = STATUS.MENGERJAKAN
    tulisSimpanan({ id: paket.id, tingkatId: paket.tingkatId })
  }

  function sinyalBaru() {
    controller?.abort()
    controller = new AbortController()
    return controller.signal
  }

  async function muatTingkat({ force = false } = {}) {
    if (inflightTingkat) return inflightTingkat
    if (!force && tingkatList.value.length && Date.now() - tingkatDimuatPada < SEGAR_TINGKAT_MS) {
      return Promise.resolve()
    }
    const signal = sinyalBaru()
    loading.value = true
    inflightTingkat = pretestService
      .tingkat({ signal })
      .then((list) => {
        if (signal.aborted) return
        tingkatList.value = list
        tingkatDimuatPada = Date.now()
      })
      .catch(() => {
        if (!signal.aborted) error.value = true
      })
      .finally(() => {
        if (!signal.aborted) loading.value = false
        inflightTingkat = null
      })
    return inflightTingkat
  }

  // POST mulai: 201 (baru) atau 200 (resume milik tingkat itu).
  async function mulai({ tingkatId: tid } = {}) {
    const signal = sinyalBaru()
    loading.value = true
    error.value = false
    try {
      terapkanPengerjaan(await pretestService.mulai({ tingkatId: tid, signal }))
    } catch (err) {
      if (!signal.aborted) error.value = true
      throw err
    } finally {
      if (!signal.aborted) loading.value = false
    }
  }

  // GET lihat: resume pengerjaan, atau langsung hasil bila sudah selesai.
  async function lanjutkan({ id } = {}) {
    const signal = sinyalBaru()
    loading.value = true
    error.value = false
    try {
      const paket = await pretestService.lihat({ id, signal })
      if (paket.jenis === 'pengerjaan') terapkanPengerjaan(paket)
      else {
        hasil.value = paket.hasil
        pretestId.value = paket.hasil.id
        status.value = STATUS.SELESAI
      }
    } catch (err) {
      if (!signal.aborted) error.value = true
      throw err
    } finally {
      if (!signal.aborted) loading.value = false
    }
  }

  // Autosave satu soal. Optimistis di lokal; kegagalan jaringan hanya
  // menandai simpanError agar view bisa memberi tahu user (tanpa toast tiap ketik).
  async function simpanJawaban({ soalId, jawaban }) {
    const target = soal.value.find((s) => s.id === soalId)
    if (target) target.jawaban = jawaban ?? null
    try {
      await pretestService.simpanJawaban({ id: pretestId.value, soalId, jawaban })
      simpanError.value = false
    } catch {
      simpanError.value = true
    }
  }

  // POST submit (idempoten) -> hasil. ID tersimpan dihapus setelah sukses.
  async function kumpulkan() {
    const signal = sinyalBaru()
    status.value = STATUS.MENGUMPULKAN
    error.value = false
    try {
      hasil.value = await pretestService.kumpulkan({ id: pretestId.value, signal })
      status.value = STATUS.SELESAI
      tulisSimpanan(null)
      return hasil.value
    } catch (err) {
      if (!signal.aborted) {
        error.value = true
        status.value = STATUS.MENGERJAKAN
      }
      throw err
    }
  }

  // Wajib dipanggil saat login/logout supaya pretest akun lama tidak bocor.
  function $reset() {
    controller?.abort()
    controller = null
    inflightTingkat = null
    tingkatDimuatPada = 0
    status.value = STATUS.IDLE
    tingkatList.value = []
    tingkatId.value = null
    pretestId.value = null
    soal.value = []
    hasil.value = null
    loading.value = false
    error.value = false
    simpanError.value = false
    tulisSimpanan(null)
  }

  return {
    status,
    tingkatList,
    tingkatId,
    pretestId,
    soal,
    hasil,
    loading,
    error,
    simpanError,
    jumlahTerjawab,
    idTersimpan: bacaSimpanan,
    muatTingkat,
    mulai,
    lanjutkan,
    simpanJawaban,
    kumpulkan,
    $reset,
  }
})
