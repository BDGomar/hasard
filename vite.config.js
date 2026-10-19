import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Deux cibles de build, choisies explicitement par le « mode » Vite :
//
//   npm run build          → mode « production » → cible Vercel :
//                            SPA autonome, assets servis à la racine (« / »)
//                            et sortie dans « dist » (ce qu'attend Vercel).
//   npm run build:laravel  → mode « laravel » → cible Laravel :
//                            assets servis depuis /build par public/build.
//
// On ne se fie surtout pas à la variable d'environnement VERCEL : elle n'est
// présente que si le projet Vercel expose ses variables système, ce qui n'est
// pas garanti (c'est ce qui a fait échouer le premier déploiement).
export default defineConfig(({ mode }) => {
  const forLaravel = mode === 'laravel' && !process.env.VERCEL

  return {
    plugins: [vue(), tailwindcss()],
    base: forLaravel ? '/build/' : '/',
    server: {
      port: 5173,
    },
    build: {
      outDir: forLaravel ? '../public/build' : 'dist',
      emptyOutDir: true,
      // Le manifeste n'est utile qu'au build servi par Laravel.
      manifest: forLaravel,
    },
  }
})
