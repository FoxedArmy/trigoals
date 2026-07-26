<script setup lang="ts">
import type { Race } from '~~/server/database/schema'
import { formatLongDate, daysUntil, today } from '~~/shared/utils/date'

definePageMeta({ middleware: 'auth' })

const toast = useToast()
const { data: races, refresh } = await useFetch<Race[]>('/api/races', { default: () => [] })

const upcoming = computed(() => (races.value ?? []).filter(r => r.date >= today()))
const past = computed(() =>
  (races.value ?? []).filter(r => r.date < today()).sort((a, b) => b.date.localeCompare(a.date))
)

const SPORT_OPTIONS = [
  { label: 'Triathlon', value: 'triathlon' },
  { label: 'Laufen', value: 'run' },
  { label: 'Rad', value: 'bike' },
  { label: 'Schwimmen', value: 'swim' },
  { label: 'Sonstiges', value: 'other' }
]

const PRIORITY_OPTIONS = [
  { label: 'A — Hauptziel', value: 'A' },
  { label: 'B — wichtig', value: 'B' },
  { label: 'C — Testwettkampf', value: 'C' }
]

const open = ref(false)
const saving = ref(false)
const state = reactive({
  name: '',
  date: today(),
  sport: 'triathlon',
  distanceLabel: '',
  priority: 'B',
  notes: ''
})

function openNew() {
  state.name = ''
  state.date = today()
  state.sport = 'triathlon'
  state.distanceLabel = ''
  state.priority = 'B'
  state.notes = ''
  open.value = true
}

async function save() {
  if (!state.name.trim()) {
    toast.add({ title: 'Bitte einen Namen eingeben', color: 'error' })
    return
  }
  saving.value = true
  try {
    await $fetch('/api/races', {
      method: 'POST',
      body: {
        name: state.name.trim(),
        date: state.date,
        sport: state.sport,
        distanceLabel: state.distanceLabel.trim() || null,
        priority: state.priority,
        notes: state.notes.trim() || null
      }
    })
    toast.add({ title: 'Wettkampf gespeichert', color: 'success', icon: 'i-lucide-check' })
    open.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Speichern fehlgeschlagen', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove(id: string) {
  try {
    await $fetch(`/api/races/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Wettkampf gelöscht', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Löschen fehlgeschlagen', color: 'error' })
  }
}

const priorityColor = (p: string) => (p === 'A' ? 'primary' : p === 'B' ? 'neutral' : 'neutral')

/** A taper reminder is only useful for the main goals, and only close to the day. */
function taperHint(race: Race): string | null {
  const d = daysUntil(race.date)
  if (race.priority !== 'A' || d < 0) return null
  if (d <= 7) return 'Wettkampfwoche — Umfang deutlich reduzieren, Intensität kurz halten.'
  if (d <= 21) return 'Taper-Phase beginnt — Umfang schrittweise zurücknehmen.'
  return null
}
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">
          Wettkämpfe & Ziele
        </h1>
        <p class="text-muted">
          Setze Saisonziele und behalte den Countdown im Blick.
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        label="Wettkampf"
        @click="openNew"
      />
    </div>

    <UCard
      v-if="!races?.length"
      :ui="{ body: 'py-12' }"
    >
      <div class="text-center space-y-3">
        <UIcon
          name="i-lucide-flag"
          class="size-10 text-muted mx-auto"
        />
        <p class="font-medium">
          Noch keine Wettkämpfe
        </p>
        <p class="text-sm text-muted max-w-md mx-auto">
          Ein A-Rennen als Hauptziel gibt deiner Saison Struktur — TriGoals erinnert dich
          rechtzeitig an die Taper-Phase.
        </p>
        <UButton
          label="Ersten Wettkampf anlegen"
          @click="openNew"
        />
      </div>
    </UCard>

    <template v-else>
      <div
        v-if="upcoming.length"
        class="space-y-2"
      >
        <h2 class="text-xs uppercase text-muted font-semibold">
          Kommend
        </h2>
        <UCard
          v-for="r in upcoming"
          :key="r.id"
          :ui="{ body: 'p-4 sm:p-4' }"
        >
          <div class="flex items-center gap-4">
            <div class="text-center shrink-0 w-16">
              <p class="text-2xl font-bold tabular-nums text-primary">
                {{ daysUntil(r.date) }}
              </p>
              <p class="text-xs text-muted">
                Tage
              </p>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-semibold truncate">
                  {{ r.name }}
                </p>
                <UBadge
                  size="sm"
                  :color="priorityColor(r.priority)"
                  :variant="r.priority === 'A' ? 'solid' : 'subtle'"
                  :label="`Prio ${r.priority}`"
                />
                <UBadge
                  v-if="r.distanceLabel"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  :label="r.distanceLabel"
                />
              </div>
              <p class="text-sm text-muted">
                {{ formatLongDate(r.date) }}
              </p>
              <p
                v-if="taperHint(r)"
                class="text-xs text-warning mt-1 flex items-center gap-1"
              >
                <UIcon
                  name="i-lucide-info"
                  class="size-3.5 shrink-0"
                />
                {{ taperHint(r) }}
              </p>
            </div>
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="`${r.name} löschen`"
              @click="remove(r.id)"
            />
          </div>
        </UCard>
      </div>

      <div
        v-if="past.length"
        class="space-y-2"
      >
        <h2 class="text-xs uppercase text-muted font-semibold">
          Vergangen
        </h2>
        <UCard
          v-for="r in past"
          :key="r.id"
          :ui="{ body: 'p-4 sm:p-4' }"
        >
          <div class="flex items-center gap-4">
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate text-muted">
                {{ r.name }}
              </p>
              <p class="text-sm text-dimmed">
                {{ formatLongDate(r.date) }}
              </p>
            </div>
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="`${r.name} löschen`"
              @click="remove(r.id)"
            />
          </div>
        </UCard>
      </div>
    </template>

    <UModal
      v-model:open="open"
      title="Wettkampf anlegen"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Name">
            <UInput
              v-model="state.name"
              placeholder="z. B. Ironman 70.3 Kärnten"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Datum">
            <UInput
              v-model="state.date"
              type="date"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Sportart">
              <USelectMenu
                v-model="state.sport"
                :items="SPORT_OPTIONS"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Distanz"
              hint="optional"
            >
              <UInput
                v-model="state.distanceLabel"
                placeholder="z. B. 70.3"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField label="Priorität">
            <USelectMenu
              v-model="state.priority"
              :items="PRIORITY_OPTIONS"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Notizen"
            hint="optional"
          >
            <UTextarea
              v-model="state.notes"
              :rows="3"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
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
      </template>
    </UModal>
  </UContainer>
</template>
