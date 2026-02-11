import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/analyze': {
        target: 'http://backend:8001',
        changeOrigin: true,
        secure: false,
      },
      '/convert': {
        target: 'http://backend:8001',
        changeOrigin: true,
        secure: false,
      },
      '/download': {
        target: 'http://backend:8001',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://backend:8001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})