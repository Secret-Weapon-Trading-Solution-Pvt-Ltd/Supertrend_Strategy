import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/dashboard': 'http://localhost:8000',
      '/status':    'http://localhost:8000',
      '/logout':    'http://localhost:8000',
      '/api':       'http://localhost:8000',
      '/socket.io': {
        target:       'http://localhost:8000',
        ws:           true,
        changeOrigin: true,
      },
    },
  },
})
