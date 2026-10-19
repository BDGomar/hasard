<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import RechargeModal from '../components/RechargeModal.vue'
import client from '../api/client'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const state = ref(null)
const history = ref([])
const showRecharge = ref(false)

const balance = computed(() => auth.user?.balance ?? 0)
const roundNo = computed(() => state.value?.round ?? null)
const players = computed(() => state.value?.players ?? 0)
const pot = computed(() => state.value?.pot ?? 0)

const stats = computed(() => {
  const done = history.value.filter((b) => b.result === 'win' || b.result === 'lose')
  const wins = done.filter((b) => b.result === 'win')
  const net = history.value.reduce((acc, b) => {
    if (b.result === 'win') return acc + (b.gain_amount ?? 0)
    if (b.result === 'lose') return acc - b.amount
    return acc
  }, 0)
  return {
    played: done.length,
    wins: wins.length,
    rate: done.length ? Math.round((wins.length / done.length) * 100) : 0,
    net,
  }
})

onMounted(async () => {
  const [round, bets] = await Promise.allSettled([
    client.get('/round'),
    client.get('/bets'),
  ])
  if (round.status === 'fulfilled') {
    state.value = round.value.data
    if (round.value.data.user) auth.setUser(round.value.data.user)
  }
  if (bets.status === 'fulfilled') {
    history.value = bets.value.data.data ?? bets.value.data
  }
})
</script>

<template>
  <div class="pb-28">
    <!-- EN-TÊTE -->
    <header class="sticky top-0 z-40 border-b border-forest-light/50 bg-ink/85 backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
        <BrandMark size="sm" subtitle="" />
        <div class="flex items-center gap-2.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5">
          <span class="hidden text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-gold/60 sm:inline">Solde</span>
          <span :key="balance" class="anim-balance font-display text-sm font-bold text-gold">
            {{ balance.toLocaleString('fr-FR') }} F
          </span>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-2xl px-4">
      <!-- Salutation -->
      <section class="anim-fade-up pt-6">
        <p class="label">Bienvenue</p>
        <h1 class="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Salut {{ auth.user?.name }} 👋
        </h1>
        <p class="mt-1.5 text-sm text-white/45">
          La prochaine manche t'attend — choisis tes boules et mise avant la fermeture des paris.
        </p>
      </section>

      <!-- CTA principal -->
      <section class="panel-gold anim-pop mt-5 p-6 text-center">
        <p class="label !mb-1">Cagnotte en cours</p>
        <p class="font-display text-4xl font-bold text-gold md:text-5xl">
          {{ pot.toLocaleString('fr-FR') }} F
        </p>
        <p class="mt-2 text-sm text-white/45">
          <template v-if="roundNo !== null">
            Manche #{{ roundNo }} · {{ players }} joueur{{ players > 1 ? 's' : '' }} en lice
          </template>
          <template v-else>Chargement de la manche…</template>
        </p>
        <div class="mt-5 flex flex-col gap-3 sm:flex-row">
          <button class="btn btn-gold flex-1" type="button" @click="router.push({ name: 'game' })">
            🎯 Jouer maintenant
          </button>
          <button class="btn btn-ghost" type="button" @click="showRecharge = true">
            ＋ Recharger
          </button>
        </div>
      </section>

      <!-- Stats -->
      <section class="anim-fade-up mt-5 grid grid-cols-3 gap-3" style="animation-delay: 0.06s">
        <div class="panel p-4 text-center">
          <p class="font-display text-2xl font-bold text-white/85">{{ stats.played }}</p>
          <p class="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/40">Mises</p>
        </div>
        <div class="panel p-4 text-center">
          <p class="font-display text-2xl font-bold text-white/85">{{ stats.rate }} %</p>
          <p class="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/40">Réussite</p>
        </div>
        <div class="panel p-4 text-center">
          <p
            class="font-display text-2xl font-bold"
            :class="stats.net > 0 ? 'text-gold' : stats.net < 0 ? 'text-white/60' : 'text-white/85'"
          >
            {{ stats.net > 0 ? '+' : '' }}{{ stats.net.toLocaleString('fr-FR') }}
          </p>
          <p class="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/40">Net (F)</p>
        </div>
      </section>

      <!-- Derniers résultats -->
      <section class="panel anim-fade-up mt-5 p-5" style="animation-delay: 0.1s">
        <h2 class="mb-4 flex items-center gap-3 font-display text-lg font-semibold">
          <span class="h-5 w-1 rounded-full bg-gold" aria-hidden="true" />
          Derniers tirages
        </h2>

        <div v-if="history.length" class="space-y-2">
          <div
            v-for="b in history.slice(0, 5)"
            :key="b.id"
            class="flex items-center justify-between rounded-xl border border-forest-light/50 bg-void/50 px-4 py-3"
          >
            <div class="flex items-center gap-3">
              <span
                class="h-3 w-3 shrink-0 rounded-full"
                :style="{ background: b.winning_ball_id ? undefined : 'rgba(255,255,255,0.15)' }"
              />
              <div>
                <p class="font-display text-sm font-semibold text-white/75">Manche #{{ b.round }}</p>
                <p class="text-xs text-white/40">Mise {{ b.amount.toLocaleString('fr-FR') }} F</p>
              </div>
            </div>
            <span
              class="rounded-full border px-2.5 py-0.5 text-xs font-semibold"
              :class="
                b.result === 'win'
                  ? 'border-gold/40 bg-gold/15 text-gold'
                  : b.result === 'lose'
                    ? 'border-white/15 bg-white/5 text-white/50'
                    : 'border-moss/40 bg-moss/10 text-moss'
              "
            >
              {{ b.result === 'win' ? 'GAGNÉ' : b.result === 'lose' ? 'PERDU' : 'EN ATTENTE' }}
            </span>
          </div>
        </div>

        <p v-else class="py-6 text-center text-sm text-white/35">
          Aucune mise pour l'instant — lance ta première manche !
        </p>
      </section>

      <footer class="mt-8 text-center text-xs text-white/25">
        Boules — jeu multijoueur en direct • solde virtuel
      </footer>
    </main>

    <RechargeModal v-if="showRecharge" @close="showRecharge = false" />
  </div>
</template>
