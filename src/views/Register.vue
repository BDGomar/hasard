<script setup>
import { ref, reactive } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const loading = ref(false)
const showPass = ref(false)
const form = reactive({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
})
const errors = ref({})
const message = ref('')

async function submit() {
  if (loading.value) return
  loading.value = true
  errors.value = {}
  message.value = ''
  try {
    await auth.register({ ...form })
    await router.push({ name: 'home' })
  } catch (error) {
    errors.value = error.response?.data?.errors || {}
    message.value = error.response?.data?.message || 'Inscription impossible.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center px-4 py-12">
    <!-- Titre de marque -->
    <div class="anim-fade-up w-full max-w-md text-center">
      <div class="flex justify-center">
        <BrandMark size="lg" />
      </div>
      <div class="mt-5 flex flex-wrap justify-center gap-2">
        <span class="chip chip-gold">🎁 2 500 F offerts</span>
        <span class="chip">Inscription en 30 s</span>
      </div>
    </div>

    <!-- Carte d'inscription -->
    <div class="panel anim-fade-up mt-8 w-full max-w-md p-7 md:p-8" style="animation-delay: 0.08s">
      <h1 class="font-display text-2xl font-bold tracking-tight">Créer un compte</h1>
      <p class="mt-1.5 text-sm text-white/50">
        Ton solde de <span class="font-semibold text-gold">2 500 F</span> t'attend — soit 10 mises offertes.
      </p>

      <div v-if="message" class="alert anim-pop mt-5" role="alert">
        <svg class="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span>{{ message }}</span>
      </div>

      <form class="mt-6 space-y-4" novalidate @submit.prevent="submit">
        <div>
          <label class="label" for="name">Nom complet</label>
          <div class="relative">
            <svg class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
            </svg>
            <input
              id="name"
              v-model.trim="form.name"
              class="input pl-10"
              :class="{ 'input-error': errors.name }"
              type="text"
              name="name"
              autocomplete="name"
              placeholder="Awa Diallo"
              maxlength="80"
              required
            />
          </div>
          <p v-if="errors.name" class="field-error">{{ errors.name[0] }}</p>
        </div>

        <div>
          <label class="label" for="email">Adresse email</label>
          <div class="relative">
            <svg class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            <input
              id="email"
              v-model.trim="form.email"
              class="input pl-10"
              :class="{ 'input-error': errors.email }"
              type="email"
              name="email"
              autocomplete="email"
              placeholder="toi@exemple.com"
              required
            />
          </div>
          <p v-if="errors.email" class="field-error">{{ errors.email[0] }}</p>
        </div>

        <div>
          <label class="label" for="password">Mot de passe</label>
          <div class="relative">
            <svg class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              id="password"
              v-model="form.password"
              class="input pl-10 pr-11"
              :class="{ 'input-error': errors.password }"
              :type="showPass ? 'text' : 'password'"
              name="password"
              autocomplete="new-password"
              placeholder="8 caractères minimum"
              minlength="8"
              required
            />
            <button
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/40 transition hover:text-gold"
              :aria-label="showPass ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
              @click="showPass = !showPass"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <template v-if="showPass">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 9 7a11.9 11.9 0 0 1-2.4 3.6M6.6 6.6C4.4 8 3 10.2 3 12c0 2.5 4 7 9 7a9.6 9.6 0 0 0 4-.8" />
                </template>
                <template v-else>
                  <path d="M3 12c0-2.5 4-7 9-7s9 4.5 9 7-4 7-9 7-9-4.5-9-7Z" />
                  <circle cx="12" cy="12" r="2.6" />
                </template>
              </svg>
            </button>
          </div>
          <p v-if="errors.password" class="field-error">{{ errors.password[0] }}</p>
        </div>

        <div>
          <label class="label" for="password_confirmation">Confirmer le mot de passe</label>
          <div class="relative">
            <svg class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <input
              id="password_confirmation"
              v-model="form.password_confirmation"
              class="input pl-10"
              :class="{ 'input-error': errors.password }"
              :type="showPass ? 'text' : 'password'"
              name="password_confirmation"
              autocomplete="new-password"
              placeholder="Retais-le une fois"
              required
            />
          </div>
        </div>

        <button class="btn btn-gold w-full" type="submit" :disabled="loading">
          <span v-if="loading" class="spinner" />
          {{ loading ? 'Création du compte…' : 'Créer mon compte' }}
        </button>
      </form>

      <div class="relative my-6 text-center">
        <span class="absolute inset-x-0 top-1/2 h-px bg-forest-light/60" aria-hidden="true" />
        <span class="relative bg-panel px-3 text-xs uppercase tracking-widest text-white/35">déjà inscrit ?</span>
      </div>

      <p class="text-center text-sm text-white/55">
        Déjà un compte ?
        <RouterLink class="font-semibold text-gold transition hover:text-gold-soft" to="/login">
          Se connecter →
        </RouterLink>
      </p>
    </div>

    <p class="anim-fade-up mt-6 text-center text-xs text-white/30" style="animation-delay: 0.16s">
      Aucune carte bancaire requise pour jouer — solde virtuel
    </p>
  </div>
</template>
