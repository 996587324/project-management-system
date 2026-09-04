<template>
  <div class="edge-gateway-page">
    <header class="page-header">
      <div>
        <h2>边缘网关运行中心</h2>
        <span>最后刷新 {{ lastRefreshTime || '-' }}</span>
      </div>
      <div class="page-header-actions">
        <EdgeFeatureSettingControl @state-change="handleFeatureStateChange" />
        <template v-if="featureReady && featureEnabled">
          <el-button
            :icon="Download"
            :loading="exporting === 'template'"
            @click="downloadConfiguration(false)"
          >
            下载模板
          </el-button>
          <el-button
            :icon="DocumentCopy"
            :loading="exporting === 'configuration'"
            @click="downloadConfiguration(true)"
          >
            导出当前配置
          </el-button>
          <el-button type="primary" :icon="Upload" :loading="importing" @click="selectImportFile">
            导入配置
          </el-button>
          <el-button :icon="Refresh" :loading="refreshing" @click="refreshCurrent">
            刷新
          </el-button>
        </template>
        <input
          ref="importInputRef"
          class="hidden-import-input"
          type="file"
          accept=".xls,.xlsx"
          @change="handleImportFileChange"
        />
      </div>
    </header>

    <el-skeleton v-if="!featureReady" class="feature-page-skeleton" :rows="6" animated />
    <el-alert
      v-else-if="!featureEnabled"
      class="feature-disabled-notice"
      title="边缘计算中心当前已关闭"
      description="采集连接、实时数据接收及自动转发已暂停，已有配置和历史数据不会被删除。"
      type="info"
      :closable="false"
      show-icon
    />
    <template v-else>
      <EdgeOverviewStats :overview="overview" :loading="overviewLoading" />

      <el-tabs v-model="activeTab" class="gateway-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="设备管理" name="devices" lazy>
          <EdgeDevicePanel ref="devicePanel" @overview-changed="loadOverview" />
        </el-tab-pane>
        <el-tab-pane label="连接配置" name="websockets" lazy>
          <EdgeWebSocketPanel ref="webSocketPanel" @overview-changed="loadOverview" />
        </el-tab-pane>
        <el-tab-pane label="实时接收" name="realtime" lazy>
          <EdgeRealtimePanel
            ref="realtimePanel"
            :active="activeTab === 'realtime'"
            @show-json="showJson"
          />
        </el-tab-pane>
        <el-tab-pane label="采集配置" name="configs" lazy>
          <EdgeConfigPanel ref="configPanel" @show-json="showJson" @view-data="viewCollectedData" />
        </el-tab-pane>
        <el-tab-pane label="边缘规则" name="rules" lazy>
          <EdgeRulePanel ref="rulePanel" @show-json="showJson" />
        </el-tab-pane>
        <el-tab-pane label="消息队列" name="queue" lazy>
          <EdgeQueuePanel ref="queuePanel" @overview-changed="loadOverview" @show-json="showJson" />
        </el-tab-pane>
        <el-tab-pane label="WebSocket 发送记录" name="websocket-sends" lazy>
          <EdgeWebSocketSendRecordPanel ref="webSocketSendRecordPanel" @show-json="showJson" />
        </el-tab-pane>
        <el-tab-pane label="WebSocket 接收记录" name="websocket-receives" lazy>
          <EdgeWebSocketReceiveRecordPanel ref="webSocketReceiveRecordPanel" @show-json="showJson" />
        </el-tab-pane>
        <el-tab-pane label="日志中心" name="events" lazy>
          <EdgeEventPanel ref="eventPanel" @show-json="showJson" />
        </el-tab-pane>
        <el-tab-pane label="B 系统适配" name="mappings" lazy>
          <EdgeBMappingPanel ref="mappingPanel" @show-json="showJson" />
        </el-tab-pane>
      </el-tabs>
    </template>

    <EdgeJsonDialog
      v-model="jsonDialogVisible"
      :title="jsonDialogTitle"
      :content="jsonDialogContent"
    />

    <el-dialog
      v-model="importResultVisible"
      title="配置导入结果"
      width="760px"
      append-to-body
      class="edge-gateway-dialog"
    >
      <el-alert
        class="import-result-alert"
        :title="importResult?.message || '导入完成'"
        :type="importResult?.failedCount ? 'warning' : 'success'"
        :closable="false"
        show-icon
      />

      <el-descriptions class="import-result-summary" :column="3" border>
        <el-descriptions-item label="识别条数">{{ importResult?.total || 0 }}</el-descriptions-item>
        <el-descriptions-item label="成功条数">
          <el-text type="success">{{ importResult?.successCount || 0 }}</el-text>
        </el-descriptions-item>
        <el-descriptions-item label="失败条数">
          <el-text :type="importResult?.failedCount ? 'danger' : 'info'">
            {{ importResult?.failedCount || 0 }}
          </el-text>
        </el-descriptions-item>
      </el-descriptions>

      <el-table
        v-if="importResult?.failures.length"
        :data="importResult.failures"
        height="320"
        stripe
      >
        <el-table-column prop="sheetName" label="配置页" width="120" />
        <el-table-column prop="rowIndex" label="行号" width="80" align="center" />
        <el-table-column prop="key" label="业务键" min-width="180" show-overflow-tooltip />
        <el-table-column prop="reason" label="失败原因" min-width="280" show-overflow-tooltip />
      </el-table>

      <template #footer>
        <el-button type="primary" @click="importResultVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { DocumentCopy, Download, Refresh, Upload } from '@element-plus/icons-vue'
  import {
    fetchEdgeOverview,
    getEdgeGatewayConfigurationTemplateUrl,
    importEdgeGatewayConfiguration,
    type EdgeGatewayImportResult,
    type EdgeOverview
  } from '@/api/edge-gateway'
  import { useUserStore } from '@/store/modules/user'
  import EdgeBMappingPanel from './components/EdgeBMappingPanel.vue'
  import EdgeConfigPanel from './components/EdgeConfigPanel.vue'
  import EdgeDevicePanel from './components/EdgeDevicePanel.vue'
  import EdgeEventPanel from './components/EdgeEventPanel.vue'
  import EdgeFeatureSettingControl from './components/EdgeFeatureSettingControl.vue'
  import EdgeJsonDialog from './components/EdgeJsonDialog.vue'
  import EdgeOverviewStats from './components/EdgeOverviewStats.vue'
  import EdgeQueuePanel from './components/EdgeQueuePanel.vue'
  import EdgeRealtimePanel from './components/EdgeRealtimePanel.vue'
  import EdgeRulePanel from './components/EdgeRulePanel.vue'
  import EdgeWebSocketPanel from './components/EdgeWebSocketPanel.vue'
  import EdgeWebSocketSendRecordPanel from './components/EdgeWebSocketSendRecordPanel.vue'
  import EdgeWebSocketReceiveRecordPanel from './components/EdgeWebSocketReceiveRecordPanel.vue'
  import type { JsonDialogPayload, RefreshablePanel } from './components/shared'
  import { downloadResponseStream } from '@/utils/file/stream-download'

  type QueuePanelExpose = RefreshablePanel & {
    showForDevice: (deviceCode: string) => Promise<void>
  }

  const AUTO_REFRESH_INTERVAL_MS = 20_000

  const emptyOverview = (): EdgeOverview => ({
    deviceCount: 0,
    onlineCount: 0,
    offlineCount: 0,
    disabledCount: 0,
    connectionCount: 0,
    receivingConnectionCount: 0,
    noDataConnectionCount: 0,
    disabledConnectionCount: 0,
    queueDepth: 0,
    failedCount: 0,
    activeAlarmCount: 0,
    successfulForwardCount: 0,
    uploadSuccessRate: 0,
    recentEvents: []
  })

  const activeTab = ref('devices')
  const refreshing = ref(false)
  const overviewLoading = ref(true)
  const featureReady = ref(false)
  const featureEnabled = ref(true)
  const importing = ref(false)
  const exporting = ref<'template' | 'configuration' | null>(null)
  const lastRefreshTime = ref('')
  const overview = reactive<EdgeOverview>(emptyOverview())
  const userStore = useUserStore()

  const devicePanel = ref<RefreshablePanel>()
  const webSocketPanel = ref<RefreshablePanel>()
  const realtimePanel = ref<RefreshablePanel>()
  const configPanel = ref<RefreshablePanel>()
  const rulePanel = ref<RefreshablePanel>()
  const queuePanel = ref<QueuePanelExpose>()
  const webSocketSendRecordPanel = ref<RefreshablePanel>()
  const webSocketReceiveRecordPanel = ref<RefreshablePanel>()
  const eventPanel = ref<RefreshablePanel>()
  const mappingPanel = ref<RefreshablePanel>()

  const jsonDialogVisible = ref(false)
  const jsonDialogTitle = ref('JSON')
  const jsonDialogContent = ref('')
  const importInputRef = ref<HTMLInputElement>()
  const importResultVisible = ref(false)
  const importResult = ref<EdgeGatewayImportResult>()
  let overviewRequest: Promise<void> | null = null
  let autoRefreshTimer: number | undefined

  const loadOverview = (): Promise<void> => {
    if (!featureReady.value || !featureEnabled.value) return Promise.resolve()
    if (overviewRequest) return overviewRequest

    overviewRequest = (async () => {
      try {
        Object.assign(overview, await fetchEdgeOverview())
      } finally {
        overviewLoading.value = false
        overviewRequest = null
      }
    })()
    return overviewRequest
  }

  const refreshOverviewAutomatically = async () => {
    if (!featureReady.value || !featureEnabled.value) return
    try {
      await Promise.all([
        loadOverview(),
        activeTab.value === 'websockets' ? webSocketPanel.value?.refresh() : undefined
      ])
      lastRefreshTime.value = new Date().toLocaleString()
    } catch {
      // 请求层会统一提示错误，定时任务保留到下一轮继续尝试。
    }
  }

  const currentPanel = () => {
    const panels: Record<string, RefreshablePanel | undefined> = {
      devices: devicePanel.value,
      websockets: webSocketPanel.value,
      realtime: realtimePanel.value,
      configs: configPanel.value,
      rules: rulePanel.value,
      queue: queuePanel.value,
      'websocket-sends': webSocketSendRecordPanel.value,
      'websocket-receives': webSocketReceiveRecordPanel.value,
      events: eventPanel.value,
      mappings: mappingPanel.value
    }
    return panels[activeTab.value]
  }

  const refreshCurrent = async () => {
    if (!featureReady.value || !featureEnabled.value) return
    refreshing.value = true
    try {
      await Promise.all([loadOverview(), currentPanel()?.refresh()])
      lastRefreshTime.value = new Date().toLocaleString()
    } finally {
      refreshing.value = false
    }
  }

  const handleTabChange = async (name: string | number) => {
    if (!featureEnabled.value) return
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

  const handleFeatureStateChange = async (enabled: boolean) => {
    featureEnabled.value = enabled
    featureReady.value = true
    if (!enabled) {
      Object.assign(overview, emptyOverview())
      overviewLoading.value = false
      lastRefreshTime.value = ''
      return
    }

    overviewLoading.value = true
    await nextTick()
    await refreshCurrent().catch(() => undefined)
  }

  const downloadConfiguration = async (includeData: boolean) => {
    if (exporting.value) return

    exporting.value = includeData ? 'configuration' : 'template'
    const fileName = includeData
      ? `边缘网关当前配置-${new Date().toISOString().slice(0, 10)}.xlsx`
      : '边缘网关配置导入模板.xlsx'
    try {
      const result = await downloadResponseStream({
        url: getEdgeGatewayConfigurationTemplateUrl(includeData),
        fileName,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        accessToken: userStore.accessToken,
        withCredentials: import.meta.env.VITE_WITH_CREDENTIALS === 'true'
      })
      if (result === 'completed') ElMessage.success('配置文件导出完成')
      if (result === 'started') ElMessage.success('配置文件已开始下载')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '配置文件导出失败')
    } finally {
      exporting.value = null
    }
  }

  const selectImportFile = () => importInputRef.value?.click()

  const handleImportFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!/\.(xls|xlsx)$/i.test(file.name)) {
      ElMessage.warning('仅支持 XLS 或 XLSX 文件')
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      ElMessage.warning('导入文件不能超过 100MB')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    if (userStore.info.userName) formData.append('operatorName', userStore.info.userName)

    importing.value = true
    try {
      importResult.value = await importEdgeGatewayConfiguration(formData)
      importResultVisible.value = true
      if (importResult.value.failedCount > 0) {
        ElMessage.warning(
          `导入完成：成功 ${importResult.value.successCount} 条，失败 ${importResult.value.failedCount} 条`
        )
      } else {
        ElMessage.success(`已成功导入 ${importResult.value.successCount} 条配置`)
      }
      await Promise.all([loadOverview(), currentPanel()?.refresh()])
      lastRefreshTime.value = new Date().toLocaleString()
    } finally {
      importing.value = false
    }
  }

  onMounted(() => {
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
