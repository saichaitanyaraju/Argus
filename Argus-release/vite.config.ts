import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages, set base to your repo name: e.g., base: '/argus/'
// For local dev or custom domain, keep base: '/'
export default defineConfig({
  plugins: [react()],
  base: '/',
  define: {
    global: 'globalThis',
  },
})
