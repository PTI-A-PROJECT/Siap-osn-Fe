<script setup>
const features = [
  {
    title: 'Pre-test Adaptif',
    text: 'Mengukur kemampuan awalmu sebelum mulai belajar, sesuai tingkat seleksi yang kamu pilih.',
  },
  {
    title: 'Pemetaan Kompetensi Otomatis',
    text: 'Hasil pre-test diolah menjadi peta kompetensi: topik mana yang sudah kuat dan mana yang masih lemah.',
    dark: true,
  },
  {
    title: 'Rekomendasi Materi Personalisasi',
    text: 'Materi disusun dari hasil pemetaanmu, jadi waktu belajar tidak habis untuk topik yang sudah kamu kuasai.',
  },
  {
    title: 'Simulasi Seleksi Bertingkat',
    text: 'Simulasi ujian untuk tiap tingkat, dengan format dan tingkat kesulitan yang mendekati seleksi sebenarnya.',
  },
  {
    title: 'Pembahasan & Evaluasi Tiap Soal',
    text: 'Setiap soal punya pembahasan, sehingga kamu tahu letak kesalahan dan cara memperbaikinya.',
    dark: true,
  },
  {
    title: 'Dashboard Progress Belajar',
    text: 'Lihat perkembangan belajar, riwayat pre-test, latihan, dan simulasi di satu halaman.',
  },
]
</script>

<template>
  <section id="fitur" class="section section--white">
    <div class="container">
      <h2 class="marked--block">Semua yang kamu butuhkan untuk <span class="hl">satu jalur persiapan</span></h2>
      <div class="features">
        <article v-for="f in features" :key="f.title" class="feature" :class="{ 'feature--dark': f.dark }">
          <h3>{{ f.title }}</h3>
          <p>{{ f.text }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped src="./shared.css"></style>

<style scoped>
.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.feature {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 28px 26px;
}

.feature h3 {
  font-size: 1rem;
  margin-bottom: 10px;
}

.feature p {
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--muted);
}

.feature--dark {
  background: var(--navy);
  border-color: var(--navy);
  color: #fff;
}

.feature--dark p {
  color: #b7c4e2;
}

@media (max-width: 900px) {
  .features {
    grid-template-columns: 1fr;
  }
}
</style>
