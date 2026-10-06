import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.js'

// vite.config.js diekspor sebagai fungsi (butuh mode + env), jadi bentuk
// objeknya harus diminta lebih dulu sebelum di-merge dengan config test.
const baseConfig = viteConfig({ command: 'serve', mode: 'test' })

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**', '.kilo/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
