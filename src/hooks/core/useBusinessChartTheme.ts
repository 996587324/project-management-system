import { nextTick, onScopeDispose, watch } from 'vue'
import type { ECharts } from 'echarts'
import { useSettingStore } from '@/store/modules/setting'
import { createBusinessChartTheme, type BusinessChartColors } from '@/utils/ui/business-chart-theme'

// 同时兼容 echarts 完整包和按需 core 包，避免依赖实例类型的私有字段。
type ThemeChart = Pick<ECharts, 'isDisposed' | 'getOption' | 'setOption'>

/** 用于现有直接初始化的图表；公开大屏可以显式禁用，图表销毁仍由调用者负责。 */
export function useBusinessChartTheme(enabled: () => boolean = () => true) {
  const settings = useSettingStore()
  const charts = new Set<ThemeChart>()
  let stopped = false

  function readColors(): BusinessChartColors {
    const styles = getComputedStyle(document.documentElement)
    const css = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
    return {
      text: css('--el-text-color-primary', settings.isDark ? '#e5eaf3' : '#303133'),
      muted: css('--el-text-color-secondary', settings.isDark ? '#a3a6ad' : '#909399'),
      border: css('--el-border-color-lighter', settings.isDark ? '#363637' : '#ebeef5'),
      surface: css('--el-bg-color', settings.isDark ? '#161618' : '#ffffff'),
      primary: css('--el-color-primary', settings.systemThemeColor),
      emphasis: css('--el-color-primary-light-8', settings.isDark ? '#28344d' : '#d9ecff')
    }
  }

  function applyTheme(chart: ThemeChart) {
    for (const existing of charts) {
      if (existing.isDisposed()) {
        charts.delete(existing)
      }
    }
    if (stopped || chart.isDisposed()) return
    charts.add(chart)
    if (!enabled()) return
    chart.setOption(createBusinessChartTheme(chart.getOption(), readColors()), { lazyUpdate: true })
  }

  watch(
    [() => settings.isDark, () => settings.systemThemeColor, enabled],
    async () => {
      await nextTick()
      if (stopped) return
      for (const chart of charts) {
        applyTheme(chart)
      }
    },
    { flush: 'post' }
  )

  onScopeDispose(() => {
    stopped = true
    charts.clear()
  })
  return { applyTheme }
}
