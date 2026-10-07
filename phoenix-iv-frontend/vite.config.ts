import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rawProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';
const proxyTarget = rawProxyTarget.includes('://') ? rawProxyTarget : `http://${rawProxyTarget}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
