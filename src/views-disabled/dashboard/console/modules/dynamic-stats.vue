<template>
  <div class="art-card h-128 p-5 mb-5 max-sm:mb-4">
    <div class="art-card-header">
      <div class="title">
        <h4>动态</h4>
        <p>新增<span class="text-success">{{ countText }}</span></p>
      </div>
    </div>

    <div class="h-9/10 mt-2 overflow-hidden">
      <ElScrollbar>
        <div
          class="h-17.5 leading-17.5 border-b border-g-300 text-sm overflow-hidden last:border-b-0"
          v-for="(item, index) in list"
          :key="index"
        >
          <span class="text-g-800 font-medium">{{ item.username }}</span>
          <span class="mx-2 text-g-600">{{ item.type }}</span>
          <span class="text-theme">{{ item.target }}</span>
        </div>
      </ElScrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { fetchDashboardDynamicStats } from '@/api/dashboard'

  interface DynamicItem {
    username: string
    type: string
    target: string
  }

  const props = withDefaults(
    defineProps<{
      refreshInterval?: number
    }>(),
    {
      refreshInterval: 30000
    }
  )

  const list = ref<DynamicItem[]>([])
  const countText = ref('0')
  const loading = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const readList = (response: Api.Dashboard.DynamicStatsResponse): Api.Dashboard.DynamicStatsItem[] => {
    if (Array.isArray(response)) return response
    return response.records || response.list || response.data || response.items || []
  }

  const normalizeItem = (item: Api.Dashboard.DynamicStatsItem): DynamicItem => ({
    username: item.username || item.userName || '--',
    type: item.type || item.action || '--',
    target: item.target || item.content || '0'
  })

  const resetData = () => {
    countText.value = '0'
    list.value = []
  }

  const getData = async () => {
    if (loading.value) return
    try {
      loading.value = true
      const response = await fetchDashboardDynamicStats()
      const sourceList = readList(response)

      countText.value = Array.isArray(response) ? String(sourceList.length || 0) : String(response.count ?? sourceList.length ?? 0)
      list.value = sourceList.map(normalizeItem)
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
