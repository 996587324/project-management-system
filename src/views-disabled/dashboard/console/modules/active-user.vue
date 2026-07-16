<template>
  <div class="art-card h-105 p-4 box-border mb-5 max-sm:mb-4">
    <ArtBarChart
      class="box-border p-2"
      barWidth="50%"
      height="13.7rem"
      :showAxisLine="false"
      :data="chartData"
      :xAxisData="xAxisLabels"
    />
    <div class="ml-1">
      <h3 class="mt-5 text-lg font-medium">{{ title }}</h3>
      <!-- <p class="mt-1 text-sm">比上周 <span class="text-success font-medium">+23%</span></p>
      <p class="mt-1 text-sm">我们为您创建了多个选项，可将它们组合在一起并定制为像素完美的页面</p> -->
    </div>
    <div class="flex-b mt-2">
      <div class="flex-1" v-for="(item, index) in list" :key="index">
        <p class="text-2xl text-g-900">{{ item.num }}</p>
        <p class="text-xs text-g-500">{{ item.name }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { fetchDashboardActiveUser } from '@/api/dashboard'

  interface UserStatItem {
    name: string
    num: string
  }

  const props = withDefaults(
    defineProps<{
      refreshInterval?: number
    }>(),
    {
      refreshInterval: 30000
    }
  )

  const defaultLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const defaultStats: UserStatItem[] = [
    { name: '一周总量', num: '0' },
    { name: '周同比', num: '0%' }
  ]
  const title = ref('一周营业额')
  const xAxisLabels = ref<string[]>([...defaultLabels])
  const chartData = ref<number[]>(defaultLabels.map(() => 0))
  const list = ref<UserStatItem[]>([...defaultStats])
  const loading = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const toNumber = (value: unknown) => {
    const parsed = Number(String(value ?? '').replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  const resetData = () => {
    title.value = '一周营业额'
    xAxisLabels.value = [...defaultLabels]
    chartData.value = defaultLabels.map(() => 0)
    list.value = [...defaultStats]
  }

  const getData = async () => {
    if (loading.value) return
    try {
      loading.value = true
      const response = await fetchDashboardActiveUser()
      const labels = response.xAxisData || response.xAxisLabels || response.labels || []
      const values = response.chartData || response.data || response.values || []
      const stats = response.list || response.stats || []

      title.value = response.title || '一周营业额'
      xAxisLabels.value = labels.length ? labels : [...defaultLabels]
      chartData.value = (values.length ? values : defaultLabels.map(() => 0)).map(toNumber)
      list.value = stats.length
        ? stats.map((item) => ({
            name: item.name || item.title || item.label || '--',
            num: String(item.num ?? item.value ?? 0)
          }))
        : [...defaultStats]
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
