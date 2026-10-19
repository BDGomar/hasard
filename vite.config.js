import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // En production, les assets sont servis par Laravel depuis /build/
  // (public/build) ; en dev, le serveur Vite reste sur la racine.
  base: process.env.NODE_ENV === 'production' ? '/build/' : '/',
  server: {
    port: 5173,
  },
  build: {
    outDir: '../public/build',
    emptyOutDir: true,
    manifest: true,
  },
})
