<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const soundOn = ref(localStorage.getItem('boules-sound') !== 'off')

function toggleSound() {
  soundOn.value = !soundOn.value
  localStorage.setItem('boules-sound', soundOn.value ? 'on' : 'off')
}

const initials = computed(() => (auth.user?.name || '?').charAt(0).toUpperCase())

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

async function logout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="pb-28">
    <!-- EN-TÊTE -->
    <header class="sticky top-0 z-40 border-b border-forest-light/50 bg-ink/85 backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-2xl items-center px-4">
        <BrandMark size="sm" subtitle="" />
      </div>
    </header>

    <main class="mx-auto max-w-2xl px-4">
      <section class="anim-fade-up pt-6">
        <p class="label">Configuration</p>
        <h1 class="font-display text-2xl font-bold tracking-tight md:text-3xl">Paramètres</h1>
      </section>

      <!-- Profil -->
      <section class="panel anim-pop mt-5 p-6">
        <div class="flex items-center gap-4">
          <span
            class="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-forest-light bg-gradient-to-br from-moss/70 to-gold/60 font-display text-xl font-bold text-void"
          >
            {{ initials }}
          </span>
          <div class="min-w-0">
            <p class="truncate font-display text-lg font-semibold">{{ auth.user?.name }}</p>
            <p class="truncate text-sm text-white/45">{{ auth.user?.email }}</p>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <span class="chip chip-gold">
            Solde · {{ (auth.user?.balance ?? 0).toLocaleString('fr-FR') }} F
          </span>
          <span class="chip">Membre depuis {{ formatDate(auth.user?.created_at) }}</span>
        </div>
      </section>

      <!-- Préférences -->
      <section class="panel anim-fade-up mt-5 p-5" style="animation-delay: 0.06s">
        <h2 class="mb-4 flex items-center gap-3 font-display text-lg font-semibold">
          <span class="h-5 w-1 rounded-full bg-gold" aria-hidden="true" />
          Préférences
        </h2>

        <!-- Son du bocal -->
        <div class="flex items-center justify-between rounded-xl border border-forest-light/50 bg-void/50 px-4 py-3.5">
          <div>
            <p class="font-display text-sm font-semibold text-white/85">Son du bocal</p>
            <p class="mt-0.5 text-xs text-white/40">Bruit des boules contre le verre pendant le mélange</p>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="soundOn"
            class="relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200"
            :class="soundOn ? 'border-gold/50 bg-gold/25' : 'border-forest-light bg-void'"
            @click="toggleSound"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full transition-all duration-200"
              :class="soundOn ? 'left-[1.4rem] bg-gold shadow-[0_0_10px_rgba(250,204,21,0.6)]' : 'left-0.5 bg-white/40'"
            />
          </button>
        </div>

        <p class="mt-3 text-xs text-white/35">
          Le son s'active aussi automatiquement au premier toucher sur la page (règle d'autoplay des navigateurs).
        </p>
      </section>

      <!-- À propos -->
      <section class="panel anim-fade-up mt-5 p-5" style="animation-delay: 0.1s">
        <h2 class="mb-4 flex items-center gap-3 font-display text-lg font-semibold">
          <span class="h-5 w-1 rounded-full bg-moss" aria-hidden="true" />
          À propos
        </h2>
        <ul class="space-y-2.5 text-sm text-white/55">
          <li class="flex items-start gap-2.5">
            <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold/60" aria-hidden="true" />
            Boules — jeu multijoueur en direct : une manche toutes les 30 secondes.
          </li>
          <li class="flex items-start gap-2.5">
            <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold/60" aria-hidden="true" />
            Solde virtuel uniquement — aucune monnaie réelle n'est en jeu.
          </li>
          <li class="flex items-start gap-2.5">
            <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold/60" aria-hidden="true" />
            Les probabilités sont défavorables au joueur.
          </li>
        </ul>
      </section>

      <!-- Déconnexion -->
      <section class="anim-fade-up mt-5" style="animation-delay: 0.14s">
        <button class="btn btn-ghost w-full !border-red-500/40 !text-red-400 hover:!border-red-500/70 hover:!bg-red-500/10 hover:!text-red-300" type="button" @click="logout">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5M21 12H9" />
          </svg>
          Se déconnecter
        </button>
      </section>

      <footer class="mt-8 text-center text-xs text-white/25">
        Boules · v1.0
      </footer>
    </main>
  </div>
</template>
