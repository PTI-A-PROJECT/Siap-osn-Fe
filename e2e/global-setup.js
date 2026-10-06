import { execSync } from 'node:child_process'

/**
 * Preflight: pastikan keempat proses dev hidup sebelum test apa pun jalan.
 *
 * Tanpa ini, kegagalan proses hanya muncul sebagai `ECONNREFUSED ::1:5173`
 * atau `expect(201).toBe(201)` yang membingungkan — padahal penyebabnya
 * `artisan serve` mati. Pesan di sini menyebut proses mana yang kurang.
 *
 * Lihat PLAN-INTEGRASI-LANJUTAN.md Fase 0.4 untuk cara menyalakannya.
 */
const CEK = [
  { nama: 'Laravel API', cmd: "curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8000/api/auth/login -H 'Accept: application/json' -H 'Content-Type: application/json' -d '{\"email\":\"siswa@example.com\",\"password\":\"password\"}'", ok: '200' },
  { nama: 'Vite', cmd: "curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/", ok: '200' },
  {
    nama: 'layanan hitung Python',
    // Tanpa token tetap 403 dari FastAPI — itu bukti proses hidup, bukan 000.
    cmd: "curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8001/hitung/penilaian -H 'Content-Type: application/json' -d '{\"soal\":[]}'",
    ok: '403',
  },
  {
    nama: 'queue worker',
    cmd: "pgrep -f 'artisan queue:work' >/dev/null && echo 200 || echo 000",
    ok: '200',
  },
]

export default function globalSetup() {
  const mati = []
  for (const { nama, cmd, ok } of CEK) {
    let hasil
    try {
      hasil = execSync(cmd, { encoding: 'utf8', timeout: 15_000 }).trim()
    } catch {
      hasil = '000'
    }
    if (hasil !== ok) mati.push(`${nama} (dapat ${hasil || 'kosong'})`)
  }

  if (mati.length) {
    throw new Error(
      `\n\nPreflight gagal — proses dev belum hidup:\n` +
        mati.map((m) => `  • ${m}`).join('\n') +
        `\n\nNyalakan dulu (PLAN-INTEGRASI-LANJUTAN.md Fase 0.4):\n` +
        `  1. Laravel   : DB_HOST=127.0.0.1 php artisan serve --host=127.0.0.1 --port=8000\n` +
        `  2. Queue     : DB_HOST=127.0.0.1 php artisan queue:work --tries=3\n` +
        `  3. Python    : uv run uvicorn data_analytics.api:app --host 127.0.0.1 --port 8001\n` +
        `  4. Vite      : bun run dev\n\n`,
    )
  }
}
