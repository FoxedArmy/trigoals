<script setup lang="ts">
import type { Activity, PlannedWorkout, Sport, WorkoutMatch } from '~~/server/database/schema'
import { SPORTS, workoutTypeLabel, formatDistance, sportColor } from '~~/shared/constants/sports'
import { formatDuration } from '~~/shared/utils/zones'
import { planDisplayStatus, weeklyCompliance, STATUS_META } from '~~/shared/utils/planStatus'
import {
  today,
  startOfWeek,
  endOfWeek,
  weekDates,
  weekdayShort,
  formatDayMonth,
  addDays,
  isoWeekNumber,
  formatLongDate
} from '~~/shared/utils/date'

definePageMeta({ middleware: 'auth' })

const toast = useToast()

/** Monday of the currently shown week. */
const anchor = ref(startOfWeek(today()))
const days = computed(() => weekDates(anchor.value))
const rangeTo = computed(() => endOfWeek(anchor.value))

type WorkoutRow = PlannedWorkout & {
  match: (WorkoutMatch & { activity: Activity | null }) | null
}

const { data: workouts, refresh } = await useFetch<WorkoutRow[]>('/api/workouts', {
  query: computed(() => ({ from: anchor.value, to: rangeTo.value })),
  default: () => []
})

const byDay = computed(() => {
  const map = new Map<string, WorkoutRow[]>()
  for (const d of days.value) map.set(d, [])
  for (const w of workouts.value ?? []) map.get(w.date)?.push(w)
  return map
})

const statusOf = (w: WorkoutRow) => planDisplayStatus(w, today())
const statusMetaOf = (w: WorkoutRow) => STATUS_META[statusOf(w)]

const compliance = computed(() => weeklyCompliance(workouts.value ?? [], today()))

// --- Weekly summary -------------------------------------------------------
const summary = computed(() => {
  const list = workouts.value ?? []
  const totalSec = list.reduce((a, w) => a + (w.plannedDurationSec ?? 0), 0)
  const totalLoad = list.reduce((a, w) => a + (w.plannedLoad ?? 0), 0)
  const perSport = new Map<string, number>()
  for (const w of list) {
    perSport.set(w.sport, (perSport.get(w.sport) ?? 0) + (w.plannedDurationSec ?? 0))
  }
  return { count: list.length, totalSec, totalLoad, perSport }
})

// --- Navigation -----------------------------------------------------------
function shiftWeek(delta: number) {
  anchor.value = addDays(anchor.value, delta * 7)
}
function goToday() {
  anchor.value = startOfWeek(today())
}

// --- Workout modal --------------------------------------------------------
const modalOpen = ref(false)
const editing = ref<WorkoutRow | null>(null)
const modalDate = ref(today())

function openNew(date: string) {
  editing.value = null
  modalDate.value = date
  modalOpen.value = true
}
function openEdit(w: WorkoutRow) {
  editing.value = w
  modalDate.value = w.date
  modalOpen.value = true
}

// --- Templates ------------------------------------------------------------
const templatesOpen = ref(false)
const { data: templates } = await useFetch('/api/templates', { default: () => [] })
const applying = ref<string | null>(null)

async function applyTemplate(id: string) {
  applying.value = id
  try {
    const res = await $fetch<{ created: number }>('/api/templates/apply', {
      method: 'POST',
      body: { templateId: id, startDate: anchor.value }
    })
    toast.add({
      title: `${res.created} Workouts eingeplant`,
      description: `Ab ${formatLongDate(anchor.value)}`,
      color: 'success',
      icon: 'i-lucide-check'
    })
    templatesOpen.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Vorlage konnte nicht angewendet werden', color: 'error' })
  } finally {
    applying.value = null
  }
}

const isToday = (d: string) => d === today()
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">
          Trainingsplan
        </h1>
        <p class="text-muted">
          KW {{ isoWeekNumber(anchor) }} · {{ formatDayMonth(anchor) }} – {{ formatDayMonth(rangeTo) }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="subtle"
          aria-label="Vorherige Woche"
          @click="shiftWeek(-1)"
        />
        <UButton
          color="neutral"
          variant="subtle"
          label="Heute"
          @click="goToday"
        />
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="subtle"
          aria-label="Nächste Woche"
          @click="shiftWeek(1)"
        />
        <UButton
          icon="i-lucide-layout-template"
          color="neutral"
          variant="subtle"
          label="Vorlage"
          @click="templatesOpen = true"
        />
      </div>
    </div>

    <!-- Weekly summary -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
      <UCard :ui="{ body: 'p-4 sm:p-4' }">
        <p class="text-xs uppercase text-muted font-semibold">
          Einheiten
        </p>
        <p class="text-2xl font-bold tabular-nums">
          {{ summary.count }}
        </p>
      </UCard>
      <UCard :ui="{ body: 'p-4 sm:p-4' }">
        <p class="text-xs uppercase text-muted font-semibold">
          Plan erfüllt
        </p>
        <p
          v-if="compliance !== null"
          class="text-2xl font-bold tabular-nums"
          :class="compliance >= 80 ? 'text-success' : compliance >= 50 ? 'text-warning' : 'text-error'"
        >
          {{ compliance }}%
        </p>
        <p
          v-else
          class="text-2xl font-bold text-muted"
        >
          –
        </p>
      </UCard>
      <UCard :ui="{ body: 'p-4 sm:p-4' }">
        <p class="text-xs uppercase text-muted font-semibold">
          Dauer
        </p>
        <p class="text-2xl font-bold tabular-nums">
          {{ formatDuration(summary.totalSec) }}
        </p>
      </UCard>
      <UCard :ui="{ body: 'p-4 sm:p-4' }">
        <p class="text-xs uppercase text-muted font-semibold">
          Geplante Last
        </p>
        <p class="text-2xl font-bold tabular-nums">
          {{ summary.totalLoad }}
        </p>
      </UCard>
      <UCard :ui="{ body: 'p-4 sm:p-4' }">
        <p class="text-xs uppercase text-muted font-semibold mb-1">
          Verteilung
        </p>
        <div
          v-if="summary.perSport.size"
          class="space-y-1"
        >
          <div
            v-for="[sport, sec] of summary.perSport"
            :key="sport"
            class="flex items-center gap-2 text-xs"
          >
            <span
              class="size-2 rounded-full"
              :style="{ backgroundColor: sportColor(sport as Sport) }"
            />
            <span class="flex-1 truncate">{{ SPORTS[sport as keyof typeof SPORTS].label }}</span>
            <span class="tabular-nums text-muted">{{ formatDuration(sec) }}</span>
          </div>
        </div>
        <p
          v-else
          class="text-sm text-muted"
        >
          –
        </p>
      </UCard>
    </div>

    <!-- Week grid -->
    <div class="grid gap-3 md:grid-cols-7">
      <div
        v-for="d in days"
        :key="d"
        class="rounded-lg border border-default bg-elevated/30 p-2 min-h-40 flex flex-col"
        :class="isToday(d) && 'ring-2 ring-primary'"
      >
        <div class="flex items-center justify-between mb-2 px-1">
          <div>
            <p
              class="text-xs font-semibold"
              :class="isToday(d) ? 'text-primary' : 'text-muted'"
            >
              {{ weekdayShort(d) }}
            </p>
            <p class="text-xs text-dimmed tabular-nums">
              {{ formatDayMonth(d) }}
            </p>
          </div>
          <UButton
            icon="i-lucide-plus"
            size="xs"
            color="neutral"
            variant="ghost"
            :aria-label="`Workout am ${d} hinzufügen`"
            @click="openNew(d)"
          />
        </div>

        <div class="space-y-2 flex-1">
          <button
            v-for="w in byDay.get(d)"
            :key="w.id"
            type="button"
            class="w-full text-left rounded-md border bg-default p-2 hover:bg-elevated transition-colors border-l-2"
            :class="{
              'border-default border-l-success': statusOf(w) === 'completed',
              'border-default border-l-warning': statusOf(w) === 'partial',
              'border-default border-l-error': statusOf(w) === 'missed',
              'border-default border-l-default': statusOf(w) === 'open'
            }"
            @click="openEdit(w)"
          >
            <div class="flex items-center gap-1.5 mb-1">
              <UIcon
                :name="SPORTS[w.sport].icon"
                class="size-3.5 shrink-0"
                :style="{ color: sportColor(w.sport) }"
              />
              <span class="text-xs font-semibold truncate flex-1">{{ w.title }}</span>
              <UIcon
                :name="statusMetaOf(w).icon"
                class="size-3.5 shrink-0"
                :class="{
                  'text-success': statusMetaOf(w).color === 'success',
                  'text-warning': statusMetaOf(w).color === 'warning',
                  'text-error': statusMetaOf(w).color === 'error',
                  'text-dimmed': statusMetaOf(w).color === 'neutral'
                }"
                :aria-label="statusMetaOf(w).label"
              />
            </div>
            <p class="text-[11px] text-muted">
              {{ workoutTypeLabel(w.type) }}
              <template v-if="w.targetZone">
                · Z{{ w.targetZone }}
              </template>
            </p>
            <p class="text-[11px] text-muted tabular-nums">
              <template v-if="w.plannedDurationSec">
                {{ formatDuration(w.plannedDurationSec) }}
              </template>
              <template v-if="w.plannedDistanceM">
                · {{ formatDistance(w.plannedDistanceM, w.sport) }}
              </template>
            </p>
          </button>
        </div>
      </div>
    </div>

    <WorkoutFormModal
      v-model:open="modalOpen"
      :workout="editing"
      :date="modalDate"
      @saved="refresh"
    />

    <!-- Templates -->
    <UModal
      v-model:open="templatesOpen"
      title="Plan-Vorlage anwenden"
    >
      <template #body>
        <p class="text-sm text-muted mb-4">
          Die Vorlage wird ab <strong>KW {{ isoWeekNumber(anchor) }}</strong>
          ({{ formatLongDate(anchor) }}) eingeplant. Alle Einheiten bleiben danach frei
          bearbeitbar.
        </p>

        <div class="space-y-3">
          <div
            v-for="t in templates"
            :key="t.id"
            class="rounded-lg border border-default p-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-semibold text-sm">
                  {{ t.name }}
                </p>
                <p class="text-xs text-muted mt-0.5">
                  {{ t.description }}
                </p>
                <div class="flex flex-wrap gap-1.5 mt-2">
                  <UBadge
                    size="sm"
                    color="neutral"
                    variant="subtle"
                    :label="`${t.weekCount} Wochen`"
                  />
                  <UBadge
                    size="sm"
                    color="neutral"
                    variant="subtle"
                    :label="t.weeklyHours"
                  />
                  <UBadge
                    v-for="l in t.weekLabels"
                    :key="l"
                    size="sm"
                    color="primary"
                    variant="subtle"
                    :label="l"
                  />
                </div>
              </div>
              <UButton
                size="sm"
                label="Anwenden"
                :loading="applying === t.id"
                @click="applyTemplate(t.id)"
              />
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
