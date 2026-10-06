import { defineConfig, devices } from '@playwright/test'

// E2E butuh keempat proses dev hidup (lihat PLAN-INTEGRASI-LANJUTAN.md Fase 0):
//   Laravel :8000 · Python :8001 · queue worker · Vite :5173
//
// Test berjalan serial. Alasannya: tiga spec=share state yang sama —
// pretest hanya bisa sekali per putaran, dan admin boleh mengubah bank soal
// yang dipakai spec lain. `fullyParallel: false` lebih jujur daripada
// membuat test saling menunggu dengan timeout.
export default defineConfig({
  testDir: './e2e',
  // Gagal cepat dengan pesan jelas kalau salah satu proses dev mati.
  globalSetup: './e2e/global-setup.js',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Server tidak dinyalakan otomatis. Empat proses harus sudah hidup, jadi
  // webServer sengaja tidak dipakai — kalau Vite mati, pesan errornya jauh
  // lebih jelas daripada "port 5173 sudah dipakai".
})
