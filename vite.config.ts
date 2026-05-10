import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import Sonda from 'sonda/vite'

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [react(), Sonda()],
})
