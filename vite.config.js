import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// Vite hanya mengisi %VITE_*% kalau env var-nya ada. Kalau VITE_API_BASE_URL
// belum diset (mis. Vercel belum dikonfigurasi), tag preconnect akan tetap
// berisi literal "%VITE_API_BASE_URL%" — href rusak. Tidak mematikan, tapi
// preload ke host ngawur. Buang tag-nya kalau env-nya kosong.
function preconnectApi(env) {
  const base = env.VITE_API_BASE_URL
  return {
    name: 'siaposn-preconnect-api',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (base) return html
        return html.replace(/[ \t]*<link rel="preconnect" href="%VITE_API_BASE_URL%"[^>]*>\n?/g, '')
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [preconnectApi(env), vue(), vueDevTools(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  }
})
