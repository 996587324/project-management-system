<template>
  <div class="dashboard-card-list">
    <div v-for="(item, index) in dataList" :key="item.id || index" class="dashboard-card-item">
      <div class="art-card relative flex flex-col justify-center h-35 px-5">
        <span class="text-g-700 text-sm whitespace-nowrap">{{ item.des }}</span>
        <ArtCountTo class="text-[26px] font-medium mt-2" :target="item.num" :duration="1300" />
        <div class="flex-c mt-1">
          <span class="text-xs text-g-600 whitespace-nowrap">较{{ item.uint }}</span>
          <span
            class="ml-1 text-xs font-semibold whitespace-nowrap"
            :class="[item.change.indexOf('+') === -1 ? 'text-danger' : 'text-success']"
          >
            {{ item.change }}
          </span>
        </div>
        <div
          class="absolute top-0 bottom-0 right-5 m-auto size-12.5 rounded-xl flex-cc bg-theme/10"
        >
          <ArtSvgIcon :icon="item.icon" class="text-xl text-theme" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { fetchDashboardCardList } from '@/api/dashboard'

  interface CardDataItem {
    id?: number | string
    des: string
    icon: string
    uint: string
    startVal: number
    duration: number
    num: number
    change: string
  }

  const props = withDefaults(
    defineProps<{
      refreshInterval?: number
    }>(),
    {
      refreshInterval: 30000
    }
  )

  const cardConfigs = [
    {
      id: 'day',
      des: '销售额天',
      icon: 'ri:sun-line',
      uint: '昨天',
      periodType: 'day'
    },
    {
      id: 'month',
      des: '销售额月',
      icon: 'ri:calendar-2-line',
      uint: '上个月',
      periodType: 'month'
    },
    {
      id: 'quarter',
      des: '销售额季度',
      icon: 'ri:bar-chart-grouped-line',
      uint: '上个季度',
      periodType: 'quarter'
    },
    {
      id: 'year',
      des: '销售额年',
      icon: 'ri:line-chart-line',
      uint: '去年',
      periodType: 'year'
    }
  ] as const
  const defaultDataList: CardDataItem[] = cardConfigs.map((item) => ({
    ...item,
    startVal: 0,
    duration: 1000,
    num: 0,
    change: '0%'
  }))
  const dataList = ref<CardDataItem[]>([...defaultDataList])
  const loading = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const toNumber = (value: unknown) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    const parsed = Number(String(value ?? '').replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getCurrentQuarter = (date: Date) => Math.floor(date.getMonth() / 3) + 1

  const getSalesQueryParams = (
    periodType: (typeof cardConfigs)[number]['periodType']
  ): Api.Dashboard.CardStatsParams => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    switch (periodType) {
      case 'day':
        return { type: periodType, Date: formatDate(now), date: formatDate(now) }
      case 'month':
        return { type: periodType, Year: year, Month: month }
      case 'quarter':
        return { type: periodType, Year: year, Quarter: getCurrentQuarter(now) }
      case 'year':
      default:
        return { type: periodType, Year: year }
    }
  }

  const formatChange = (value: unknown) => {
    if (value === undefined || value === null || value === '') return '+0%'
    const text = String(value)
    if (text.includes('%')) return text
    const numeric = Number(text)
    if (!Number.isFinite(numeric)) return text
    return `${numeric > 0 ? '+' : ''}${numeric}%`
  }

  const normalizeCardItem = (
    item: Api.Dashboard.SalesStatsResponse,
    index: number
  ): CardDataItem => {
    const config = cardConfigs[index % cardConfigs.length]
    return {
      id: config.id,
      des: config.des,
      icon: config.icon,
      uint: config.uint,
      startVal: 0,
      duration: 1000,
      num: toNumber(item.salesAmount),
      change: formatChange(item.growthRate)
    }
  }

  const getCardStats = async (index: number) => {
    const config = cardConfigs[index]
    const response = await fetchDashboardCardList(getSalesQueryParams(config.periodType))
    return normalizeCardItem(response, index)
  }

  const getCardList = async () => {
    if (loading.value) return

    try {
      loading.value = true
      dataList.value = await Promise.all(cardConfigs.map((_, index) => getCardStats(index)))
    } catch (error) {
      dataList.value = [...defaultDataList]
      void error
    } finally {
      loading.value = false
    }
  }

  const startPolling = () => {
    stopPolling()
    if (props.refreshInterval > 0) {
      timer = setInterval(getCardList, props.refreshInterval)
    }
  }

  const stopPolling = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(() => {
    getCardList()
    startPolling()
  })

  onUnmounted(stopPolling)
</script>

<style lang="scss" scoped>
  .dashboard-card-list {
    display: flex;
    flex-wrap: nowrap;
    gap: 20px;
    width: 100%;
    margin-bottom: 20px;
    overflow-x: auto;
  }

  .dashboard-card-item {
    flex: 1 0 0;
    min-width: 0;
  }
</style>
