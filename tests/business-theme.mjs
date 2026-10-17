import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { transformWithEsbuild } from 'vite'
import { parse } from 'vue/compiler-sfc'
import * as sass from 'sass'

const testRequire = createRequire(import.meta.url)
const echarts = testRequire('echarts')
const { effectScope, reactive, ref, nextTick } = testRequire('vue')

async function loadTypeScript(file, overrides = {}) {
  const source = await readFile(file, 'utf8')
  const compiled = await transformWithEsbuild(source, file, { loader: 'ts', format: 'cjs' })
  const module = { exports: {} }
  const requireModule = (name) => overrides[name] ?? testRequire(name)
  new Function('require', 'module', 'exports', compiled.code)(requireModule, module, module.exports)
  return module.exports
}

const helper = await loadTypeScript('src/utils/ui/business-chart-theme.ts')
const light = {
  text: '#303133',
  muted: '#909399',
  border: '#ebeef5',
  surface: '#ffffff',
  primary: '#409eff',
  emphasis: '#d9ecff'
}
const dark = {
  text: '#e5eaf3',
  muted: '#a3a6ad',
  border: '#363637',
  surface: '#161618',
  primary: '#a76aff',
  emphasis: '#342343'
}

for (const type of ['line', 'bar', 'pie']) {
  const chart = echarts.init(null, undefined, {
    renderer: 'svg',
    ssr: true,
    width: 640,
    height: 360
  })
  try {
    chart.setOption({
      tooltip: {},
      legend: { selected: { 手工颜色: false } },
      ...(type === 'pie'
        ? {}
        : {
            xAxis: { type: 'category', data: ['a', 'b', 'c'] },
            yAxis: { type: 'value' },
            dataZoom: [
              { type: 'inside', start: 15, end: 75 },
              { type: 'slider', start: 15, end: 75 }
            ]
          }),
      series: [
        {
          id: 'manual',
          name: '手工颜色',
          type,
          itemStyle: { color: '#ab1234' },
          data: type === 'pie' ? [{ name: '分组', value: 5 }] : [3, 5, 8]
        }
      ]
    })
    const original = chart.getOption()
    for (const colors of [light, dark, light]) {
      chart.setOption(helper.createBusinessChartTheme(chart.getOption(), colors))
      const result = chart.getOption()
      assert.equal(result.textStyle.color, colors.text)
      assert.equal(result.tooltip[0].backgroundColor, colors.surface)
      assert.equal(result.series[0].id, 'manual')
      assert.equal(result.series[0].itemStyle.color, '#ab1234')
      assert.deepEqual(result.series[0].data, original.series[0].data)
      assert.deepEqual(result.legend[0].selected, original.legend[0].selected)
      if (type !== 'pie') {
        assert.equal(result.xAxis[0].axisLabel.color, colors.muted)
        assert.deepEqual(result.xAxis[0].data, original.xAxis[0].data)
        assert.equal(result.dataZoom[0].start, 15)
        assert.equal(result.dataZoom[0].end, 75)
        assert.equal(result.dataZoom[1].start, 15)
        assert.equal(result.dataZoom[1].end, 75)
      } else {
        assert.equal(result.series[0].label.color, colors.text)
      }
    }
  } finally {
    chart.dispose()
  }
}

// 用真实 Vue 响应式验证主题监听和公开页禁用，不发送接口请求。
const settings = reactive({ isDark: false, systemThemeColor: light.primary })
const colors = { current: light }
const originalDocument = globalThis.document
const originalGetComputedStyle = globalThis.getComputedStyle
const cssNames = {
  '--el-text-color-primary': 'text',
  '--el-text-color-secondary': 'muted',
  '--el-border-color-lighter': 'border',
  '--el-bg-color': 'surface',
  '--el-color-primary': 'primary',
  '--el-color-primary-light-8': 'emphasis'
}
globalThis.document = { documentElement: {} }
globalThis.getComputedStyle = () => ({ getPropertyValue: (name) => colors.current[cssNames[name]] })
const scope = effectScope()
try {
  const { useBusinessChartTheme } = await loadTypeScript(
    'src/hooks/core/useBusinessChartTheme.ts',
    {
      '@/store/modules/setting': { useSettingStore: () => settings },
      '@/utils/ui/business-chart-theme': helper
    }
  )
  const enabled = ref(false)
  let calls = 0
  let lastPatch
  let disposed = false
  const chart = {
    isDisposed: () => disposed,
    getOption: () => ({ legend: [{}] }),
    setOption: (patch) => {
      calls++
      lastPatch = patch
    }
  }
  const theme = scope.run(() => useBusinessChartTheme(() => enabled.value))
  theme.applyTheme(chart)
  settings.isDark = true
  colors.current = dark
  await nextTick()
  await nextTick()
  assert.equal(calls, 0, '公开大屏不应用系统图表颜色')
  enabled.value = true
  await nextTick()
  await nextTick()
  assert.equal(calls, 1)
  assert.equal(lastPatch.textStyle.color, dark.text)
  settings.systemThemeColor = '#00aa66'
  colors.current = { ...dark, primary: '#00aa66' }
  await nextTick()
  await nextTick()
  assert.equal(calls, 2)
  assert.equal(lastPatch.legend[0].pageIconColor, '#00aa66')
  disposed = true
  settings.isDark = false
  await nextTick()
  await nextTick()
  assert.equal(calls, 2, '销毁的图表不能继续更新')
  scope.stop()
  theme.applyTheme(chart)
  assert.equal(calls, 2)
} finally {
  scope.stop()
  globalThis.document = originalDocument
  globalThis.getComputedStyle = originalGetComputedStyle
}

const businessCss = sass.compile('src/assets/styles/core/business-theme.scss').css
assert.doesNotMatch(businessCss, /\.production-dashboard/, '生产监控看板不再注入系统主题配色')
assert.match(businessCss, /\.layout-editor/)
assert.match(businessCss, /\.line-config-mask/)
const productionWidget = await readFile(
  'src/views/production-dashboard/components/DashboardWidgetRenderer.vue',
  'utf8'
)
assert.doesNotMatch(
  productionWidget,
  /useBusinessChartTheme|applyTheme\(/,
  '生产监控图表不再随系统主题改变，保持独立深色页面上的文字对比度'
)
assert.match(businessCss, /--business-radius: var\(--custom-radius/)
assert.match(businessCss, /data-box-mode=shadow-mode/)

for (const file of [
  'src/views/production-dashboard/device-card-board/index.vue',
  'src/views/production-dashboard/device-card-config/index.vue',
  'src/views/process-board/board/index.vue',
  'src/views/process-board/config/index.vue',
  'src/views/process-board/components/ProcessFlow.vue',
  'src/views/process-board/components/ParameterTrends.vue',
  'src/views/production-dashboard/board/index.vue',
  'src/views/production-dashboard/board/components/DashboardHeaderRegion.vue',
  'src/views/production-dashboard/board/components/DashboardMainRegion.vue',
  'src/views/production-dashboard/board/components/DashboardLineOverviewRegion.vue',
  'src/views/production-dashboard/board/components/DashboardAnalyticsRegion.vue',
  'src/views/production-dashboard/components/DashboardWidgetRenderer.vue',
  'src/views/production-dashboard/layout-editor/index.vue',
  'src/views/production-dashboard/components/ProductionLineConfigDialog.vue'
]) {
  const { descriptor, errors } = parse(await readFile(file, 'utf8'), { filename: file })
  assert.equal(errors.length, 0, file)
  for (const style of descriptor.styles) sass.compileString(style.content)
}
console.log(
  'PASS: chart light/dark/primary colors, zoom/legend/data preservation, public opt-out, CSS compilation'
)
