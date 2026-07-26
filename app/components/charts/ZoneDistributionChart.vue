<script setup lang="ts">
import VChart from 'vue-echarts'
import type { TooltipParam } from '~/types/charts'
import { formatDuration } from '~~/shared/utils/zones'

const props = defineProps<{ zoneSeconds: Record<string, number> }>()

const viz = useVizTheme()

const ZONE_NAMES = [
  'Regeneration',
  'Grundlage',
  'Tempo',
  'Schwelle',
  'VO2max',
  'Anaerob',
  'Neuromuskulär'
]

const rows = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const zone = i + 1
    return {
      zone,
      name: ZONE_NAMES[i]!,
      seconds: props.zoneSeconds[String(zone)] ?? 0,
      color: viz.value.zones[i]!
    }
  })
)

const total = computed(() => rows.value.reduce((s, r) => s + r.seconds, 0))

const option = computed(() => {
  const t = viz.value
  return {
    backgroundColor: 'transparent',
    animationDuration: 400,
    grid: { top: 8, right: 48, bottom: 8, left: 96, containLabel: false },
    tooltip: {
      trigger: 'item',
      backgroundColor: t.surface,
      borderColor: t.grid,
      borderWidth: 1,
      textStyle: { color: t.ink, fontSize: 12 },
      formatter: (p: TooltipParam) => {
        const r = rows.value[p.dataIndex]!
        const share = total.value ? Math.round((r.seconds / total.value) * 100) : 0
        return `<div style="font-weight:600">Zone ${r.zone} · ${r.name}</div>
                <div style="font-variant-numeric:tabular-nums">${formatDuration(
                  r.seconds
                )} · ${share}%</div>`
      }
    },
    xAxis: {
      type: 'value',
      show: false
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.value.map(r => `Z${r.zone} ${r.name}`),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: t.ink, fontSize: 11 }
    },
    series: [
      {
        type: 'bar',
        data: rows.value.map(r => ({
          value: Math.round((r.seconds / 3600) * 100) / 100,
          itemStyle: { color: r.color, borderRadius: [0, 4, 4, 0] }
        })),
        barMaxWidth: 16,
        // Direct labels — required relief for the low-contrast steps.
        label: {
          show: true,
          position: 'right',
          color: t.ink,
          fontSize: 11,
          formatter: (p: TooltipParam) => (p.value > 0 ? formatDuration(p.value * 3600) : '')
        }
      }
    ]
  }
})
</script>

<template>
  <div>
    <p class="text-xs text-dimmed mb-2">
      Geschätzt aus der Durchschnittsintensität je Einheit.
    </p>

    <!-- Inline height: vue-echarts' `.echarts` class would override a utility. -->
    <ClientOnly>
      <VChart
        v-if="total > 0"
        :option="option"
        style="height: 14rem; width: 100%"
        autoresize
      />
      <div
        v-else
        class="flex items-center justify-center text-sm text-muted"
        style="height: 14rem"
      >
        Noch keine Aktivitäten im Zeitraum.
      </div>
      <template #fallback>
        <div
          class="w-full rounded-md bg-elevated/30 animate-pulse"
          style="height: 14rem"
        />
      </template>
    </ClientOnly>
  </div>
</template>
