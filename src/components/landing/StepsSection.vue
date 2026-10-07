<script setup>
const steps = [
  {
    title: 'Daftar',
    text: 'Buat akun dengan nama, email, dan kata sandi.',
  },
  {
    title: 'Pilih Tingkat',
    text: 'Pilih tingkat seleksi yang sedang kamu ikuti: Kabupaten atau Provinsi.',
  },
  {
    title: 'Kerjakan Pre-Test',
    text: 'Jawab soal pre-test untuk mengetahui kemampuan awal dan topik yang perlu diperkuat.',
  },
  {
    title: 'Belajar & Simulasi',
    text: 'Pelajari materi yang direkomendasikan, lalu uji kesiapanmu lewat simulasi seleksi.',
  },
]
</script>

<template>
<section id="cara-kerja" class="section section--navy-2">
      <div class="container">
        <small class="kicker">Alur belajar</small>
        <h2 class="light">Cara kerja</h2>
        <p class="light-muted">
          Empat langkah dari mendaftar sampai siap menghadapi seleksi.
        </p>
        <ol class="steps">
          <li v-for="(s, i) in steps" :key="s.title">
            <span class="steps__no">{{ String(i + 1).padStart(2, '0') }}</span>
            <strong>{{ s.title }}</strong>
            <p>{{ s.text }}</p>
          </li>
        </ol>
      </div>
    </section>
</template>

<style scoped src="./shared.css"></style>

<style scoped>
.light {
  color: #fff;
  font-size: clamp(1.6rem, 3vw, 2.1rem);
  margin: 8px 0 10px;
}

.light-muted {
  color: #c8d2ea;
  font-size: 0.92rem;
  max-width: 44ch;
}

.steps {
  list-style: none;
  margin: 40px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.steps li {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: var(--radius);
  padding: 22px 20px;
}

.steps strong {
  display: block;
  font-size: 0.9rem;
  margin-bottom: 6px;
}

.steps p {
  font-size: 0.78rem;
  color: #9fb0d3;
}

.steps li {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: var(--radius);
  padding: 22px 20px;
}

.steps__no {
  display: block;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.4rem;
  font-weight: 600;
  margin-bottom: 22px;
}

.steps strong {
  display: block;
  font-size: 0.9rem;
  margin-bottom: 6px;
}

.steps p {
  font-size: 0.78rem;
  color: #9fb0d3;
}

@media (max-width: 900px) {
  .steps {
    grid-template-columns: 1fr;
  }
}
</style>
