<script setup lang="ts">
import type { Sport } from '~~/server/database/schema'
import { SPORT_OPTIONS, SPORTS } from '~~/shared/constants/sports'

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { required: true })

const toast = useToast()

function nowLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const state = reactive({
  sport: 'run' as Sport,
  name: '',
  startTime: nowLocal(),
  durationMin: 60 as number | null,
  distance: null as number | null,
  avgPower: null as number | null,
  avgHr: null as number | null,
  maxHr: null as number | null,
  elevationM: null as number | null
})

const distanceUnit = computed(() => SPORTS[state.sport].distanceUnit)

watch(open, (v) => {
  if (!v) return
  state.sport = 'run'
  state.name = ''
  state.startTime = nowLocal()
  state.durationMin = 60
  state.distance = null
  state.avgPower = null
  state.avgHr = null
  state.maxHr = null
  state.elevationM = null
})

const saving = ref(false)

async function save() {
  if (!state.durationMin || state.durationMin <= 0) {
    toast.add({ title: 'Bitte eine Dauer eingeben', color: 'error' })
    return
  }
  saving.value = true
  try {
    await $fetch('/api/activities', {
      method: 'POST',
      body: {
        sport: state.sport,
        name: state.name.trim() || null,
        startTime: state.startTime,
        durationSec: state.durationMin * 60,
        distanceM: state.distance
          ? distanceUnit.value === 'm'
            ? state.distance
            : state.distance * 1000
          : null,
        avgPower: state.avgPower || null,
        avgHr: state.avgHr || null,
        maxHr: state.maxHr || null,
        elevationM: state.elevationM || null
      }
    })
    toast.add({ title: 'Aktivität gespeichert', color: 'success', icon: 'i-lucide-check' })
    open.value = false
    emit('saved')
  } catch {
    toast.add({ title: 'Speichern fehlgeschlagen', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Aktivität erfassen"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Sportart">
          <USelectMenu
            v-model="state.sport"
            :items="SPORT_OPTIONS"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Bezeichnung"
          hint="optional"
        >
          <UInput
            v-model="state.name"
            placeholder="z. B. Morgenlauf"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Start">
          <UInput
            v-model="state.startTime"
            type="datetime-local"
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
              :step="distanceUnit === 'm' ? 50 : 0.1"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormField
            v-if="state.sport === 'bike'"
            label="Ø Leistung (W)"
          >
            <UInput
              v-model.number="state.avgPower"
              type="number"
              min="0"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Ø Herzfrequenz (bpm)">
            <UInput
              v-model.number="state.avgHr"
              type="number"
              min="0"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Max. HF (bpm)">
            <UInput
              v-model.number="state.maxHr"
              type="number"
              min="0"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Höhenmeter">
            <UInput
              v-model.number="state.elevationM"
              type="number"
              min="0"
              class="w-full"
            />
          </UFormField>
        </div>

        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          title="Trainingslast wird automatisch berechnet"
          description="Aus Leistung, Pace oder Herzfrequenz — abhängig davon, was du einträgst und welche Schwellenwerte im Profil hinterlegt sind."
        />
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
</template>
