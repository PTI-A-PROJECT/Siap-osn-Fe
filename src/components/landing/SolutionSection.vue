<script setup>
const priorities = [
  { judul: 'Dynamic Programming Dasar', sub: 'Prioritas tinggi · Belum dikuasai', tone: 'yellow' },
  { judul: 'Graf & Pohon Lanjutan', sub: 'Prioritas sedang · Perlu latihan', tone: 'blue' },
  { judul: 'Struktur Data Dasar', sub: 'Dikuasai · Simulasi tersedia', tone: 'green' },
]
</script>

<template>
  <section id="solusi" class="section section--navy">
    <div class="container split split--reverse">
      <div class="priority-card">
        <h3 class="priority-card__title">Rekomendasi Materi Kamu</h3>
        <span class="tag tag--green">Diperbarui otomatis</span>
        <ul>
          <li v-for="p in priorities" :key="p.judul">
            <span class="dot" :class="`dot--${p.tone}`" aria-hidden="true"></span>
            <span>
              <strong>{{ p.judul }}</strong>
              <small>{{ p.sub }}</small>
            </span>
          </li>
        </ul>
      </div>
      <div class="split__text split__text--light">
        <small class="kicker">Solusinya</small>
        <h2>Bagaimana SIAP OSN <span class="hl">menjawab masalah itu?</span></h2>
        <p>
          SIAP OSN memetakan kemampuanmu lewat pre-test, lalu menyusun rekomendasi materi sesuai
          hasilnya. Setelah itu kamu bisa mencoba simulasi seleksi dengan pembahasan tiap soal,
          jadi tahu persis apa yang harus diperbaiki.
        </p>
        <a href="/register" class="btn btn--light">Coba Pre-Test Sekarang</a>
      </div>
    </div>
  </section>
</template>

<style scoped src="./shared.css"></style>

<style scoped>
.priority-card {
  background: #fff;
  color: var(--ink);
  border-radius: 14px;
  padding: 20px 24px 8px;
}

.priority-card__title {
  font-size: 0.95rem;
  margin: 0 0 4px;
}

.priority-card ul {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}

.priority-card li {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 0;
  border-top: 1px solid var(--line);
  font-size: 0.8rem;
  color: var(--muted);
}

.priority-card li strong {
  display: block;
  color: var(--ink);
  font-size: 0.85rem;
}

.priority-card li small {
  display: block;
  font-size: 0.72rem;
}

.tag {
  display: block;
  width: fit-content;
  margin-left: auto;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 0.68rem;
  font-weight: 600;
}

.tag--green {
  background: #e3f5ec;
  color: #1f8a5b;
}

/* Penanda status berupa titik warna sederhana (bukan ikon) */
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}

.dot--yellow {
  background: #f0b323;
}

.dot--blue {
  background: #3b76e8;
}

.dot--green {
  background: #1f8a5b;
}

@media (max-width: 900px) {
  .split {
    grid-template-columns: 1fr;
  }
  .split--reverse .priority-card {
    order: 2;
  }
}
</style>
