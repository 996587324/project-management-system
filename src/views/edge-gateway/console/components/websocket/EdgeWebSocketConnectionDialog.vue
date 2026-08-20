<template>
  <el-dialog
    v-model="visible"
    :title="form.id ? '编辑 WebSocket 连接' : '新增 WebSocket 连接'"
    :width="usePagedSubscriptionEditor ? 'min(1200px, 96vw)' : 'min(980px, 96vw)'"
    class="edge-gateway-dialog websocket-editor-dialog"
  >
    <el-form label-position="top">
      <div class="form-grid">
        <el-form-item label="数据源标识" required>
          <el-input v-model="form.sourceId" placeholder="例如 cabinet-realtime" maxlength="64" />
        </el-form-item>
        <el-form-item label="连接名称" required>
          <el-input v-model="form.sourceName" placeholder="例如柜体实时数据" maxlength="128" />
        </el-form-item>
      </div>

      <el-form-item label="WebSocket 地址" required>
        <el-input
          v-model="form.endpoint"
          placeholder="ws://your-domain:9080/getCabinetDeviceInfo"
        />
      </el-form-item>

      <div class="form-grid websocket-option-grid">
        <el-form-item label="数据类型" required>
          <el-select
            v-model="form.dataType"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入数据类型"
          >
            <el-option label="遥测数据 Telemetry" value="Telemetry" />
            <el-option label="事件数据 Event" value="Event" />
            <el-option label="状态数据 Status" value="Status" />
          </el-select>
        </el-form-item>
        <el-form-item label="断线重连间隔">
          <el-input-number
            v-model="form.reconnectIntervalSeconds"
            :min="1"
            :max="300"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="启用连接">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </div>

      <el-form-item label="握手请求头">
        <EdgeWebSocketHeaderEditor v-model="headers" />
      </el-form-item>

      <EdgeWebSocketPagedSubscriptionEditor
        v-if="usePagedSubscriptionEditor"
        ref="subscriptionEditor"
        v-model="subscriptionDevices"
      />
      <EdgeWebSocketSubscriptionEditor
        v-else
        ref="subscriptionEditor"
        v-model="subscriptionDevices"
      />
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">校验并保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import {
    saveWebSocketSource,
    saveWebSocketSubscriptions,
    type EdgeWebSocketSource,
    type EdgeWebSocketSourceSave,
    type EdgeWebSocketSubscriptionDevice
  } from '@/api/edge-gateway'
  import EdgeWebSocketHeaderEditor, {
    type WebSocketHeaderEntry
  } from './EdgeWebSocketHeaderEditor.vue'
  import EdgeWebSocketSubscriptionEditor from './EdgeWebSocketSubscriptionEditor.vue'
  import EdgeWebSocketPagedSubscriptionEditor from './EdgeWebSocketPagedSubscriptionEditor.vue'
  import { countSubscriptionParameters } from './subscriptionEditorUtils'

  const PAGED_EDITOR_DEVICE_THRESHOLD = 30
  const PAGED_EDITOR_PARAMETER_THRESHOLD = 500

  const props = defineProps<{
    deviceId?: number
    source?: EdgeWebSocketSource
    duplicate?: boolean
  }>()

  const emit = defineEmits<{
    saved: []
  }>()

  const visible = defineModel<boolean>({ required: true })
  const saving = ref(false)
  const headers = ref<WebSocketHeaderEntry[]>([])
  const subscriptionDevices = ref<EdgeWebSocketSubscriptionDevice[]>([])
  const subscriptionEditor = ref<{ validate: () => boolean }>()
  const originalConnectionSignature = ref('')
  let headerSequence = 0

  const usePagedSubscriptionEditor = computed(
    () =>
      subscriptionDevices.value.length > PAGED_EDITOR_DEVICE_THRESHOLD ||
      countSubscriptionParameters(subscriptionDevices.value) > PAGED_EDITOR_PARAMETER_THRESHOLD
  )

  const defaultSource = (): EdgeWebSocketSourceSave => ({
    id: 0,
    sourceId: '',
    sourceName: '',
    endpoint: 'ws://',
    subscriptionPayload: '',
    headersJson: '{}',
    dataType: 'Telemetry',
    reconnectIntervalSeconds: 5,
    enabled: true
  })

  const form = reactive<EdgeWebSocketSourceSave>(defaultSource())

  const cloneSubscriptions = (
    devices: EdgeWebSocketSubscriptionDevice[]
  ): EdgeWebSocketSubscriptionDevice[] =>
    devices.map((device, deviceIndex) => ({
      ...device,
      id: props.duplicate ? undefined : device.id,
      sort: deviceIndex,
      parameters: device.parameters.map((parameter, parameterIndex) => ({
        ...parameter,
        id: props.duplicate ? undefined : parameter.id,
        sort: parameterIndex
      }))
    }))

  const parseLegacySubscription = (payload?: string): EdgeWebSocketSubscriptionDevice[] => {
    if (!payload?.trim()) return []
    try {
      const parsed = JSON.parse(payload) as {
        devices?: Array<{ deviceCode?: string; parameters?: string[] }>
      }
      return (parsed.devices || []).map((device, deviceIndex) => ({
        deviceCode: device.deviceCode || '',
        deviceName: '',
        enabled: true,
        sort: deviceIndex,
        parameters: (device.parameters || []).map((parameterName, parameterIndex) => ({
          parameterName,
          parameterNameCn: '',
          dataType: '',
          enabled: true,
          sort: parameterIndex
        }))
      }))
    } catch {
      return []
    }
  }

  const parseHeaders = (headersJson?: string): WebSocketHeaderEntry[] => {
    if (!headersJson) return []
    try {
      const parsed = JSON.parse(headersJson) as Record<string, unknown>
      return Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        .map(([name, value]) => ({ id: (headerSequence += 1), name, value }))
    } catch {
      return []
    }
  }

  const connectionSignature = (source: EdgeWebSocketSourceSave) =>
    JSON.stringify({
      id: source.id,
      sourceId: source.sourceId.trim(),
      sourceName: source.sourceName.trim(),
      endpoint: source.endpoint.trim(),
      headersJson: source.headersJson || '{}',
      dataType: source.dataType.trim(),
      reconnectIntervalSeconds: source.reconnectIntervalSeconds,
      enabled: source.enabled
    })

  const resetEditor = () => {
    const source = props.source
    Object.assign(form, defaultSource(), source || {})
    if (props.duplicate && source) {
      form.id = 0
      form.sourceId = `${source.sourceId}-copy`
      form.sourceName = `${source.sourceName} - 副本`
    }
    headers.value = parseHeaders(source?.headersJson)
    const structured = source?.subscriptionDevices?.length
      ? source.subscriptionDevices
      : parseLegacySubscription(source?.subscriptionPayload)
    subscriptionDevices.value = cloneSubscriptions(structured || [])
    if (!subscriptionDevices.value.length) {
      subscriptionDevices.value = [
        {
          deviceCode: '',
          deviceName: '',
          enabled: true,
          sort: 0,
          parameters: [
            {
              parameterName: '',
              parameterNameCn: '',
              dataType: '',
              enabled: true,
              sort: 0
            }
          ]
        }
      ]
    }
    form.headersJson = buildHeadersJson(false) || '{}'
    originalConnectionSignature.value = connectionSignature(form)
  }

  const buildHeadersJson = (showWarning = true) => {
    const result: Record<string, string> = {}
    const names = new Set<string>()
    for (let index = 0; index < headers.value.length; index += 1) {
      const name = headers.value[index].name.trim()
      const headerValue = headers.value[index].value.trim()
      if (!name || !headerValue) {
        if (showWarning) ElMessage.warning(`第 ${index + 1} 个请求头没有填写完整`)
        return null
      }
      if (names.has(name.toLowerCase())) {
        if (showWarning) ElMessage.warning(`请求头名称重复：${name}`)
        return null
      }
      names.add(name.toLowerCase())
      result[name] = headerValue
    }
    return JSON.stringify(result, null, 2)
  }

  const validateConnection = () => {
    if (!props.deviceId) {
      ElMessage.warning('请先选择设备')
      return false
    }
    if (!form.sourceId.trim() || !form.sourceName.trim()) {
      ElMessage.warning('请填写数据源标识和连接名称')
      return false
    }
    if (!form.dataType.trim()) {
      ElMessage.warning('请填写数据类型')
      return false
    }
    try {
      const endpoint = new URL(form.endpoint)
      if (endpoint.protocol === 'ws:' || endpoint.protocol === 'wss:') return true
    } catch {
      // 统一由下方提示处理。
    }
    ElMessage.warning('WebSocket 地址必须是有效的 ws:// 或 wss:// 完整地址')
    return false
  }

  const normalizedSubscriptions = () =>
    subscriptionDevices.value.map((device, deviceIndex) => ({
      ...device,
      deviceCode: device.deviceCode.trim(),
      deviceName: device.deviceName?.trim(),
      sort: deviceIndex,
      parameters: device.parameters.map((parameter, parameterIndex) => ({
        ...parameter,
        parameterName: parameter.parameterName.trim(),
        parameterNameCn: parameter.parameterNameCn?.trim(),
        dataType: parameter.dataType?.trim(),
        sort: parameterIndex
      }))
    }))

  const submit = async () => {
    if (!validateConnection() || !subscriptionEditor.value?.validate()) return
    const headersJson = buildHeadersJson()
    if (headersJson === null || !props.deviceId) return

    const connection = {
      ...form,
      sourceId: form.sourceId.trim(),
      sourceName: form.sourceName.trim(),
      endpoint: form.endpoint.trim(),
      dataType: form.dataType.trim(),
      headersJson
    }
    const connectionChanged =
      !connection.id || connectionSignature(connection) !== originalConnectionSignature.value

    saving.value = true
    try {
      const sourceId = connectionChanged
        ? await saveWebSocketSource(props.deviceId, connection)
        : connection.id
      if (!sourceId) throw new Error('保存 WebSocket 连接后未返回连接 ID')
      await saveWebSocketSubscriptions(sourceId, normalizedSubscriptions())
      ElMessage.success(
        connectionChanged ? '连接和订阅已保存并下发' : '订阅已更新，在线连接将立即重新订阅'
      )
      visible.value = false
      emit('saved')
    } finally {
      saving.value = false
    }
  }

  watch(
    () => visible.value,
    (opened) => {
      if (opened) resetEditor()
    }
  )
</script>
