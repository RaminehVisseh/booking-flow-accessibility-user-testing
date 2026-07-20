import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/booking-flow-accessibility-user-testing/',
  build: { outDir: 'dist' },
  resolve: { dedupe: ['@janeapp/burrito-design-system', 'react', 'react-dom'] },
})
