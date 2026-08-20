<template>
  <div>
    <el-alert
      title="连接配置会按设备下发"
      description="每条连接可以订阅多台业务设备和多个参数；数据状态根据中心端最近收到的有效数据自动判断。"
      type="info"
      show-icon
      :closable="false"
      class="connection-help-alert"
    />

    <div class="toolbar">
      <div class="filters">
        <el-select
          v-model="selectedDeviceId"
          filterable
          placeholder="选择设备"
          class="device-select"
          @change="loadSources"
        >
          <el-option
            v-for="device in deviceOptions"
            :key="device.id"
            :label="`${device.deviceName} (${device.deviceCode})`"
            :value="device.id"
          />
        </el-select>
      </div>
      <div class="actions">
        <el-button
          :icon="RefreshRight"
          :loading="reconnectingDevice"
          :disabled="!selectedDeviceId || !hasEnabledSources || reconnectingAll"
          @click="reconnectSelectedDevice"
        >
          重连当前设备
        </el-button>
        <el-button
          type="warning"
          plain
          :icon="RefreshRight"
          :loading="reconnectingAll"
          :disabled="!deviceOptions.length || reconnectingDevice"
          @click="reconnectAllDevices"
        >
          全部重连
        </el-button>
        <el-button type="primary" :icon="Plus" :disabled="!selectedDeviceId" @click="openEditor()">
          新增连接
        </el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="sources" height="520" stripe>
      <el-table-column label="数据状态" width="112" fixed>
        <template #default="{ row }">
          <el-tag :type="dataStatusType(row.dataStatus)" effect="plain">
            {{ dataStatusText(row.dataStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="启用" width="86">
        <template #default="{ row }">
          <el-switch v-model="row.enabled" @change="changeEnabled(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="sourceId" label="数据源标识" min-width="150" show-overflow-tooltip />
      <el-table-column prop="sourceName" label="连接名称" min-width="170" show-overflow-tooltip />
      <el-table-column
        prop="endpoint"
        label="WebSocket 地址"
        min-width="280"
        show-overflow-tooltip
      />
      <el-table-column label="订阅设备" width="100" align="right">
        <template #default="{ row }">{{ row.subscriptionDevices.length }} 台</template>
      </el-table-column>
      <el-table-column label="订阅参数" width="100" align="right">
        <template #default="{ row }">{{ subscriptionParameterCount(row) }} 项</template>
      </el-table-column>
      <el-table-column prop="dataType" label="数据类型" width="120" />
      <el-table-column label="最后收到数据" width="170">
        <template #default="{ row }">{{ formatTime(row.lastDataTime) }}</template>
      </el-table-column>
      <el-table-column label="重连间隔" width="100" align="right">
        <template #default="{ row }">{{ row.reconnectIntervalSeconds }} 秒</template>
      </el-table-column>
      <el-table-column label="版本" width="126">
        <template #default="{ row }"
          >连接 v{{ row.version }} / 订阅 v{{ row.subscriptionVersion }}</template
        >
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditor(row)">编辑</el-button>
          <el-button link @click="openEditor(row, true)">复制</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <EdgeWebSocketConnectionDialog
      v-model="editorVisible"
      :device-id="selectedDeviceId"
      :source="editingSource"
      :duplicate="duplicateSource"
      @saved="handleSaved"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus, RefreshRight } from '@element-plus/icons-vue'
  import {
    deleteWebSocketSource,
    fetchWebSocketSources,
    reconnectAllWebSocketSources,
    reconnectDeviceWebSocketSources,
    setWebSocketSourceEnabled,
    type EdgeDevice,
    type EdgeWebSocketSource
  } from '@/api/edge-gateway'
  import { fetchDeviceOptions, formatTime } from './shared'
  import EdgeWebSocketConnectionDialog from './websocket/EdgeWebSocketConnectionDialog.vue'

  const sources = ref<EdgeWebSocketSource[]>([])
  const deviceOptions = ref<EdgeDevice[]>([])
  const selectedDeviceId = ref<number>()
  const loading = ref(false)
  const reconnectingDevice = ref(false)
  const reconnectingAll = ref(false)
  const editorVisible = ref(false)
  const editingSource = ref<EdgeWebSocketSource>()
  const duplicateSource = ref(false)
  const emit = defineEmits<{
    'overview-changed': []
  }>()
  const hasEnabledSources = computed(() => sources.value.some((source) => source.enabled))

  const loadOptions = async () => {
    deviceOptions.value = await fetchDeviceOptions()
    if (!selectedDeviceId.value && deviceOptions.value.length) {
      selectedDeviceId.value = deviceOptions.value[0].id
    }
  }

  const loadSources = async () => {
    if (!selectedDeviceId.value) {
      sources.value = []
      return
    }
    loading.value = true
    try {
      sources.value = await fetchWebSocketSources(selectedDeviceId.value)
    } finally {
      loading.value = false
    }
  }

  const refresh = async () => {
    await loadOptions()
    await loadSources()
  }

  const openEditor = (source?: EdgeWebSocketSource, duplicate = false) => {
    editingSource.value = source
    duplicateSource.value = duplicate
    editorVisible.value = true
  }

  const subscriptionParameterCount = (source: EdgeWebSocketSource) =>
    source.subscriptionDevices.reduce((total, device) => total + device.parameters.length, 0)

  const dataStatusText = (status: EdgeWebSocketSource['dataStatus']) =>
    ({
      Receiving: '正常接收',
      Interrupted: '数据中断',
      NeverReceived: '未收到数据',
      Disabled: '已停用'
    })[status]

  const dataStatusType = (status: EdgeWebSocketSource['dataStatus']) =>
    ({
      Receiving: 'success',
      Interrupted: 'danger',
      NeverReceived: 'warning',
      Disabled: 'info'
    })[status] as 'success' | 'danger' | 'warning' | 'info'

  const handleSaved = async () => {
    await loadSources()
    emit('overview-changed')
  }

  const changeEnabled = async (row: EdgeWebSocketSource) => {
    try {
      await setWebSocketSourceEnabled(row.id, row.enabled)
      ElMessage.success(row.enabled ? '连接已启用，将自动下发' : '连接已停用，将自动下发')
      await loadSources()
      emit('overview-changed')
    } catch {
      row.enabled = !row.enabled
    }
  }

  const reconnectSelectedDevice = async () => {
    if (!selectedDeviceId.value) return
    const enabledCount = sources.value.filter((source) => source.enabled).length
    if (!enabledCount) {
      ElMessage.warning('当前设备没有已启用的 WebSocket 连接')
      return
    }
    const device = deviceOptions.value.find((item) => item.id === selectedDeviceId.value)
    try {
      await ElMessageBox.confirm(
        `将重新建立“${device?.deviceName || '当前设备'}”的 ${enabledCount} 个已启用连接，是否继续？`,
        '重新连接当前设备',
        { type: 'warning', confirmButtonText: '重新连接', cancelButtonText: '取消' }
      )
    } catch {
      return
    }

    reconnectingDevice.value = true
    try {
      const result = await reconnectDeviceWebSocketSources(selectedDeviceId.value)
      ElMessage.success(
        `已下发重新连接指令，${result.deviceCount} 台设备的 ${result.connectionCount} 个连接将在下一次配置同步时重建`
      )
      await loadSources()
    } finally {
      reconnectingDevice.value = false
    }
  }

  const reconnectAllDevices = async () => {
    try {
      await ElMessageBox.confirm(
        '将重新建立所有设备中已启用的 WebSocket 连接，是否继续？',
        '全部重新连接',
        { type: 'warning', confirmButtonText: '全部重新连接', cancelButtonText: '取消' }
      )
    } catch {
      return
    }

    reconnectingAll.value = true
    try {
      const result = await reconnectAllWebSocketSources()
      if (!result.connectionCount) {
        ElMessage.warning('当前没有可重新连接的已启用 WebSocket 连接')
        return
      }
      ElMessage.success(
        `已下发重新连接指令，共 ${result.deviceCount} 台设备、${result.connectionCount} 个连接`
      )
      await loadSources()
    } finally {
      reconnectingAll.value = false
    }
  }

  const remove = async (row: EdgeWebSocketSource) => {
    await ElMessageBox.confirm(
      `确认删除连接“${row.sourceName}”？配置同步后会停止该连接。`,
      '删除 WebSocket 连接',
      { type: 'warning' }
    )
    await deleteWebSocketSource(row.id)
    ElMessage.success('连接已删除，将在下一次配置同步时停止')
    await loadSources()
    emit('overview-changed')
  }

  defineExpose({ refresh })
</script>
