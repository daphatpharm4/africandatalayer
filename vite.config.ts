import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Needed because tests/viteBuildTargets.test.ts imports this config directly via tsx:
// native ESM has no __dirname, and while Vite's own config loader shims it, tsx does not.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiProxyTarget = env.VITE_API_PROXY_TARGET || process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000';
    return {
      server: {
        port: Number(process.env.PORT) || 5173,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          input:
            process.env.ADL_BUILD_TARGET === 'console'
              ? { console: path.resolve(__dirname, 'console.html') }
              : { main: path.resolve(__dirname, 'index.html') },
        },
      },
    };
});
