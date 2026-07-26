<script setup lang="ts">
import type { Activity, WorkoutMatch } from '~~/server/database/schema'
import { SPORTS, formatDistance, sportColor } from '~~/shared/constants/sports'
import { formatDuration, formatPace } from '~~/shared/utils/zones'

definePageMeta({ middleware: 'auth' })

type ActivityRow = Activity & { match: WorkoutMatch | null }

const toast = useToast()
const { data: activities, refresh } = await useFetch<ActivityRow[]>('/api/activities', {
  default: () => []
})

const manualOpen = ref(false)

// --- File import ----------------------------------------------------------
const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)

function pickFiles() {
  fileInput.value?.click()
}

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length) return

  importing.value = true
  try {
    const form = new FormData()
    for (const f of files) form.append('files', f)

    const res = await $fetch<{ imported: number, failed: { file: string, reason: string }[] }>(
      '/api/activities/import',
      { method: 'POST', body: form }
    )

    if (res.imported) {
      toast.add({
        title: `${res.imported} ${res.imported === 1 ? 'Aktivität' : 'Aktivitäten'} importiert`,
        color: 'success',
        icon: 'i-lucide-check'
      })
    }
    for (const f of res.failed) {
      toast.add({ title: `${f.file}: ${f.reason}`, color: 'error' })
    }
    await refresh()
  } catch (e) {
    toast.add({ title: apiErrorMessage(e, 'Import fehlgeschlagen'), color: 'error' })
  } finally {
    importing.value = false
    input.value = ''
  }
}

async function remove(id: string) {
  try {
    await $fetch(`/api/activities/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Aktivität gelöscht', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Löschen fehlgeschlagen', color: 'error' })
  }
}

// --- Display helpers ------------------------------------------------------
function formatStart(iso: string | Date): string {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function pace(a: ActivityRow): string | null {
  if (!a.distanceM || !a.durationSec) return null
  if (a.sport === 'swim') return formatPace(a.durationSec / (a.distanceM / 100), '/100m')
  if (a.sport === 'bike') return null // speed is more useful for cycling
  return formatPace(a.durationSec / (a.distanceM / 1000), '/km')
}

function speedKmh(a: ActivityRow): string | null {
  if (a.sport !== 'bike' || !a.distanceM || !a.durationSec) return null
  const kmh = a.distanceM / 1000 / (a.durationSec / 3600)
  return `${kmh.toFixed(1).replace('.', ',')} km/h`
}

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Manuell',
  import: 'Datei',
  strava: 'Strava'
}

const matchBadge = (m: WorkoutMatch | null) => {
  if (!m) return { label: 'Ungeplant', color: 'neutral' as const }
  if (m.status === 'completed') return { label: `Erledigt ${m.complianceScore}%`, color: 'success' as const }
  if (m.status === 'partial') return { label: `Teilweise ${m.complianceScore}%`, color: 'warning' as const }
  return { label: m.status, color: 'neutral' as const }
}
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">
          Aktivitäten
        </h1>
        <p class="text-muted">
          Erfasse Einheiten manuell oder importiere sie aus .fit-, .gpx- oder .tcx-Dateien.
        </p>
      </div>

      <div class="flex gap-2">
        <input
          ref="fileInput"
          type="file"
          accept=".fit,.gpx,.tcx"
          multiple
          class="hidden"
          @change="onFilesSelected"
        >
        <UButton
          icon="i-lucide-upload"
          color="neutral"
          variant="subtle"
          label="Datei importieren"
          :loading="importing"
          @click="pickFiles"
        />
        <UButton
          icon="i-lucide-plus"
          label="Erfassen"
          @click="manualOpen = true"
        />
      </div>
    </div>

    <UCard
      v-if="!activities?.length"
      :ui="{ body: 'py-12' }"
    >
      <div class="text-center space-y-3">
        <UIcon
          name="i-lucide-activity"
          class="size-10 text-muted mx-auto"
        />
        <p class="font-medium">
          Noch keine Aktivitäten
        </p>
        <p class="text-sm text-muted max-w-md mx-auto">
          Trage deine erste Einheit ein oder lade eine Datei von deiner Uhr hoch. Sie wird
          automatisch mit deinem Trainingsplan abgeglichen.
        </p>
      </div>
    </UCard>

    <div
      v-else
      class="space-y-2"
    >
      <UCard
        v-for="a in activities"
        :key="a.id"
        :ui="{ body: 'p-4 sm:p-4' }"
      >
        <div class="flex items-center gap-4">
          <div
            class="flex items-center justify-center size-10 rounded-lg shrink-0"
            :style="{ backgroundColor: sportColor(a.sport) }"
          >
            <UIcon
              :name="SPORTS[a.sport].icon"
              class="size-5 text-white"
            />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-semibold truncate">
                {{ a.name || SPORTS[a.sport].label }}
              </p>
              <UBadge
                size="sm"
                :color="matchBadge(a.match).color"
                variant="subtle"
                :label="matchBadge(a.match).label"
              />
              <UBadge
                size="sm"
                color="neutral"
                variant="outline"
                :label="SOURCE_LABEL[a.source]"
              />
            </div>
            <p class="text-xs text-muted">
              {{ formatStart(a.startTime) }}
            </p>
          </div>

          <div class="hidden sm:flex items-center gap-6 text-sm tabular-nums shrink-0">
            <div class="text-right">
              <p class="text-xs text-muted">
                Dauer
              </p>
              <p class="font-medium">
                {{ formatDuration(a.durationSec) }}
              </p>
            </div>
            <div
              v-if="a.distanceM"
              class="text-right"
            >
              <p class="text-xs text-muted">
                Distanz
              </p>
              <p class="font-medium">
                {{ formatDistance(a.distanceM, a.sport) }}
              </p>
            </div>
            <div
              v-if="pace(a) || speedKmh(a)"
              class="text-right"
            >
              <p class="text-xs text-muted">
                {{ a.sport === 'bike' ? 'Ø Speed' : 'Ø Pace' }}
              </p>
              <p class="font-medium">
                {{ speedKmh(a) ?? pace(a) }}
              </p>
            </div>
            <div
              v-if="a.avgHr"
              class="text-right"
            >
              <p class="text-xs text-muted">
                Ø HF
              </p>
              <p class="font-medium">
                {{ a.avgHr }}
              </p>
            </div>
            <div
              v-if="a.avgPower"
              class="text-right"
            >
              <p class="text-xs text-muted">
                Ø Watt
              </p>
              <p class="font-medium">
                {{ a.avgPower }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-xs text-muted">
                Last
              </p>
              <p class="font-semibold text-primary">
                {{ a.load ?? '–' }}
              </p>
            </div>
          </div>

          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="`${a.name || 'Aktivität'} löschen`"
            @click="remove(a.id)"
          />
        </div>

        <!-- Mobile metrics -->
        <div class="sm:hidden flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs tabular-nums text-muted">
          <span>{{ formatDuration(a.durationSec) }}</span>
          <span v-if="a.distanceM">{{ formatDistance(a.distanceM, a.sport) }}</span>
          <span v-if="speedKmh(a) ?? pace(a)">{{ speedKmh(a) ?? pace(a) }}</span>
          <span v-if="a.avgHr">{{ a.avgHr }} bpm</span>
          <span class="text-primary font-semibold">Last {{ a.load ?? '–' }}</span>
        </div>
      </UCard>
    </div>

    <ActivityFormModal
      v-model:open="manualOpen"
      @saved="refresh"
    />
  </UContainer>
</template>
