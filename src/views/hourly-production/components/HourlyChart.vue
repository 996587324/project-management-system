<template>
  <section class="hourly-chart" :class="{ 'fill-chart': fill }">
    <header v-if="!compact">
      <strong>{{ title }}</strong>
      <span v-if="latest" :class="['state', reached(latest) ? 'Achieved' : latest.status]">{{
        latestLabel
      }}</span>
      <span v-else class="state">{{ configured ? '待开始' : '未绑定数据源' }}</span>
    </header>
    <div
      ref="element"
      class="plot"
      :style="fill ? undefined : { height: `${compact ? 64 : height}px` }"
    />
  </section>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import * as echarts from 'echarts'
  import type { HourlyPoint } from '@/api/hourly-production'

  const props = withDefaults(
    defineProps<{
      title: string
      points: HourlyPoint[]
      configured?: boolean
      compact?: boolean
      height?: number
      fill?: boolean
    }>(),
    { configured: true, compact: false, height: 150, fill: false }
  )
  const element = ref<HTMLElement>()
  let chart: echarts.ECharts | undefined
  let observer: ResizeObserver | undefined
  const latest = computed(
    () =>
      props.points.find((p) => p.status === 'Running') ??
      props.points.filter((p) => p.status !== 'Pending' && p.status !== 'Unbound').at(-1)
  )
  const latestLabel = computed(() => {
    const point = latest.value
    if (!point) return ''
    if (point.status === 'Running')
      return reached(point)
        ? '统计中 · 已达目标'
        : point.target == null
          ? '统计中 · 未设置目标'
          : '统计中'
    if (point.status === 'NoTarget') return '未设置目标'
    return point.status === 'Achieved'
      ? `✓ 达标 ${point.achievement}%`
      : `达成 ${point.achievement ?? '—'}%`
  })

  function reached(point: HourlyPoint) {
    return point.target != null && point.output != null && point.output >= point.target
  }

  function render() {
    chart?.setOption(
      {
        animation: false,
        grid: { left: 44, right: 12, top: props.compact ? 8 : 24, bottom: 24 },
        tooltip: {
          trigger: 'axis',
          formatter: (raw: unknown) => {
            const params = raw as { dataIndex: number }[]
            const point = props.points[params[0]?.dataIndex ?? 0]
            if (!point) return ''
            const label = `${point.start.slice(11, 16)}–${point.end.slice(11, 16)}`
            if (point.status === 'Pending') return `${label}<br/>待开始`
            if (point.status === 'Unbound') return `${label}<br/>未绑定数据源`
            return `${label}<br/>产出：${point.output ?? '—'}<br/>返工：${point.rework ?? '—'}<br/>目标：${point.target ?? '未设置'}<br/>达成率：${point.achievement == null ? '—' : `${point.achievement}%`}${point.status === 'Running' ? '<br/>统计中，尚未最终结算' : ''}`
          }
        },
        xAxis: {
          type: 'category',
          data: props.points.map((p) => p.start.slice(11, 16)),
          axisLabel: { color: '#64748b', fontSize: 11, interval: 0, hideOverlap: true },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: '#dbe5ef' } }
        },
        yAxis: {
          type: 'value',
          min: 0,
          minInterval: 1,
          splitNumber: props.compact ? 2 : 4,
          axisLabel: { color: '#64748b', fontSize: 11, hideOverlap: true },
          splitLine: { lineStyle: { color: '#eef2f6' } }
        },
        series: [
          {
            name: '产出',
            type: 'bar',
            barMaxWidth: 18,
            data: props.points.map((p) => ({
              value: p.output,
              itemStyle: {
                color: reached(p) ? '#16a34a' : '#3b82f6',
                borderRadius: [3, 3, 0, 0]
              }
            })),
            label: {
              show: !props.compact,
              position: 'top',
              color: '#1d4ed8',
              fontSize: 12,
              formatter: '{c}'
            }
          },
          {
            name: '返工',
            type: 'bar',
            barMaxWidth: 14,
            data: props.points.map((p) => p.rework),
            itemStyle: { color: '#f59e0b', borderRadius: [3, 3, 0, 0] }
          },
          {
            name: '目标',
            type: 'line',
            data: props.points.map((p) => p.target),
            connectNulls: false,
            symbol: 'circle',
            symbolSize: 3,
            step: 'middle',
            lineStyle: { type: 'dashed', width: 2, color: '#64748b' }
          }
        ]
      },
      true
    )
  }

  function resizeChart() {
    const container = element.value
    if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) return
    if (!chart) {
      chart = echarts.init(container)
      render()
    } else {
      chart.resize()
    }
  }

  onMounted(() => {
    if (!element.value) return
    // Carousel pages and fullscreen transitions can briefly have zero dimensions.
    observer = new ResizeObserver(resizeChart)
    observer.observe(element.value)
    resizeChart()
  })
  watch(() => [props.points, props.compact], render, { deep: true })
  onBeforeUnmount(() => {
    observer?.disconnect()
    chart?.dispose()
  })
</script>

<style scoped>
  .hourly-chart {
    box-sizing: border-box;
    min-width: 0;
    min-height: 0;
    padding: 10px 14px;
    background: #fff;
    border: 1px solid #e0e8f0;
    border-radius: 12px;
  }

  header {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    color: #1e293b;
  }

  strong {
    overflow: hidden;
    font-size: 17px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .state {
    flex-shrink: 0;
    font-size: 12px;
    color: #64748b;
  }

  .Achieved {
    font-weight: 700;
    color: #15803d;
  }

  .Running {
    color: #2563eb;
  }

  .BelowTarget {
    color: #d97706;
  }

  .plot {
    width: 100%;
  }

  .fill-chart {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .fill-chart .plot {
    flex: 1 1 0;
    min-height: 0;
  }
</style>
