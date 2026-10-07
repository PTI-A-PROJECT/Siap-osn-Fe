<script setup>
const levels = [
  {
    title: 'Kabupaten',
    text: 'Tahap awal untuk membangun dasar Informatika dan mengenali topik yang perlu diperkuat.',
  },
  {
    title: 'Provinsi',
    text: 'Materi dan simulasi lebih menantang, mengikuti standar seleksi tingkat provinsi.',
  },
]
</script>

<template>
  <section id="tingkat" class="section section--soft">
    <div class="container levels">
      <small class="kicker kicker--center">Jenjang seleksi</small>
      <h2 class="marked--center">Naik tingkat sesuai <span class="hl">pencapaianmu</span></h2>
      <p class="levels__lead">
        Tingkat Provinsi terbuka setelah kamu memenuhi ketentuan di tingkat Kabupaten.
      </p>
      <div class="levels__row">
        <template v-for="(l, i) in levels" :key="l.title">
          <article class="level">
            <h3>{{ l.title }}</h3>
            <p>{{ l.text }}</p>
          </article>
          <span v-if="i < levels.length - 1" class="levels__arrow" aria-hidden="true">→</span>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped src="./shared.css"></style>

<style scoped>
.lp .levels__lead {
  text-align: center;
  color: var(--muted);
  font-size: 0.92rem;
  max-width: 46ch;
  margin: 16px auto 64px;
}

.levels__row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
}

.level {
  background: #fff;
  border-radius: var(--radius);
  padding: 28px;
  height: 100%;
}

.level h3 {
  font-size: 1.05rem;
  margin-bottom: 8px;
}

.level p {
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--muted);
}

.levels__arrow {
  color: #98a3bf;
  font-size: 1.4rem;
}

.levels .marked--center {
  margin-top: 14px;
}

@media (max-width: 900px) {
  .levels__row {
    grid-template-columns: 1fr;
  }
  .levels__arrow {
    display: none;
  }
}
</style>
