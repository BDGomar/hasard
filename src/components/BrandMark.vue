<script setup>
defineProps({
  subtitle: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg
})
</script>

<template>
  <div class="flex items-center gap-3" :class="size === 'sm' ? '' : 'gap-4'">
    <span
      class="brand-dots shrink-0"
      :class="size === 'lg' ? 'scale-125' : ''"
      aria-hidden="true"
    >
      <i></i><i></i><i></i>
    </span>
    <div class="min-w-0">
      <p
        class="font-display font-bold tracking-tight leading-none"
        :class="size === 'lg' ? 'text-4xl md:text-5xl' : size === 'sm' ? 'text-base' : 'text-xl'"
      >
        BOU<span class="text-gold">LES</span>
      </p>
      <p v-if="subtitle" class="mt-1.5 text-sm text-white/45">{{ subtitle }}</p>
      <slot />
    </div>
  </div>
</template>
