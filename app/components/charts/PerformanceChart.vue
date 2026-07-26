<script setup lang="ts">
import VChart from 'vue-echarts'
import type { LoadPoint } from '~~/shared/utils/load'
import type { TooltipParam } from '~/types/charts'
import { formatDayMonth } from '~~/shared/utils/date'

const props = defineProps<{ series: LoadPoint[] }>()

const viz = useVizTheme()

/**
 * Everything here shares one unit (load points), so a single y-axis is correct:
 * daily load sits behind as recessive bars, the three trend lines read on top.
 */
const option = computed(() => {
  const t = viz.value
  const dates = props.series.map(p => p.date)

  return {
    backgroundColor: 'transparent',
    animationDuration: 400,
    grid: { top: 8, right: 12, bottom: 24, left: 40, containLabel: false },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: t.axis, width: 1 } },
      backgroundColor: t.surface,
      borderColor: t.grid,
      borderWidth: 1,
      textStyle: { color: t.ink, fontSize: 12 },
      formatter: (params: TooltipParam[]) => {
        if (!params?.length) return ''
        const date = params[0]!.axisValue
        const rows = params
          .map(
            p =>
              `<div style="display:flex;gap:8px;align-items:center;margin-top:2px">
                 <span style="width:8px;height:8px;border-radius:2px;background:${p.color}"></span>
                 <span style="flex:1">${p.seriesName}</span>
                 <strong style="font-variant-numeric:tabular-nums">${Math.round(p.value)}</strong>
               </div>`
          )
          .join('')
        return `<div style="font-weight:600;margin-bottom:2px">${formatDayMonth(date)}</div>${rows}`
      }
    },
    legend: {
      show: false // rendered as HTML below so it stays keyboard/screen-reader friendly
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
      axisLabel: {
        color: t.inkMuted,
        fontSize: 11,
        interval: Math.max(0, Math.floor(dates.length / 6) - 1),
        formatter: (v: string) => formatDayMonth(v)
      }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: t.grid, width: 1 } },
      axisLabel: { color: t.inkMuted, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [
      {
        name: 'Tageslast',
        type: 'bar',
        data: props.series.map(p => p.load),
        itemStyle: { color: t.loadBar, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 10,
        z: 1,
        silent: false
      },
      {
        name: 'Fitness',
        type: 'line',
        data: props.series.map(p => p.fitness),
        smooth: 0.2,
        showSymbol: false,
        symbolSize: 8,
        lineStyle: { color: t.fitness, width: 2 },
        itemStyle: { color: t.fitness, borderColor: t.surface, borderWidth: 2 },
        z: 4
      },
      {
        name: 'Ermüdung',
        type: 'line',
        data: props.series.map(p => p.fatigue),
        smooth: 0.2,
        showSymbol: false,
        symbolSize: 8,
        lineStyle: { color: t.fatigue, width: 2 },
        itemStyle: { color: t.fatigue, borderColor: t.surface, borderWidth: 2 },
        z: 3
      },
      {
        name: 'Form',
        type: 'line',
        data: props.series.map(p => p.form),
        smooth: 0.2,
        showSymbol: false,
        symbolSize: 8,
        lineStyle: { color: t.form, width: 2 },
        itemStyle: { color: t.form, borderColor: t.surface, borderWidth: 2 },
        z: 2,
        markLine: {
          silent: true,
          symbol: 'none',
          data: [{ yAxis: 0 }],
          lineStyle: { color: t.axis, width: 1, type: 'dashed' },
          label: { show: false }
        }
      }
    ]
  }
})

/**
 * The legend uses the CSS variables directly rather than resolved hex, so the
 * server and client render identical markup (each mode has different steps, and
 * only the browser knows which mode is active). ECharts draws to canvas and
 * can't read CSS vars, so it keeps the resolved values from `viz`.
 */
const legend = [
  { label: 'Fitness', color: 'var(--viz-fitness)', hint: 'langfristige Belastbarkeit' },
  { label: 'Ermüdung', color: 'var(--viz-fatigue)', hint: 'kurzfristige Müdigkeit' },
  { label: 'Form', color: 'var(--viz-form)', hint: 'Fitness − Ermüdung' },
  { label: 'Tageslast', color: 'var(--viz-load-bar)', hint: 'Belastung pro Tag' }
]
</script>

<template>
  <div>
    <!-- Legend as HTML: reachable by screen readers, and it satisfies the
         "identity never by colour alone" rule via the text label. -->
    <ul class="flex flex-wrap gap-x-4 gap-y-1 mb-3">
      <li
        v-for="l in legend"
        :key="l.label"
        class="flex items-center gap-1.5 text-xs"
      >
        <span
          class="size-2 rounded-sm shrink-0"
          :style="{ backgroundColor: l.color }"
          aria-hidden="true"
        />
        <span class="text-toned font-medium">{{ l.label }}</span>
        <span class="text-dimmed hidden sm:inline">· {{ l.hint }}</span>
      </li>
    </ul>

    <!-- Height must be inline: vue-echarts' own `.echarts` class sets
         height:100%, which would otherwise beat a Tailwind height utility. -->
    <ClientOnly>
      <VChart
        :option="option"
        style="height: 18rem; width: 100%"
        autoresize
      />
      <template #fallback>
        <div
          class="w-full rounded-md bg-elevated/30 animate-pulse"
          style="height: 18rem"
        />
      </template>
    </ClientOnly>
  </div>
</template>
