/**
 * Smoke check + laporan otomatis untuk alur siswa, dari landing sampai logout.
 *
 * Dipakai untuk menggantikan cek manual satu per satu. TUJUANNYA berbeda dari
 * `playwright test`:
 *
 *   - test  -> assertions-bisnis, gagal kalau ada yang tidak sesuai
 *   - smoke -> "apakah web-nya hidup dan bersih", selalu jalan sampai habis,
 *              screenshot tiap langkah, lalu tulis laporan markdown
 *
 * Jadi ini TIDAK gagal exit kalau ada halaman bermasalah -- dia tetap menyelesaikan
 * seluruh alur supaya masalahnya ketahuan sekaligus, bukan satu per satu.
 *
 * Jalankan dari repo Siap-osn-Fe:
 *   node scripts/smoke-report.mjs
 *   node scripts/smoke-report.mjs --headed
 *
 * Keluaran: reports/smoke-<timestamp>/laporan.md + <NN>-<nama>.png
 */
import { chromium } from '@playwright/test'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const DI = dirname(fileURLToPath(import.meta.url))
const REPO = join(DI, '..')
const API = 'http://127.0.0.1:8000/api'
const APP = 'http://localhost:5173'
const PY = 'http://127.0.0.1:8001'
const COMPOSE_LARAVEL = process.env.LARAVEL_COMPOSE_DIR ?? join(REPO, '..', 'Osn-Readiness-Web')
const HEADED = process.argv.includes('--headed')

const PASSWORD = 'password123'
const TINGKAT = 1

const ts = new Date()
const STAMP = [
  ts.getFullYear(),
  String(ts.getMonth() + 1).padStart(2, '0'),
  String(ts.getDate()).padStart(2, '0'),
  '-',
  String(ts.getHours()).padStart(2, '0'),
  String(ts.getMinutes()).padStart(2, '0'),
  String(ts.getSeconds()).padStart(2, '0'),
].join('')
const OUT = join(REPO, 'reports', `smoke-${STAMP}`)
mkdirSync(OUT, { recursive: true })

const steps = []
let browser

/* ------------------------------------------------------------------ util */

function log(msg) {
  process.stdout.write(`${msg}\n`)
}

async function apiPost(path, body, headers = {}) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { status: r.status, json, text }
}

async function apiPut(path, body, headers = {}) {
  const r = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  return { status: r.status, text: await r.text() }
}

/* ------------------------------------------------------------ preflight */

// Versi pakai fetch, bukan curl seperti di e2e/global-setup.js. Bedanya disengaja:
// global-setup harus jalan juga di shell cmd.exe, sedangkan script ini selalu di
// Node, jadi bisa langsung pakai fetch tanpa quadrature quoting.
async function preflight() {
  const checks = []

  checks.push(await check('Laravel API :8000', async () => {
    const r = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: 'siswa@example.com', password: 'password' }),
    })
    const got = r.status
    return { ok: got === 200, got: `HTTP ${got}`, expect: 'HTTP 200' }
  }))

  checks.push(await check('Vite :5173', async () => {
    const r = await fetch('http://localhost:5173/')
    const got = r.status
    return { ok: got === 200, got: `HTTP ${got}`, expect: 'HTTP 200' }
  }))

  checks.push(await check('Layanan hitung Python :8001', async () => {
    // Tanpa token harus 403 -- itu bukti proses hidup, bukan 000/koneksi gagal.
    const r = await fetch(`${PY}/hitung/penilaian`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soal: [] }),
    })
    const got = r.status
    return { ok: got === 403, got: `HTTP ${got}`, expect: 'HTTP 403 (tanpa token)' }
  }))

  checks.push(await check('Queue worker', async () => {
    // pgrep host tidak ada di Windows, dan worker-nya hidup di dalam container.
    const cmd = `docker compose -f "${COMPOSE_LARAVEL}/compose.yaml" --project-directory "${COMPOSE_LARAVEL}" exec -T laravel.test sh -c "pgrep -f 'artisan queue:work' >/dev/null 2>&1 && echo 200 || echo 000"`
    let got
    try {
      got = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim()
    } catch {
      got = '000'
    }
    return { ok: got === '200', got: got === '200' ? 'ditemukan' : 'tidak ditemukan', expect: 'ditemukan' }
  }))

  return checks
}

async function check(nama, fn) {
  try {
    const r = await fn()
    return { nama, ...r }
  } catch (e) {
    return { nama, ok: false, got: e.message, expect: 'berhasil' }
  }
}

/* ----------------------------------------------------------------- steps */

/**
 * SATU context dan SATU page dipakai untuk seluruh alur, bukan context per
 * langkah. Ini penting: kalau tiap langkah memakai context baru, session login
 * hilang begitu saja dan semua halaman yang butuh auth akan diam-diam
 * ter-redirect ke /login -- hasilnya laporan penuh GAGAL palsu.
 *
 * Listener juga dipasang sekali, lalu menulis ke `kolektor` yang di-reset tiap
 * langkah. Kalau listener-nya dipasang/dilepas per langkah, ada celah di mana
 * error bisa lolos tidak tercatat.
 */
let page = null
const kolektor = { konsol: [], jaringan: [], pageError: [] }

async function siapBrowser() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  page = await ctx.newPage()

  page.on('console', (m) => {
    if (m.type() === 'error') kolektor.konsol.push(m.text().slice(0, 300))
  })
  page.on('pageerror', (e) => kolektor.pageError.push(String(e.message).slice(0, 300)))
  page.on('requestfailed', (r) =>
    kolektor.jaringan.push({ ket: 'request gagal', url: r.url(), status: r.failure()?.errorText ?? '-' }),
  )
  page.on('response', (r) => {
    if (r.status() >= 400) kolektor.jaringan.push({ ket: 'HTTP', url: r.url(), status: r.status() })
  })
}

/**
 * Jalankan satu langkah: reset collector, jalankan aksi, screenshot, catat.
 * `aksi` boleh melempar -- langkah ditandai gagal tapi alur tetap lanjut.
 *
 * Opsi:
 *   tunggu  - locator yang harus terlihat sebelum langkah dianggap selesai
 *   harus   - regex URL yang wajib ada di address bar. Tanpa ini halaman yang
 *             diam-diam ter-redirect tetap saja dihitung "sukses".
 */
async function langkah(nama, aksi, { tunggu, harus } = {}) {
  const no = String(steps.length + 1).padStart(2, '0')
  const slug = nama.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const file = `${no}-${slug}.png`

  kolektor.konsol = []
  kolektor.jaringan = []
  kolektor.pageError = []

  const mulai = Date.now()
  let galat = null
  let ketGagal = null
  try {
    await aksi(page)
    if (tunggu) await page.locator(tunggu).first().waitFor({ state: 'visible', timeout: 15_000 })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    if (harus && !harus.test(page.url())) {
      throw new Error(`URL tidak sesuai: ${page.url()} (harus cocok dengan ${harus})`)
    }
  } catch (e) {
    galat = String(e.message).split('\n')[0].slice(0, 300)
    ketGagal = e.name ?? 'Error'
  }


  // Screenshot selalu diambil -- ini bukti kondisi, termasuk saat sukses.
  let adaScreenshot = true
  try {
    await page.screenshot({ path: join(OUT, file), fullPage: false })
  } catch {
    adaScreenshot = false
  }

  const url = page.url()

  // Klasifikasi: 5xx dan request gagal itu serius; 4xx bisa sah (mis. guard
  // yang mengembalikan 401 sebelum redirect), jadi hanya peringatan.
  const network5xx = kolektor.jaringan.filter((x) => typeof x.status === 'number' && x.status >= 500)
  const warn4xx = kolektor.jaringan.filter((x) => x.status === 401 || x.status === 403 || x.status === 404)
  const status = galat ? 'GAGAL' : network5xx.length || kolektor.pageError.length ? 'PERINGATAN' : 'OK'

  const s = {
    no,
    nama,
    status,
    ms: Date.now() - mulai,
    url,
    file: adaScreenshot ? file : null,
    galat,
    ketGagal,
    pageError: [...kolektor.pageError],
    konsol: [...kolektor.konsol],
    jaringan5xx: network5xx,
    warn4xx,
  }
  steps.push(s)

  const tanda = { OK: 'OK  ', PERINGATAN: 'WARN', GAGAL: 'FAIL' }[status]
  log(`  [${tanda}] ${no} ${nama} (${s.ms}ms)${galat ? ` -- ${galat}` : ''}`)
  return s
}

/* ------------------------------------------------------------------ main */

async function main() {
  log(`\nSmoke check -> ${relative(process.cwd(), OUT)}\n`)

  log('Preflight:')
  const pf = await preflight()
  for (const c of pf) log(`  [${c.ok ? 'OK  ' : 'FAIL'}] ${c.nama} (${c.got}, harus ${c.expect})`)

  const preflightOk = pf.every((c) => c.ok)
  if (!preflightOk) {
    log('\nPreflight gagal. Smoke check tidak dilanjutkan -- tanpa layanan yang hidup')
    log('laporannya tidak akan berarti. Perbaiki dulu, lalu jalankan ulang.\n')
  }

  log('\nAlur:')
  browser = await chromium.launch({ headless: !HEADED })
  await siapBrowser()

  const email = `smoke.${Date.now()}@example.com`
  let token = null
  let pretestId = null
  let hasilId = null

  if (preflightOk) {
    // 01 Landing
    await langkah('Landing page', async (p) => {
      await p.goto(`${APP}/`)
      await p.waitForLoadState('domcontentloaded')
    })

    // 02 Daftar akun (lewat API -- membuat akun lewat UI hanya menambah satu
    // langkah tanpa menambah cakupan smoke check)
    await langkah('Registrasi akun (API)', async () => {
      const r = await apiPost('/auth/register', {
        name: 'Smoke Check',
        email,
        password: PASSWORD,
        password_confirmation: PASSWORD,
      })
      if (r.status !== 201) throw new Error(`register HTTP ${r.status}: ${r.text.slice(0, 160)}`)
      const l = await apiPost('/auth/login', { email, password: PASSWORD })
      token = l.json?.data?.token
      if (!token) throw new Error('token tidak didapat')
    })

    // 03 Login lewat UI
    await langkah('Login (UI)', async (p) => {
      await p.goto(`${APP}/login`)
      await p.locator('#email').fill(email)
      await p.locator('#password').fill(PASSWORD)
      await p.locator('#login-form button[type="submit"]').click()
      await p.waitForURL(/\/siswa/, { timeout: 20_000 })
    })

    await langkah('Dashboard siswa', async (p) => {
      await p.goto(`${APP}/siswa`)
      await p.waitForURL(/\/siswa/, { timeout: 15_000 })
    })

    await langkah('Halaman profil', async (p) => {
      await p.goto(`${APP}/siswa/profil`)
    }, { tunggu: 'text=/profil akun/i', harus: /\/siswa\/profil/ })

    // 04 Pretest
    await langkah('Mulai pre-test (UI)', async (p) => {
      await p.goto(`${APP}/siswa/pretest`)
      await p.locator('.tingkat-opsi:not([disabled])').first().click()
      await p.locator('.btn-mulai').click()
      await p.getByText('Soal 1 dari 30').first().waitFor({ timeout: 20_000 })
      // Sama seperti langkah simulasi: tunggu isi soal, bukan cuma judul chip.
      await p.locator('.opsi, .uraian').first().waitFor({ state: 'visible', timeout: 20_000 })
    }, { harus: /\/siswa\/pretest/ })

    await langkah('Jawab + submit pre-test (API)', async () => {
      const auth = { Authorization: `Bearer ${token}` }
      const m = await apiPost('/pretest', { tingkat_id: TINGKAT }, auth)
      if (m.status !== 201 && m.status !== 200) {
        throw new Error(`mulai pretest HTTP ${m.status}: ${m.text.slice(0, 160)}`)
      }
      const p2 = m.json?.data
      if (!p2?.id) throw new Error('id pretest tidak ada di respons')
      pretestId = p2.id
      for (const s of p2.soal ?? []) {
        const jwb = s.tipe_soal === 'pilihan_ganda' ? Object.keys(s.pilihan_jawaban ?? {})[0] : 'jawaban smoke'
        await apiPut(`/pretest/${p2.id}/jawaban`, { soal_id: s.id, jawaban_user: jwb }, auth)
      }
      const sub = await apiPost(`/pretest/${p2.id}/submit`, {}, auth)
      if (sub.status !== 200) throw new Error(`submit HTTP ${sub.status}: ${sub.text.slice(0, 160)}`)
    })

    // 05 Pemetaan -- regresi Fase 5.1 yang pernah membuat halaman ini nge-hang
    await langkah('Pemetaan kompetensi (tanpa id)', async (p) => {
      await p.goto(`${APP}/siswa/pemetaan`)
      await p.getByText(/memuat hasil pre-test/i).waitFor({ state: 'hidden', timeout: 20_000 })
    })

    await langkah('Materi', async (p) => {
      await p.goto(`${APP}/siswa/materi`)
    }, { harus: /\/siswa\/materi/ })

    await langkah('Progress belajar', async (p) => {
      await p.goto(`${APP}/siswa/progress`)
    }, { harus: /\/siswa\/progress/ })

    await langkah('Daftar simulasi (syarat)', async (p) => {
      await p.goto(`${APP}/siswa/simulasi`)
      await p.locator('.syarat-status').waitFor({ timeout: 20_000 })
    }, { harus: /\/siswa\/simulasi/ })

    // 06 Penuhi syarat simulasi
    await langkah('Penuhi syarat simulasi (API)', async () => {
      const auth = { Authorization: `Bearer ${token}` }
      const r = await fetch(`${API}/materi?tingkat_id=${TINGKAT}`, { headers: { ...auth, Accept: 'application/json' } })
      const body = JSON.parse(await r.text())
      const materi = body.data ?? []
      for (const m of materi.filter((x) => x.wajib)) {
        await apiPut(`/materi/${m.id}/progress`, { status: 'selesai' }, auth)
        if (!m.quiz_id) continue
        const mulai = await apiPost(`/quiz/${m.quiz_id}/mulai`, {}, auth)
        const pj = mulai.json?.data
        if (!pj?.id) continue
        for (const s of pj.soal ?? []) {
          const jwb = s.tipe_soal === 'pilihan_ganda' ? Object.keys(s.pilihan_jawaban ?? {})[0] : 'jawaban smoke'
          await apiPut(`/quiz-pengerjaan/${pj.id}/jawaban`, { soal_id: s.id, jawaban_user: jwb }, auth)
        }
        await apiPost(`/quiz-pengerjaan/${pj.id}/submit`, {}, auth)
      }
    })

    await langkah('Simulasi: syarat terpenuhi', async (p) => {
      await p.goto(`${APP}/siswa/simulasi`)
      await p.locator('.syarat-status').waitFor({ timeout: 20_000 })
      await p.locator('.syarat-status').filter({ hasText: /terpenuhi/i }).first().waitFor({ timeout: 20_000 })
    }, { harus: /\/siswa\/simulasi/ })

    await langkah('Mulai simulasi (UI)', async (p) => {
      await p.getByRole('button', { name: /mulai simulasi/i }).first().click()
      await p.locator('.setuju input[type="checkbox"]').check()
      await p.locator('.btn-modal.btn-mulai').click()
      await p.getByText('Sisa Waktu:').waitFor({ timeout: 20_000 })
      // WAJIB tunggu isi soal, bukan cuma header. Header "Sisa Waktu:" muncul
      // duluan; tanpa ini langkah ini false OK dalam ~0.5 detik sambil
      // screenshot masih menangkap modal yang belum selesai hilang.
      //
      // NB: halaman ini TIDAK punya class semantik seperti `.opsi` milik
      // PretestView -- UjianSimulasiView hanya memakai utility class Tailwind.
      // Yang membedakannya: tiap tombol opsi punya anak <b> berisi kode "A.";
      // tombol navigasi dan tombol nomor tidak.
      await p
        .locator('button:has(b), textarea')
        .first()
        .waitFor({ state: 'visible', timeout: 20_000 })
      // Timer dihitung dari batas_pada; tunggu supaya tidak masih 00:00.
      await p
        .locator('text=/Sisa Waktu: (?!00:00)/')
        .first()
        .waitFor({ timeout: 10_000 })
    }, { harus: /\/siswa\/simulasi\/ujian/ })

    await langkah('Jawab + submit simulasi (API)', async () => {
      const auth = { Authorization: `Bearer ${token}` }
      const mulai = await apiPost('/simulasi/1/mulai', {}, auth)
      if (mulai.status !== 201 && mulai.status !== 200) {
        throw new Error(`mulai simulasi HTTP ${mulai.status}: ${mulai.text.slice(0, 160)}`)
      }
      const s2 = mulai.json?.data
      if (!s2?.id) throw new Error('id hasil simulasi tidak ada di respons')
      hasilId = s2.id
      for (const s of (s2.soal ?? []).slice(0, 10)) {
        const jwb = s.tipe_soal === 'pilihan_ganda' ? Object.keys(s.pilihan_jawaban ?? {})[0] : 'jawaban smoke'
        await apiPut(`/hasil-simulasi/${s2.id}/jawaban`, { soal_id: s.id, jawaban_user: jwb }, auth)
      }
      const sub = await apiPost(`/hasil-simulasi/${s2.id}/submit`, {}, auth)
      if (sub.status !== 200) throw new Error(`submit simulasi HTTP ${sub.status}: ${sub.text.slice(0, 160)}`)
    })

    await langkah('Hasil simulasi', async (p) => {
      await p.goto(`${APP}/siswa/simulasi/hasil/${hasilId}`)
      await p.waitForLoadState('domcontentloaded')
    }, { harus: /\/siswa\/simulasi\/hasil/ })

    await langkah('Riwayat hasil', async (p) => {
      await p.goto(`${APP}/siswa/riwayat`)
    }, { harus: /\/siswa\/riwayat/ })

    // 07 Logout, lalu uji guard sebagai anonim (karena guard-nya berbeda:
    // belum login -> /login, sudah login tapi role salah -> /forbidden)
    await langkah('Logout', async (p) => {
      await p.goto(`${APP}/siswa/progress`)
      const akun = p.locator('button[aria-haspopup="menu"]').first()
      await akun.waitFor({ state: 'visible', timeout: 15_000 })
      await akun.click()
      await p.getByRole('menuitem', { name: /^keluar$/i }).click()
      await p.waitForURL(/\/login/, { timeout: 15_000 })
    }, { harus: /\/login/ })

    await langkah('Guard: anonim ditolak dari /admin', async (p) => {
      await p.goto(`${APP}/admin`)
      await p.waitForURL(/\/login|\/forbidden/, { timeout: 15_000 })
    }, { harus: /\/login|\/forbidden/ })

    await langkah('Guard: anonim ditolak dari /siswa/pretest', async (p) => {
      await p.goto(`${APP}/siswa/pretest`)
      await p.waitForURL(/\/login/, { timeout: 15_000 })
    }, { harus: /\/login/ })

    await langkah('Halaman 404', async (p) => {
      await p.goto(`${APP}/halaman-yang-tidak-ada`)
    }, { harus: /\/halaman-yang-tidak-ada/ })
  }

  await browser.close()
  tulisLaporan({ pf, preflightOk, email, pretestId, hasilId })
}

/* ---------------------------------------------------------------- laporan */

function tulisLaporan({ pf, preflightOk, email, pretestId, hasilId }) {
  const gagal = steps.filter((s) => s.status === 'GAGAL')
  const warn = steps.filter((s) => s.status === 'PERINGATAN')
  const ok = steps.filter((s) => s.status === 'OK')
  const total = steps.reduce((a, s) => a + s.ms, 0)

  const ya = (b) => (b ? 'ya' : 'tidak')
  const kode = (s) => `\`${s.url.replace(APP, '')}\``

  const L = []
  L.push(`# Laporan Smoke Check — ${ts.toLocaleString('id-ID')}`)
  L.push('')
  L.push('Dibuat otomatis oleh `scripts/smoke-report.mjs`. Menelusuri alur siswa dari')
  L.push('landing sampai logout, mengambil screenshot di setiap langkah, dan mencatat')
  L.push('error konsol serta request yang gagal.')
  L.push('')
  L.push('> Bedakan dengan `playwright test`: smoke check **tidak** punya assertions')
  L.push('> bisnis. Dia selalu menyelesaikan seluruh alur supaya semua masalah kelihatan')
  L.push('> sekaligus, lalu menulis laporan di sini.')
  L.push('')
  L.push('## Ringkasan')
  L.push('')
  L.push(`- **Langkah:** ${steps.length} — OK ${ok.length}, PERINGATAN ${warn.length}, GAGAL ${gagal.length}`)
  L.push(`- **Total waktu alur:** ${(total / 1000).toFixed(1)} detik`)
  // Path dipisah dengan / supaya tautan di markdown bisa diklik juga di GitHub.
  const outRel = relative(REPO, OUT).split(/[\\/]/).join('/')
  L.push(`- **Screenshot:** ${steps.filter((s) => s.file).length} berkas di \`${outRel}/\``)
  L.push(`- **Akun uji:** \`${email}\``)
  L.push(`- **Wujud test:** pretest ${pretestId ? `#${pretestId}` : '—'}, hasil simulasi ${hasilId ? `#${hasilId}` : '—'}`)
  L.push('')

  L.push('## Preflight')
  L.push('')
  L.push('| Service | Hasil | Diterima |')
  L.push('| --- | --- | --- |')
  for (const c of pf) L.push(`| ${c.nama} | ${c.ok ? 'OK' : `GAGAL (${c.got})`} | ${c.expect} |`)
  L.push('')
  if (!preflightOk) {
  L.push('> Perhatian: preflight gagal, jadi alur di bawah **tidak dijalankan**. Laporan ini')
    L.push('> belum berarti apa-apa — perbaiki dulu service-nya.')
    L.push('')
  }

  L.push('## Alur')
  L.push('')
  L.push('| # | Langkah | Status | Waktu | Halaman | Screenshot |')
  L.push('| --- | --- | --- | --- | --- | --- |')
  for (const s of steps) {
    const badge = s.status === 'OK' ? 'OK' : s.status === 'PERINGATAN' ? 'PERINGATAN' : 'GAGAL'
    const shot = s.file ? `![${s.nama}](${s.file})` : '—'
    L.push(`| ${s.no} | ${s.nama} | ${badge} | ${s.ms} ms | ${kode(s)} | ${shot} |`)
  }
  L.push('')

  const adaDetail = gagal.length || warn.length
  if (adaDetail) {
    L.push('## Detail masalah')
    L.push('')
    for (const s of [...gagal, ...warn]) {
      L.push(`### ${s.no} ${s.nama} — ${s.status}`)
      L.push('')
      if (s.galat) {
        L.push(`**${s.ketGagal}:** \`${s.galat}\``)
        L.push('')
      }
      if (s.pageError.length) {
        L.push('**Uncaught exception:**')
        L.push('')
        for (const e of s.pageError) L.push(`- \`${e}\``)
        L.push('')
      }
      if (s.jaringan5xx.length) {
        L.push('**Server error (5xx):**')
        L.push('')
        for (const n of s.jaringan5xx) L.push(`- \`HTTP ${n.status}\` ${n.url.replace(API, '/api')}`)
        L.push('')
      }
      if (s.warn4xx.length) {
        L.push('<details><summary>HTTP 4xx (umumnya sah — guard sebelum redirect)</summary>')
        L.push('')
        for (const n of s.warn4xx) L.push(`- \`HTTP ${n.status}\` ${n.url.replace(API, '/api')}`)
        L.push('')
        L.push('</details>')
        L.push('')
      }
      if (s.konsol.length) {
        L.push('<details><summary>Console error</summary>')
        L.push('')
        for (const c of s.konsol) L.push(`- \`${c}\``)
        L.push('')
        L.push('</details>')
        L.push('')
      }
      if (s.file) {
        L.push(`![screenshot ${s.nama}](${s.file})`)
        L.push('')
      }
    }
  } else {
    L.push('## Detail masalah')
    L.push('')
    L.push('Tidak ada. Semua langkah lolos tanpa error konsol, exception, atau 5xx.')
    L.push('')
  }

  L.push('## Catatan')
  L.push('')
  L.push('- Error **5xx** dan uncaught exception dianggap serius. Error **4xx** hanya')
  L.push('  peringatan karena guard memang membalas 401/403 sebelum redirect.')
  L.push('- `Guard: anonim ditolak` selalu memuat request 401 dari `/api/dashboard` —')
  L.push('  itu perilaku yang diharapkan.')
  L.push('- Folder `reports/` belum masuk `.gitignore`, jadi ikut muncul sebagai')
  L.push('  untracked file.')
  L.push('')

  writeFileSync(join(OUT, 'laporan.md'), L.join('\n'), 'utf8')
  log(`\nLaporan: ${join(OUT, 'laporan.md')}`)
  log(`Ringkasan: OK ${ok.length} / PERINGATAN ${warn.length} / GAGAL ${gagal.length}`)
  log('')
  process.exitCode = gagal.length ? 1 : 0
}

main().catch(async (e) => {
  log(`\nSmoke check gagal total: ${e.stack}`)
  if (browser) await browser.close().catch(() => {})
  process.exitCode = 1
})
