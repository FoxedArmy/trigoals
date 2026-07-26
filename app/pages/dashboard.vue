<script setup lang="ts">
import { SPORTS, SPORT_ORDER, sportColor, workoutTypeLabel } from '~~/shared/constants/sports'
import type { Sport } from '~~/server/database/schema'
import { formatDuration } from '~~/shared/utils/zones'
import { formatDayMonth, weekdayShort, daysUntil, isoWeekNumber } from '~~/shared/utils/date'

definePageMeta({ middleware: 'auth' })

const { user } = useUserSession()

const rangeDays = ref(90)
const rangeOptions = [
  { label: '4 Wochen', value: 28 },
  { label: '3 Monate', value: 90 },
  { label: '6 Monate', value: 182 },
  { label: '1 Jahr', value: 365 }
]

const { data, refresh } = await useFetch('/api/dashboard', {
  query: computed(() => ({ days: rangeDays.value }))
})

const form = computed(() => data.value?.current.form ?? 0)

/** Nothing planned and nothing recorded — there are no numbers worth charting. */
const isFresh = computed(
  () => !data.value || (!data.value.totals.sessions && !data.value.thisWeek.planned)
)

/** Plain-language reading of the current Form value. */
const formHint = computed(() => {
  const f = form.value
  if (f > 15) return { text: 'frisch — bereit für harte Reize', color: 'text-success' }
  if (f > 5) return { text: 'erholt', color: 'text-success' }
  if (f > -10) return { text: 'im Trainingsbereich', color: 'text-toned' }
  if (f > -25) return { text: 'deutlich belastet', color: 'text-warning' }
  return { text: 'stark ermüdet — Entlastung einplanen', color: 'text-error' }
})

/** Injury/overtraining warnings, only shown when they actually trigger. */
const warnings = computed(() => {
  const out: { title: string, description: string, color: 'warning' | 'error' }[] = []
  const d = data.value
  if (!d) return out

  if (d.rampRate !== null && d.rampRate > 7) {
    out.push({
      title: `Belastung steigt schnell (+${d.rampRate}/Woche)`,
      description:
        'Ein Fitness-Zuwachs über etwa 7 Punkten pro Woche erhöht das Verletzungsrisiko. Eine ruhigere Woche einplanen.',
      color: 'warning'
    })
  }
  if (d.monotony !== null && d.monotony > 2 && d.strain !== null && d.strain > 1500) {
    out.push({
      title: 'Training zu gleichförmig',
      description:
        'Hohe Monotonie bei hoher Gesamtbelastung. Mehr Kontrast zwischen harten und leichten Tagen senkt das Übertrainingsrisiko.',
      color: 'warning'
    })
  }
  if (form.value < -30) {
    out.push({
      title: 'Form stark im Minus',
      description: 'Die Ermüdung liegt deutlich über der Fitness. Regeneration hat jetzt Priorität.',
      color: 'error'
    })
  }
  return out
})

const activeSports = computed<Sport[]>(() =>
  SPORT_ORDER.filter(s => (data.value?.totals.bySport[s]?.sessions ?? 0) > 0)
)

function formatDistanceTotal(sport: Sport, metres: number): string {
  if (!metres) return '–'
  return SPORTS[sport].distanceUnit === 'm'
    ? `${(metres / 1000).toFixed(1).replace('.', ',')} km`
    : `${Math.round(metres / 1000)} km`
}

watch(rangeDays, () => refresh())
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">
          Hallo {{ user?.name || 'Athlet' }}
        </h1>
        <p class="text-muted">
          Dein Trainingsstand auf einen Blick.
        </p>
      </div>

      <div class="flex gap-1">
        <UButton
          v-for="o in rangeOptions"
          :key="o.value"
          size="sm"
          :color="rangeDays === o.value ? 'primary' : 'neutral'"
          :variant="rangeDays === o.value ? 'solid' : 'ghost'"
          :label="o.label"
          @click="rangeDays = o.value"
        />
      </div>
    </div>

    <!-- Setup checklist — stays until all three steps are ticked off -->
    <OnboardingSteps
      v-if="data && !data.onboarding.complete"
      :state="data.onboarding"
      :fresh="isFresh"
    />

    <template v-if="data && !isFresh">
      <!-- Warnings -->
      <div
        v-if="warnings.length"
        class="space-y-2"
      >
        <UAlert
          v-for="w in warnings"
          :key="w.title"
          :color="w.color"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="w.title"
          :description="w.description"
        />
      </div>

      <!-- Stat tiles -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <UCard :ui="{ body: 'p-4 sm:p-4' }">
          <p class="text-xs uppercase text-muted font-semibold">
            Fitness
          </p>
          <p
            class="text-3xl font-bold"
            :style="{ color: 'var(--viz-fitness)' }"
          >
            {{ Math.round(data.current.fitness) }}
          </p>
          <p class="text-xs text-dimmed mt-0.5">
            langfristige Belastbarkeit
          </p>
        </UCard>

        <UCard :ui="{ body: 'p-4 sm:p-4' }">
          <p class="text-xs uppercase text-muted font-semibold">
            Ermüdung
          </p>
          <p
            class="text-3xl font-bold"
            :style="{ color: 'var(--viz-fatigue)' }"
          >
            {{ Math.round(data.current.fatigue) }}
          </p>
          <p class="text-xs text-dimmed mt-0.5">
            kurzfristige Müdigkeit
          </p>
        </UCard>

        <UCard :ui="{ body: 'p-4 sm:p-4' }">
          <p class="text-xs uppercase text-muted font-semibold">
            Form
          </p>
          <p
            class="text-3xl font-bold"
            :style="{ color: 'var(--viz-form)' }"
          >
            {{ form > 0 ? '+' : '' }}{{ Math.round(form) }}
          </p>
          <p
            class="text-xs mt-0.5"
            :class="formHint.color"
          >
            {{ formHint.text }}
          </p>
        </UCard>

        <UCard :ui="{ body: 'p-4 sm:p-4' }">
          <p class="text-xs uppercase text-muted font-semibold">
            Diese Woche
          </p>
          <p
            v-if="data.thisWeek.compliance !== null"
            class="text-3xl font-bold"
            :class="data.thisWeek.compliance >= 80
              ? 'text-success'
              : data.thisWeek.compliance >= 50 ? 'text-warning' : 'text-error'"
          >
            {{ data.thisWeek.compliance }}%
          </p>
          <p
            v-else
            class="text-3xl font-bold text-muted"
          >
            –
          </p>
          <p class="text-xs text-dimmed mt-0.5">
            {{ data.thisWeek.planned }} Einheiten geplant
          </p>
        </UCard>
      </div>

      <!-- Performance chart -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold">
                Fitness, Ermüdung & Form
              </h2>
              <p class="text-xs text-muted">
                {{ formatDayMonth(data.range.from) }} – {{ formatDayMonth(data.range.to) }}
              </p>
            </div>
            <UBadge
              v-if="data.rampRate !== null"
              size="sm"
              :color="data.rampRate > 7 ? 'warning' : 'neutral'"
              variant="subtle"
              :label="`Anstieg ${data.rampRate > 0 ? '+' : ''}${data.rampRate}/Woche`"
            />
          </div>
        </template>

        <ChartsPerformanceChart :series="data.series" />
      </UCard>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Weekly volume -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Wochenvolumen nach Sportart
            </h2>
          </template>
          <ChartsWeeklyVolumeChart
            v-if="data.weeklyVolume.length"
            :weeks="data.weeklyVolume"
          />
          <p
            v-else
            class="text-sm text-muted py-8 text-center"
          >
            Noch keine Aktivitäten im Zeitraum.
          </p>
        </UCard>

        <!-- Zone distribution -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Zeit in Intensitätszonen
            </h2>
          </template>
          <ChartsZoneDistributionChart :zone-seconds="data.zoneSeconds" />
        </UCard>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Totals per sport -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Umfang im Zeitraum
            </h2>
          </template>

          <div class="space-y-3">
            <div class="flex items-baseline gap-4 pb-3 border-b border-default">
              <div>
                <p class="text-xs uppercase text-muted font-semibold">
                  Einheiten
                </p>
                <p class="text-xl font-bold tabular-nums">
                  {{ data.totals.sessions }}
                </p>
              </div>
              <div>
                <p class="text-xs uppercase text-muted font-semibold">
                  Zeit
                </p>
                <p class="text-xl font-bold tabular-nums">
                  {{ formatDuration(data.totals.durationSec) }}
                </p>
              </div>
              <div>
                <p class="text-xs uppercase text-muted font-semibold">
                  Last
                </p>
                <p class="text-xl font-bold tabular-nums">
                  {{ data.totals.load }}
                </p>
              </div>
            </div>

            <!-- Table view: also the relief for low-contrast chart steps -->
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs uppercase text-muted">
                  <th class="text-left font-semibold pb-1">
                    Sportart
                  </th>
                  <th class="text-right font-semibold pb-1">
                    Einheiten
                  </th>
                  <th class="text-right font-semibold pb-1">
                    Zeit
                  </th>
                  <th class="text-right font-semibold pb-1">
                    Distanz
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="s in activeSports"
                  :key="s"
                  class="border-t border-default"
                >
                  <td class="py-1.5">
                    <span class="flex items-center gap-2">
                      <span
                        class="size-2 rounded-sm shrink-0"
                        :style="{ backgroundColor: sportColor(s) }"
                        aria-hidden="true"
                      />
                      {{ SPORTS[s].label }}
                    </span>
                  </td>
                  <td class="text-right tabular-nums py-1.5">
                    {{ data.totals.bySport[s]!.sessions }}
                  </td>
                  <td class="text-right tabular-nums py-1.5">
                    {{ formatDuration(data.totals.bySport[s]!.durationSec) }}
                  </td>
                  <td class="text-right tabular-nums py-1.5">
                    {{ formatDistanceTotal(s, data.totals.bySport[s]!.distanceM) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <!-- Upcoming -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-semibold">
                Als Nächstes
              </h2>
              <UButton
                to="/plan"
                size="xs"
                color="neutral"
                variant="ghost"
                label="Kalender"
              />
            </div>
          </template>

          <div class="space-y-4">
            <!-- Races -->
            <div
              v-if="data.races.length"
              class="space-y-2"
            >
              <p class="text-xs uppercase text-muted font-semibold">
                Wettkämpfe
              </p>
              <div
                v-for="r in data.races"
                :key="r.id"
                class="flex items-center gap-3 rounded-md border border-default p-2"
              >
                <UIcon
                  name="i-lucide-flag"
                  class="size-4 text-primary shrink-0"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium truncate">
                    {{ r.name }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ formatDayMonth(r.date) }}
                    <template v-if="r.distanceLabel">
                      · {{ r.distanceLabel }}
                    </template>
                  </p>
                </div>
                <UBadge
                  size="sm"
                  color="neutral"
                  variant="subtle"
                  :label="`Prio ${r.priority}`"
                />
                <span class="text-sm font-semibold tabular-nums shrink-0">
                  {{ daysUntil(r.date) }} T
                </span>
              </div>
            </div>

            <!-- Open workouts -->
            <div class="space-y-2">
              <p class="text-xs uppercase text-muted font-semibold">
                Offene Einheiten
              </p>
              <div
                v-for="w in data.upcoming"
                :key="w.id"
                class="flex items-center gap-3 rounded-md border border-default p-2"
              >
                <UIcon
                  :name="SPORTS[w.sport].icon"
                  class="size-4 shrink-0"
                  :style="{ color: sportColor(w.sport) }"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium truncate">
                    {{ w.title }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ weekdayShort(w.date) }} {{ formatDayMonth(w.date) }} ·
                    {{ workoutTypeLabel(w.type) }}
                    <template v-if="w.targetZone">
                      · Z{{ w.targetZone }}
                    </template>
                  </p>
                </div>
                <span
                  v-if="w.plannedDurationSec"
                  class="text-sm tabular-nums text-muted shrink-0"
                >
                  {{ formatDuration(w.plannedDurationSec) }}
                </span>
              </div>
              <p
                v-if="!data.upcoming.length"
                class="text-sm text-muted"
              >
                Keine offenen Einheiten geplant.
              </p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Compliance history -->
      <UCard v-if="data.complianceByWeek.length > 1">
        <template #header>
          <h2 class="font-semibold">
            Planerfüllung nach Woche
          </h2>
        </template>
        <div class="flex items-end gap-2 overflow-x-auto pb-1">
          <div
            v-for="w in data.complianceByWeek"
            :key="w.week"
            class="flex flex-col items-center gap-1 shrink-0 w-12"
          >
            <span class="text-xs tabular-nums text-muted">
              {{ w.compliance !== null ? w.compliance + '%' : '–' }}
            </span>
            <div class="w-full h-24 flex items-end rounded-sm bg-elevated/40">
              <div
                class="w-full rounded-sm transition-all"
                :class="(w.compliance ?? 0) >= 80
                  ? 'bg-success'
                  : (w.compliance ?? 0) >= 50 ? 'bg-warning' : 'bg-error'"
                :style="{ height: `${Math.max(2, w.compliance ?? 0)}%` }"
              />
            </div>
            <span class="text-xs text-dimmed tabular-nums">KW {{ isoWeekNumber(w.week) }}</span>
          </div>
        </div>
      </UCard>
    </template>
  </UContainer>
</template>
