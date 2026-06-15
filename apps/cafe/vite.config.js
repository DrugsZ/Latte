import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  base: './',
  server: {
    headers: crossOriginIsolationHeaders,
    port: 8080,
  },
  optimizeDeps: {
    exclude: ['@latte-js/syrup', '@latte-js/crema'],
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
})
