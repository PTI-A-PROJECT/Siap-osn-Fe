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
// Laravel jalan di Docker Sail, jadi folder compose-nya bisa dipindah. Default
// menebak letak repo tetangga; set LARAVEL_COMPOSE_DIR kalau tidak cocok.
const COMPOSE_LARAVEL = process.env.LARAVEL_COMPOSE_DIR ?? '../Osn-Readiness-Web'

// Dua hal soal portability Windows:
//  1. curl.exe tidak bisa menulis ke /dev/null — dia membuka path itu sebagai
//     file biasa (C:\dev\nul), gagal, lalu keluar dengan kode != 0. execSync
//     memakai exit code, bukan isi stdout, sehingga proses hidup terbaca mati.
//     Null device Windows bernama NUL.
//  2. execSync memakai cmd.exe di Windows, yang TIDAK memaknai single quote.
//     -w '%{http_code}' jadi keluar sebagai '200' (kutipnya ikut terbaca) dan
//     -d '{...}' jadi JSON rusak. Karena itu semua argumen curl di bawah memakai
//     double quote, yang valid baik di cmd.exe maupun sh.
const NULL = process.platform === 'win32' ? 'NUL' : '/dev/null'

// Cara memeriksa queue worker.
//
//   QUEUE_CHECK=docker (default) -- Laravel jalan di Docker Sail. Worker-nya ada
//                                di DALAM container, jadi pgrep host tidak akan
//                                pernah menemukannya; dicek lewat docker compose.
//                                Ini juga yang membuat preflight wajib Docker.
//
//   QUEUE_CHECK=host             -- Laravel jalan langsung di host (paket PHP
//                                milikmu sendiri). Dipakai tim yang tidak
//                                memakai Sail sama sekali.
//
// Pakai host kalau tidak ada Docker CLI di PATH; kalau tidak, set env ini di
// shell sebelum menjalankan test.
const QUEUE_CHECK = process.env.QUEUE_CHECK ?? 'docker'

const cekQueueWorker =
  QUEUE_CHECK === 'host'
    ? `pgrep -f "artisan queue:work" >${NULL} 2>&1 && echo 200 || echo 000`
    : `docker compose -f "${COMPOSE_LARAVEL}/compose.yaml" --project-directory "${COMPOSE_LARAVEL}" exec -T laravel.test sh -c "pgrep -f 'artisan queue:work' >/dev/null 2>&1 && echo 200 || echo 000"`

const CEK = [
  { nama: 'Laravel API', cmd: `curl -s -o ${NULL} -w "%{http_code}" -X POST http://127.0.0.1:8000/api/auth/login -H "Accept: application/json" -H "Content-Type: application/json" -d "{\\"email\\":\\"siswa@example.com\\",\\"password\\":\\"password\\"}"`, ok: '200' },
  { nama: 'Vite', cmd: `curl -s -o ${NULL} -w "%{http_code}" http://localhost:5173/`, ok: '200' },
  {
    nama: 'layanan hitung Python',
    // Tanpa token tetap 403 dari FastAPI — itu bukti proses hidup, bukan 000.
    cmd: `curl -s -o ${NULL} -w "%{http_code}" -X POST http://127.0.0.1:8001/hitung/penilaian -H "Content-Type: application/json" -d "{\\"soal\\":[]}"`,
    ok: '403',
  },
  {
    nama: 'queue worker',
    // Dua sebab kenapa `pgrep` host tidak bisa dipakai di mode docker:
    //   1. Windows tidak punya pgrep sama sekali.
    //   2. Worker-nya hidup di DALAM container, jadi tidak akan terlihat sebagai
    //      proses host meski pgrep ada.
    // `sh -c` dipakai supaya redirect >/dev/null ditangani shell Linux, bukan
    // cmd.exe. Lihat QUEUE_CHECK di atas untuk mode host.
    cmd: cekQueueWorker,
    ok: '200',
  },
]

export default function globalSetup() {
  const mati = []
  for (const { nama, cmd, ok } of CEK) {
    // execSync melempar exception kalau exit code bukan 0, dan itu persis
    // kasus yang ingin kita tandai "proses mati" -- jadi nilai awal tidak
    // perlu ada, catch yang menentukan.
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
        `\n\nNyalakan dulu:\n` +
        (QUEUE_CHECK === 'host'
          ? `  1. Laravel   : php artisan serve --host=127.0.0.1 --port=8000\n` +
            `  2. Queue     : php artisan queue:work --tries=3\n`
          : `  1. Laravel   : docker compose -f ${COMPOSE_LARAVEL}/compose.yaml --project-directory ${COMPOSE_LARAVEL} up -d\n` +
            `  2. Queue     : docker compose -f ${COMPOSE_LARAVEL}/compose.yaml --project-directory ${COMPOSE_LARAVEL} exec laravel.test php artisan queue:work --tries=3\n`) +
        `  3. Python    : uv run uvicorn data_analytics.api:app --host 127.0.0.1 --port 8001\n` +
        `  4. Vite      : bun run dev\n\n`,
    )
  }
}
