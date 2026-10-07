<script setup>
const stats = [
  { value: '2', label: 'Tingkat seleksi' },
  { value: '6', label: 'Kelompok fitur belajar' },
  { value: '100%', label: 'Materi dipersonalisasi' },
]
</script>

<template>
  <section class="hero">
    <div class="container hero__grid">
      <div class="hero__copy">
        <span class="pill">Persiapan OSN Bidang Informatika</span>
        <h1>Sistem Interaktif<br />Adaptif<br />Persiapan OSN</h1>
        <p class="hero__lead">
          Platform belajar adaptif untuk persiapan OSN Bidang Informatika, dari tingkat Kabupaten
          hingga Provinsi. Ikuti pre-test untuk memetakan kompetensimu, lalu dapatkan materi,
          latihan, dan simulasi seleksi yang disesuaikan dengan hasilmu.
        </p>
        <div class="hero__cta">
          <a href="/register" class="btn btn--light">Mulai Pre-Test Gratis</a>
          <a href="#cara-kerja" class="btn btn--outline">Lihat Cara Kerja</a>
        </div>
        <dl class="stats">
          <div v-for="s in stats" :key="s.label">
            <dt>{{ s.value }}</dt>
            <dd>{{ s.label }}</dd>
          </div>
        </dl>
      </div>

      <div class="hero__visual">
        <img class="hero__logo" src="/logo-icon.png" alt="Logo SIAP OSN" />
      </div>
    </div>
  </section>
</template>

<style scoped src="./shared.css"></style>

<style scoped>
.hero {
  background: linear-gradient(180deg, var(--navy) 0%, #0b2245 100%);
  color: #fff;
  padding: 56px 0 72px;
  /* Tinggi minimal satu layar (dikurangi navbar) agar layar pertama penuh biru */
  min-height: calc(100vh - 64px);
  min-height: calc(100svh - 64px);
  display: flex;
  align-items: center;
}

.hero__grid {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 48px;
  align-items: center;
}

.hero h1 {
  font-size: clamp(2rem, 4.2vw, 2.9rem);
  font-weight: 700;
  margin: 18px 0 16px;
}

.hero__lead {
  color: #c8d2ea;
  font-size: 0.95rem;
  max-width: 52ch;
}

.hero__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 28px 0 40px;
}

.stats {
  display: flex;
  gap: 40px;
  margin: 0;
}

.stats dt {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.4rem;
  font-weight: 700;
}

.stats dd {
  margin: 0;
  font-size: 0.75rem;
  color: #9fb0d3;
}

/* Logo di sisi kanan hero (menggantikan kartu pemetaan kompetensi) */
.hero__visual {
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero__logo {
  width: clamp(240px, 40vw, 500px);
  aspect-ratio: 1;
  object-fit: contain;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
}

.pill {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 500;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

@media (max-width: 900px) {
  .hero__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .stats {
    gap: 24px;
  }
}
</style>
