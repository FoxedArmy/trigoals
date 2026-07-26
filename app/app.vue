<script setup lang="ts">
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: 'de' }
})

const title = 'TriGoals — Deine Trainingsziele im Blick'
const description
  = 'Plane Triathlon-, Rad- und Lauftraining, vergleiche geplante mit absolvierten Einheiten und behalte Fitness, Form und Fortschritt im Blick.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
