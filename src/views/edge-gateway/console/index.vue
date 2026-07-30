<template>
  <div class="edge-gateway-page">
    <header class="page-header">
      <div>
        <h2>边缘网关运行中心</h2>
        <span>最后刷新 {{ lastRefreshTime || '-' }}</span>
      </div>
      <el-button :loading="refreshing" @click="refreshCurrent">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </header>

    <EdgeOverviewStats :overview="overview" />

    <el-tabs v-model="activeTab" class="gateway-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="设备管理" name="devices">
        <EdgeDevicePanel ref="devicePanel" @overview-changed="loadOverview" />
      </el-tab-pane>
      <el-tab-pane label="连接配置" name="websockets">
        <EdgeWebSocketPanel ref="webSocketPanel" />
      </el-tab-pane>
      <el-tab-pane label="采集配置" name="configs">
        <EdgeConfigPanel ref="configPanel" @show-json="showJson" @view-data="viewCollectedData" />
      </el-tab-pane>
      <el-tab-pane label="边缘规则" name="rules">
        <EdgeRulePanel ref="rulePanel" @show-json="showJson" />
      </el-tab-pane>
      <el-tab-pane label="消息队列" name="queue">
        <EdgeQueuePanel ref="queuePanel" @overview-changed="loadOverview" @show-json="showJson" />
      </el-tab-pane>
      <el-tab-pane label="日志中心" name="events">
        <EdgeEventPanel ref="eventPanel" @show-json="showJson" />
      </el-tab-pane>
      <el-tab-pane label="B 系统适配" name="mappings">
        <EdgeBMappingPanel ref="mappingPanel" @show-json="showJson" />
      </el-tab-pane>
    </el-tabs>

    <EdgeJsonDialog
      v-model="jsonDialogVisible"
      :title="jsonDialogTitle"
      :content="jsonDialogContent"
    />
  </div>
</template>

<script setup lang="ts">
  import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
  import { Refresh } from '@element-plus/icons-vue'
  import { fetchEdgeOverview, type EdgeOverview } from '@/api/edge-gateway'
  import EdgeBMappingPanel from './components/EdgeBMappingPanel.vue'
  import EdgeConfigPanel from './components/EdgeConfigPanel.vue'
  import EdgeDevicePanel from './components/EdgeDevicePanel.vue'
  import EdgeEventPanel from './components/EdgeEventPanel.vue'
  import EdgeJsonDialog from './components/EdgeJsonDialog.vue'
  import EdgeOverviewStats from './components/EdgeOverviewStats.vue'
  import EdgeQueuePanel from './components/EdgeQueuePanel.vue'
  import EdgeRulePanel from './components/EdgeRulePanel.vue'
  import EdgeWebSocketPanel from './components/EdgeWebSocketPanel.vue'
  import type { JsonDialogPayload, RefreshablePanel } from './components/shared'

  type QueuePanelExpose = RefreshablePanel & {
    showForDevice: (deviceCode: string) => Promise<void>
  }

  const AUTO_REFRESH_INTERVAL_MS = 20_000

  const emptyOverview = (): EdgeOverview => ({
    deviceCount: 0,
    onlineCount: 0,
    offlineCount: 0,
    disabledCount: 0,
    queueDepth: 0,
    failedCount: 0,
    activeAlarmCount: 0,
    successfulForwardCount: 0,
    uploadSuccessRate: 0,
    recentEvents: []
  })

  const activeTab = ref('devices')
  const refreshing = ref(false)
  const lastRefreshTime = ref('')
  const overview = reactive<EdgeOverview>(emptyOverview())

  const devicePanel = ref<RefreshablePanel>()
  const webSocketPanel = ref<RefreshablePanel>()
  const configPanel = ref<RefreshablePanel>()
  const rulePanel = ref<RefreshablePanel>()
  const queuePanel = ref<QueuePanelExpose>()
  const eventPanel = ref<RefreshablePanel>()
  const mappingPanel = ref<RefreshablePanel>()

  const jsonDialogVisible = ref(false)
  const jsonDialogTitle = ref('JSON')
  const jsonDialogContent = ref('')
  let overviewRequest: Promise<void> | null = null
  let autoRefreshTimer: number | undefined

  const loadOverview = (): Promise<void> => {
    if (overviewRequest) return overviewRequest

    overviewRequest = (async () => {
      try {
        Object.assign(overview, await fetchEdgeOverview())
      } finally {
        overviewRequest = null
      }
    })()
    return overviewRequest
  }

  const refreshOverviewAutomatically = async () => {
    try {
      await loadOverview()
      lastRefreshTime.value = new Date().toLocaleString()
    } catch {
      // 请求层会统一提示错误，定时任务保留到下一轮继续尝试。
    }
  }

  const currentPanel = () => {
    const panels: Record<string, RefreshablePanel | undefined> = {
      devices: devicePanel.value,
      websockets: webSocketPanel.value,
      configs: configPanel.value,
      rules: rulePanel.value,
      queue: queuePanel.value,
      events: eventPanel.value,
      mappings: mappingPanel.value
    }
    return panels[activeTab.value]
  }

  const refreshCurrent = async () => {
    refreshing.value = true
    try {
      await Promise.all([loadOverview(), currentPanel()?.refresh()])
      lastRefreshTime.value = new Date().toLocaleString()
    } finally {
      refreshing.value = false
    }
  }

  const handleTabChange = async (name: string | number) => {
    activeTab.value = String(name)
    await nextTick()
    await refreshCurrent()
  }

  const showJson = (payload: JsonDialogPayload) => {
    jsonDialogTitle.value = payload.title
    jsonDialogContent.value = payload.content
    jsonDialogVisible.value = true
  }

  const viewCollectedData = async (deviceCode: string) => {
    activeTab.value = 'queue'
    await nextTick()
    await Promise.all([loadOverview(), queuePanel.value?.showForDevice(deviceCode)])
    lastRefreshTime.value = new Date().toLocaleString()
  }

  onMounted(() => {
    void refreshCurrent().catch(() => undefined)
    autoRefreshTimer = window.setInterval(
      () => void refreshOverviewAutomatically(),
      AUTO_REFRESH_INTERVAL_MS
    )
  })

  onBeforeUnmount(() => {
    if (autoRefreshTimer !== undefined) window.clearInterval(autoRefreshTimer)
  })
</script>

<style lang="scss" src="./console.scss"></style>
