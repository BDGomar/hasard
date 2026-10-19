<script setup>
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import BottomNav from './components/BottomNav.vue'

const route = useRoute()
const showNav = computed(() => Boolean(route.meta.auth))
</script>

<template>
  <div class="relative min-h-screen overflow-x-hidden bg-void">
    <!-- Orbes lumineux (vert foncé + jaune) -->
    <div
      class="anim-orb pointer-events-none fixed -top-40 -left-40 h-[34rem] w-[34rem] rounded-full opacity-60 blur-[110px]"
      style="background: radial-gradient(circle, rgba(27, 122, 80, 0.5), transparent 65%)"
      aria-hidden="true"
    />
    <div
      class="anim-orb pointer-events-none fixed -right-48 bottom-[-12rem] h-[30rem] w-[30rem] rounded-full opacity-30 blur-[120px]"
      style="background: radial-gradient(circle, rgba(250, 204, 21, 0.35), transparent 65%); animation-delay: -7s"
      aria-hidden="true"
    />

    <!-- Trame technique subtile -->
    <div
      class="pointer-events-none fixed inset-0 opacity-[0.05]"
      style="
        background-image:
          linear-gradient(rgba(27, 122, 80, 0.6) 1px, transparent 1px),
          linear-gradient(90deg, rgba(27, 122, 80, 0.6) 1px, transparent 1px);
        background-size: 56px 56px;
        mask-image: radial-gradient(ellipse at center, black 30%, transparent 78%);
      "
      aria-hidden="true"
    />

    <div class="relative z-10" :class="showNav ? 'pb-[4.4rem]' : ''">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </div>

    <BottomNav v-if="showNav" />
  </div>
</template>
