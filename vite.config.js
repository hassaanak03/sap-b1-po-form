import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // SL_TARGET is read from .env (no VITE_ prefix, so it is never sent to the browser)
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Browser calls /b1s/v1/... on the Vite server; Vite forwards to the Service Layer.
        // This sidesteps CORS and lets you use the server's self-signed certificate.
        '/b1s': {
          target: env.SL_TARGET || 'https://localhost:50000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
