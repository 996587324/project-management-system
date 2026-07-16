<template>
  <div class="art-card h-128 p-5 mb-5 max-sm:mb-4">
    <div class="art-card-header">
      <div class="title">
        <h4>代办事项</h4>
        <p>待处理<span class="text-danger">{{ pendingText }}</span></p>
      </div>
    </div>

    <div class="h-[calc(100%-40px)] overflow-auto">
      <ElScrollbar>
        <div
          class="flex-cb h-17.5 border-b border-g-300 text-sm last:border-b-0"
          v-for="(item, index) in list"
          :key="index"
        >
          <div>
            <p class="text-sm">{{ item.username }}</p>
            <p class="text-g-500 mt-1">{{ item.date }}</p>
          </div>
          <ElCheckbox v-model="item.complate" />
        </div>
      </ElScrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { fetchDashboardTodoList } from '@/api/dashboard'

  interface TodoItem {
    username: string
    date: string
    complate: boolean
  }

  const props = withDefaults(
    defineProps<{
      refreshInterval?: number
    }>(),
    {
      refreshInterval: 30000
    }
  )

  const list = ref<TodoItem[]>([])
  const pendingText = ref('0')
  const loading = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const readList = (response: Api.Dashboard.TodoListResponse): Api.Dashboard.TodoListItem[] => {
    if (Array.isArray(response)) return response
    return response.records || response.list || response.data || response.items || []
  }

  const normalizeItem = (item: Api.Dashboard.TodoListItem): TodoItem => ({
    username: item.username || item.title || item.name || '--',
    date: item.date || item.time || '--',
    complate: item.complate ?? item.complete ?? item.completed ?? item.done ?? false
  })

  const resetData = () => {
    pendingText.value = '0'
    list.value = []
  }

  const getData = async () => {
    if (loading.value) return
    try {
      loading.value = true
      const response = await fetchDashboardTodoList()
      const sourceList = readList(response)

      list.value = sourceList.map(normalizeItem)
      pendingText.value = Array.isArray(response)
        ? String(list.value.filter((item) => !item.complate).length)
        : String(response.pending ?? response.count ?? list.value.filter((item) => !item.complate).length)
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
