import type { EChartsOption } from 'echarts'

export interface BusinessChartColors {
  text: string
  muted: string
  border: string
  surface: string
  primary: string
  emphasis: string
}

function entries(value: unknown): Record<string, unknown>[] {
  if (value == null) return []
  return (Array.isArray(value) ? value : [value]).filter(
    (item): item is Record<string, unknown> => !!item && typeof item === 'object'
  )
}

/** 只构建颜色补丁，不包含 data、selected、缩放范围或用户配置的系列颜色。 */
export function createBusinessChartTheme(
  options: Record<string, unknown>,
  colors: BusinessChartColors
): EChartsOption {
  const patch: Record<string, unknown> = {
    backgroundColor: 'transparent',
    textStyle: { color: colors.text }
  }
  if (options.tooltip) {
    patch.tooltip = entries(options.tooltip).map(() => ({
      backgroundColor: colors.surface,
      borderColor: colors.border,
      textStyle: { color: colors.text },
      axisPointer: { label: { backgroundColor: colors.surface, color: colors.text } }
    }))
  }
  if (options.legend) {
    patch.legend = entries(options.legend).map(() => ({
      textStyle: { color: colors.text },
      inactiveColor: colors.muted,
      pageTextStyle: { color: colors.text },
      pageIconColor: colors.primary,
      pageIconInactiveColor: colors.muted
    }))
  }
  for (const key of ['xAxis', 'yAxis']) {
    if (options[key]) {
      patch[key] = entries(options[key]).map(() => ({
        nameTextStyle: { color: colors.muted },
        axisLabel: { color: colors.muted },
        axisLine: { lineStyle: { color: colors.border } },
        axisTick: { lineStyle: { color: colors.border } },
        splitLine: { lineStyle: { color: colors.border } },
        axisPointer: { label: { backgroundColor: colors.surface, color: colors.text } }
      }))
    }
  }
  if (options.toolbox) {
    patch.toolbox = entries(options.toolbox).map(() => ({
      iconStyle: { borderColor: colors.muted },
      emphasis: { iconStyle: { borderColor: colors.primary } }
    }))
  }
  if (options.dataZoom) {
    patch.dataZoom = entries(options.dataZoom).map((zoom) =>
      zoom.type === 'slider'
        ? {
            textStyle: { color: colors.muted },
            borderColor: colors.border,
            backgroundColor: colors.surface,
            fillerColor: colors.emphasis,
            handleStyle: { color: colors.primary, borderColor: colors.primary },
            dataBackground: {
              lineStyle: { color: colors.muted },
              areaStyle: { color: colors.emphasis }
            }
          }
        : {}
    )
  }
  if (options.series) {
    patch.series = entries(options.series).map((series) =>
      series.type === 'pie'
        ? {
            label: { color: colors.text },
            labelLine: { lineStyle: { color: colors.muted } }
          }
        : {}
    )
  }
  return patch as EChartsOption
}
