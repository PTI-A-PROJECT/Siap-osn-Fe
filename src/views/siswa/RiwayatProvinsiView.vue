<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UserMenu from '@/components/UserMenu.vue'
import PretestWarningDialog from '@/components/PretestWarningDialog.vue'

const route = useRoute()
const router = useRouter()

// ---- Data halaman ini (sementara hardcode; nanti ganti dengan data API) ----

const data = {
  singkat: 'Provinsi',
  berikutnya: null,
  status: 'berjalan',
  deskripsiMateri: 'Selesaikan semua materi dan latihan untuk menuntaskan tahap ini.',
  preTest: [
    { tgl: '15 Jun 2026', tingkat: 'Provinsi', skor: 64, benar: '16/25', durasi: '44 menit', tren: 'turun' },
    { tgl: '02 Jun 2026', tingkat: 'Provinsi', skor: 72, benar: '18/25', durasi: '50 menit', tren: 'awal' },
  ],
  stats: [
    { label: 'Total Pre-Test', value: '1x', note: 'dari 2 tahap' },
    { label: 'Rata-rata Skor', value: '63%', note: '-19% dari awal', tone: 'bad' },
    { label: 'Topik Paling Lemah', value: 'Materi 3' },
  ],
  materiStats: {
    dibuka: { done: 4, total: 10 },
    latihan: { done: 3, total: 10 },
    rata: 79,
    selisih: 5,
  },
  materi: [
    { tgl: '10 Sep 2026', nama: 'Materi 1', status: 'dibaca', soal: 10, nilai: 72, durasi: '14 menit' },
    { tgl: '11 Sep 2026', nama: 'Materi 2', status: 'dibaca', soal: 10, nilai: 80, durasi: '16 menit' },
    { tgl: '12 Sep 2026', nama: 'Materi 3', status: 'dibaca', soal: 10, nilai: 85, durasi: '18 menit' },
    { tgl: null, nama: 'Materi 4', status: 'dibaca', soal: 10, nilai: null, durasi: null },
    { tgl: null, nama: 'Materi 5', status: 'belum', soal: 10, nilai: null, durasi: null },
    { tgl: null, nama: 'Materi 6', status: 'belum', soal: 10, nilai: null, durasi: null },
    { tgl: null, nama: 'Materi 7', status: 'belum', soal: 10, nilai: null, durasi: null },
    { tgl: null, nama: 'Materi 8', status: 'belum', soal: 10, nilai: null, durasi: null },
    { tgl: null, nama: 'Materi 9', status: 'belum', soal: 10, nilai: null, durasi: null },
    { tgl: null, nama: 'Materi 10', status: 'belum', soal: 10, nilai: null, durasi: null },
  ],
}

// ---- Kartu posisi tahap (link ke halaman masing-masing) ----
const daftarTahap = [
  { nama: 'OSN Kabupaten/Kota', info: 'Tuntas · materi 5/5 · latihan 5/5', to: { name: 'siswa.riwayat-kabupaten' } },
  { nama: 'OSN Provinsi', info: 'Sedang berjalan · materi 4/10 · latihan 3/10', to: { name: 'siswa.riwayat-provinsi' } },
].map((t) => ({ ...t, aktif: route.name === t.to.name }))

// ---- Turunan data ----
const preTest = data.preTest
const adaPreTest = preTest.length > 0
const preTestStats = adaPreTest
  ? data.stats
  : [
      { label: 'Total Pre-Test', value: '0x', note: 'Belum ada' },
      { label: 'Rata-rata Skor', value: '0%', note: 'Belum ada pembanding' },
      { label: 'Topik Paling Lemah', value: '-' },
    ]
const materiStats = data.materiStats

// ---- Helper tampilan ----
const warnaSkor = (n) => (n >= 80 ? 'ok' : n >= 65 ? 'warn' : 'bad')
const teksTren = { turun: '↓ Turun', naik: '↑ Naik', stabil: '→ Stabil', konsisten: 'Konsisten', awal: 'Awal' }
const teksStatus = { dibaca: 'Selesai dibaca', belum: 'Belum dibuka' }
const teksTahap = { tuntas: 'Tuntas', berjalan: 'Berjalan' }
const persen = (p) => `${(p.done / p.total) * 100}%`

const banner = computed(() => {
  if (!adaPreTest) {
    return {
      tone: 'biru',
      judul: 'Satu langkah kecil untuk memulai',
      isi: 'Kerjakan pre-test pertamamu, lalu kami tunjukkan materi mana yang paling perlu kamu kuatkan.',
    }
  }
  if (data.status === 'tuntas') {
    const lanjut = data.berikutnya ? ` Siap lanjut ke tingkat ${data.berikutnya}.` : ''
    return {
      tone: 'hijau',
      judul: 'Luar biasa, semua tahap tuntas!',
      isi: `Kamu menyelesaikan seluruh materi, latihan, dan simulasi dari ${data.singkat}. Ini hasil konsistensi yang panjang.${lanjut}`,
    }
  }
  return preTest[0]?.tren === 'turun'
    ? {
        judul: 'Tetap semangat, kamu pasti bisa!',
        isi: 'Nilai terakhirmu turun sedikit, dan itu wajar saat materi makin sulit. Ulangi materi yang masih lemah, lalu coba latihan berikutnya.',
      }
    : {
        judul: 'Kerja bagus, pertahankan ritmemu!',
        isi: 'Nilaimu bergerak ke arah yang baik. Lanjutkan materi berikutnya dan teruslah berlatih.',
      }
})

// ---- Peringatan belum pre-test ----
const tampilModal = ref(!adaPreTest)

function kerjakanSekarang() {
  tampilModal.value = false
  router.push('/siswa/pre-test') // TODO: sesuaikan dengan route halaman pre-test
}

function lewatiDulu() {
  tampilModal.value = false
}

// ---- Grafik SVG ----
const W = 640, L = 44, R = 630, T = 26, B = 206
const y = (v) => B - (v / 100) * (B - T)
const nilai = data.materi.map((m) => m.nilai)
const slot = (R - L) / nilai.length
const bars = nilai.map((v, i) => ({
  label: `M${i + 1}`,
  v,
  x: L + slot * i + slot / 2,
  y: v == null ? null : y(v),
  h: v == null ? 0 : B - y(v),
}))
const garisEmas = bars.filter((b) => b.v != null).map((b) => `${b.x},${b.y}`).join(' ')
</script>

<template>
  <div class="min-h-full bg-[#f5f8fc] text-[#0f1b33]">
    <header class="flex items-center justify-between border-b border-[#e6ebf2] bg-white px-7 py-4">
      <div>
        <h1 class="text-[17px] font-bold leading-tight">{{ route.meta.title ?? 'Riwayat Hasil' }}</h1>
        <p class="mt-0.5 text-xs text-[#6b778c]">
          Semua jejak pre-test, materi, latihan, dan simulasi yang pernah kamu kerjakan
        </p>
      </div>
      <UserMenu />
    </header>

    <main class="px-6 py-6">
      <div class="riwayat">
        <div class="banner" :class="banner.tone">
          <p class="banner-title">{{ banner.judul }}</p>
          <p class="banner-text">{{ banner.isi }}</p>
        </div>

        <!-- 01 Posisi tahap -->
        <section class="section">
          <p class="eyebrow">01 · POSISI TAHAP</p>
          <h2>Kamu ada di tahap mana</h2>
          <p class="desc">Tahap dibuka satu per satu. Provinsi baru terbuka setelah Kabupaten tuntas.</p>
          <div class="tahap">
            <RouterLink
              v-for="t in daftarTahap"
              :key="t.nama"
              :to="t.to"
              class="card tahap-card"
              :class="{ aktif: t.aktif }"
              :aria-current="t.aktif ? 'page' : undefined"
            >
              <span class="tahap-nama">{{ t.nama }}</span>
              <span class="tahap-info">{{ t.info }}</span>
            </RouterLink>
          </div>
        </section>

        <!-- 02 Riwayat pre-test -->
        <section class="section">
          <p class="eyebrow">02 · RIWAYAT PRE-TEST</p>
          <h2>Riwayat Pre-Test</h2>
          <p class="desc">Pre-test hanya bisa dikerjakan 1 kali di setiap tahap untuk memetakan kompetensi.</p>

          <div class="stats">
            <div v-for="s in preTestStats" :key="s.label" class="card stat">
              <p class="stat-label">{{ s.label }}</p>
              <p class="stat-value">{{ s.value }}</p>
              <p v-if="s.note" class="stat-note" :class="s.tone">{{ s.note }}</p>
            </div>
          </div>

          <div class="card table-card">
            <table>
              <thead>
                <tr><th>Tanggal</th><th>Tingkat</th><th>Skor</th><th>Benar</th><th>Durasi</th><th>Tren</th></tr>
              </thead>
              <tbody>
                <tr v-if="!adaPreTest">
                  <td colspan="6" class="kosong-row">Belum ada pre-test yang dikerjakan.</td>
                </tr>
                <tr v-for="r in preTest" :key="r.tgl">
                  <td>{{ r.tgl }}</td>
                  <td><span class="badge" :class="r.tingkat.toLowerCase()">{{ r.tingkat }}</span></td>
                  <td><span class="skor" :class="warnaSkor(r.skor)">{{ r.skor }}%</span></td>
                  <td>{{ r.benar }}</td>
                  <td>{{ r.durasi }}</td>
                  <td><span class="badge" :class="r.tren">{{ teksTren[r.tren] }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 03 Materi dan latihan -->
        <section class="section">
          <p class="eyebrow">03 · MATERI DAN LATIHAN</p>
          <div class="title-row">
            <h2>Materi dan Latihan Soal</h2>
            <span class="badge" :class="data.status">{{ teksTahap[data.status] }}</span>
          </div>
          <p class="desc">{{ data.deskripsiMateri }}</p>

          <div class="stats">
            <div class="card stat">
              <p class="stat-label">Materi dibuka</p>
              <p class="stat-value">{{ materiStats.dibuka.done }}/{{ materiStats.dibuka.total }}</p>
              <div class="progress"><div class="progress-fill" :style="{ width: persen(materiStats.dibuka) }"></div></div>
              <p class="stat-sub">{{ materiStats.dibuka.total - materiStats.dibuka.done }} materi belum selesai</p>
            </div>
            <div class="card stat">
              <p class="stat-label">Latihan dikerjakan</p>
              <p class="stat-value">{{ materiStats.latihan.done }}/{{ materiStats.latihan.total }}</p>
              <div class="progress"><div class="progress-fill" :style="{ width: persen(materiStats.latihan) }"></div></div>
              <p class="stat-sub">{{ materiStats.latihan.total - materiStats.latihan.done }} latihan tersisa</p>
            </div>
            <div class="card stat">
              <p class="stat-label">Rata-rata nilai latihan</p>
              <p class="stat-value gold">{{ materiStats.rata }}</p>
              <p
                class="stat-note"
                :class="materiStats.selisih < 0 ? 'bad' : materiStats.selisih > 0 ? 'good' : ''"
              >
                {{ materiStats.selisih > 0 ? '+' : '' }}{{ materiStats.selisih }} dari latihan sebelumnya
              </p>
            </div>
          </div>

          <div class="card chart-card">
            <p class="chart-title">Grafik nilai latihan per materi</p>
            <svg :viewBox="`0 0 ${W} 250`" class="chart" role="img" aria-label="Grafik nilai latihan per materi">
              <g v-for="g in [0, 50, 100]" :key="g">
                <line :x1="L" :x2="R" :y1="y(g)" :y2="y(g)" class="grid" />
                <text :x="L - 10" :y="y(g) + 3" class="axis" text-anchor="end">{{ g }}</text>
              </g>
              <template v-for="b in bars" :key="b.label">
                <template v-if="b.v != null">
                  <rect :x="b.x - 14" :y="b.y" width="28" :height="b.h" rx="4" class="bar" />
                  <text :x="b.x" :y="b.y - 6" class="val" text-anchor="middle">{{ b.v }}</text>
                </template>
                <line v-else :x1="b.x - 6" :x2="b.x + 6" :y1="B - 6" :y2="B - 6" class="kosong" />
                <text :x="b.x" :y="B + 26" class="axis" text-anchor="middle">{{ b.label }}</text>
              </template>
              <polyline v-if="garisEmas" :points="garisEmas" class="garis" />
            </svg>
            <p class="chart-note">Garis emas menunjukkan arah nilaimu dari materi ke materi.</p>
          </div>

          <div class="card table-card">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th><th>Materi</th><th>Status materi</th>
                  <th>Jumlah soal</th><th>Nilai</th><th>Durasi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in data.materi" :key="m.nama">
                  <td>{{ m.tgl ?? '-' }}</td>
                  <td>{{ m.nama }}</td>
                  <td><span class="badge" :class="m.status">{{ teksStatus[m.status] }}</span></td>
                  <td>{{ m.soal }}</td>
                  <td>
                    <span v-if="m.nilai != null" class="skor" :class="warnaSkor(m.nilai)">{{ m.nilai }}</span>
                    <span v-else>Belum latihan</span>
                  </td>
                  <td>{{ m.durasi ?? '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>

    <PretestWarningDialog v-if="tampilModal" @kerjakan="kerjakanSekarang" @lewati="lewatiDulu" />
  </div>
</template>

<style scoped>
.riwayat {
  --gold: #e5a823;
  --gold-dark: #c8921a;
  --text: #0f1b33;
  --muted: #6b7686;
  --line: #e6ebf2;
  --ok: #1faa6b;
  --warn: #d99a1e;
  --bad: #e5484d;
  --bar: #4a72d4;

  color: var(--text);
  font-size: 13px;
}

.banner {
  padding: 20px 40px;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(90deg, #b8861f 0%, #c5622f 55%, #dc4a3f 100%);
}
.banner.biru { background: linear-gradient(90deg, #1e3a8a 0%, #1f4cc0 100%); }
.banner.hijau { background: linear-gradient(90deg, #0f8a4c 0%, #16a35a 100%); }
.banner-title { margin: 0; font-size: 15px; font-weight: 700; }
.banner-text { margin: 6px 0 0; max-width: 520px; font-size: 11.5px; line-height: 1.55; opacity: 0.95; }
.kosong-row { padding: 22px 0; color: var(--muted); }

.section { padding: 22px 0 28px; }
.section + .section { border-top: 1px solid var(--line); padding-top: 28px; }
.eyebrow { margin: 0 0 4px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; color: var(--gold-dark); }
.section h2 { margin: 0; font-size: 17px; font-weight: 600; }
.title-row { display: flex; align-items: center; gap: 12px; }
.desc { margin: 3px 0 14px; color: var(--muted); font-size: 12px; }

.card { background: #fff; border: 1px solid var(--line); border-radius: 16px; }

/* Tahap (kartu = link ke halaman tahap) */
.tahap { display: grid; grid-template-columns: repeat(2, minmax(0, 260px)); gap: 14px; }
.tahap-card { display: block; padding: 14px 18px; color: inherit; text-decoration: none; }
.tahap-card:hover { border-color: #e9cf8e; }
.tahap-card.aktif { border: 2px solid var(--gold); padding: 13px 17px; }
.tahap-card:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
.tahap-nama { display: block; font-size: 14px; font-weight: 700; }
.tahap-info { display: block; margin-top: 5px; font-size: 10.5px; color: var(--muted); }

/* Statistik */
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 14px; }
.stat { padding: 16px 20px; min-height: 92px; }
.stat-label { margin: 0 0 6px; font-size: 11.5px; font-weight: 600; }
.stat-value { margin: 0; font-size: 20px; font-weight: 700; line-height: 1.25; }
.stat-value.gold { color: var(--gold); }
.stat-note { margin: 8px 0 0; font-size: 10.5px; font-weight: 600; color: var(--muted); }
.stat-note.bad { color: var(--bad); }
.stat-note.good { color: var(--ok); }
.stat-sub { margin: 8px 0 0; font-size: 10.5px; font-weight: 600; color: var(--muted); }
.progress { margin-top: 10px; height: 5px; border-radius: 999px; background: #eef0f6; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 999px; background: var(--gold); }

/* Grafik */
.chart-card { padding: 18px 22px 16px; margin-bottom: 14px; }
.chart-title { margin: 0 0 4px; font-size: 12px; font-weight: 700; }
.chart { width: 100%; height: auto; display: block; }
.grid { stroke: #e3e7ee; stroke-width: 1.2; }
.axis { font-size: 10px; fill: var(--muted); }
.bar { fill: var(--bar); }
.val { font-size: 11px; font-weight: 700; fill: var(--text); }
.kosong { stroke: #5a6578; stroke-width: 2; }
.garis { fill: none; stroke: var(--gold); stroke-width: 2; stroke-linejoin: round; }
.chart-note { margin: 6px 0 0; font-size: 10.5px; color: var(--muted); }

/* Tabel */
.table-card { padding: 14px 30px 18px; overflow-x: auto; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; }
th { padding: 12px 0; text-align: center; font-size: 10.5px; font-weight: 600; color: #5a6578; border-bottom: 1px solid var(--line); }
td { padding: 11px 0; text-align: center; font-size: 11.5px; border-bottom: 1px solid #f0f2f6; white-space: nowrap; }
tbody tr:last-child td { border-bottom: 0; }

.skor { font-size: 11.5px; font-weight: 700; }
.skor.ok { color: var(--ok); }
.skor.warn { color: var(--warn); }
.skor.bad { color: var(--bad); }

.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 9.5px; font-weight: 700; }
.badge.kabupaten { background: #e3edff; color: #1d3f8f; }
.badge.provinsi { background: #f6e3a8; color: #8a5a00; }
.badge.turun { background: #fde4e4; color: #c7383d; }
.badge.naik { background: #dff5ea; color: #13804f; }
.badge.stabil { background: #eef1f6; color: #5a6578; }
.badge.konsisten { background: #e3edff; color: #1d3f8f; }
.badge.awal { background: #e3edff; color: #1d3f8f; }
.badge.dibaca { background: #dff5ea; color: #13804f; }
.badge.belum { background: #e8eefb; color: #2f3f73; }
.badge.tuntas { background: #dff5ea; color: #13804f; }
.badge.berjalan { background: #e8eefb; color: #2f3f73; }

@media (max-width: 860px) {
  .stats { grid-template-columns: 1fr; }
  .tahap { grid-template-columns: 1fr; }
  .banner { padding: 18px 20px; }
  .table-card { padding: 10px 16px 14px; }
  td, th { padding-right: 18px; }
}
</style>