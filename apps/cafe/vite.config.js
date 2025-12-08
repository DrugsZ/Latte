import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  base: './',
  server: {
    headers: {
      // 💥 核心配置：开启 SharedArrayBuffer 支持
      // 如果缺少这两个头，espresso 的 SharedArrayBuffer 会报错
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});