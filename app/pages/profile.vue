<script setup lang="ts">
import {
  powerZones,
  hrZones,
  runPaceZones,
  swimPaceZones,
  formatDuration
} from '~~/shared/utils/zones'

definePageMeta({ middleware: 'auth' })

const toast = useToast()
const { data: profile, refresh } = await useFetch('/api/profile')

interface ThresholdState {
  ftp: number | null
  thresholdPaceRun: number | null // sec / km
  css: number | null // sec / 100 m
  lthr: number | null
  maxHr: number | null
  restHr: number | null
  weightKg: number | null
}

const state = reactive<ThresholdState>({
  ftp: null,
  thresholdPaceRun: null,
  css: null,
  lthr: null,
  maxHr: null,
  restHr: null,
  weightKg: null
})

function hydrate() {
  const p = profile.value
  state.ftp = p?.ftp ?? null
  state.thresholdPaceRun = p?.thresholdPaceRun ?? null
  state.css = p?.css ?? null
  state.lthr = p?.lthr ?? null
  state.maxHr = p?.maxHr ?? null
  state.restHr = p?.restHr ?? null
  state.weightKg = p?.weightKg ?? null
}
watch(profile, hydrate, { immediate: true })

/** Unsaved changes — sliders move easily, so make it visible. */
const dirty = computed(() => {
  const p = profile.value
  return (
    state.ftp !== (p?.ftp ?? null)
    || state.thresholdPaceRun !== (p?.thresholdPaceRun ?? null)
    || state.css !== (p?.css ?? null)
    || state.lthr !== (p?.lthr ?? null)
    || state.maxHr !== (p?.maxHr ?? null)
    || state.restHr !== (p?.restHr ?? null)
    || state.weightKg !== (p?.weightKg ?? null)
  )
})

// --- Derived readouts -----------------------------------------------------
const wattsPerKg = computed(() =>
  state.ftp && state.weightKg
    ? `${(state.ftp / state.weightKg).toFixed(2).replace('.', ',')} W/kg`
    : null
)

const runSpeed = computed(() =>
  state.thresholdPaceRun
    ? `${(3600 / state.thresholdPaceRun).toFixed(1).replace('.', ',')} km/h`
    : null
)

/** 1500 m is the reference swim distance most athletes know their time for. */
const swim1500 = computed(() =>
  state.css ? `1500 m in ${formatDuration(state.css * 15)}` : null
)

const lthrShare = computed(() =>
  state.lthr && state.maxHr
    ? `${Math.round((state.lthr / state.maxHr) * 100)} % der max. HF`
    : null
)

const hrReserve = computed(() =>
  state.maxHr && state.restHr ? `HF-Reserve ${state.maxHr - state.restHr} bpm` : null
)

// --- Zones ----------------------------------------------------------------
const powerZ = computed(() => (state.ftp ? powerZones(state.ftp) : []))
const hrZ = computed(() => hrZones({ lthr: state.lthr, maxHr: state.maxHr }))
const runZ = computed(() => (state.thresholdPaceRun ? runPaceZones(state.thresholdPaceRun) : []))
const swimZ = computed(() => (state.css ? swimPaceZones(state.css) : []))

const hasAnyZone = computed(
  () => powerZ.value.length || runZ.value.length || swimZ.value.length || hrZ.value.length
)

// --- Save -----------------------------------------------------------------
const saving = ref(false)

async function save() {
  saving.value = true
  try {
    await $fetch('/api/profile', { method: 'PUT', body: { ...state } })
    await refresh()
    toast.add({ title: 'Profil gespeichert', color: 'success', icon: 'i-lucide-check' })
  } catch (e) {
    toast.add({ title: apiErrorMessage(e, 'Speichern fehlgeschlagen'), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UContainer class="py-8 space-y-8">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">
          Profil & Trainingszonen
        </h1>
        <p class="text-muted">
          Schiebe deine Schwellenwerte zurecht — die Zonen rechnen live mit.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <span
          v-if="dirty"
          class="text-xs text-warning flex items-center gap-1"
        >
          <UIcon
            name="i-lucide-circle-dot"
            class="size-3.5"
          />
          nicht gespeichert
        </span>
        <UButton
          :loading="saving"
          :disabled="!dirty"
          icon="i-lucide-save"
          label="Speichern"
          @click="save"
        />
      </div>
    </div>

    <div class="grid gap-8 lg:grid-cols-2">
      <!-- Inputs -->
      <div class="space-y-6">
        <section class="space-y-3">
          <h2 class="text-xs font-semibold uppercase text-muted tracking-wide">
            Rad
          </h2>
          <ThresholdSlider
            v-model="state.ftp"
            label="FTP"
            help="Leistung, die du etwa eine Stunde halten kannst"
            icon="i-lucide-bike"
            kind="watt"
            unit="W"
            :min="80"
            :max="500"
            :fallback="220"
            :derived="wattsPerKg"
          />
        </section>

        <section class="space-y-3">
          <h2 class="text-xs font-semibold uppercase text-muted tracking-wide">
            Laufen
          </h2>
          <ThresholdSlider
            v-model="state.thresholdPaceRun"
            label="Schwellen-Pace"
            help="Renntempo über etwa eine Stunde"
            icon="i-lucide-footprints"
            kind="pace"
            unit="/km"
            :min="150"
            :max="480"
            :fallback="270"
            :derived="runSpeed"
          />
        </section>

        <section class="space-y-3">
          <h2 class="text-xs font-semibold uppercase text-muted tracking-wide">
            Schwimmen
          </h2>
          <ThresholdSlider
            v-model="state.css"
            label="CSS"
            help="Critical Swim Speed — Dauertempo pro 100 m"
            icon="i-lucide-waves"
            kind="pace"
            unit="/100m"
            :min="60"
            :max="180"
            :fallback="110"
            :derived="swim1500"
          />
        </section>

        <section class="space-y-3">
          <h2 class="text-xs font-semibold uppercase text-muted tracking-wide">
            Herzfrequenz & Körper
          </h2>
          <ThresholdSlider
            v-model="state.lthr"
            label="Schwellen-HF (LTHR)"
            help="Puls an der anaeroben Schwelle"
            icon="i-lucide-heart-pulse"
            kind="bpm"
            unit="bpm"
            :min="120"
            :max="210"
            :fallback="165"
            :derived="lthrShare"
          />
          <ThresholdSlider
            v-model="state.maxHr"
            label="Maximale HF"
            icon="i-lucide-activity"
            kind="bpm"
            unit="bpm"
            :min="140"
            :max="220"
            :fallback="190"
            :derived="hrReserve"
          />
          <ThresholdSlider
            v-model="state.restHr"
            label="Ruhepuls"
            help="Morgens im Liegen gemessen"
            icon="i-lucide-bed"
            kind="bpm"
            unit="bpm"
            :min="30"
            :max="90"
            :fallback="55"
          />
          <ThresholdSlider
            v-model="state.weightKg"
            label="Gewicht"
            icon="i-lucide-scale"
            kind="weight"
            unit="kg"
            :min="40"
            :max="150"
            :step="0.1"
            :fallback="75"
          />
        </section>
      </div>

      <!-- Live zones -->
      <div class="space-y-6">
        <ZoneList
          v-if="powerZ.length"
          title="Leistungszonen (Rad)"
          icon="i-lucide-bike"
          :zones="powerZ"
          kind="power"
          unit="W"
        />
        <ZoneList
          v-if="runZ.length"
          title="Pace-Zonen (Laufen)"
          icon="i-lucide-footprints"
          :zones="runZ"
          kind="pace"
          unit="/km"
        />
        <ZoneList
          v-if="swimZ.length"
          title="Pace-Zonen (Schwimmen)"
          icon="i-lucide-waves"
          :zones="swimZ"
          kind="pace"
          unit="/100m"
        />
        <ZoneList
          v-if="hrZ.length"
          title="Herzfrequenzzonen"
          icon="i-lucide-heart-pulse"
          :zones="hrZ"
          kind="hr"
          unit="bpm"
        />

        <UAlert
          v-if="!hasAnyZone"
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          title="Noch keine Zonen"
          description="Stelle links mindestens einen Schwellenwert ein, um deine Zonen zu sehen."
        />
      </div>
    </div>
  </UContainer>
</template>
