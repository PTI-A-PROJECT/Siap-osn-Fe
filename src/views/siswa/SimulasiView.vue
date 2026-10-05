<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import UserMenu from '@/components/UserMenu.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()

// --- Data (masih mock; nantinya diganti data dari API) ---
// Tambahkan { key: 'nasional', status: 'terkunci', ... } bila ingin menampilkan level terkunci.
const levels = [
  { key: 'kabupaten', nama: 'Kabupaten', status: 'selesai', kode: 'OSN-K 2026', label: 'Sudah Dilalui',
    desc: 'Fondasi dasar Informatika. Kamu sudah menuntaskan tingkat ini.', soal: 25, menit: 60 },
  { key: 'provinsi', nama: 'Provinsi', status: 'berjalan', kode: 'OSN-P 2026', label: 'Sedang Berjalan',
    desc: 'Standar soal meningkat mengikuti seleksi tingkat provinsi.', soal: 30, menit: 90 },
]

const hasil = {
  skor: 74,
  judul: 'Simulasi Seleksi — Tingkat Provinsi',
  meta: '22 September 2026 · 25 dari 30 benar · Durasi 78 menit',
  stats: [
    { nilai: '25', label: 'Benar' },
    { nilai: '5', label: 'Salah' },
    { nilai: '78m', label: 'Durasi' },
    { nilai: '+5', label: 'Dari sebelumnya' },
  ],
}

// Ringkasan pembahasan: nomor soal yang dijawab salah (sisanya benar)
const pembahasan = {
  total: 30,
  salah: [4, 7, 15, 18, 26],
  judul: 'Dari simulasi Tingkat Provinsi · 22 September 2026',
}
const kotak = computed(() =>
  Array.from({ length: pembahasan.total }, (_, i) => ({
    no: i + 1,
    benar: !pembahasan.salah.includes(i + 1),
  }))
)
const jumlahSalah = computed(() => pembahasan.salah.length)
const jumlahBenar = computed(() => pembahasan.total - jumlahSalah.value)

// Lingkaran skor (SVG)
const R = 36
const keliling = 2 * Math.PI * R
const offset = computed(() => keliling * (1 - hasil.skor / 100))

// --- Modal detail simulasi ---
const modalTerbuka = ref(false)
const levelDipilih = ref(null)
const setuju = ref(false)
const modalEl = ref(null)

const aturan = computed(() => {
  const menit = levelDipilih.value?.menit ?? 0
  return [
    { judul: 'Timer Berjalan Otomatis',
      isi: 'Timer mulai berjalan langsung setelah simulasi dimulai dan tidak dapat dijeda atau dihentikan sementara.' },
    { judul: 'Penyimpanan Jawaban Otomatis (Autosave)',
      isi: 'Setiap opsi yang kamu klik akan otomatis tersimpan langsung ke server evaluasi secara real-time.' },
    { judul: 'Navigasi Bebas Antarsoal',
      isi: 'Kamu bebas berpindah antarsoal kapan saja melalui panel nomor soal di sisi kanan ruang ujian.' },
    { judul: 'Pengumpulan Otomatis oleh Sistem',
      isi: `Simulasi akan dikumpulkan secara otomatis oleh sistem tepat saat waktu ${menit} menit habis.` },
    { judul: 'Kestabilan Koneksi Jaringan',
      isi: 'Pastikan koneksi internet tetap aktif dan stabil selama pengerjaan untuk menghindari keterlambatan sinkronisasi data.' },
  ]
})

function bukaModal(level) {
  levelDipilih.value = level
  setuju.value = false
  modalTerbuka.value = true
}

function tutupModal() {
  modalTerbuka.value = false
}

function mulaiUjian() {
  if (!setuju.value || !levelDipilih.value) return
  const level = levelDipilih.value
  modalTerbuka.value = false

  // Halaman ujian belum dibuat. Kalau nanti ada route 'siswa.ujian', otomatis dipakai.
  if (router.hasRoute('siswa.ujian')) {
    router.push({ name: 'siswa.ujian', params: { level: level.key } })
    return
  }
  segeraHadir(`Halaman ujian tingkat ${level.nama} belum tersedia.`)
}

watch(modalTerbuka, (buka) => {
  document.body.style.overflow = buka ? 'hidden' : ''
  if (buka) nextTick(() => modalEl.value?.focus())
})

function onKeydown(e) {
  if (e.key === 'Escape' && modalTerbuka.value) tutupModal()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

// --- Navigasi lain ---
function lihatRiwayat() {
  router.push({ name: 'siswa.riwayat' })
}

function lihatPembahasan() {
  // Kalau nanti ada route 'siswa.pembahasan', otomatis dipakai.
  if (router.hasRoute('siswa.pembahasan')) {
    router.push({ name: 'siswa.pembahasan' })
    return
  }
  segeraHadir('Halaman pembahasan soal belum tersedia.')
}

function segeraHadir(detail) {
  toast.add({ severity: 'info', summary: 'Segera hadir', detail, life: 3000 })
}
</script>

<template>
  <div class="halaman">
    <header class="topbar">
      <div>
        <h1>{{ route.meta.title || 'Simulasi Seleksi' }}</h1>
        <p>Rasakan kondisi ujian sesungguhnya, sesuai standar TOKI</p>
      </div>
      <UserMenu />
    </header>

    <div class="konten">
      <!-- 01 Pilih tingkat -->
      <section>
        <span class="eyebrow">01 · Pilih Tingkat</span>
        <h2>Pilih Tingkat Simulasi</h2>
        <p class="sub">Tekan Mulai Simulasi untuk membuka halaman ujian.</p>

        <div class="grid-level">
          <article v-for="l in levels" :key="l.key" class="kartu level" :class="'is-' + l.status">
            <span class="badge" :class="'badge-' + l.status">
              <template v-if="l.status === 'terkunci'">🔒 </template>{{ l.label }}
            </span>
            <h3>{{ l.nama }}</h3>
            <p class="desc">{{ l.desc }}</p>
            <div class="info">
              <span>📝 {{ l.soal }} soal</span>
              <span>⏱ {{ l.menit }} menit</span>
            </div>
            <button v-if="l.status === 'selesai'" type="button" class="btn btn-hijau" @click="lihatRiwayat">Lihat Riwayat</button>
            <button v-else-if="l.status === 'berjalan'" type="button" class="btn btn-emas" @click="bukaModal(l)">Mulai Simulasi →</button>
            <button v-else type="button" class="btn btn-mati" disabled>Terkunci</button>
          </article>
        </div>
      </section>

      <hr />

      <!-- 02 Hasil terakhir -->
      <section>
        <span class="eyebrow">02 · Hasil Terakhir</span>
        <h2>Hasil Simulasi Terakhir</h2>
        <p class="sub">Ringkasan skor dari simulasi yang baru kamu selesaikan.</p>

        <div class="kartu hasil">
          <div class="hasil-atas">
            <div class="ring">
              <svg viewBox="0 0 88 88" width="80" height="80" aria-hidden="true">
                <circle cx="44" cy="44" :r="R" fill="none" stroke="#f1f3f7" stroke-width="8" />
                <circle cx="44" cy="44" :r="R" fill="none" stroke="#f0a30f" stroke-width="8" stroke-linecap="round"
                  :stroke-dasharray="keliling" :stroke-dashoffset="offset" transform="rotate(-90 44 44)" />
              </svg>
              <div class="ring-teks"><strong>{{ hasil.skor }}%</strong><small>Skor</small></div>
            </div>
            <div>
              <h3>{{ hasil.judul }}</h3>
              <p class="meta">{{ hasil.meta }}</p>
            </div>
          </div>
          <div class="stats">
            <div v-for="s in hasil.stats" :key="s.label" class="stat">
              <strong>{{ s.nilai }}</strong><span>{{ s.label }}</span>
            </div>
          </div>
        </div>
      </section>

      <hr class="hr-lebar" />

      <!-- 03 Pembahasan -->
      <section>
        <span class="eyebrow">03 · Pembahasan</span>
        <h2>Pembahasan Soal</h2>
        <p class="sub">Jawabanmu dibandingkan dengan jawaban benar, lengkap dengan penjelasannya.</p>

        <div class="kartu pembahasan">
          <div class="pembahasan-info">
            <h3>{{ pembahasan.total }} soal siap dibahas</h3>
            <p class="pembahasan-sub">{{ pembahasan.judul }}</p>

            <div class="kotak-grid" role="list" aria-label="Ringkasan jawaban per soal">
              <span
                v-for="k in kotak"
                :key="k.no"
                class="kotak"
                :class="k.benar ? 'kotak-benar' : 'kotak-salah'"
                role="listitem"
                :title="`Soal ${k.no}: ${k.benar ? 'benar' : 'salah'}`"
              />
            </div>

            <div class="legenda">
              <span><i class="titik titik-benar"></i>{{ jumlahBenar }} benar</span>
              <span><i class="titik titik-salah"></i>{{ jumlahSalah }} salah</span>
            </div>
          </div>

          <button type="button" class="btn btn-emas btn-auto" @click="lihatPembahasan">Lihat Pembahasan Soal →</button>
        </div>
      </section>
    </div>

    <!-- Modal detail simulasi -->
    <Teleport to="body">
      <Transition name="fade-modal">
        <div v-if="modalTerbuka && levelDipilih" class="overlay" @click.self="tutupModal">
          <div
            ref="modalEl"
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-modal"
            tabindex="-1"
          >
            <div class="modal-kepala">
              <h3 id="judul-modal" class="modal-judul"><i class="titik-emas"></i>Detail Simulasi</h3>
              <span class="pil-status">Tersedia untuk Dikerjakan</span>
            </div>

            <div class="grid-info">
              <div class="kartu-info">
                <span class="label-info">Tingkat Seleksi</span>
                <b class="nilai-info">{{ levelDipilih.nama }}</b>
                <span class="kode">{{ levelDipilih.kode }}</span>
              </div>
              <div class="kartu-info">
                <span class="label-info">Jumlah Soal</span>
                <span class="nilai-info"><b>{{ levelDipilih.soal }}</b> Soal</span>
                <span class="sub-info">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
                  Bank Soal Acak
                </span>
              </div>
              <div class="kartu-info">
                <span class="label-info">Durasi Waktu</span>
                <span class="nilai-info"><b>{{ levelDipilih.menit }}</b> Menit</span>
                <span class="sub-info">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
                  Countdown Statis
                </span>
              </div>
              <div class="kartu-info">
                <span class="label-info">Tipe Soal</span>
                <b class="nilai-info">Pilihan Ganda</b>
                <span class="sub-info">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                  5 Opsi (A - E)
                </span>
              </div>
            </div>

            <hr class="garis-modal" />

            <h4 class="judul-aturan">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" /><path d="M9 12l2 2 4-4" /></svg>
              Aturan dan Ketentuan Simulasi
            </h4>

            <ol class="aturan">
              <li v-for="(a, i) in aturan" :key="a.judul">
                <span class="nomor">{{ i + 1 }}</span>
                <div>
                  <p class="aturan-judul">{{ a.judul }}</p>
                  <p class="aturan-isi">{{ a.isi }}</p>
                </div>
              </li>
            </ol>

            <label class="setuju">
              <input v-model="setuju" type="checkbox" />
              <span>Saya telah membaca dan memahami aturan simulasi.</span>
            </label>

            <div class="modal-kaki">
              <button type="button" class="btn-modal btn-batal" @click="tutupModal">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Batal
              </button>
              <button type="button" class="btn-modal btn-mulai" :disabled="!setuju" @click="mulaiUjian">
                Mulai Simulasi
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.halaman { min-height: 100%; background: #f7f9fc; }

.topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  background: #fff; border-bottom: 1px solid #e6ebf2; padding: 18px 28px;
}
.topbar h1 { font-size: 20px; font-weight: 700; line-height: 1.25; margin: 0; color: #0f1b33; }
.topbar p { font-size: 14px; color: #6b778c; margin: 4px 0 0; }

.konten {
  --emas: #f59e0b;
  --emas-tua: #d9780a;
  --hijau: #12805a;
  --merah: #e11d48;
  --ink: #0f1b33;
  --abu: #6b778c;
  --garis: #e6e9f0;
  color: var(--ink);
  padding: 32px 28px 56px;
}
.konten, .konten *, .konten *::before, .konten *::after { box-sizing: border-box; }

.eyebrow { display: block; font-size: 12px; font-weight: 700; letter-spacing: .02em; color: var(--emas-tua); text-transform: uppercase; }
h2 { font-size: 26px; font-weight: 700; line-height: 1.25; margin: 4px 0 2px; }
h3 { font-size: 16px; font-weight: 700; margin: 0; }
.sub { font-size: 14px; color: var(--abu); margin: 0 0 14px; }
hr { border: 0; border-top: 1px solid var(--garis); margin: 32px 0; }
.hr-lebar { margin: 56px 0 32px; }

.kartu { background: #fff; border: 1px solid var(--garis); border-radius: 16px; padding: 24px; }

/* Level */
.grid-level { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; align-items: stretch; }
.level { display: flex; flex-direction: column; gap: 10px; box-shadow: 0 1px 3px rgba(15, 27, 51, .05); }
.level.is-berjalan { border: 2px solid var(--emas); padding: 23px; box-shadow: 0 6px 20px rgba(245, 158, 11, .15); }
.level h3 { font-size: 20px; margin-top: 8px; }
.badge { align-self: flex-start; font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 99px; white-space: nowrap; }
.badge-selesai { background: #e7f6ef; color: var(--hijau); }
.badge-berjalan { background: #fdf1d3; color: #92400e; }
.badge-terkunci { background: #eef1f6; color: var(--abu); }
.desc { font-size: 13px; color: var(--abu); line-height: 1.5; margin: 0; max-width: 260px; flex: 1; }
.info { display: flex; flex-wrap: nowrap; gap: 16px; font-size: 13px; color: var(--ink); margin: 6px 0 8px; white-space: nowrap; }
.btn {
  width: 100%; border: 0; border-radius: 10px; padding: 11px 14px;
  font: inherit; font-size: 13px; font-weight: 600; line-height: 1.2; white-space: nowrap; cursor: pointer;
  transition: background .15s ease;
}
.btn-hijau { background: #e9f7f0; color: var(--hijau); }
.btn-hijau:hover { background: #dcf1e7; }
.btn-emas { background: var(--emas); color: #1a1a1a; }
.btn-emas:hover { background: #f7ae2e; }
.btn-mati { background: #eef1f6; color: var(--abu); cursor: not-allowed; }
.btn:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.btn-auto { width: auto; padding: 11px 20px; border-radius: 8px; flex: none; }

/* Hasil */
.hasil { padding: 28px; }
.hasil-atas { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.ring { position: relative; width: 80px; height: 80px; flex: none; }
.ring-teks { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ring-teks strong { font-size: 17px; line-height: 1.1; }
.ring-teks small { font-size: 11px; color: var(--abu); }
.hasil-atas h3 { font-size: 17px; }
.meta { font-size: 13px; color: var(--abu); margin: 4px 0 0; }
.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.stat {
  background: #fafbfd; border: 1px solid #eef1f6; border-radius: 12px; padding: 18px 8px;
  text-align: center; display: flex; flex-direction: column; gap: 4px;
}
.stat strong { font-size: 22px; line-height: 1.2; }
.stat span { font-size: 12px; color: var(--abu); }

/* Pembahasan */
.pembahasan { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.pembahasan-info h3 { font-size: 17px; }
.pembahasan-sub { font-size: 14px; color: var(--abu); margin: 4px 0 14px; }
.kotak-grid { display: grid; grid-template-columns: repeat(15, 18px); gap: 5px; max-width: 100%; }
.kotak { width: 18px; height: 16px; border-radius: 4px; border: 1px solid transparent; }
.kotak-benar { background: #e7f6ef; border-color: #cdeedd; }
.kotak-salah { background: #fde8ec; border-color: #f9c4cf; }
.legenda { display: flex; gap: 16px; margin-top: 10px; font-size: 12.5px; color: var(--abu); }
.legenda span { display: inline-flex; align-items: center; gap: 6px; }
.titik { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.titik-benar { background: #16a34a; }
.titik-salah { background: var(--merah); }

/* Modal detail simulasi (dirender di <body>, jadi punya variabel sendiri) */
.overlay {
  --emas: #f59e0b;
  --ink: #0f1b33;
  --garis: #e6e9f0;
  position: fixed; inset: 0; z-index: 1000;
  display: flex; padding: 24px 16px;
  background: rgba(15, 27, 51, .55);
  overflow-y: auto;
}
.overlay, .overlay *, .overlay *::before, .overlay *::after { box-sizing: border-box; }
.modal {
  width: 100%; max-width: 960px; margin: auto;
  background: #fff; color: var(--ink); border-radius: 14px;
  padding: 32px 44px 28px;
  box-shadow: 0 24px 60px rgba(15, 27, 51, .3);
  outline: none;
}
.modal svg {
  width: 14px; height: 14px; flex: none; fill: none; stroke: currentColor;
  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
.modal-kepala { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
.modal-judul { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; margin: 0; }
.titik-emas { width: 8px; height: 8px; border-radius: 50%; background: var(--emas); display: inline-block; }
.pil-status {
  display: inline-flex; align-items: center; gap: 6px;
  background: #fde3b8; color: #5c3200; font-size: 12.5px; font-weight: 500;
  padding: 6px 12px; border-radius: 99px;
}
.pil-status::before { content: ''; width: 4px; height: 4px; border-radius: 50%; background: currentColor; }

.grid-info { display: grid; grid-template-columns: 1.08fr 1fr 1fr .94fr; gap: 12px; }
.kartu-info {
  border: 1px solid var(--garis); border-radius: 12px; padding: 14px 20px;
  display: flex; flex-direction: column; gap: 7px;
}
.label-info { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
.nilai-info { font-size: 13.5px; }
.nilai-info b, b.nilai-info { font-weight: 700; }
.sub-info { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #3c4658; }
.kode {
  align-self: flex-start; font-size: 11px; font-weight: 500;
  background: #fdf1d3; color: #92400e; padding: 2px 8px; border-radius: 6px;
}

.garis-modal { border: 0; border-top: 1px solid var(--garis); margin: 22px 0; }

.judul-aturan { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; margin: 0 0 14px; }
.judul-aturan svg { color: #b7791f; }

.aturan { list-style: none; margin: 0; padding: 22px 26px; background: #f5f8fe; border-radius: 12px; display: flex; flex-direction: column; gap: 10px; }
.aturan li { display: flex; gap: 12px; align-items: flex-start; }
.nomor {
  flex: none; width: 24px; height: 24px; border-radius: 50%;
  display: grid; place-items: center; background: #e4ecf9; font-size: 12px; font-weight: 700;
}
.aturan p { margin: 0; font-size: 13px; line-height: 1.5; max-width: 640px; }
.aturan-judul { font-weight: 600; }
.aturan-isi { color: #2b3447; }

.setuju { display: flex; align-items: center; gap: 10px; margin: 20px 0 0 10px; font-size: 13px; font-weight: 500; cursor: pointer; width: fit-content; }
.setuju input { width: 16px; height: 16px; margin: 0; accent-color: var(--emas); cursor: pointer; }

.modal-kaki { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 28px; }
.btn-modal {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: 0; border-radius: 8px; padding: 9px 18px;
  font: inherit; font-size: 13px; font-weight: 600; line-height: 1.2; cursor: pointer;
  transition: background .15s ease, opacity .15s ease;
}
.btn-batal { background: #b91c1c; color: #fff; padding: 9px 16px; }
.btn-batal:hover { background: #a11818; }
.btn-mulai { background: var(--emas); color: #1a1a1a; }
.btn-mulai:hover:not(:disabled) { background: #f7ae2e; }
.btn-mulai:disabled { opacity: .45; cursor: not-allowed; }
.btn-modal:focus-visible, .setuju input:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }

.fade-modal-enter-active, .fade-modal-leave-active { transition: opacity .18s ease; }
.fade-modal-enter-active .modal, .fade-modal-leave-active .modal { transition: transform .18s ease; }
.fade-modal-enter-from, .fade-modal-leave-to { opacity: 0; }
.fade-modal-enter-from .modal, .fade-modal-leave-to .modal { transform: translateY(8px); }
@media (prefers-reduced-motion: reduce) {
  .fade-modal-enter-active, .fade-modal-leave-active,
  .fade-modal-enter-active .modal, .fade-modal-leave-active .modal { transition: none; }
}

/* Responsif */
@media (max-width: 1000px) {
  .modal { padding: 28px 24px 24px; }
  .grid-info { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 768px) {
  .topbar { padding: 14px 16px; }
  .konten { padding: 22px 16px 40px; }
  h2 { font-size: 22px; }
  .grid-level { grid-template-columns: 1fr; gap: 16px; }
  .hasil { padding: 20px; }
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pembahasan { flex-direction: column; align-items: stretch; }
  .kotak-grid { grid-template-columns: repeat(10, 18px); }
  .btn-auto { width: 100%; }
}
@media (max-width: 560px) {
  .overlay { padding: 12px 8px; }
  .modal { padding: 20px 14px 16px; }
  .grid-info { grid-template-columns: 1fr; }
  .kartu-info { padding: 12px 16px; }
  .aturan { padding: 16px 14px; }
  .setuju { margin-left: 0; align-items: flex-start; }
  .modal-kaki { margin-top: 22px; }
}
</style>