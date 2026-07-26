<script setup lang="ts">
import { formatPace } from '~~/shared/utils/zones'

/**
 * Single threshold value on a slider, at the precision the value deserves:
 * one second for paces, one watt for power, one beat for heart rate.
 *
 * Dragging is for the ballpark, the ± buttons and arrow keys for the exact
 * number — so an athlete never has to type `4:15` into a text field.
 */
const props = withDefaults(
  defineProps<{
    label: string
    /** Decides how the value is rendered. */
    kind: 'pace' | 'watt' | 'bpm' | 'weight'
    min: number
    max: number
    step?: number
    /** Where the slider sits before a value has been set. */
    fallback: number
    /** Appended to plain numbers, or used as the pace denominator (`/km`). */
    unit?: string
    help?: string
    /** Extra readout under the value, e.g. `3,4 W/kg`. */
    derived?: string | null
    icon?: string
  }>(),
  { step: 1, unit: '', help: undefined, derived: null, icon: undefined }
)

const model = defineModel<number | null>({ required: true })

const isSet = computed(() => model.value != null)

/** The slider always needs a number; unset values park on the fallback. */
const sliderValue = computed({
  get: () => model.value ?? props.fallback,
  set: (v: number) => {
    model.value = clamp(v)
  }
})

/** Decimals implied by the step, so 0.1 steps don't drift into 75.30000000000001. */
const decimals = computed(() => {
  const s = String(props.step)
  return s.includes('.') ? s.split('.')[1]!.length : 0
})

function clamp(v: number): number {
  const snapped = Math.round(v / props.step) * props.step
  const bounded = Math.min(props.max, Math.max(props.min, snapped))
  return Number(bounded.toFixed(decimals.value))
}

function format(v: number): string {
  if (props.kind === 'pace') return formatPace(v, props.unit)
  if (props.kind === 'weight') return `${v.toFixed(1).replace('.', ',')} ${props.unit}`
  return `${v} ${props.unit}`
}

const display = computed(() => (isSet.value ? format(model.value!) : '–'))

/**
 * Nuxt UI hardcodes the thumb's `aria-label` to "Thumb", and `aria-valuenow`
 * would read a pace as its raw seconds ("255"). Neither is reachable through
 * props, so we label the thumb ourselves and keep a spoken value in sync.
 */
const rootEl = ref<HTMLElement | null>(null)

function describeThumb() {
  const thumb = rootEl.value?.querySelector('[data-slot="thumb"]')
  if (!thumb) return
  thumb.setAttribute('aria-label', props.label)
  thumb.setAttribute(
    'aria-valuetext',
    isSet.value ? format(sliderValue.value) : `nicht gesetzt, ${format(sliderValue.value)}`
  )
}

onMounted(describeThumb)
watch([display, () => props.label], () => nextTick(describeThumb))

function nudge(delta: number) {
  // From the unset state, the first press commits the value already on screen
  // rather than nudging one step off it.
  model.value = isSet.value ? clamp(model.value! + delta * props.step) : clamp(props.fallback)
}

function clear() {
  model.value = null
}

/**
 * Pace runs "fastest" at the low end, which is the opposite of the usual
 * more-to-the-right reading, so the ends are spelled out.
 */
const endLabels = computed(() => {
  if (props.kind === 'pace') {
    return {
      left: `${format(props.min)} · schneller`,
      right: `${format(props.max)} · langsamer`
    }
  }
  return { left: format(props.min), right: format(props.max) }
})
</script>

<template>
  <div
    ref="rootEl"
    class="rounded-lg border p-4 transition-colors"
    :class="isSet ? 'border-default bg-elevated/20' : 'border-dashed border-accented'"
  >
    <!-- Header: label + live value -->
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <UIcon
            v-if="icon"
            :name="icon"
            class="size-4 text-primary shrink-0"
          />
          <span class="text-sm font-semibold">{{ label }}</span>
        </div>
        <p
          v-if="help"
          class="text-xs text-muted mt-0.5"
        >
          {{ help }}
        </p>
      </div>

      <div class="text-right shrink-0">
        <p
          class="text-2xl font-bold tabular-nums leading-tight"
          :class="isSet ? 'text-highlighted' : 'text-dimmed'"
        >
          {{ display }}
        </p>
        <p
          v-if="isSet && derived"
          class="text-xs text-muted tabular-nums"
        >
          {{ derived }}
        </p>
      </div>
    </div>

    <!-- Slider + fine adjustment -->
    <div class="flex items-center gap-2">
      <UButton
        icon="i-lucide-minus"
        size="xs"
        color="neutral"
        variant="subtle"
        :aria-label="`${label} verringern`"
        :disabled="isSet && sliderValue <= min"
        @click="nudge(-1)"
      />

      <USlider
        v-model="sliderValue"
        :min="min"
        :max="max"
        :step="step"
        class="flex-1"
        :ui="{ thumb: isSet ? '' : 'opacity-60' }"
      />

      <UButton
        icon="i-lucide-plus"
        size="xs"
        color="neutral"
        variant="subtle"
        :aria-label="`${label} erhöhen`"
        :disabled="isSet && sliderValue >= max"
        @click="nudge(1)"
      />
    </div>

    <!-- Scale ends + state -->
    <div class="flex items-center justify-between gap-2 mt-2">
      <span class="text-[11px] text-dimmed tabular-nums">{{ endLabels.left }}</span>

      <span
        v-if="!isSet"
        class="text-[11px] text-dimmed"
      >
        ziehen zum Festlegen
      </span>
      <UButton
        v-else
        icon="i-lucide-x"
        size="xs"
        color="neutral"
        variant="ghost"
        label="zurücksetzen"
        :aria-label="`${label} zurücksetzen`"
        :ui="{ label: 'text-[11px] text-dimmed' }"
        @click="clear"
      />

      <span class="text-[11px] text-dimmed tabular-nums">{{ endLabels.right }}</span>
    </div>
  </div>
</template>
