<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="$emit('close')">
    <div class="panel-gold anim-pop w-full max-w-md p-6">
      <h2 class="font-display text-xl font-semibold">Recharger mon compte</h2>
      <p class="mt-1 text-sm text-white/45">Paiement sécurisé par LigdiCash — Orange, Moov, MTN, Wave.</p>

      <p class="label mt-5">1 — Choisis un montant</p>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
          {{ p.toLocaleString('fr-FR') }} F
        </button>
      </div>

      <div class="mt-3">
        <label class="label" for="recharge-amount">Ou un montant libre (≥ {{ min }} F)</label>
        <div class="flex items-center gap-2">
          <input
            id="recharge-amount"
            v-model="customInput"
            type="number"
            inputmode="numeric"
            step="100"
            :min="min"
            class="input flex-1"
            :class="{ 'input-error': error && customMode }"
            placeholder="ex. 3000"
            @input="onCustomInput"
          />
          <span class="chip">F</span>
        </div>
        <p v-if="error" class="field-error">{{ error }}</p>
      </div>

      <Transition name="result">
        <p v-if="errorMessage" class="alert mt-4" role="alert">
          <svg class="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{{ errorMessage }}</span>
        </p>
      </Transition>

      <div class="mt-5 flex flex-col gap-3 sm:flex-row">
        <button class="btn btn-ghost" type="button" :disabled="loading" @click="$emit('close')">
          Annuler
        </button>
        <button class="btn btn-gold flex-1" type="button" :disabled="loading || Boolean(error)" @click="pay">
          <span v-if="loading" class="spinner" />
          {{ loading ? 'Redirection…' : `Payer ${total.toLocaleString('fr-FR')} F` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import client from '../api/client'

const emit = defineEmits(['close', 'done'])

const presets = [1000, 2000, 5000, 10000]
const min = 100
const amount = ref(1000)
const customMode = ref(false)
const customInput = ref('')
const loading = ref(false)
const errorMessage = ref('')

const total = computed(() => amount.value)

const error = computed(() => {
  if (!customMode.value) return ''
  const raw = customInput.value
  const n = Number(raw)
  if (raw === '' || Number.isNaN(n)) return 'Saisis un montant.'
  if (!Number.isInteger(n)) return 'Le montant doit être un nombre entier.'
  if (n < min) return `Le montant minimum est de ${min} F.`
  return ''
})

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

async function pay() {
  if (error.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await client.post('/recharge/init', { amount: total.value }).then((r) => r.data)
    if (data.pay_url) {
      window.location.href = data.pay_url
      return // la redirection charge une nouvelle page
    }
    errorMessage.value = 'Aucune URL de paiement reçue — réessaie.'
  } catch (e) {
    errorMessage.value =
      e.response?.data?.message || "Impossible d'initier le paiement pour le moment."
  } finally {
    loading.value = false
    emit('done')
  }
}
</script>
