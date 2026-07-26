<script setup lang="ts">
import type { Zone } from '~~/shared/utils/zones'
import { formatPace } from '~~/shared/utils/zones'

const props = defineProps<{
  title: string
  icon: string
  zones: Zone[]
  /** 'power' | 'hr' → integer + unit; 'pace' → m:ss format */
  kind: 'power' | 'hr' | 'pace'
  unit?: string
}>()

/**
 * Zones are ordered intensity, so they get a single-hue ordinal ramp (light →
 * dark) rather than a rainbow. The zone number and name always accompany the
 * colour, so nothing depends on hue alone.
 */
const clampZone = (zone: number) => Math.min(7, Math.max(1, zone))
const zoneColor = (zone: number) => `var(--viz-zone-${clampZone(zone)})`
const zoneInk = (zone: number) => `var(--viz-zone-${clampZone(zone)}-ink)`

function fmt(v: number | null): string {
  if (v == null) return ''
  if (props.kind === 'pace') return formatPace(v, props.unit ?? '')
  return `${v}${props.unit ? ' ' + props.unit : ''}`
}

function range(z: Zone): string {
  const lo = fmt(z.min)
  const hi = fmt(z.max)
  if (props.kind === 'pace') {
    // pace: min is fastest, max is slowest
    if (z.min == null) return `schneller als ${hi}`
    if (z.max == null) return `langsamer als ${lo}`
    return `${lo} – ${hi}`
  }
  if (z.min == null) return `bis ${hi}`
  if (z.max == null) return `ab ${lo}`
  return `${lo} – ${hi}`
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon
          :name="icon"
          class="size-5 text-primary"
        />
        <h3 class="font-semibold">
          {{ title }}
        </h3>
      </div>
    </template>

    <ul class="space-y-2">
      <li
        v-for="z in zones"
        :key="z.zone"
        class="flex items-center gap-3"
      >
        <span
          class="inline-flex items-center justify-center size-7 rounded-md text-xs font-bold shrink-0"
          :style="{ backgroundColor: zoneColor(z.zone), color: zoneInk(z.zone) }"
        >Z{{ z.zone }}</span>
        <span class="flex-1 text-sm font-medium">{{ z.name }}</span>
        <span class="text-sm text-muted tabular-nums">{{ range(z) }}</span>
      </li>
    </ul>
  </UCard>
</template>
