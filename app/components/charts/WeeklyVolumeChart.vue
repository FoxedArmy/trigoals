<script setup lang="ts">
import VChart from 'vue-echarts'
import type { Sport } from '~~/server/database/schema'
import type { TooltipParam } from '~/types/charts'
import { SPORTS, SPORT_ORDER, sportColor } from '~~/shared/constants/sports'
import { formatDayMonth, isoWeekNumber } from '~~/shared/utils/date'
import { formatDuration } from '~~/shared/utils/zones'

const props = defineProps<{
  weeks: { week: string, bySport: Record<string, number>, load: number }[]
}>()

const viz = useVizTheme()

/** Only chart sports the athlete actually did, keeping the fixed slot order. */
const activeSports = computed<Sport[]>(() =>
  SPORT_ORDER.filter(s => props.weeks.some(w => (w.bySport[s] ?? 0) > 0))
)

const option = computed(() => {
  const t = viz.value
  const sports = activeSports.value

  return {
    backgroundColor: 'transparent',
    animationDuration: 400,
    grid: { top: 8, right: 12, bottom: 24, left: 40, containLabel: false },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: t.surface,
      borderColor: t.grid,
      borderWidth: 1,
      textStyle: { color: t.ink, fontSize: 12 },
      formatter: (params: TooltipParam[]) => {
        if (!params?.length) return ''
        const week = params[0]!.axisValue
        const total = params.reduce((s, p) => s + (p.value || 0), 0)
        const rows = params
          .filter(p => p.value > 0)
          .map(
            p =>
              `<div style="display:flex;gap:8px;align-items:center;margin-top:2px">
                 <span style="width:8px;height:8px;border-radius:2px;background:${p.color}"></span>
                 <span style="flex:1">${p.seriesName}</span>
                 <strong style="font-variant-numeric:tabular-nums">${formatDuration(
                    p.value * 3600
                  )}</strong>
               </div>`
          )
          .join('')
        return `<div style="font-weight:600;margin-bottom:2px">KW ${isoWeekNumber(week)} · ab ${formatDayMonth(
          week
        )}</div>${rows}<div style="display:flex;gap:8px;margin-top:4px;padding-top:4px;border-top:1px solid ${
          t.grid
        }"><span style="flex:1">Gesamt</span><strong style="font-variant-numeric:tabular-nums">${formatDuration(
          total * 3600
        )}</strong></div>`
      }
    },
    xAxis: {
      type: 'category',
      data: props.weeks.map(w => w.week),
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
      axisLabel: {
        color: t.inkMuted,
        fontSize: 11,
        formatter: (v: string) => `KW ${isoWeekNumber(v)}`
      }
    },
    yAxis: {
      type: 'value',
      name: 'Stunden',
      nameTextStyle: { color: t.inkMuted, fontSize: 11, align: 'left' },
      splitLine: { lineStyle: { color: t.grid, width: 1 } },
      axisLabel: { color: t.inkMuted, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: sports.map((sport, i) => ({
      name: SPORTS[sport].label,
      type: 'bar',
      stack: 'volume',
      data: props.weeks.map(w => Math.round(((w.bySport[sport] ?? 0) / 3600) * 100) / 100),
      itemStyle: {
        color: t.sport[sport],
        // 2px surface gap between stacked segments; round only the top segment.
        borderColor: t.surface,
        borderWidth: 2,
        borderRadius: i === sports.length - 1 ? [4, 4, 0, 0] : 0
      },
      barMaxWidth: 28
    }))
  }
})
</script>

<template>
  <div>
    <ul class="flex flex-wrap gap-x-4 gap-y-1 mb-3">
      <li
        v-for="s in activeSports"
        :key="s"
        class="flex items-center gap-1.5 text-xs"
      >
        <!-- CSS var, not resolved hex: keeps SSR and client markup identical. -->
        <span
          class="size-2 rounded-sm shrink-0"
          :style="{ backgroundColor: sportColor(s) }"
          aria-hidden="true"
        />
        <span class="text-toned font-medium">{{ SPORTS[s].label }}</span>
      </li>
    </ul>

    <!-- Inline height: vue-echarts' `.echarts` class would override a utility. -->
    <ClientOnly>
      <VChart
        :option="option"
        style="height: 16rem; width: 100%"
        autoresize
      />
      <template #fallback>
        <div
          class="w-full rounded-md bg-elevated/30 animate-pulse"
          style="height: 16rem"
        />
      </template>
    </ClientOnly>
  </div>
</template>
