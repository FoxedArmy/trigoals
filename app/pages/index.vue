<script setup lang="ts">
const { loggedIn } = useUserSession()

const features = [
  {
    icon: 'i-lucide-calendar-check',
    title: 'Planen & Abhaken',
    description:
      'Erstelle Wochenpläne aus Vorlagen oder selbst und hake absolvierte Einheiten ab.'
  },
  {
    icon: 'i-lucide-git-compare-arrows',
    title: 'Plan vs. Realität',
    description:
      'Geplante und tatsächliche Workouts werden automatisch abgeglichen — inkl. Compliance-Score.'
  },
  {
    icon: 'i-lucide-trending-up',
    title: 'Fitness & Form',
    description:
      'Verfolge Trainingslast, Fitness, Ermüdung und Form über die Zeit in klaren Charts.'
  },
  {
    icon: 'i-simple-icons-strava',
    title: 'Strava-ready',
    description:
      'Import per Datei heute, automatischer Strava-Sync nach Freigabe — dieselbe Auswertung.'
  }
]
</script>

<template>
  <div>
    <UPageHero
      title="Erreiche deine Trainingsziele"
      description="TriGoals plant dein Triathlon-, Rad- und Lauftraining, vergleicht geplante mit absolvierten Einheiten und zeigt dir Fitness, Form und Fortschritt auf einen Blick."
      :links="loggedIn
        ? [{ label: 'Zum Dashboard', to: '/dashboard', trailingIcon: 'i-lucide-arrow-right', size: 'xl' }]
        : [
          { label: 'Kostenlos starten', to: '/register', trailingIcon: 'i-lucide-arrow-right', size: 'xl' },
          { label: 'Anmelden', to: '/login', size: 'xl', color: 'neutral', variant: 'subtle' }
        ]"
    />

    <UPageSection
      title="Alles für dein Training"
      description="Von der Planung bis zur Auswertung — an einem Ort."
      :features="features"
    />
  </div>
</template>
