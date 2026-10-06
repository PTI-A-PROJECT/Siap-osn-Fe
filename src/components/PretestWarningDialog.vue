<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits(['kerjakan', 'lewati'])

const dialog = ref(null)
const tombolUtama = ref(null)
let overflowAwal = ''

// Esc = Lewati dulu; Tab dijaga agar fokus tidak keluar dari dialog.
function onKeydown(e) {
  if (e.key === 'Escape') {
    emit('lewati')
    return
  }
  if (e.key !== 'Tab' || !dialog.value) return
  const tombol = dialog.value.querySelectorAll('button')
  if (!tombol.length) return
  const awal = tombol[0]
  const akhir = tombol[tombol.length - 1]
  if (e.shiftKey && document.activeElement === awal) {
    e.preventDefault()
    akhir.focus()
  } else if (!e.shiftKey && document.activeElement === akhir) {
    e.preventDefault()
    awal.focus()
  }
}

onMounted(() => {
  overflowAwal = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKeydown)
  nextTick(() => tombolUtama.value?.focus())
})

onBeforeUnmount(() => {
  document.body.style.overflow = overflowAwal
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="overlay">
      <div
        ref="dialog"
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pretest-judul"
      >
        <div class="head">
          <span class="ikon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.8-1.1 1.6" />
              <circle cx="12" cy="17" r=".7" fill="currentColor" />
            </svg>
          </span>
          <div>
            <h2 id="pretest-judul">Lewati pre-test dulu?</h2>
            <p>Kamu tetap bisa belajar, tetapi:</p>
          </div>
        </div>

        <ul class="risiko">
          <li>Rekomendasi materi belum disesuaikan denganmu</li>
          <li>Topik terlemah belum bisa ditentukan</li>
          <li>Pre-test bisa kamu kerjakan kapan saja, tetapi hanya 1 kali</li>
        </ul>

        <div class="aksi">
          <button ref="tombolUtama" type="button" class="btn utama" @click="emit('kerjakan')">
            Kerjakan Sekarang
          </button>
          <button type="button" class="btn sekunder" @click="emit('lewati')">Lewati dulu</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(15, 27, 51, 0.45);
  backdrop-filter: blur(6px);
}
.dialog {
  width: 100%;
  max-width: 512px;
  padding: 32px;
  border-radius: 16px;
  background: #fff;
  color: #0f1b33;
  box-shadow: 0 20px 50px rgba(15, 27, 51, 0.25);
}
.head { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
.ikon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 12px;
  background: #fdf0d2;
  color: #8a5a00;
}
h2 { margin: 0; font-size: 17px; font-weight: 700; }
.head p { margin: 4px 0 0; font-size: 13px; color: #5f6c85; }
.risiko {
  margin: 0 0 28px;
  padding: 14px 20px 14px 36px;
  border-radius: 10px;
  background: #fde2e2;
  color: #5f6c85;
  font-size: 13px;
  line-height: 1.7;
}
.aksi { display: flex; flex-wrap: wrap; gap: 12px; }
.btn {
  padding: 12px 24px;
  border-radius: 10px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn.utama { border: 0; background: #1e3a8a; color: #fff; }
.btn.utama:hover { background: #1a3277; }
.btn.sekunder { border: 1px solid #e6ebf2; background: #fff; color: #0f1b33; }
.btn.sekunder:hover { background: #f5f8fc; }
.btn:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
</style>