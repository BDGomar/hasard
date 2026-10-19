<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import client from '../api/client'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  outcome: { type: String, default: 'success' },
  rechargeId: { type: [String, Number], default: null },
})

const router = useRouter()
const auth = useAuthStore()

const state = ref('checking') // checking | completed | failed | pending | unknown
const amount = ref(0)
const attempts = ref(0)
const message = ref('')

/** ID de la recharge : paramètre ?r= de la return_url, sinon localStorage. */
const rechargeId = props.rechargeId || localStorage.getItem('pending_recharge')

/**
 * Après la redirection depuis LigdiCash, on n'a jamais la preuve du paiement
 * dans l'URL : on appelle notre backend, qui re-vérifie via l'endpoint
 * `confirm` de LigdiCash avec le token stocké à la création.
 * Polling : l'opérateur mobile money peut mettre quelques secondes à confirmer.
 */
async function verify() {
  if (!rechargeId) {
    state.value = 'unknown'
    message.value = 'Aucune transaction à vérifier sur cet appareil.'
    return
  }

  localStorage.removeItem('pending_recharge')
  state.value = 'checking'

  const MAX_ATTEMPTS = 10
  const DELAY = 3000

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    attempts.value = i
    try {
      const { data } = await client.get(`/recharge/${rechargeId}/confirm`)
      amount.value = data.amount ?? 0

      if (data.status === 'completed') {
        state.value = 'completed'
        await auth.fetchUser()
        return
      }
      if (data.status === 'failed' || data.status === 'cancelled') {
        state.value = 'failed'
        return
      }
      // Toujours en attente côté opérateur → on retente.
    } catch {
      // erreur réseau/transitoire : on retente aussi.
    }

    if (i < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, DELAY))
  }

  // Toujours pas de verdict : le callback ou une vérification ultérieure tranchera.
  state.value = 'pending'
  message.value =
    "La confirmation de l'opérateur prend plus de temps que prévu. " +
    'Ton solde sera crédité automatiquement — réessaie plus tard depuis ton portefeuille.'
}

function goToWallet() {
  router.push({ name: 'wallet' })
}

onMounted(verify)
</script>

<template>
  <div class="flex min-h-[70vh] items-center justify-center px-4">
    <div class="panel-gold anim-pop w-full max-w-md p-6 text-center">
      <BrandMark size="sm" subtitle="" />

      <!-- Vérification en cours -->
      <div v-if="state === 'checking'" class="mt-8">
        <span class="spinner mx-auto !h-10 !w-10" />
        <h1 class="font-display mt-5 text-xl font-semibold">
          Vérification du paiement…
        </h1>
        <p class="mt-2 text-sm text-white/45">
          Ne ferme pas cette page. Tentative {{ attempts }} / 10
        </p>
      </div>

      <!-- Succès -->
      <div v-else-if="state === 'completed'" class="mt-8">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/50 bg-gold/15">
          <svg class="h-8 w-8 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 class="font-display mt-5 text-2xl font-bold text-gold">Paiement confirmé !</h1>
        <p class="mt-2 text-sm text-white/60">
          <template v-if="amount">+{{ amount.toLocaleString('fr-FR') }} F crédités sur ton solde.</template>
          <template v-else>Le montant a été crédité sur ton solde.</template>
        </p>
        <button class="btn btn-gold mt-6 w-full" type="button" @click="goToWallet">
          Voir mon portefeuille
        </button>
      </div>

      <!-- Échec -->
      <div v-else-if="state === 'failed'" class="mt-8">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-red-500/50 bg-red-500/15">
          <svg class="h-8 w-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </div>
        <h1 class="font-display mt-5 text-2xl font-bold text-red-400">Paiement non abouti</h1>
        <p class="mt-2 text-sm text-white/60">
          Le paiement a été annulé ou refusé. Aucun montant n'a été débité définitivement.
        </p>
        <button class="btn btn-gold mt-6 w-full" type="button" @click="goToWallet()">
          Retour au portefeuille
        </button>
      </div>

      <!-- En attente -->
      <div v-else-if="state === 'pending'" class="mt-8">
        <span class="spinner mx-auto !h-10 !w-10" />
        <h1 class="font-display mt-5 text-xl font-semibold">Confirmation en attente</h1>
        <p class="mt-2 text-sm text-white/45">{{ message }}</p>
        <button class="btn btn-ghost mt-6 w-full" type="button" @click="goToWallet">
          Retour au portefeuille
        </button>
      </div>

      <!-- Rien à vérifier -->
      <div v-else class="mt-8">
        <h1 class="font-display mt-5 text-xl font-semibold">Aucune transaction</h1>
        <p class="mt-2 text-sm text-white/45">{{ message }}</p>
        <button class="btn btn-gold mt-6 w-full" type="button" @click="goToWallet">
          Retour au portefeuille
        </button>
      </div>
    </div>
  </div>
</template>
