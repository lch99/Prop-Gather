import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Prop-Gather/',
  server: {
    port: 5173
  }
})
