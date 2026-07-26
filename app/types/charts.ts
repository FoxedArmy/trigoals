/**
 * The subset of an ECharts tooltip callback parameter this app actually uses.
 * ECharts types these very loosely, so we narrow to what we read.
 */
export interface TooltipParam {
  axisValue: string
  seriesName: string
  color: string
  value: number
  dataIndex: number
}
