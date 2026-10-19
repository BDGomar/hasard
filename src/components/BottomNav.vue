<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const items = [
  {
    name: 'home',
    label: 'Accueil',
    icon: '<path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.8" />',
  },
  {
    name: 'game',
    label: 'Jeu',
    icon: '<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />',
  },
  {
    name: 'wallet',
    label: 'Portefeuille',
    icon: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1" /><path d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 7.5Z" /><circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none" />',
  },
  {
    name: 'settings',
    label: 'Paramètres',
    icon: '<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.98 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.98a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.28.62.9 1.03 1.59 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />',
  },
]

const isActive = (name) => route.name === name
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-50 border-t border-forest-light/50 bg-ink/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    aria-label="Navigation principale"
  >
    <div class="mx-auto grid h-[4.4rem] max-w-md grid-cols-4">
      <button
        v-for="item in items"
        :key="item.name"
        type="button"
        class="group relative flex flex-col items-center justify-center gap-1 transition-colors duration-200"
        :class="isActive(item.name) ? 'text-gold' : 'text-white/45 hover:text-white/80'"
        :aria-current="isActive(item.name) ? 'page' : undefined"
        @click="$router.push({ name: item.name })"
      >
        <!-- Trait actif -->
        <span
          class="absolute top-0 h-0.5 w-9 rounded-full transition-all duration-300"
          :class="isActive(item.name) ? 'bg-gold shadow-[0_0_12px_2px_rgba(250,204,21,0.5)]' : 'bg-transparent'"
          aria-hidden="true"
        />

        <span
          class="grid h-9 w-9 place-items-center rounded-xl transition-all duration-200"
          :class="isActive(item.name) ? 'bg-gold/12' : 'group-active:scale-90'"
          aria-hidden="true"
        >
          <svg
            class="h-[1.35rem] w-[1.35rem]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            v-html="item.icon"
          />
        </span>

        <span class="text-[0.62rem] font-semibold uppercase tracking-[0.08em]">
          {{ item.label }}
        </span>
      </button>
    </div>
  </nav>
</template>
