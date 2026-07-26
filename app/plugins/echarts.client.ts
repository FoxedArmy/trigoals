import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  DatasetComponent
} from 'echarts/components'

/**
 * Registers only the ECharts pieces the dashboard actually uses, so the client
 * bundle stays small. Client-only: ECharts needs a DOM to measure.
 */
export default defineNuxtPlugin(() => {
  use([
    CanvasRenderer,
    LineChart,
    BarChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    MarkLineComponent,
    DatasetComponent
  ])
})
