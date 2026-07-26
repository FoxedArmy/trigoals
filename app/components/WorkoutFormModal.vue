<script setup lang="ts">
import type { Activity, PlannedWorkout, Sport, WorkoutMatch, WorkoutType } from '~~/server/database/schema'
import { SPORT_OPTIONS, WORKOUT_TYPE_OPTIONS, defaultZoneForType, SPORTS, formatDistance, sportColor } from '~~/shared/constants/sports'
import { estimatePlannedLoad } from '~~/shared/utils/load'
import { formatLongDate, today } from '~~/shared/utils/date'
import { formatDuration } from '~~/shared/utils/zones'
import { planDisplayStatus, STATUS_META } from '~~/shared/utils/planStatus'

type WorkoutWithMatch = PlannedWorkout & {
  match?: (WorkoutMatch & { activity?: Activity | null }) | null
}

const props = defineProps<{
  /** Existing workout to edit, or null to create a new one. */
  workout?: WorkoutWithMatch | null
  /** Pre-selected date when creating. */
  date: string
}>()

const emit = defineEmits<{ saved: [], close: [] }>()

const open = defineModel<boolean>('open', { required: true })
const toast = useToast()

const isEdit = computed(() => !!props.workout)

const state = reactive({
  date: props.date,
  sport: 'run' as Sport,
  title: '',
  type: 'endurance' as WorkoutType,
  durationMin: null as number | null,
  distance: null as number | null, // km, or m for swimming
  // `undefined` rather than `null` so USelectMenu's own empty state matches.
  targetZone: 2 as number | undefined,
  notes: ''
})

/** Distance is entered in km for bike/run but in metres for swimming. */
const distanceUnit = computed(() => SPORTS[state.sport].distanceUnit)

function hydrate() {
  const w = props.workout
  if (w) {
    state.date = w.date
    state.sport = w.sport
    state.title = w.title
    state.type = w.type
    state.durationMin = w.plannedDurationSec ? Math.round(w.plannedDurationSec / 60) : null
    state.distance = w.plannedDistanceM
      ? SPORTS[w.sport].distanceUnit === 'm'
        ? Math.round(w.plannedDistanceM)
        : Math.round((w.plannedDistanceM / 1000) * 10) / 10
      : null
    state.targetZone = w.targetZone ?? undefined
    state.notes = w.notes ?? ''
  } else {
    state.date = props.date
    state.sport = 'run'
    state.title = ''
    state.type = 'endurance'
    state.durationMin = 60
    state.distance = null
    state.targetZone = 2
    state.notes = ''
  }
}

watch(open, (v) => {
  if (v) hydrate()
})
onMounted(hydrate)

// Picking a workout type suggests its typical zone.
watch(() => state.type, (type) => {
  state.targetZone = defaultZoneForType(type)
})

const estimatedLoad = computed(() =>
  state.durationMin ? estimatePlannedLoad(state.durationMin * 60, state.targetZone) : null
)

const zoneOptions = [1, 2, 3, 4, 5, 6, 7].map(z => ({ label: `Zone ${z}`, value: z }))

// --- Completion status ----------------------------------------------------
const match = computed(() => props.workout?.match ?? null)
const status = computed(() =>
  props.workout ? planDisplayStatus({ date: props.workout.date, match: match.value }, today()) : 'open'
)
const statusMeta = computed(() => STATUS_META[status.value])

/** Unmatched activities near this workout, loaded on demand. */
const candidates = ref<{ activity: Activity, score: number }[]>([])
const loadingCandidates = ref(false)

async function loadCandidates() {
  if (!props.workout) return
  loadingCandidates.value = true
  try {
    candidates.value = await $fetch(`/api/workouts/${props.workout.id}/candidates`)
  } catch {
    candidates.value = []
  } finally {
    loadingCandidates.value = false
  }
}

watch(
  () => [open.value, props.workout?.id, match.value?.id] as const,
  ([isOpen]) => {
    if (isOpen && props.workout && !match.value) loadCandidates()
    else candidates.value = []
  },
  { immediate: true }
)

const updatingMatch = ref(false)

async function checkOff(activityId?: string) {
  if (!props.workout) return
  updatingMatch.value = true
  try {
    await $fetch('/api/matches', {
      method: 'POST',
      body: { plannedWorkoutId: props.workout.id, activityId: activityId ?? null }
    })
    toast.add({ title: 'Als erledigt markiert', color: 'success', icon: 'i-lucide-check' })
    open.value = false
    emit('saved')
  } catch {
    toast.add({ title: 'Konnte nicht abgehakt werden', color: 'error' })
  } finally {
    updatingMatch.value = false
  }
}

async function unlink() {
  if (!match.value) return
  updatingMatch.value = true
  try {
    await $fetch(`/api/matches/${match.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Zuordnung aufgehoben', color: 'success' })
    open.value = false
    emit('saved')
  } catch {
    toast.add({ title: 'Aufheben fehlgeschlagen', color: 'error' })
  } finally {
    updatingMatch.value = false
  }
}

const saving = ref(false)

async function save() {
  if (!state.title.trim()) {
    toast.add({ title: 'Bitte einen Titel eingeben', color: 'error' })
    return
  }
  saving.value = true
  try {
    const body = {
      date: state.date,
      sport: state.sport,
      title: state.title.trim(),
      type: state.type,
      plannedDurationSec: state.durationMin ? state.durationMin * 60 : null,
      plannedDistanceM: state.distance
        ? distanceUnit.value === 'm'
          ? state.distance
          : state.distance * 1000
        : null,
      targetZone: state.targetZone ?? null,
      notes: state.notes.trim() || null
    }

    if (isEdit.value) {
      await $fetch(`/api/workouts/${props.workout!.id}`, { method: 'PATCH', body })
    } else {
      await $fetch('/api/workouts', { method: 'POST', body })
    }

    toast.add({
      title: isEdit.value ? 'Workout aktualisiert' : 'Workout geplant',
      color: 'success',
      icon: 'i-lucide-check'
    })
    open.value = false
    emit('saved')
  } catch {
    toast.add({ title: 'Speichern fehlgeschlagen', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.workout) return
  saving.value = true
  try {
    await $fetch(`/api/workouts/${props.workout.id}`, { method: 'DELETE' })
    toast.add({ title: 'Workout gelöscht', color: 'success' })
    open.value = false
    emit('saved')
  } catch {
    toast.add({ title: 'Löschen fehlgeschlagen', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? 'Workout bearbeiten' : 'Workout planen'"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          {{ formatLongDate(state.date) }}
        </p>

        <!-- Completion status (existing workouts only) -->
        <template v-if="isEdit">
          <div class="rounded-lg border border-default p-3 space-y-3">
            <div class="flex items-center gap-2">
              <UIcon
                :name="statusMeta.icon"
                class="size-5"
                :class="{
                  'text-success': statusMeta.color === 'success',
                  'text-warning': statusMeta.color === 'warning',
                  'text-error': statusMeta.color === 'error',
                  'text-muted': statusMeta.color === 'neutral'
                }"
              />
              <span class="font-medium text-sm">{{ statusMeta.label }}</span>
              <span
                v-if="match?.complianceScore != null"
                class="text-sm text-muted"
              >
                · {{ match.complianceScore }}% erfüllt
              </span>
              <UBadge
                v-if="match?.autoMatched"
                size="sm"
                color="neutral"
                variant="subtle"
                label="automatisch"
                class="ml-auto"
              />
            </div>

            <!-- Linked activity -->
            <div
              v-if="match?.activity"
              class="flex items-center gap-2 text-sm rounded-md bg-elevated/50 p-2"
            >
              <UIcon
                :name="SPORTS[match.activity.sport].icon"
                class="size-4 shrink-0"
                :style="{ color: sportColor(match.activity.sport) }"
              />
              <span class="truncate flex-1">
                {{ match.activity.name || SPORTS[match.activity.sport].label }}
              </span>
              <span class="text-muted tabular-nums shrink-0">
                {{ formatDuration(match.activity.durationSec) }}
                <template v-if="match.activity.distanceM">
                  · {{ formatDistance(match.activity.distanceM, match.activity.sport) }}
                </template>
              </span>
            </div>

            <!-- Actions -->
            <div
              v-if="match"
              class="flex gap-2"
            >
              <UButton
                size="sm"
                color="neutral"
                variant="subtle"
                icon="i-lucide-unlink"
                label="Zuordnung aufheben"
                :loading="updatingMatch"
                @click="unlink"
              />
            </div>
            <div
              v-else
              class="space-y-2"
            >
              <UButton
                size="sm"
                icon="i-lucide-check"
                label="Ohne Aktivität abhaken"
                :loading="updatingMatch"
                @click="checkOff()"
              />

              <div
                v-if="loadingCandidates"
                class="text-xs text-muted"
              >
                Suche passende Aktivitäten …
              </div>
              <div
                v-else-if="candidates.length"
                class="space-y-1.5"
              >
                <p class="text-xs font-semibold text-muted uppercase tracking-wide">
                  Passende Aktivitäten
                </p>
                <button
                  v-for="c in candidates"
                  :key="c.activity.id"
                  type="button"
                  class="w-full flex items-center gap-2 text-sm rounded-md border border-default p-2 hover:bg-elevated transition-colors text-left"
                  :disabled="updatingMatch"
                  @click="checkOff(c.activity.id)"
                >
                  <UIcon
                    :name="SPORTS[c.activity.sport].icon"
                    class="size-4 shrink-0"
                    :style="{ color: sportColor(c.activity.sport) }"
                  />
                  <span class="truncate flex-1">
                    {{ c.activity.name || SPORTS[c.activity.sport].label }}
                  </span>
                  <span class="text-muted tabular-nums text-xs shrink-0">
                    {{ formatDuration(c.activity.durationSec) }}
                  </span>
                  <UBadge
                    v-if="c.score > 0"
                    size="sm"
                    :color="c.score >= 70 ? 'success' : 'neutral'"
                    variant="subtle"
                    :label="`${c.score}%`"
                  />
                </button>
              </div>
            </div>
          </div>

          <USeparator />
        </template>

        <UFormField label="Sportart">
          <USelectMenu
            v-model="state.sport"
            :items="SPORT_OPTIONS"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Titel">
          <UInput
            v-model="state.title"
            placeholder="z. B. Long Run"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Art">
          <USelectMenu
            v-model="state.type"
            :items="WORKOUT_TYPE_OPTIONS"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Dauer (Minuten)">
            <UInput
              v-model.number="state.durationMin"
              type="number"
              min="1"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="`Distanz (${distanceUnit})`">
            <UInput
              v-model.number="state.distance"
              type="number"
              min="0"
              :step="distanceUnit === 'm' ? 50 : 0.5"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Zielzone">
          <USelectMenu
            v-model="state.targetZone"
            :items="zoneOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="estimatedLoad"
          color="neutral"
          variant="subtle"
          icon="i-lucide-gauge"
          :title="`Geschätzte Trainingslast: ${estimatedLoad}`"
          description="Wird automatisch aus Dauer und Zielzone berechnet."
        />

        <UFormField label="Notizen">
          <UTextarea
            v-model="state.notes"
            :rows="3"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between w-full">
        <UButton
          v-if="isEdit"
          color="error"
          variant="ghost"
          icon="i-lucide-trash-2"
          label="Löschen"
          :disabled="saving"
          @click="remove"
        />
        <div v-else />
        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Abbrechen"
            @click="open = false"
          />
          <UButton
            :loading="saving"
            label="Speichern"
            @click="save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
