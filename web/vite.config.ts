import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true, // Allow external connections
    proxy: {
      '/api': {
        target: 'http://localhost:3080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3080',
        ws: true,
      },
    },
  },
})
