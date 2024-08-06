import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from "vite-plugin-svgr"
import browserslistToEsbuild from 'browserslist-to-esbuild'
import path from 'path'

export default defineConfig({
  plugins: [react(), svgr({ include: '**/*.svg' })],
  base: './',
  server: {
    port: 8000,
  },
  esbuild: {
    legalComments: 'none',
  },
  build: {
    emptyOutDir: true,
    target: browserslistToEsbuild(),
    rollupOptions: {
      output: {
        chunkFileNames: 'js/[name].[hash].js',
        entryFileNames: 'js/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        manualChunks: {
          reactVendor: ['react', 'react-dom'],
        },
      },
    },
  },
  resolve: {
    alias: {
      'Latte': path.resolve(__dirname, "src"),
      'components': path.resolve(__dirname, "src/workbench/components"),
      'workbench': path.resolve(__dirname, "src/workbench"),
    }
  },
});