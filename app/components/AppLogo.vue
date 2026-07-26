<script setup lang="ts">
defineProps<{ class?: string }>()
</script>

<template>
  <span
    class="inline-flex items-center gap-2 font-bold text-highlighted"
    :class="$props.class"
  >
    <UIcon
      name="i-lucide-target"
      class="size-6 text-primary"
    />
    <span class="text-lg tracking-tight">Tri<span class="text-primary">Goals</span></span>
  </span>
</template>
