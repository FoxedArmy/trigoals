<script setup lang="ts">
const props = defineProps<{
  state: { profile: boolean, plan: boolean, activity: boolean, complete: boolean }
  /** Nothing set up at all — worth a fuller, more welcoming presentation. */
  fresh?: boolean
}>()

const steps = computed(() => [
  {
    key: 'profile',
    done: props.state.profile,
    icon: 'i-lucide-user',
    title: 'Profil einrichten',
    description: 'Schwellenwerte hinterlegen, damit Zonen und Trainingslast stimmen.',
    to: '/profile',
    action: 'Zum Profil'
  },
  {
    key: 'plan',
    done: props.state.plan,
    icon: 'i-lucide-calendar',
    title: 'Woche planen',
    description: 'Einheiten selbst anlegen oder eine Vorlage übernehmen.',
    to: '/plan',
    action: 'Zum Kalender'
  },
  {
    key: 'activity',
    done: props.state.activity,
    icon: 'i-lucide-activity',
    title: 'Aktivität erfassen',
    description: 'Manuell eintragen oder .fit-, .gpx- bzw. .tcx-Datei importieren.',
    to: '/activities',
    action: 'Zu Aktivitäten'
  }
])

const doneCount = computed(() => steps.value.filter(s => s.done).length)

/** First step still open — the one to nudge toward. */
const nextStep = computed(() => steps.value.find(s => !s.done))
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold">
            {{ fresh ? 'Leg los mit TriGoals' : 'Erste Schritte' }}
          </h2>
          <p class="text-sm text-muted">
            {{ doneCount }} von {{ steps.length }} erledigt
          </p>
        </div>
        <UIcon
          v-if="fresh"
          name="i-lucide-rocket"
          class="size-6 text-primary shrink-0"
        />
      </div>
    </template>

    <ol class="space-y-2">
      <li
        v-for="(step, i) in steps"
        :key="step.key"
        class="flex items-center gap-3 rounded-lg border p-3 transition-colors"
        :class="step.done
          ? 'border-default bg-elevated/20'
          : step.key === nextStep?.key
            ? 'border-primary/40 bg-primary/5'
            : 'border-default'"
      >
        <!-- Status: check when done, step number while open -->
        <span
          class="inline-flex items-center justify-center size-7 rounded-full shrink-0 text-xs font-bold"
          :class="step.done
            ? 'bg-success text-inverted'
            : 'bg-elevated text-muted ring-1 ring-inset ring-accented'"
        >
          <UIcon
            v-if="step.done"
            name="i-lucide-check"
            class="size-4"
          />
          <template v-else>{{ i + 1 }}</template>
        </span>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <UIcon
              :name="step.icon"
              class="size-4 shrink-0"
              :class="step.done ? 'text-dimmed' : 'text-primary'"
            />
            <p
              class="text-sm font-medium truncate"
              :class="step.done && 'text-muted'"
            >
              {{ step.title }}
            </p>
            <span
              v-if="step.done"
              class="sr-only"
            >— erledigt</span>
          </div>
          <p
            v-if="!step.done"
            class="text-xs text-muted mt-0.5"
          >
            {{ step.description }}
          </p>
        </div>

        <UButton
          :to="step.to"
          size="xs"
          :color="step.done ? 'neutral' : 'primary'"
          :variant="step.done ? 'ghost' : 'solid'"
          :label="step.done ? 'Ändern' : step.action"
          class="shrink-0"
        />
      </li>
    </ol>
  </UCard>
</template>
