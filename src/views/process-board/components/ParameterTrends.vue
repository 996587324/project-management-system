<template>
  <section
    class="parameter-trends"
    :style="{ width: line.trendWidth ? `${line.trendWidth}px` : undefined }"
  >
    <div class="trend-toolbar">
      <h3>线体参数曲线</h3>
      <el-date-picker v-model="range" type="datetimerange" value-format="YYYY-MM-DD HH:mm:ss" />
      <el-switch v-model="raw" active-text="原始值" inactive-text="展示值" />
      <el-button :loading="loading" @click="load">查询曲线</el-button>
    </div>
    <div class="trend-body">
      <el-tree
        ref="tree"
        :data="nodes"
        node-key="key"
        show-checkbox
        :props="{ label: 'label' }"
        @check="load"
        @node-click="selectNode"
      />
      <div ref="chartElement" class="trend-chart" :style="{ height: `${line.trendHeight}px` }" />
    </div>
    <p class="tip"
      >滚轮、框选和下方时间滑块可缩放。双击曲线或左侧参数查看明细。大范围按时间桶显示均值与极值，不代表逐条原始样本。</p
    >
    <ParameterHistory
      v-model="history"
      :card-id="selected.cardId"
      :field-code="selected.fieldCode"
      :name="selected.name"
    />
  </section>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
  import * as echarts from 'echarts'
  import { useBusinessChartTheme } from '@/hooks/core/useBusinessChartTheme'
  import { ElMessage, type ElTree } from 'element-plus'
  import { processApi, type ProcessDefinition } from '@/api/process-board'
  import ParameterHistory from './ParameterHistory.vue'

  const props = defineProps<{ cards: ProcessDefinition[]; line: ProcessDefinition }>()
  interface ParameterNode {
    key: string
    label: string
    cardId?: number
    fieldCode?: string
    unit?: string
    children?: ParameterNode[]
  }
  const nodes = computed<ParameterNode[]>(() => {
    const devices = new Map<string, ParameterNode>()
    for (const card of [props.line, ...props.cards]) {
      for (const field of card.fields.filter((item) => item.trendEnabled)) {
        const key = JSON.stringify([field.source.tenantMark, field.source.deviceMark])
        if (!devices.has(key)) {
          devices.set(key, {
            key: `device:${key}`,
            label: field.source.deviceMark
              ? `${field.source.deviceMark} · ${field.source.tenantMark}`
              : '计算 / 固定参数',
            children: []
          })
        }
        devices.get(key)!.children!.push({
          key: `${card.id}:${field.code}`,
          label: `${field.name} (${card.name})`,
          cardId: card.id,
          fieldCode: field.code,
          unit: field.unit
        })
      }
    }
    return [...devices.values()]
  })
  const tree = ref<InstanceType<typeof ElTree>>()
  const chartElement = ref<HTMLElement>()
  const loading = ref(false)
  const raw = ref(false)
  const history = ref(false)
  const selected = reactive({ cardId: 0, fieldCode: '', name: '' })
  const range = ref<[string, string]>([
    localTime(new Date(Date.now() - 5 * 3600000)),
    localTime(new Date())
  ])
  let chart: echarts.ECharts | undefined
  const { applyTheme } = useBusinessChartTheme()
  let observer: ResizeObserver | undefined
  let revision = 0
  let clickedKey = ''
  let clickedAt = 0
  let selections: ParameterNode[] = []

  function localTime(date: Date) {
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  function openHistory(node: ParameterNode) {
    if (!node.cardId || !node.fieldCode) return
    Object.assign(selected, { cardId: node.cardId, fieldCode: node.fieldCode, name: node.label })
    history.value = true
  }

  function selectNode(node: ParameterNode) {
    const now = Date.now()
    if (node.key === clickedKey && now - clickedAt < 400) {
      if (node.cardId) openHistory(node)
      else if (node.children?.[0]) openHistory(node.children[0])
    }
    clickedKey = node.key
    clickedAt = now
  }

  async function load() {
    if (!chart || !range.value?.length) return
    const current = ++revision
    selections = ((tree.value?.getCheckedNodes(true) as ParameterNode[]) || []).filter(
      (node) => node.cardId && node.fieldCode
    )
    if (selections.length > 12) {
      ElMessage.warning('单次最多展示 12 条曲线，请减少选择')
      return
    }
    loading.value = true
    try {
      const result = await Promise.all(
        selections.map((node) =>
          processApi.curve({
            cardId: node.cardId,
            fieldCode: node.fieldCode,
            start: range.value[0],
            end: range.value[1],
            points: 600,
            raw: raw.value
          })
        )
      )
      if (current !== revision) return
      const units = [...new Set(selections.map((node) => node.unit || '无单位'))]
      chart.setOption(
        {
          tooltip: { trigger: 'axis' },
          legend: { type: 'scroll' },
          grid: { top: 65, left: 65, right: Math.max(55, units.length * 50), bottom: 80 },
          toolbox: { feature: { dataZoom: { yAxisIndex: 'none' }, restore: {}, saveAsImage: {} } },
          xAxis: { type: 'time' },
          yAxis: units.length
            ? units.map((unit, index) => ({
                type: 'value',
                name: unit,
                position: index === 0 ? 'left' : 'right',
                offset: Math.max(0, index - 1) * 55
              }))
            : [{ type: 'value' }],
          dataZoom: [
            { type: 'inside', filterMode: 'none' },
            { type: 'slider', filterMode: 'none' }
          ],
          series: selections.map((node, index) => ({
            name: node.label,
            type: 'line',
            showSymbol: false,
            connectNulls: false,
            yAxisIndex: units.indexOf(node.unit || '无单位'),
            data: result[index].points.map((point) => [
              point.time,
              point.average,
              point.minimum,
              point.maximum
            ])
          }))
        },
        true
      )
      applyTheme(chart)
    } finally {
      if (current === revision) loading.value = false
    }
  }

  watch(raw, load)
  onMounted(async () => {
    await nextTick()
    chart = echarts.init(chartElement.value!)
    chart.on('dblclick', (event) => {
      if (event.seriesIndex != null && selections[event.seriesIndex])
        openHistory(selections[event.seriesIndex])
    })
    observer = new ResizeObserver(() => chart?.resize())
    observer.observe(chartElement.value!)
    await load()
  })
  onBeforeUnmount(() => {
    revision++
    observer?.disconnect()
    chart?.dispose()
  })
</script>

<style scoped lang="scss">
  .parameter-trends {
    color: var(--el-text-color-primary);
    box-shadow: var(--business-card-shadow);
    padding: 20px;
    border: 1px solid var(--el-border-color-lighter);
    background: var(--el-bg-color);
    border-radius: var(--business-radius);
  }
  .trend-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    h3 {
      margin: 0 auto 0 0;
    }
  }
  .trend-body {
    display: flex;
    margin-top: 20px;
    gap: 16px;
    .el-tree {
      width: 260px;
      flex-shrink: 0;
      max-height: 400px;
      overflow: auto;
    }
  }
  .trend-chart {
    height: 400px;
    min-width: 0;
    flex: 1;
  }
  .tip {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
  @media (max-width: 760px) {
    .trend-body {
      flex-direction: column;
      .el-tree {
        width: 100%;
        max-height: 180px;
      }
    }
    .trend-chart {
      flex: none;
      width: 100%;
    }
  }
</style>
