import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Deux cibles de build, choisies explicitement par le « mode » Vite :
//
//   npm run build          → cible Vercel (défaut) : SPA autonome, assets
//                            servis à la racine (« / »), sortie dans « dist ».
//   npm run build:laravel  → cible Laravel : assets servis depuis /build par
//                            l'application Laravel du dépôt voisin
//                            (../boules-game/public/build), en repli du SPA
//                            déployé sur Vercel.
//
// On ne se fie pas à la variable VERCEL : elle n'est présente que si le projet
// Vercel expose ses variables système, ce qui n'est pas garanti.
export default defineConfig(({ mode }) => {
  const forLaravel = mode === 'laravel' && !process.env.VERCEL

  return {
    plugins: [vue(), tailwindcss()],
    base: forLaravel ? '/build/' : '/',
    server: {
      port: 5173,
    },
    build: {
      // Adapter ce chemin si le dépôt backend n'est pas dans « ../boules-game ».
      outDir: forLaravel ? '../boules-game/public/build' : 'dist',
      emptyOutDir: true,
      // Le manifeste n'est utile qu'au build servi par Laravel.
      manifest: forLaravel,
    },
  }
})
