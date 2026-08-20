<template>
  <el-dialog
    v-model="visible"
    :title="form.id ? '编辑 B 系统映射' : '新增 B 系统映射'"
    width="min(1040px, 96vw)"
    class="edge-gateway-dialog b-mapping-dialog"
  >
    <el-form label-position="top">
      <div class="form-grid">
        <el-form-item label="映射名称" required>
          <el-input v-model="form.mappingName" maxlength="128" />
        </el-form-item>
        <el-form-item label="作用范围" required>
          <el-segmented v-model="scopeType" :options="scopeOptions" @change="handleScopeChange" />
        </el-form-item>
      </div>

      <div v-if="scopeType !== 'Global'" class="form-grid">
        <el-form-item label="边缘节点" required>
          <el-select
            v-model="form.deviceId"
            filterable
            placeholder="选择负责采集的边缘节点"
            @change="handleDeviceChange"
          >
            <el-option
              v-for="device in deviceOptions"
              :key="device.id"
              :label="`${device.deviceName} (${device.deviceCode})`"
              :value="device.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="scopeType === 'SubscriptionDevice'" label="WebSocket 数据源" required>
          <el-select
            v-model="form.sourceId"
            :loading="sourceLoading"
            filterable
            placeholder="选择 WebSocket 连接"
            @change="handleSourceChange"
          >
            <el-option
              v-for="source in sourceOptions"
              :key="source.id"
              :label="`${source.sourceName} (${source.sourceId})${source.enabled ? '' : ' · 已停用'}`"
              :value="source.sourceId"
            />
          </el-select>
        </el-form-item>
      </div>

      <el-form-item v-if="scopeType === 'SubscriptionDevice'" label="WebSocket 订阅设备" required>
        <el-select
          v-model="form.sourceDeviceCode"
          :disabled="!form.sourceId"
          filterable
          placeholder="选择该连接订阅的 deviceCode"
        >
          <el-option
            v-for="device in subscriptionDeviceOptions"
            :key="device.id || device.deviceCode"
            :label="`${device.deviceName || '未命名设备'} (${device.deviceCode})${device.enabled ? '' : ' · 已停用'}`"
            :value="device.deviceCode"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="报文模板">
        <div class="template-selector">
          <el-select
            v-model="form.payloadTemplateId"
            clearable
            filterable
            placeholder="选择模板，或在下方直接配置 JSON 结构"
            @change="applySelectedTemplate"
          >
            <el-option
              v-for="template in templateOptions"
              :key="template.id"
              :label="`${template.templateName} (${template.templateCode})`"
              :value="template.id"
              :disabled="!template.enabled"
            />
          </el-select>
          <el-tooltip content="新增报文模板" placement="top">
            <el-button
              :icon="Plus"
              aria-label="新增报文模板"
              @click="templateEditorVisible = true"
            />
          </el-tooltip>
        </div>
      </el-form-item>

      <div class="form-grid mapping-protocol-grid">
        <el-form-item label="通讯协议" required>
          <el-segmented v-model="form.protocol" :options="protocolOptions" />
        </el-form-item>
        <el-form-item label="启用映射">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </div>

      <EdgeBHttpTransportFields v-if="form.protocol === 'HTTP'" :model-value="form" />
      <EdgeBMqttTransportFields v-else :model-value="form" />

      <el-form-item label="报文结构与字段绑定" required>
        <EdgeBFieldMappingEditor
          ref="fieldMappingEditor"
          v-model="form.mappingJson"
          :device-id="form.deviceId"
          :device-code="selectedDeviceCode"
          :source-id="form.sourceId"
          :source-device-code="form.sourceDeviceCode"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">校验并保存</el-button>
    </template>

    <EdgeBTemplateEditorDialog v-model="templateEditorVisible" @saved="handleTemplateSaved" />
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import {
    saveEdgeBMapping,
    fetchWebSocketSources,
    type EdgeBMapping,
    type EdgeBPayloadTemplate,
    type EdgeBTransportProtocol,
    type EdgeDevice,
    type EdgeWebSocketSource
  } from '@/api/edge-gateway'
  import EdgeBHttpTransportFields from './EdgeBHttpTransportFields.vue'
  import EdgeBFieldMappingEditor from './EdgeBFieldMappingEditor.vue'
  import EdgeBMqttTransportFields from './EdgeBMqttTransportFields.vue'
  import EdgeBTemplateEditorDialog from './EdgeBTemplateEditorDialog.vue'

  const props = defineProps<{
    mapping?: EdgeBMapping
    deviceOptions: EdgeDevice[]
    templates: EdgeBPayloadTemplate[]
  }>()

  const emit = defineEmits<{
    saved: []
    'templates-changed': []
  }>()

  const visible = defineModel<boolean>({ required: true })
  const saving = ref(false)
  const templateEditorVisible = ref(false)
  const fieldMappingEditor = ref<{
    applyTemplate: (content: string) => boolean
    validate: () => boolean
  }>()
  type BMappingScope = 'Global' | 'Gateway' | 'SubscriptionDevice'
  const scopeType = ref<BMappingScope>('Global')
  const sourceOptions = ref<EdgeWebSocketSource[]>([])
  const sourceLoading = ref(false)
  const scopeOptions: Array<{ label: string; value: BMappingScope }> = [
    { label: '全局默认', value: 'Global' },
    { label: '节点默认', value: 'Gateway' },
    { label: '订阅设备', value: 'SubscriptionDevice' }
  ]
  const selectedDeviceCode = computed(
    () => props.deviceOptions.find((device) => device.id === form.deviceId)?.deviceCode
  )
  const selectedSource = computed(() =>
    sourceOptions.value.find((source) => source.sourceId === form.sourceId)
  )
  const subscriptionDeviceOptions = computed(() => selectedSource.value?.subscriptionDevices || [])
  const templateOptions = computed(() => {
    const items = [...props.templates]
    if (
      form.payloadTemplateId &&
      !items.some((template) => template.id === form.payloadTemplateId)
    ) {
      items.unshift({
        id: form.payloadTemplateId,
        templateCode: 'HISTORY',
        templateName: form.payloadTemplateName || '历史模板',
        templateJson: form.mappingJson,
        enabled: false
      })
    }
    return items
  })
  const protocolOptions: Array<{ label: string; value: EdgeBTransportProtocol }> = [
    { label: 'HTTP', value: 'HTTP' },
    { label: 'MQTT', value: 'MQTT' }
  ]

  const defaultMapping = (): EdgeBMapping => ({
    id: 0,
    deviceId: undefined,
    sourceId: undefined,
    sourceDeviceCode: undefined,
    payloadTemplateId: undefined,
    payloadTemplateName: undefined,
    mappingName: '',
    protocol: 'HTTP',
    targetUrl: 'https://',
    httpMethod: 'POST',
    mqttTopic: '',
    mqttClientId: '',
    mqttUsername: '',
    mqttPassword: '',
    hasMqttPassword: false,
    mqttQosLevel: 1,
    mqttRetain: false,
    mappingJson: '{}',
    headersJson: '{}',
    enabled: true
  })

  const form = reactive<EdgeBMapping>(defaultMapping())

  const loadSourceOptions = async () => {
    sourceOptions.value = []
    if (!form.deviceId) return
    sourceLoading.value = true
    try {
      sourceOptions.value = await fetchWebSocketSources(form.deviceId)
    } finally {
      sourceLoading.value = false
    }
  }

  const resetForm = async () => {
    Object.assign(form, defaultMapping(), props.mapping || {})
    form.protocol = form.protocol || 'HTTP'
    form.mqttPassword = ''
    scopeType.value = form.sourceDeviceCode
      ? 'SubscriptionDevice'
      : form.deviceId
        ? 'Gateway'
        : 'Global'
    await loadSourceOptions()
  }

  const clearSubscriptionScope = () => {
    form.sourceId = undefined
    form.sourceDeviceCode = undefined
  }

  const handleScopeChange = (scope: BMappingScope) => {
    if (scope === 'Global') {
      form.deviceId = undefined
      sourceOptions.value = []
      clearSubscriptionScope()
      return
    }
    if (scope === 'Gateway') clearSubscriptionScope()
  }

  const handleDeviceChange = async () => {
    clearSubscriptionScope()
    await loadSourceOptions()
  }

  const handleSourceChange = () => {
    form.sourceDeviceCode = undefined
  }

  const applySelectedTemplate = (templateId?: number) => {
    if (!templateId) return
    const template = props.templates.find((item) => item.id === templateId)
    if (!template) return
    fieldMappingEditor.value?.applyTemplate(template.templateJson)
  }

  const handleTemplateSaved = (template: EdgeBPayloadTemplate) => {
    form.payloadTemplateId = template.id
    form.payloadTemplateName = template.templateName
    fieldMappingEditor.value?.applyTemplate(template.templateJson)
    emit('templates-changed')
  }

  const parseJsonObject = (content: string | undefined, fieldName: string) => {
    if (!content?.trim()) return true
    try {
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return true
    } catch {
      // 统一由下方提示处理。
    }
    ElMessage.warning(`${fieldName}必须是有效的 JSON 对象`)
    return false
  }

  const validateHttp = () => {
    try {
      const target = new URL(form.targetUrl)
      if (target.protocol !== 'http:' && target.protocol !== 'https:') throw new Error()
    } catch {
      ElMessage.warning('HTTP 目标地址必须是有效的 http:// 或 https:// 完整地址')
      return false
    }
    return parseJsonObject(form.headersJson, '请求头 JSON')
  }

  const validateMqtt = () => {
    try {
      const target = new URL(form.targetUrl)
      if (target.protocol !== 'mqtt:' && target.protocol !== 'mqtts:') throw new Error()
    } catch {
      ElMessage.warning('MQTT Broker 地址必须是有效的 mqtt:// 或 mqtts:// 完整地址')
      return false
    }
    if (!form.mqttTopic?.trim()) {
      ElMessage.warning('请填写 MQTT 发布主题')
      return false
    }
    if (form.mqttTopic.includes('#') || form.mqttTopic.includes('+')) {
      ElMessage.warning('发布主题不能包含 # 或 + 通配符')
      return false
    }
    return [0, 1, 2].includes(form.mqttQosLevel)
  }

  const submit = async () => {
    if (!form.mappingName.trim()) {
      ElMessage.warning('请填写映射名称')
      return
    }
    if (scopeType.value !== 'Global' && !form.deviceId) {
      ElMessage.warning('请选择边缘节点')
      return
    }
    if (scopeType.value === 'SubscriptionDevice' && (!form.sourceId || !form.sourceDeviceCode)) {
      ElMessage.warning('请选择 WebSocket 数据源和订阅设备')
      return
    }
    if (!fieldMappingEditor.value?.validate()) return
    if (form.protocol === 'HTTP' ? !validateHttp() : !validateMqtt()) return

    saving.value = true
    try {
      await saveEdgeBMapping({
        ...form,
        mappingName: form.mappingName.trim(),
        targetUrl: form.targetUrl.trim(),
        httpMethod: form.httpMethod.toUpperCase(),
        mqttTopic: form.mqttTopic?.trim(),
        mqttClientId: form.mqttClientId?.trim(),
        mqttUsername: form.mqttUsername?.trim()
      })
      ElMessage.success('B 系统映射已保存')
      visible.value = false
      emit('saved')
    } finally {
      saving.value = false
    }
  }

  watch(
    () => visible.value,
    async (opened) => {
      if (opened) await resetForm()
    }
  )

  watch(
    () => form.protocol,
    (protocol, previous) => {
      if (!visible.value || protocol === previous) return
      if (protocol === 'MQTT' && /^https?:\/\//i.test(form.targetUrl)) {
        form.targetUrl = 'mqtt://'
      }
      if (protocol === 'HTTP' && /^mqtts?:\/\//i.test(form.targetUrl)) {
        form.targetUrl = 'https://'
      }
    }
  )
</script>

<style scoped>
  .template-selector {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 40px;
    gap: 8px;
    width: 100%;
  }

  .mapping-protocol-grid {
    grid-template-columns: minmax(260px, 1fr) minmax(120px, 0.4fr);
  }
</style>
