<script setup>
import { computed, onMounted, ref } from 'vue'
import BrandMark from '../components/BrandMark.vue'
import RechargeModal from '../components/RechargeModal.vue'
import client, { getReferral } from '../api/client'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const recharges = ref([])
const bets = ref([])
const loading = ref(true)
const confirmingId = ref(null)
const showRecharge = ref(false)

// Parrainage : code, filleuls et gains.
const referral = ref(null)
const copied = ref(false)

const balance = computed(() => auth.user?.balance ?? 0)

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

const totalRecharged = computed(() =>
  recharges.value.filter((r) => r.status === 'completed').reduce((a, r) => a + r.amount, 0)
)

const STATUS = {
  completed: { label: 'Crédité', cls: 'border-gold/40 bg-gold/15 text-gold' },
  processing: { label: 'En cours', cls: 'border-moss/40 bg-moss/10 text-moss' },
  pending: { label: 'En attente', cls: 'border-moss/40 bg-moss/10 text-moss' },
  failed: { label: 'Échoué', cls: 'border-red-500/40 bg-red-500/10 text-red-400' },
  cancelled: { label: 'Annulé', cls: 'border-white/15 bg-white/5 text-white/50' },
}

const statusOf = (s) => STATUS[s] ?? { label: s, cls: 'border-white/15 bg-white/5 text-white/50' }

async function load() {
  loading.value = true
  const [rec, bt, ref] = await Promise.allSettled([
    client.get('/recharges'),
    client.get('/bets'),
    getReferral(),
  ])
  if (rec.status === 'fulfilled') recharges.value = rec.value.data.data ?? rec.value.data
  if (bt.status === 'fulfilled') bets.value = bt.value.data.data ?? bt.value.data
  if (ref.status === 'fulfilled') referral.value = ref.value
  loading.value = false
}

/** Vérifie réellement le statut auprès de LigdiCash (ne jamais se fier à la redirection). */
async function confirm(r) {
  confirmingId.value = r.id
  try {
    const { data } = await client.get(`/recharge/${r.id}/confirm`)
    const idx = recharges.value.findIndex((x) => x.id === r.id)
    if (idx >= 0) recharges.value[idx] = { ...recharges.value[idx], status: data.status }
    if (data.status === 'completed') await auth.fetchUser()
  } catch {
    /* on réessaiera au prochain chargement */
  } finally {
    confirmingId.value = null
  }
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

/**
 * Vérifie automatiquement les recharges jamais finalisées (callback LigdiCash
 * potentiellement injoignable, retour de paiement non détecté…).
 * C'est le filet de sécurité qui garantit que le solde finit toujours par être crédité.
 */
async function autoVerify() {
  const pending = recharges.value
    .filter((r) => r.status === 'pending' || r.status === 'processing')
    .slice(0, 3)
  if (!pending.length) return

  const results = await Promise.allSettled(
    pending.map((r) => client.get(`/recharge/${r.id}/confirm`))
  )

  let credited = false
  results.forEach((res, i) => {
    if (res.status !== 'fulfilled') return
    const data = res.value.data
    const idx = recharges.value.findIndex((x) => x.id === pending[i].id)
    if (idx >= 0) recharges.value[idx] = { ...recharges.value[idx], status: data.status }
    if (data.status === 'completed') credited = true
  })
  if (credited) await auth.fetchUser()
}

onMounted(async () => {
  await load()
  await autoVerify()
})
</script>

<template>
  <div class="pb-28">
    <!-- EN-TÊTE -->
    <header class="sticky top-0 z-40 border-b border-forest-light/50 bg-ink/85 backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
        <BrandMark size="sm" subtitle="" />
        <button class="btn btn-gold !px-4 !py-1.5 !text-sm" type="button" @click="showRecharge = true">
          ＋ Recharger
        </button>
      </div>
    </header>

    <main class="mx-auto max-w-2xl px-4">
      <section class="anim-fade-up pt-6">
        <p class="label">Mon portefeuille</p>
        <h1 class="font-display text-2xl font-bold tracking-tight md:text-3xl">Portefeuille</h1>
      </section>

      <!-- Carte solde -->
      <section class="panel-gold anim-pop mt-5 p-6">
        <p class="label !mb-1">Solde disponible</p>
        <p class="font-display text-4xl font-bold text-gold md:text-5xl">
          {{ balance.toLocaleString('fr-FR') }} F
        </p>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <span class="chip">Total rechargé · {{ totalRecharged.toLocaleString('fr-FR') }} F</span>
          <span class="chip">{{ recharges.length }} transaction{{ recharges.length > 1 ? 's' : '' }}</span>
        </div>
        <button class="btn btn-gold mt-5 w-full" type="button" @click="showRecharge = true">
          ＋ Recharger mon compte
        </button>
        <p class="mt-3 text-center text-xs text-white/35">
          Paiement Mobile Money sécurisé via LigdiCash — Orange, Moov, MTN, Wave.
        </p>
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

        <div class="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
          <div class="min-w-0 flex-1">
            <p class="label !mb-0.5">Mon code</p>
            <p class="font-display text-xl font-bold tracking-[0.2em] text-gold">{{ referral.code }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="btn btn-gold !px-4 !py-1.5 !text-sm" type="button" @click="copyReferralLink">
              {{ copied ? '✓ Copié' : 'Copier le lien' }}
            </button>
            <button class="chip" type="button" @click="shareReferralLink">Partager</button>
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

      <!-- Historique des recharges -->
      <section class="panel anim-fade-up mt-5 p-5" style="animation-delay: 0.06s">
        <h2 class="mb-4 flex items-center gap-3 font-display text-lg font-semibold">
          <span class="h-5 w-1 rounded-full bg-gold" aria-hidden="true" />
          Historique des recharges
        </h2>

        <div v-if="loading" class="py-8 text-center">
          <span class="spinner mx-auto" />
        </div>

        <div v-else-if="recharges.length" class="space-y-2">
          <div
            v-for="r in recharges"
            :key="r.id"
            class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-forest-light/50 bg-void/50 px-4 py-3"
          >
            <div>
              <p class="font-display text-sm font-semibold text-white/80">
                +{{ r.amount.toLocaleString('fr-FR') }} F
              </p>
              <p class="mt-0.5 text-xs text-white/40">
                {{ formatDate(r.created_at) }}
                <template v-if="r.operator"> · {{ r.operator }}</template>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="r.status === 'pending' || r.status === 'processing'"
                class="chip"
                type="button"
                :disabled="confirmingId === r.id"
                @click="confirm(r)"
              >
                <span v-if="confirmingId === r.id" class="spinner !h-3 !w-3" />
                {{ confirmingId === r.id ? 'Vérification…' : 'Vérifier' }}
              </button>
              <span class="rounded-full border px-2.5 py-0.5 text-xs font-semibold" :class="statusOf(r.status).cls">
                {{ statusOf(r.status).label }}
              </span>
            </div>
          </div>
        </div>

        <p v-else class="py-6 text-center text-sm text-white/35">
          Aucune recharge pour l'instant.
        </p>
      </section>

      <!-- Résumé des mises -->
      <section class="panel anim-fade-up mt-5 p-5" style="animation-delay: 0.1s">
        <h2 class="mb-4 flex items-center gap-3 font-display text-lg font-semibold">
          <span class="h-5 w-1 rounded-full bg-moss" aria-hidden="true" />
          Activité de jeu
        </h2>

        <div v-if="bets.length" class="space-y-2">
          <div
            v-for="b in bets.slice(0, 8)"
            :key="b.id"
            class="flex items-center justify-between rounded-xl border border-forest-light/50 bg-void/50 px-4 py-3"
          >
            <div>
              <p class="font-display text-sm font-semibold text-white/75">Manche #{{ b.round }}</p>
              <p class="text-xs text-white/40">Mise {{ b.amount.toLocaleString('fr-FR') }} F</p>
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
              {{ b.result === 'win' ? '+' + (b.gain_amount ?? 0).toLocaleString('fr-FR') + ' F' : b.result === 'lose' ? '−' + b.amount.toLocaleString('fr-FR') + ' F' : 'En attente' }}
            </span>
          </div>
        </div>

        <p v-else class="py-6 text-center text-sm text-white/35">
          Aucune mise pour l'instant.
        </p>
      </section>
    </main>

    <RechargeModal v-if="showRecharge" @close="showRecharge = false" @done="load" />
  </div>
</template>
