<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import { getReferral } from '../api/client'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const soundOn = ref(localStorage.getItem('boules-sound') !== 'off')

function toggleSound() {
  soundOn.value = !soundOn.value
  localStorage.setItem('boules-sound', soundOn.value ? 'on' : 'off')
}

// Parrainage : code, filleuls et gains.
const referral = ref(null)
const copied = ref(false)

// Lien à partager : n'importe quelle page sait lire ?ref=CODE.
const referralLink = computed(() =>
  referral.value?.code ? `${window.location.origin}/register?ref=${referral.value.code}` : ''
)

async function copyReferralLink() {
  if (!referralLink.value) return
  try {
    await navigator.clipboard.writeText(referralLink.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    /* le presse-papiers peut être refusé : le code reste visible à recopier */
  }
}

async function shareReferralLink() {
  if (!referralLink.value) return
  const text = `Rejoins-moi sur Boules Game, 2 500 F offerts pour jouer 🎉 ${referralLink.value}`
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Boules Game', text, url: referralLink.value })
      return
    } catch {
      /* partage annulé */
    }
  }
  await copyReferralLink()
}

onMounted(async () => {
  try {
    referral.value = await getReferral()
  } catch {
    /* le portefeuille affichera l'info au prochain chargement */
  }
})

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

      <!-- Parrainage : 500 F par filleul -->
      <section v-if="referral" class="panel anim-fade-up mt-5 p-5" style="animation-delay: 0.04s">
        <h2 class="mb-4 flex items-center gap-3 font-display text-lg font-semibold">
          <span class="h-5 w-1 rounded-full bg-gold" aria-hidden="true" />
          Parrainage
        </h2>

        <p class="text-sm text-white/55">
          Invite tes amis : tu reçois
          <span class="font-semibold text-gold">{{ referral.reward.toLocaleString('fr-FR') }} F</span>
          par personne inscrite avec ton code.
        </p>

        <div class="mt-4 rounded-xl border border-gold/30 bg-gold/5 px-4 py-4">
          <p class="label !mb-1">Mon code</p>
          <p class="font-display text-2xl font-bold leading-none tracking-[0.15em] text-gold break-all">
            {{ referral.code }}
          </p>

          <div class="mt-4 flex flex-col gap-2 sm:flex-row">
            <button class="btn btn-gold flex-1 !px-4 !py-2 !text-sm" type="button" @click="copyReferralLink">
              {{ copied ? '✓ Lien copié' : 'Copier le lien' }}
            </button>
            <button class="chip flex-1 justify-center !py-2" type="button" @click="shareReferralLink">
              Partager
            </button>
          </div>
        </div>

        <p class="mt-2 break-all text-xs text-white/30">{{ referralLink }}</p>

        <div class="mt-4 grid grid-cols-3 gap-2 text-center">
          <div class="rounded-xl border border-forest-light/50 bg-void/50 px-2 py-3">
            <p class="font-display text-lg font-bold">{{ referral.referrals_count }}</p>
            <p class="text-xs text-white/40">Filleul{{ referral.referrals_count > 1 ? 's' : '' }}</p>
          </div>
          <div class="rounded-xl border border-forest-light/50 bg-void/50 px-2 py-3">
            <p class="font-display text-lg font-bold">{{ referral.rewarded_count }}</p>
            <p class="text-xs text-white/40">Prime{{ referral.rewarded_count > 1 ? 's' : '' }} versée{{ referral.rewarded_count > 1 ? 's' : '' }}</p>
          </div>
          <div class="rounded-xl border border-gold/30 bg-gold/5 px-2 py-3">
            <p class="font-display text-lg font-bold text-gold">
              {{ referral.earned.toLocaleString('fr-FR') }} F
            </p>
            <p class="text-xs text-white/40">Gagné</p>
          </div>
        </div>

        <p v-if="referral.trigger === 'first_recharge'" class="mt-3 text-xs text-white/35">
          Ta prime est versée dès que ton filleul effectue sa première recharge.
        </p>
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
