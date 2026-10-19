<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import JarGame from '../components/JarGame.vue'
import RechargeModal from '../components/RechargeModal.vue'
import client from '../api/client'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

/* ================= Données ================= */
const balls = ref([])
const history = ref([])
const state = ref(null) // dernier payload /round
const offset = ref(0) // horloge serveur - horloge locale (ms)
const localPhase = ref('betting') // betting | mixing (calculé localement en continu)
const remainMs = ref(0)
const syncing = ref(false)

/* ================= Formulaire de mise ================= */
const selected = ref([])
const MAX_SELECTION = 5
const customMode = ref(false)
const customInput = ref('')
const amount = ref(250)
const submitting = ref(false)
const errorMessage = ref('')

/* ================= Animations ================= */
const emergeBall = ref(null) // boule gagnante émergeant du bocal
const lastResult = ref(null) // dernier tirage soldé (bannière)
const pendingRound = ref(-1) // manche vue en mélange (gagnant déjà connu)
const pendingWinner = ref(null) // boule gagnante de cette manche
let emergePlayedFor = -1 // manche dont l'émergence a déjà été jouée
let lastSyncAttempt = 0

let pollTimer = null
let tickTimer = null

const showRecharge = ref(false)

function openRecharge() {
  showRecharge.value = true
}
const jarRef = ref(null)
const soundOn = ref(localStorage.getItem('boules-sound') !== 'off')

function toggleSound() {
  soundOn.value = !soundOn.value
  localStorage.setItem('boules-sound', soundOn.value ? 'on' : 'off')
  if (soundOn.value) jarRef.value?.unlock()
}

/* ================= Horloge partagée ================= */
const serverNow = () => Date.now() + offset.value

function applyState(data) {
  state.value = data
  offset.value = Date.parse(data.server_time) - Date.now()
  if (data.user) auth.setUser(data.user)

  const res = data.result

  // 1. Pendant le mélange : on mémorise le gagnant, prêt à émerger à la fin.
  if (data.phase === 'mixing' && res && res.round === data.round) {
    if (pendingRound.value !== data.round) {
      pendingRound.value = data.round
      pendingWinner.value = res.winning
      emergeBall.value = null // la gagnante précédente retombe dans le bocal
    }
  }

  // 2. Révélation : la manche mémorisée vient d'être soldée → émergence.
  if (
    data.phase === 'betting' &&
    res &&
    res.resolved &&
    pendingRound.value === res.round &&
    emergePlayedFor !== res.round
  ) {
    emergePlayedFor = res.round
    emergeBall.value = pendingWinner.value
  }

  // 3. Bannière : on garde toujours le résultat soldé le plus récent
  //    (couvre aussi le chargement initial et le retour après absence).
  if (res && res.resolved && res.round > (lastResult.value?.round ?? -1)) {
    lastResult.value = res
  }
}

async function fetchRound() {
  const { data } = await client.get('/round')
  applyState(data)
  return data
}

async function loadBalls() {
  const { data } = await client.get('/balls')
  balls.value = data.balls
}

async function loadHistory() {
  const { data } = await client.get('/bets')
  history.value = data.data ?? data
}

/* ================= Chrono local (150 ms) ================= */
function setPhase(p) {
  if (localPhase.value === p) return
  localPhase.value = p
  if (p === 'mixing') {
    emergeBall.value = null // les boules retombent dans le bocal
    errorMessage.value = ''
  }
}

function tick() {
  const s = state.value
  if (!s || syncing.value) return

  const now = serverNow()
  const betEnd = Date.parse(s.betting_end_at)
  const mixEnd = Date.parse(s.mixing_end_at)

  if (now >= mixEnd) {
    // Fin du mélange : on resynchronise au plus vite (l'émergence est déclenchée
    // par applyState dès l'arrivée de l'état « paris ouverts » suivant).
    syncNow()
    return
  }

  if (now >= betEnd) {
    setPhase('mixing')
    remainMs.value = mixEnd - now
  } else {
    setPhase('betting')
    remainMs.value = betEnd - now
  }
}

async function syncNow() {
  if (syncing.value) return
  if (Date.now() - lastSyncAttempt < 800) return // anti-rebond si le réseau rame
  lastSyncAttempt = Date.now()

  syncing.value = true
  try {
    await fetchRound()
    await loadHistory()
  } catch {
    // Réseau indisponible : le poll suivant reprendra la main.
  } finally {
    syncing.value = false
  }
}

/* ================= Sélection ================= */
const ballById = (id) => balls.value.find((b) => b.id === id) || null
const maxReached = computed(() => selected.value.length >= MAX_SELECTION)

function toggleBall(id) {
  if (localPhase.value !== 'betting' || myBet.value || submitting.value) return
  const idx = selected.value.indexOf(id)
  if (idx >= 0) {
    selected.value.splice(idx, 1)
  } else if (selected.value.length < MAX_SELECTION) {
    selected.value.push(id)
  }
  errorMessage.value = ''
}

function clearSelection() {
  if (myBet.value) return
  selected.value = []
}

/* ================= Montants ================= */
const presets = computed(() => state.value?.presets ?? [250, 500, 1000, 2000, 5000])
const minMise = computed(() => state.value?.min_mise ?? 250)
const balance = computed(() => auth.user?.balance ?? 0)

function pickPreset(p) {
  amount.value = p
  customMode.value = false
  customInput.value = ''
  errorMessage.value = ''
}

function onCustomInput() {
  customMode.value = true
  errorMessage.value = ''
  const n = parseInt(customInput.value, 10)
  if (!Number.isNaN(n)) amount.value = n
}

const amountError = computed(() => {
  if (customMode.value) {
    const raw = customInput.value
    const n = Number(raw)
    if (raw === '' || Number.isNaN(n)) return 'Saisis un montant.'
    if (!Number.isInteger(n)) return 'Le montant doit être un nombre entier.'
    if (n < minMise.value) return `Le montant minimum est de ${minMise.value} F.`
  }
  if (amount.value > balance.value) {
    return `Solde insuffisant — il te reste ${balance.value.toLocaleString('fr-FR')} F.`
  }
  return ''
})

/* ================= État de la manche ================= */
const myBet = computed(() => state.value?.my_bet ?? null)
const players = computed(() => state.value?.players ?? 0)
const pot = computed(() => state.value?.pot ?? 0)
const roundNo = computed(() => state.value?.round ?? null)
const remainSec = computed(() => Math.max(0, Math.ceil(remainMs.value / 1000)))

const betDurMs = computed(() => (state.value?.betting_seconds ?? 20) * 1000)
const mixDurMs = computed(() => (state.value?.mixing_seconds ?? 10) * 1000)

const betProgress = computed(() => {
  if (localPhase.value !== 'betting') return 100
  return Math.min(100, Math.max(0, ((betDurMs.value - remainMs.value) / betDurMs.value) * 100))
})
const mixProgress = computed(() => {
  if (localPhase.value !== 'mixing') return 0
  return Math.min(100, Math.max(0, ((mixDurMs.value - remainMs.value) / mixDurMs.value) * 100))
})

const phaseLabel = computed(() => {
  if (localPhase.value === 'mixing') return 'Mélange en cours'
  return myBet.value ? 'Mise en jeu' : 'Paris ouverts'
})

const phaseHint = computed(() => {
  if (!state.value) return 'Synchronisation…'
  if (localPhase.value === 'mixing') return `Révélation dans ${remainSec.value} s`
  if (myBet.value) return `Tirage dans ${remainSec.value} s`
  return `Choisis et mise avant la fermeture — ${remainSec.value} s`
})

const canBet = computed(
  () =>
    localPhase.value === 'betting' &&
    !myBet.value &&
    selected.value.length >= 1 &&
    selected.value.length <= MAX_SELECTION &&
    !submitting.value &&
    amountError.value === ''
)

const jarDisabled = computed(
  () => localPhase.value !== 'betting' || Boolean(myBet.value) || submitting.value
)

/* ================= Mise ================= */
async function submitBet() {
  if (!canBet.value) return
  submitting.value = true
  errorMessage.value = ''

  try {
    const { data } = await client.post('/bet', {
      amount: amount.value,
      selected: selected.value,
    })
    applyState(data)
  } catch (error) {
    const res = error.response?.data
    errorMessage.value =
      res?.message ||
      res?.errors?.amount?.[0] ||
      res?.errors?.balance?.[0] ||
      'La mise a échoué — réessaie.'
    if (res?.errors?.selected) errorMessage.value = 'Ta sélection de boules est invalide.'
  } finally {
    submitting.value = false
  }
}

/* ================= Session ================= */
async function logout() {
  await auth.logout()
  await router.push({ name: 'login' })
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* ================= Cycle de vie ================= */
onMounted(async () => {
  await Promise.all([
    loadBalls().catch(() => {}),
    loadHistory().catch(() => {}),
    fetchRound().catch(() => {}),
  ])
  pollTimer = setInterval(() => fetchRound().catch(() => {}), 1000)
  tickTimer = setInterval(tick, 150)
})

onBeforeUnmount(() => {
  clearInterval(pollTimer)
  clearInterval(tickTimer)
})
</script>

<template>
  <div class="pb-8">
    <!-- ================= EN-TÊTE ================= -->
    <header class="sticky top-0 z-40 border-b border-forest-light/50 bg-ink/85 backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <BrandMark size="sm" subtitle="" />

        <!-- Pastille de phase (desktop) -->
        <div
          v-if="state"
          class="hidden items-center gap-2 rounded-full border px-4 py-1.5 md:flex"
          :class="
            localPhase === 'mixing'
              ? 'border-gold/40 bg-gold/10'
              : 'border-moss/60 bg-moss/10'
          "
        >
          <span class="relative flex h-2 w-2" aria-hidden="true">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              :class="localPhase === 'mixing' ? 'bg-gold' : 'bg-moss'"
            />
            <span
              class="relative inline-flex h-2 w-2 rounded-full"
              :class="localPhase === 'mixing' ? 'bg-gold' : 'bg-moss'"
            />
          </span>
          <span class="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-white/75">
            {{ phaseLabel }}
          </span>
          <span class="font-display text-sm font-bold text-gold">· {{ remainSec }}s</span>
        </div>

        <div class="flex items-center gap-2 md:gap-3">
          <!-- Solde -->
          <div class="flex items-center gap-2.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 md:px-4">
            <span class="hidden text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-gold/60 sm:inline">Solde</span>
            <span :key="balance" class="anim-balance font-display text-sm font-bold text-gold md:text-base">
              {{ balance.toLocaleString('fr-FR') }} F
            </span>
            <button class="btn btn-gold !px-3 !py-1 !text-xs ml-2" @click="openRecharge">Recharger</button>
          </div>

          <!-- Utilisateur -->
          <div class="hidden items-center gap-2.5 md:flex">
            <span
              class="grid h-9 w-9 place-items-center rounded-full border border-forest-light bg-gradient-to-br from-moss/70 to-gold/60 font-display text-sm font-bold text-void"
            >
              {{ (auth.user?.name || '?').charAt(0).toUpperCase() }}
            </span>
            <span class="max-w-[9rem] truncate text-sm text-white/70">{{ auth.user?.name }}</span>
          </div>

          <button class="btn btn-ghost !px-3.5 !py-1.5 !text-sm" type="button" @click="logout">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5M21 12H9" />
            </svg>
            <span class="hidden sm:inline">Quitter</span>
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4">
      <!-- ================= BARRE D'ÉTAT ================= -->
      <section class="anim-fade-up pt-6">
        <div class="panel flex flex-wrap items-center justify-between gap-4 p-4 md:p-5">
          <div class="flex items-center gap-3">
            <span
              class="grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-lg"
              :class="
                localPhase === 'mixing'
                  ? 'border-gold/40 bg-gold/10'
                  : 'border-moss/60 bg-moss/10'
              "
              aria-hidden="true"
            >
              {{ localPhase === 'mixing' ? '🌀' : '🎯' }}
            </span>
            <div>
              <p class="font-display text-base font-semibold md:text-lg">
                {{ phaseLabel }}
                <span class="font-display font-bold text-gold">· {{ remainSec }}s</span>
              </p>
              <p class="text-sm text-white/45">{{ phaseHint }}</p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span v-if="roundNo !== null" class="chip">Manche #{{ roundNo }}</span>
            <span class="chip" :class="{ 'chip-gold': players > 0 }">
              {{ players }} joueur{{ players > 1 ? 's' : '' }} en lice
            </span>
            <span class="chip chip-gold">Cagnotte {{ pot.toLocaleString('fr-FR') }} F</span>
          </div>
        </div>

        <!-- Chronologie de la manche -->
        <div class="mt-3 grid grid-cols-2 gap-3" aria-hidden="true">
          <div>
            <div class="mb-1 flex justify-between text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/40">
              <span>1 · Paris</span>
              <span>{{ state?.betting_seconds ?? 20 }}s</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-void/80">
              <div
                class="h-full rounded-full transition-all duration-200 ease-linear"
                :class="localPhase === 'betting' ? 'bg-gradient-to-r from-moss to-gold' : 'bg-moss/50'"
                :style="{ width: betProgress + '%' }"
              />
            </div>
          </div>
          <div>
            <div class="mb-1 flex justify-between text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/40">
              <span>2 · Mélange du bocal</span>
              <span>{{ state?.mixing_seconds ?? 10 }}s</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-void/80">
              <div
                class="h-full rounded-full transition-all duration-200 ease-linear"
                :class="localPhase === 'mixing' ? 'bg-gradient-to-r from-gold-dim to-gold' : 'bg-white/5'"
                :style="{ width: mixProgress + '%' }"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- ================= JEU ================= -->
      <div class="mt-6 grid gap-6 lg:grid-cols-[400px,1fr]">
        <!-- ---------- Bocal ---------- -->
        <section class="panel anim-fade-up self-start p-5 lg:sticky lg:top-20" style="animation-delay: 0.05s">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 class="flex items-center gap-3 font-display text-lg font-semibold">
              <span class="h-5 w-1 rounded-full bg-gold" aria-hidden="true" />
              Le bocal
            </h2>
            <div class="flex items-center gap-2">
              <button
                class="chip"
                type="button"
                :class="{ 'chip-gold': soundOn }"
                :aria-pressed="soundOn"
                :title="soundOn ? 'Couper le son' : 'Activer le son'"
                @click="toggleSound"
              >
                <svg v-if="soundOn" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
                </svg>
                <svg v-else class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                  <path d="m22 9-6 6M16 9l6 6" />
                </svg>
                <span>{{ soundOn ? 'Son' : 'Muet' }}</span>
              </button>
              <span class="chip" :class="{ 'chip-gold': selected.length }">
                {{ selected.length }} / {{ MAX_SELECTION }}
              </span>
            </div>
          </div>

          <JarGame
            ref="jarRef"
            :balls="balls"
            :selected="selected"
            :phase="localPhase"
            :disabled="jarDisabled"
            :emerge="emergeBall"
            :muted="!soundOn"
          />

          <p class="mt-3 text-center text-xs text-white/40">
            <template v-if="jarDisabled && !myBet && localPhase === 'mixing'">
              🌀 Mélange en cours — prochaine manche dans {{ remainSec }} s
            </template>
            <template v-else-if="myBet">
              🔒 Mise verrouillée pour cette manche
            </template>
            <template v-else-if="localPhase === 'betting'">
              Clique les boules ci-dessous pour faire ta sélection (1 à 5)
            </template>
          </p>

          <!-- Puces de sélection -->
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <button
              v-for="id in selected"
              :key="id"
              class="chip chip-gold anim-pop"
              type="button"
              :disabled="jarDisabled"
              :aria-label="`Retirer ${ballById(id)?.name}`"
              @click="toggleBall(id)"
            >
              <span class="h-2.5 w-2.5 rounded-full" :style="{ background: ballById(id)?.hex }" />
              {{ ballById(id)?.name }}
              <span v-if="!jarDisabled" aria-hidden="true" class="text-gold/70">×</span>
            </button>
            <button
              v-if="selected.length && !myBet"
              class="chip"
              type="button"
              @click="clearSelection"
            >
              Effacer
            </button>
          </div>

          <!-- Liste de boules à sélectionner -->
          <div class="mt-3 panel-gold p-3">
            <p class="label !mb-2">Sélectionne tes boules</p>
            <div class="grid grid-cols-5 gap-2 sm:grid-cols-5">
              <button
                v-for="b in balls"
                :key="b.id"
                type="button"
                class="ball-card flex flex-col items-center justify-center gap-1 px-1 py-2"
                :class="{ 'is-selected': selected.includes(b.id) }"
                :disabled="jarDisabled || (maxReached && !selected.includes(b.id))"
                :aria-pressed="selected.includes(b.id)"
                :title="b.name"
                @click="toggleBall(b.id)"
              >
                <span
                  class="ball h-8 w-8 sm:h-9 sm:w-9"
                  :style="{
                    background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.5), transparent 44%), ${b.hex}`,
                    boxShadow: `inset 0 -5px 10px rgba(0,0,0,0.35), 0 6px 14px -6px ${b.hex}`,
                  }"
                />
                <span class="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-white/70">{{ b.name }}</span>
                <svg v-if="selected.includes(b.id)" class="ball-check h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </div>
            <p class="mt-2 text-xs text-white/40">1 à 5 boules maximum</p>
          </div>
        </section>

        <!-- ---------- Colonne de droite ---------- -->
        <div class="space-y-6">
          <!-- Erreurs -->
          <Transition name="result">
            <div v-if="errorMessage" class="alert anim-pop" role="alert">
              <svg class="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span>{{ errorMessage }}</span>
            </div>
          </Transition>

          <!-- Résultat du dernier tirage -->
          <Transition name="result">
            <section
              v-if="lastResult"
              class="panel anim-pop p-5 md:p-6"
              :class="{ 'panel-gold': lastResult.my?.won }"
            >
              <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 class="flex items-center gap-3 font-display text-lg font-semibold">
                  <span class="h-5 w-1 rounded-full bg-gold" aria-hidden="true" />
                  Résultat — manche #{{ lastResult.round }}
                </h2>
                <span v-if="!lastResult.resolved" class="chip">Soldes en cours…</span>
              </div>

              <div class="flex flex-wrap items-center gap-5">
                <span
                  class="ball h-16 w-16 shrink-0"
                  :class="{ 'anim-ring': lastResult.my?.won }"
                  :style="{
                    background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.5), transparent 44%), ${lastResult.winning?.hex}`,
                    boxShadow: `inset 0 -8px 16px rgba(0,0,0,0.35), 0 8px 24px -8px ${lastResult.winning?.hex}`,
                  }"
                />
                <div>
                  <p class="font-display text-xl font-semibold">{{ lastResult.winning?.name }}</p>
                  <p class="text-sm text-white/45">
                    {{ lastResult.players }} joueur{{ lastResult.players > 1 ? 's' : '' }} en lice
                    <template v-if="lastResult.winners !== null">
                      · {{ lastResult.winners }} gagnant{{ lastResult.winners > 1 ? 's' : '' }}
                    </template>
                  </p>
                </div>
              </div>

              <!-- Verdict personnel -->
              <div
                v-if="lastResult.my"
                class="mt-5 flex flex-col gap-4 rounded-2xl border p-5 md:flex-row md:items-center md:justify-between"
                :class="lastResult.my.won ? 'border-gold/40 bg-gold/10' : 'border-white/10 bg-white/[0.03]'"
              >
                <div>
                  <p
                    class="font-display text-2xl font-bold tracking-tight md:text-3xl"
                    :class="lastResult.my.won ? 'text-gold' : 'text-white/60'"
                  >
                    {{ lastResult.my.won ? 'GAGNÉ !' : 'PERDU !' }}
                  </p>
                  <p class="mt-1.5 text-sm text-white/55">
                    Mise {{ lastResult.my.amount.toLocaleString('fr-FR') }} F · gain
                    {{ lastResult.my.gain_percent }} %
                  </p>
                </div>

                <div class="flex items-end gap-6">
                  <div v-if="lastResult.my.won">
                    <p class="label !mb-1">Gain net</p>
                    <p class="font-display text-3xl font-bold text-gold">
                      +{{ lastResult.my.gain_amount.toLocaleString('fr-FR') }} F
                    </p>
                  </div>
                  <div>
                    <p class="label !mb-1">{{ lastResult.my.won ? 'Retourné' : 'Perte' }}</p>
                    <p
                      class="font-display text-3xl font-bold"
                      :class="lastResult.my.won ? 'text-white/85' : 'text-white/60'"
                    >
                      {{ lastResult.my.won ? '+' + lastResult.my.total_won.toLocaleString('fr-FR') : '−' + lastResult.my.amount.toLocaleString('fr-FR') }} F
                    </p>
                    <p v-if="lastResult.my.won" class="text-right text-xs text-white/40">mise incluse</p>
                  </div>
                </div>
              </div>

              <p v-else-if="lastResult.resolved" class="mt-4 text-sm text-white/40">
                Tu n'étais pas sur ce tour — la prochaine manche est déjà ouverte, tente ta chance !
              </p>
            </section>
          </Transition>

          <!-- Mise en attente -->
          <Transition name="result">
            <section v-if="myBet" class="panel anim-pop p-5 md:p-6">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 class="flex items-center gap-3 font-display text-lg font-semibold">
                  <span class="h-5 w-1 rounded-full bg-moss" aria-hidden="true" />
                  Ta mise — manche #{{ myBet.round }}
                </h2>
                <span class="chip chip-gold">🔒 En attente du tirage</span>
              </div>

              <div class="flex flex-wrap items-center gap-5">
                <p class="font-display text-3xl font-bold text-gold">
                  {{ myBet.amount.toLocaleString('fr-FR') }} F
                </p>
                <div class="flex flex-wrap gap-2">
                  <span v-for="s in myBet.selected_colors" :key="s.id" class="chip">
                    <span class="h-2.5 w-2.5 rounded-full" :style="{ background: s.hex }" />
                    {{ s.name }}
                  </span>
                </div>
              </div>

              <p class="mt-4 text-sm text-white/45">
                <template v-if="localPhase === 'mixing'">
                  🌀 Les boules se mélangent — révélation dans {{ remainSec }} s…
                </template>
                <template v-else>
                  Le bocal sera secoué à la fermeture des paris — tirage dans {{ remainSec }} s.
                </template>
              </p>
            </section>
          </Transition>

          <!-- Formulaire de mise -->
          <Transition name="result">
            <section
              v-if="localPhase === 'betting' && !myBet"
              class="panel anim-fade-up p-5 md:p-6"
              style="animation-delay: 0.08s"
            >
              <h2 class="mb-5 flex items-center gap-3 font-display text-lg font-semibold">
                <span class="h-5 w-1 rounded-full bg-gold" aria-hidden="true" />
                Ta mise
              </h2>

              <!-- Montant -->
              <p class="label">1 — Montant à miser</p>
              <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
                <button
                  v-for="p in presets"
                  :key="p"
                  type="button"
                  class="rounded-xl border px-3 py-2.5 font-display text-sm font-bold transition-all duration-200"
                  :class="
                    !customMode && amount === p
                      ? 'border-gold/60 bg-gold/15 text-gold shadow-[0_0_18px_-6px_rgba(250,204,21,0.6)]'
                      : 'border-forest-light/70 bg-void/60 text-white/70 hover:border-gold/40 hover:text-gold'
                  "
                  @click="pickPreset(p)"
                >
                  {{ p.toLocaleString('fr-FR') }}
                </button>
              </div>

              <div class="mt-3">
                <label class="label" for="custom-amount">Ou un montant libre (≥ {{ minMise }} F)</label>
                <div class="flex items-center gap-2">
                  <input
                    id="custom-amount"
                    v-model="customInput"
                    type="number"
                    inputmode="numeric"
                    step="1"
                    :min="minMise"
                    class="input flex-1"
                    :class="{ 'input-error': amountError && customMode }"
                    placeholder="ex. 750"
                    @input="onCustomInput"
                  />
                  <span class="chip">F</span>
                </div>
                <p v-if="amountError" class="field-error">{{ amountError }}</p>
              </div>

              <!-- Récapitulatif -->
              <div class="mt-5 flex items-center justify-between rounded-xl border border-forest-light/60 bg-void/50 px-4 py-3">
                <div>
                  <p class="label !mb-1">2 — Tes boules</p>
                  <div class="flex items-center gap-1.5">
                    <span
                      v-for="id in selected"
                      :key="id"
                      class="h-4 w-4 rounded-full ring-1 ring-black/40"
                      :style="{ background: ballById(id)?.hex }"
                      :title="ballById(id)?.name"
                    />
                    <span class="ml-1.5 text-sm" :class="selected.length ? 'text-white/75' : 'text-white/35'">
                      {{ selected.length ? `${selected.length} choisie${selected.length > 1 ? 's' : ''}` : 'aucune' }}
                    </span>
                  </div>
                </div>
                <div class="text-right">
                  <p class="label !mb-1">Gain potentiel</p>
                  <p class="font-display text-lg font-bold text-gold">
                    {{ selected.length ? [100, 80, 60, 40, 20][selected.length - 1] : 0 }} %
                  </p>
                </div>
              </div>

              <p class="mt-4 text-xs text-white/40">
                Rappel : avec {{ selected.length || 1 }} boule{{ selected.length > 1 ? 's' : '' }} choisie{{ selected.length > 1 ? 's' : '' }},
                le gain est de {{ selected.length ? [100, 80, 60, 40, 20][selected.length - 1] : 100 }} % de ta mise
                si la boule gagnante en fait partie. Plus tu en choisis, plus ta chance augmente mais le gain baisse.
              </p>

              <div class="mt-5 flex flex-col gap-3 sm:flex-row">
                <button class="btn btn-gold flex-1" type="button" :disabled="!canBet" @click="submitBet">
                  <span v-if="submitting" class="spinner" />
                  {{ submitting ? 'Mise en cours…' : `Valider ma mise — ${amount.toLocaleString('fr-FR')} F` }}
                </button>
                <button
                  v-if="selected.length"
                  class="btn btn-ghost"
                  type="button"
                  :disabled="submitting"
                  @click="clearSelection"
                >
                  Effacer
                </button>
              </div>
            </section>
          </Transition>

          <!-- Attente (paris fermés, pas de mise) -->
          <Transition name="result">
            <section
              v-if="localPhase === 'mixing' && !myBet"
              class="panel anim-fade-up p-5 text-center md:p-6"
            >
              <p class="font-display text-lg font-semibold text-white/75">
                🌀 Paris fermés — tirage en cours
              </p>
              <p class="mt-2 text-sm text-white/45">
                La prochaine manche ouvre dans {{ remainSec }} s — prépare ta sélection.
              </p>
            </section>
          </Transition>

          <!-- Hors connexion / chargement -->
          <section v-if="!state" class="panel anim-fade-up p-5 text-center md:p-6">
            <span class="spinner mx-auto" />
            <p class="mt-3 text-sm text-white/45">Synchronisation avec la manche en cours…</p>
          </section>
        </div>
      </div>

      <!-- ================= HISTORIQUE ================= -->
      <section class="panel anim-fade-up mt-8 p-5 md:p-8" style="animation-delay: 0.12s">
        <h2 class="mb-6 flex items-center gap-3 font-display text-xl font-semibold">
          <span class="h-5 w-1 rounded-full bg-gold" aria-hidden="true" />
          10 dernières mises
        </h2>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-[0.68rem] uppercase tracking-[0.14em] text-white/40">
                <th class="border-b border-forest-light/60 py-3 text-left font-semibold">Manche</th>
                <th class="border-b border-forest-light/60 py-3 text-left font-semibold">Date</th>
                <th class="border-b border-forest-light/60 py-3 text-left font-semibold">Mise</th>
                <th class="border-b border-forest-light/60 py-3 text-left font-semibold">Choisies</th>
                <th class="border-b border-forest-light/60 py-3 text-left font-semibold">Gagnante</th>
                <th class="border-b border-forest-light/60 py-3 text-left font-semibold">Résultat</th>
                <th class="border-b border-forest-light/60 py-3 text-right font-semibold">Gain net</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="b in history" :key="b.id" class="transition-colors hover:bg-forest/30">
                <td class="border-b border-forest/40 py-3 font-display font-semibold text-white/70">#{{ b.round }}</td>
                <td class="border-b border-forest/40 py-3 text-white/45">{{ formatDate(b.created_at) }}</td>
                <td class="border-b border-forest/40 py-3 text-white/70">{{ b.amount.toLocaleString('fr-FR') }} F</td>
                <td class="border-b border-forest/40 py-3">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="s in b.selected_colors"
                      :key="s.id"
                      class="inline-flex items-center gap-1 rounded-full border border-forest-light/70 bg-void/60 px-1.5 py-0.5 text-xs text-white/65"
                    >
                      <span class="h-2 w-2 rounded-full" :style="{ background: s.hex }" />
                      {{ s.name }}
                    </span>
                  </div>
                </td>
                <td class="border-b border-forest/40 py-3">
                  <div v-if="b.winning_ball_id" class="flex items-center gap-2">
                    <span class="h-3 w-3 rounded-full" :style="{ background: ballById(b.winning_ball_id)?.hex }" />
                    <span class="text-white/70">{{ ballById(b.winning_ball_id)?.name }}</span>
                  </div>
                  <span v-else class="text-white/25">—</span>
                </td>
                <td class="border-b border-forest/40 py-3">
                  <span
                    class="inline-block rounded-full border px-2 py-0.5 text-xs font-semibold"
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
                </td>
                <td
                  class="border-b border-forest/40 py-3 text-right font-display font-semibold"
                  :class="b.result === 'win' ? 'text-gold' : b.result === 'lose' ? 'text-white/45' : 'text-white/25'"
                >
                  <template v-if="b.result === 'win'">+{{ b.gain_amount.toLocaleString('fr-FR') }} F</template>
                  <template v-else-if="b.result === 'lose'">−{{ b.amount.toLocaleString('fr-FR') }} F</template>
                  <template v-else>—</template>
                </td>
              </tr>
              <tr v-if="history.length === 0">
                <td colspan="7" class="py-10 text-center text-white/35">
                  Aucune mise pour l'instant — ta première manche t'attend !
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer class="mt-10 text-center text-xs text-white/25">
        Boules — jeu multijoueur en direct • solde virtuel • les probabilités sont défavorables au joueur
      </footer>
    </main>

    <RechargeModal v-if="showRecharge" @close="showRecharge = false" @done="fetchRound" />
  </div>
</template>
