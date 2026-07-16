<template>
  <div class="art-card h-105 p-5 mb-5 max-sm:mb-4">
    <div class="art-card-header">
      <div class="title">
        <h4>{{ title }}</h4>
        <p>今年增长<span class="text-success">{{ growthText }}</span></p>
      </div>
    </div>
    <ArtLineChart
      height="calc(100% - 56px)"
      :data="data"
      :xAxisData="xAxisData"
      :showAreaColor="true"
      :showAxisLine="false"
    />
  </div>
</template>

<script setup lang="ts">
  import { fetchDashboardSalesOverview } from '@/api/dashboard'

  const props = withDefaults(
    defineProps<{
      refreshInterval?: number
    }>(),
    {
      refreshInterval: 30000
    }
  )

  const defaultXAxisData = [
    '1月',
    '2月',
    '3月',
    '4月',
    '5月',
    '6月',
    '7月',
    '8月',
    '9月',
    '10月',
    '11月',
    '12月'
  ]
  const title = ref('年销售量(月)')
  const growthText = ref('0%')
  const data = ref<number[]>(defaultXAxisData.map(() => 0))
  const xAxisData = ref<string[]>([...defaultXAxisData])
  const loading = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const toNumber = (value: unknown) => {
    const parsed = Number(String(value ?? '').replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  const formatGrowth = (value: unknown) => {
    if (value === undefined || value === null || value === '') return '0%'
    const text = String(value)
    if (text.includes('%')) return text
    const numeric = Number(text)
    if (!Number.isFinite(numeric)) return text
    return `${numeric > 0 ? '+' : ''}${numeric}%`
  }

  const resetData = () => {
    title.value = '年销售量(月)'
    growthText.value = '0%'
    data.value = defaultXAxisData.map(() => 0)
    xAxisData.value = [...defaultXAxisData]
  }

  const getData = async () => {
    if (loading.value) return
    try {
      loading.value = true
      const response = await fetchDashboardSalesOverview()
      const labels = response.xAxisData || response.xAxisLabels || response.labels || []
      const values = response.data || response.chartData || response.values || []

      title.value = response.title || '年销售量(月)'
      growthText.value = response.growthText || formatGrowth(response.growth ?? response.change)
      xAxisData.value = labels.length ? labels : [...defaultXAxisData]
      data.value = (values.length ? values : defaultXAxisData.map(() => 0)).map(toNumber)
    } catch (error) {
      resetData()
      void error
    } finally {
      loading.value = false
    }
  }

  const stopPolling = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const startPolling = () => {
    stopPolling()
    if (props.refreshInterval > 0) {
      timer = setInterval(getData, props.refreshInterval)
    }
  }

  onMounted(() => {
    getData()
    startPolling()
  })

  onUnmounted(stopPolling)
</script>
