<template>
  <section ref="widgetRef" class="dashboard-widget" :style="widgetGridStyle">
    <header>
      <div
        ><b>{{ widget.title }}</b
        ><small>{{ sourceLabel }} · {{ periodLabel }}</small></div
      >
      <div class="dashboard-widget__actions">
        <button type="button" title="查看明细数据" @click="emit('view-details', widget)">查看详情</button>
        <span :class="{ loading }"><i />{{ loading ? '更新中' : `${widget.refreshSeconds}s` }}</span>
      </div>
    </header>

    <el-table
      v-if="widget.widgetType === 'Table'"
      ref="tableRef"
      v-loading="loading"
      :data="tableRows"
      height="100%"
      stripe
      :class="[
        'dashboard-widget__table',
        { 'dashboard-widget__table--rolling': isScrollableTable }
      ]"
      :row-style="tableRowStyle"
      @mouseenter="tableScrollPaused = true"
      @mouseleave="tableScrollPaused = false"
    >
      <el-table-column
        v-for="field in visibleFields"
        :key="field.fieldKey"
        :label="field.displayName"
        :width="columnWidth(field)"
        :min-width="field.width ? undefined : defaultColumnWidth(field.fieldKey)"
      >
        <template #default="{ row }">{{ formatTableValue(row, field) }}</template>
      </el-table-column>
    </el-table>

    <div v-else ref="chartRef" v-loading="loading" class="dashboard-widget__chart" />
    <el-empty
      v-if="!loading && rows.length === 0"
      class="dashboard-widget__empty"
      description="当前周期暂无数据"
      :image-size="54"
    />
  </section>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import * as echarts from 'echarts'
  import type { TableInstance } from 'element-plus'
  import {
    DashboardWidget,
    DashboardWidgetField,
    fetchDashboardDailyStatistics,
    fetchDashboardFaultRecords,
    fetchDashboardFaultSummary,
    fetchDashboardRuntime
  } from '@/api/edge-dashboard'
  import { parseDashboardWidgetDisplayConfig } from './dashboardWidgetConfig'
  import { normalizeDashboardPercentages } from './dashboardWidgetPercentage'

  const props = withDefaults(
    defineProps<{
      widget: DashboardWidget
      lineCode: string
      defaultColumnSpan: number
      publicAccess?: boolean
    }>(),
    { publicAccess: false }
  )
  const emit = defineEmits<{ 'view-details': [widget: DashboardWidget] }>()

  const widgetRef = ref<HTMLElement | null>(null)
  const chartRef = ref<HTMLElement | null>(null)
  const tableRef = ref<TableInstance>()
  const tableWidth = ref(0)
  const rows = ref<Record<string, unknown>[]>([])
  const loading = ref(false)
  const tableScrollPaused = ref(false)
  let chart: echarts.ECharts | null = null
  let timer = 0
  let tableScrollTimer = 0
  let lastDataSignature: string | null = null
  let hasLoaded = false
  let requestInFlight = false
  let resizeObserver: ResizeObserver | null = null
  let tablePercentageCache = new WeakMap<object, Map<string, number>>()
  const displayConfig = computed(() => parseDashboardWidgetDisplayConfig(props.widget.configJson))
  const widgetGridStyle = computed(() => ({
    gridColumn: `span ${displayConfig.value.columnSpan || props.defaultColumnSpan}`,
    gridRow: `span ${displayConfig.value.rowSpan}`
  }))

  const visibleFields = computed(() =>
    props.widget.fields.filter((field) => field.visible).sort((a, b) => a.sort - b.sort)
  )
  const percentageTableFields = computed(() =>
    visibleFields.value.filter((field) => field.unit === '%')
  )
  const isScrollableTable = computed(
    () => props.widget.widgetType === 'Table' && displayConfig.value.autoScroll
  )
  /** 自动滚动表格展示本周期全部已加载记录，静态表格继续遵循最多显示数量。 */
  const tableRows = computed(() =>
    isScrollableTable.value ? rows.value : rows.value.slice(0, props.widget.topN)
  )
  const sourceLabel = computed(
    () =>
      ({
        RealtimeRobot: '实时机械手',
        DailyStatistics: '每日状态统计',
        FaultRecords: '故障记录',
        FaultSummary: '故障原因汇总'
      })[props.widget.dataSourceType]
  )
  const periodLabel = computed(
    () => ({ Day: '今日', Week: '近 7 日', Month: '近 30 日' })[props.widget.period]
  )

  const dateRange = () => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(end.getDate() - { Day: 0, Week: 6, Month: 29 }[props.widget.period])
    const format = (date: Date) => {
      const year = date.getFullYear()
      const month = `${date.getMonth() + 1}`.padStart(2, '0')
      const day = `${date.getDate()}`.padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    return { dateFrom: format(start), dateTo: format(end) }
  }

  /** 查询部件数据，但不触碰当前响应式数组。 */
  const fetchRows = async (): Promise<Record<string, unknown>[]> => {
    const range = dateRange()
    if (props.widget.dataSourceType === 'RealtimeRobot') {
      const runtime = await fetchDashboardRuntime(props.lineCode, props.publicAccess)
      return runtime.robots.map((robot) => ({
        bindingId: robot.bindingId,
        lineCode: robot.lineCode,
        robotCode: robot.robotCode,
        robotName: robot.robotName,
        deviceMark: robot.deviceMark,
        status: robot.status,
        dataOnline: robot.dataOnline,
        receiveTime: robot.receiveTime,
        ...Object.fromEntries(
          robot.fields.map((field) => [`field:${field.fieldCode}`, field.displayValue])
        )
      }))
    }
    if (props.widget.dataSourceType === 'DailyStatistics') {
      const result = await fetchDashboardDailyStatistics(
        {
          current: 1,
          size: 500,
          lineCode: props.lineCode,
          ...range
        },
        props.publicAccess
      )
      return result.records as unknown as Record<string, unknown>[]
    }
    if (props.widget.dataSourceType === 'FaultRecords') {
      const result = await fetchDashboardFaultRecords(
        {
          current: 1,
          size: isScrollableTable.value ? 500 : Math.min(props.widget.topN, 500),
          lineCode: props.lineCode,
          ...range
        },
        props.publicAccess
      )
      return result.records as unknown as Record<string, unknown>[]
    }
    return (await fetchDashboardFaultSummary(
      {
        lineCode: props.lineCode,
        topN: isScrollableTable.value ? 100 : props.widget.topN,
        ...range
      },
      props.publicAccess
    )) as unknown as Record<string, unknown>[]
  }

  /**
   * 后台轮询只在数据内容变化时替换 rows 和重绘图表，避免无新数据时出现闪烁。
   */
  const load = async () => {
    if (requestInFlight) return
    requestInFlight = true
    const showInitialLoading = !hasLoaded
    if (showInitialLoading) loading.value = true
    try {
      const nextRows = await fetchRows()
      const nextSignature = JSON.stringify(nextRows)
      if (nextSignature === lastDataSignature) return

      lastDataSignature = nextSignature
      tablePercentageCache = new WeakMap<object, Map<string, number>>()
      rows.value = nextRows
      await nextTick()
      if (isScrollableTable.value) tableRef.value?.setScrollTop(0)
      renderChart()
    } catch {
      // 单个部件接口暂时不可用时保留上次结果，避免拖慢或清空整个看板。
    } finally {
      hasLoaded = true
      requestInFlight = false
      if (showInitialLoading) loading.value = false
    }
  }

  const renderChart = () => {
    if (props.widget.widgetType === 'Table' || !chartRef.value) return
    chart ||= echarts.init(chartRef.value)
    const fields = visibleFields.value
    const categoryField = fields.find((field) => field.role === 'Category')
    const valueFields = fields.filter((field) => field.role === 'Value')
    const textColor = '#a9bfd0'
    const axisColor = '#28475a'
    const readableLargeScreen =
      window.devicePixelRatio <= 1.1 && window.innerWidth >= 1440 && window.innerHeight >= 760
    const chartFontSize = readableLargeScreen ? 16 : 12
    const chartLegendIconSize = readableLargeScreen ? 15 : 10

    if (props.widget.widgetType === 'Pie') {
      const percentageDecimals = Math.max(0, ...valueFields.map((field) => field.decimals ?? 1))
      const configuredValues =
        categoryField && valueFields[0]
          ? aggregateByCategory(rows.value, categoryField, valueFields[0]).map((item) => ({
              name: String(item.category),
              value: item.value
            }))
          : valueFields.map((field) => ({
              name: field.displayName,
              value: aggregate(
                rows.value.map((row) => row[field.fieldKey]),
                field.aggregate
              ),
              itemStyle: { color: field.color }
            }))
      const data = normalizeDashboardPercentages(configuredValues, percentageDecimals)
      chart.setOption(
        {
          animationDuration: 450,
          tooltip: {
            trigger: 'item',
            formatter: '{b}: {c}%',
            textStyle: { fontSize: chartFontSize }
          },
          legend: {
            bottom: 2,
            textStyle: { color: textColor, fontSize: chartFontSize },
            itemWidth: chartLegendIconSize,
            itemHeight: chartLegendIconSize
          },
          series: [
            {
              type: 'pie',
              radius: ['42%', '67%'],
              center: ['50%', '43%'],
              label: { color: textColor, fontSize: chartFontSize, formatter: '{b}\n{c}%' },
              data
            }
          ]
        },
        true
      )
      return
    }

    const category = categoryField || fields[0]
    if (!category) return
    const categories = Array.from(
      new Set(rows.value.map((row) => categoryValue(row[category.fieldKey], category.fieldKey)))
    ).slice(0, props.widget.topN)
    const percentageMode = valueFields.some((field) => field.unit === '%')
    const percentageDecimals = Math.max(0, ...valueFields.map((field) => field.decimals ?? 1))
    const categoryRows = categories.map((item) =>
      rows.value.filter((row) => categoryValue(row[category.fieldKey], category.fieldKey) === item)
    )
    const categoryPercentages = percentageMode
      ? categoryRows.map((matchedRows) =>
          normalizeDashboardPercentages(
            valueFields.map((field) => ({
              name: field.fieldKey,
              value: aggregate(
                matchedRows.map((row) => row[field.fieldKey]),
                field.aggregate
              )
            })),
            percentageDecimals
          )
        )
      : []
    const series = valueFields.map((field, fieldIndex) => ({
      name: field.displayName,
      type: 'bar',
      stack: props.widget.stacked ? 'total' : undefined,
      barMaxWidth: 28,
      itemStyle: { color: field.color, borderRadius: [2, 2, 0, 0] },
      data: categoryRows.map((matchedRows, categoryIndex) =>
        percentageMode
          ? categoryPercentages[categoryIndex][fieldIndex].value
          : aggregateField(
              matchedRows.map((row) => row[field.fieldKey]),
              field
            )
      )
    }))
    const horizontal = props.widget.orientation === 'Horizontal'
    const categoryAxis = {
      type: 'category' as const,
      data: categories,
      axisLabel: { color: textColor, fontSize: chartFontSize },
      axisLine: { lineStyle: { color: axisColor } }
    }
    const valueAxis = {
      type: 'value' as const,
      min: percentageMode ? 0 : undefined,
      max: percentageMode ? 100 : undefined,
      axisLabel: {
        color: textColor,
        fontSize: chartFontSize,
        formatter: percentageMode ? '{value}%' : undefined
      },
      splitLine: { lineStyle: { color: '#18384b' } }
    }
    chart.setOption(
      {
        animationDuration: 450,
        color: valueFields.map(
          (field, index) => field.color || ['#20e5a3', '#38bdf8', '#ff4d67'][index % 3]
        ),
        tooltip: { trigger: 'axis', textStyle: { fontSize: chartFontSize } },
        legend: { top: 0, textStyle: { color: textColor, fontSize: chartFontSize } },
        grid: readableLargeScreen
          ? { left: 64, right: 26, top: 48, bottom: 44 }
          : { left: 54, right: 22, top: 42, bottom: 38 },
        xAxis: horizontal ? valueAxis : categoryAxis,
        yAxis: horizontal ? categoryAxis : valueAxis,
        series
      },
      true
    )
  }

  const aggregateByCategory = (
    data: Record<string, unknown>[],
    category: DashboardWidgetField,
    field: DashboardWidgetField
  ) =>
    Array.from(new Set(data.map((row) => categoryValue(row[category.fieldKey], category.fieldKey))))
      .slice(0, props.widget.topN)
      .map((item) => ({
        category: item,
        value: aggregateField(
          data
            .filter((row) => categoryValue(row[category.fieldKey], category.fieldKey) === item)
            .map((row) => row[field.fieldKey]),
          field
        )
      }))

  const aggregate = (values: unknown[], method: string) => {
    if (method === 'Count') return values.length
    const numbers = values.map(Number).filter(Number.isFinite)
    if (!numbers.length) return 0
    if (method === 'Average') return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
    if (method === 'Max') return Math.max(...numbers)
    if (method === 'Min') return Math.min(...numbers)
    return numbers.reduce((sum, value) => sum + value, 0)
  }

  const aggregateField = (values: unknown[], field: DashboardWidgetField) => {
    const result = aggregate(values, field.aggregate)
    if (field.unit === 'm') return Number((result / 60).toFixed(field.decimals ?? 1))
    if (field.unit === 'h') return Number((result / 3600).toFixed(field.decimals ?? 1))
    return result
  }

  const categoryValue = (value: unknown, fieldKey: string) => {
    if (/date/i.test(fieldKey) && value) return String(value).slice(0, 10)
    return String(value ?? '-')
  }

  const formatValue = (value: unknown, field: DashboardWidgetField) => {
    if (value == null || value === '') return '-'
    if (field.unit === 'h' && Number.isFinite(Number(value)))
      return `${(Number(value) / 3600).toFixed(field.decimals ?? 1)} h`
    if (field.unit === 'm' && Number.isFinite(Number(value)))
      return `${(Number(value) / 60).toFixed(field.decimals ?? 1)} m`
    if (field.unit === 's' && Number.isFinite(Number(value)))
      return `${Number(value).toLocaleString()} s`
    if (field.unit === '%' && Number.isFinite(Number(value)))
      return `${Number(value).toFixed(field.decimals ?? 1)}%`
    if (/time|date/i.test(field.fieldKey)) {
      const date = new Date(String(value))
      if (!Number.isNaN(date.getTime())) return date.toLocaleString('zh-CN', { hour12: false })
    }
    if (typeof value === 'boolean') return value ? '是' : '否'
    if (Number.isFinite(Number(value)) && field.decimals != null)
      return Number(value).toFixed(field.decimals)
    return `${value}${field.unit && !['h', 'm', 's', '%'].includes(field.unit) ? ` ${field.unit}` : ''}`
  }

  /** 表格百分比字段以当前行已配置字段的合计作为 100%。 */
  const formatTableValue = (row: unknown, field: DashboardWidgetField) => {
    const record = row as Record<string, unknown>
    if (field.unit !== '%') return formatValue(record[field.fieldKey], field)

    let percentageMap = tablePercentageCache.get(record)
    if (!percentageMap) {
      const decimals = Math.max(0, ...percentageTableFields.value.map((item) => item.decimals ?? 1))
      const percentages = normalizeDashboardPercentages(
        percentageTableFields.value.map((item) => ({
          name: item.fieldKey,
          value: Number(record[item.fieldKey]) || 0
        })),
        decimals
      )
      percentageMap = new Map(percentages.map((item) => [item.name, item.value]))
      tablePercentageCache.set(record, percentageMap)
    }

    return `${(percentageMap.get(field.fieldKey) ?? 0).toFixed(field.decimals ?? 1)}%`
  }

  const defaultColumnWidth = (fieldKey: string) => (/time|date|reason/i.test(fieldKey) ? 170 : 110)
  const columnWidth = (field: DashboardWidgetField) => {
    if (!field.width || tableWidth.value <= 0) return undefined
    return Math.max(60, Math.floor((tableWidth.value * field.width) / 100))
  }
  const tableRowStyle = () => ({ height: `${displayConfig.value.tableRowHeight}px` })

  const startTimer = () => {
    window.clearInterval(timer)
    timer = window.setInterval(load, Math.max(3, props.widget.refreshSeconds) * 1000)
  }

  /** 表格数据超过可视高度时逐行滚动，停在末尾一轮后回到最新记录。 */
  const advanceTableScroll = () => {
    if (!isScrollableTable.value || tableScrollPaused.value || tableRows.value.length < 2) return
    const tableElement = tableRef.value?.$el as HTMLElement | undefined
    const scrollElement = tableElement?.querySelector<HTMLElement>(
      '.el-table__body-wrapper .el-scrollbar__wrap'
    )
    if (!scrollElement) return
    const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight
    if (maxScrollTop <= 1) return
    const firstRow = tableElement?.querySelector<HTMLElement>('.el-table__body tbody tr')
    const rowHeight = Math.max(firstRow?.getBoundingClientRect().height || 40, 32)
    const reachedEnd = scrollElement.scrollTop >= maxScrollTop - 1
    tableRef.value?.setScrollTop(
      reachedEnd ? 0 : Math.min(maxScrollTop, scrollElement.scrollTop + rowHeight)
    )
  }

  const startTableScroll = () => {
    window.clearInterval(tableScrollTimer)
    tableScrollTimer = window.setInterval(
      advanceTableScroll,
      displayConfig.value.scrollIntervalSeconds * 1000
    )
  }

  onMounted(() => {
    load()
    startTimer()
    startTableScroll()
    if (widgetRef.value) {
      resizeObserver = new ResizeObserver(() => {
        tableWidth.value = tableRef.value?.$el?.clientWidth || widgetRef.value?.clientWidth || 0
        tableRef.value?.doLayout()
        chart?.resize()
      })
      resizeObserver.observe(widgetRef.value)
    }
  })

  watch(
    () => [props.widget, props.lineCode],
    () => {
      lastDataSignature = null
      hasLoaded = false
      tablePercentageCache = new WeakMap<object, Map<string, number>>()
      rows.value = []
      tableRef.value?.setScrollTop(0)
      startTimer()
      startTableScroll()
      load()
    },
    { deep: true }
  )

  onBeforeUnmount(() => {
    window.clearInterval(timer)
    window.clearInterval(tableScrollTimer)
    resizeObserver?.disconnect()
    chart?.dispose()
  })
</script>

<style scoped lang="scss">
  .dashboard-widget {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: #0d2635;
    border: 1px solid #21455a;
    border-radius: 4px;
  }

  .dashboard-widget > header {
    display: flex;
    flex: 0 0 42px;
    align-items: center;
    justify-content: space-between;
    min-height: 42px;
    padding: 5px 10px;
    color: #e7f5ff;
    border-bottom: 1px solid #1d4256;
  }

  .dashboard-widget > header div {
    display: flex;
    flex-direction: column;
  }

  .dashboard-widget > header small {
    margin-top: 2px;
    color: #7899aa;
  }

  .dashboard-widget__actions,
  .dashboard-widget > header > span {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    color: #7899aa;
  }

  .dashboard-widget > header > span i {
    width: 7px;
    height: 7px;
    background: #20e5a3;
    border-radius: 50%;
  }

  .dashboard-widget > header > span.loading i {
    background: #f6b852;
  }

  .dashboard-widget__actions > button {
    padding: 2px 4px;
    color: #65d6f4;
    font-size: 12px;
    line-height: 18px;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 3px;
  }

  .dashboard-widget__actions > button:hover {
    background: rgb(70 199 235 / 14%);
  }

  .dashboard-widget__chart {
    flex: 1;
    width: 100%;
    min-height: 0;
  }

  .dashboard-widget__table {
    flex: 1;
    min-height: 0;

    --el-table-bg-color: #0d2635;
    --el-table-tr-bg-color: #0d2635;
    --el-table-header-bg-color: #123247;
    --el-table-row-hover-bg-color: #153a4c;
    --el-table-current-row-bg-color: #153a4c;
    --el-table-border-color: #21455a;
    --el-table-text-color: #c3d7e2;
    --el-table-header-text-color: #86aabd;
    --el-fill-color-light: #153a4c;
    --el-fill-color-lighter: #102d3d;
  }

  :deep(.dashboard-widget__table--rolling .el-table__body-wrapper .el-scrollbar__wrap) {
    scroll-behavior: smooth;
  }

  :deep(.dashboard-widget__table .el-table__body tr.current-row > td.el-table__cell) {
    background: #153a4c;
  }

  .dashboard-widget__empty {
    position: absolute;
    inset: 43px 0 0;
    background: #0d2635;
  }

  @media (resolution <= 1.1dppx) and (width >= 1440px) and (height >= 760px) {
    .dashboard-widget > header {
      flex-basis: 50px;
      min-height: 50px;
      padding: 6px 13px;
    }

    .dashboard-widget > header b {
      font-size: 18px;
    }

    .dashboard-widget > header small {
      font-size: 15px;
    }

    .dashboard-widget > header > span {
      gap: 8px;
      font-size: 16px;
    }

    .dashboard-widget > header > span i {
      width: 9px;
      height: 9px;
    }

    :deep(.dashboard-widget__table) {
      font-size: 16px;
    }

    :deep(.dashboard-widget__table .cell) {
      padding: 0 12px;
      line-height: 24px;
    }

    .dashboard-widget__empty {
      inset: 51px 0 0;
      font-size: 16px;
    }
  }

  @media (width <= 767px) {
    .dashboard-widget {
      height: 320px;
      min-height: 320px;
    }
  }
</style>
