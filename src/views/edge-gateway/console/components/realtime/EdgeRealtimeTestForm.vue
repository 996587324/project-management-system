<template>
  <section class="realtime-test-section">
    <header class="section-heading">
      <div class="heading-main">
        <h3>数据接收测试</h3>
        <el-tag type="success" effect="plain" size="small">POST</el-tag>
      </div>
      <el-button :icon="MagicStick" @click="generatePayload"> 按当前参数生成 </el-button>
    </header>

    <el-form label-position="top">
      <div class="selector-grid">
        <el-form-item label="设备型号标识（可选）">
          <el-input v-model="modelMark" maxlength="64" placeholder="例如 PUNCH" />
        </el-form-item>

        <el-form-item label="租户标识" required>
          <el-input v-model="tenantMark" maxlength="64" placeholder="例如 geek" />
        </el-form-item>

        <el-form-item label="设备标识" required>
          <el-input v-model="deviceMark" maxlength="128" placeholder="例如 PUNCH_13" />
        </el-form-item>

        <el-form-item label="数据类型（可选）">
          <el-input-number
            v-model="dataType"
            :min="0"
            :max="2147483647"
            controls-position="right"
          />
        </el-form-item>

        <el-form-item label="接口密钥">
          <el-input
            v-model="apiKey"
            type="password"
            show-password
            autocomplete="off"
            placeholder="未启用机器认证时留空"
          />
        </el-form-item>
      </div>

      <el-form-item label="请求地址">
        <el-input :model-value="requestEndpoint" readonly />
      </el-form-item>

      <el-form-item label="请求 JSON" class="json-editor-item">
        <el-input
          v-model="payloadText"
          type="textarea"
          resize="vertical"
          :autosize="{ minRows: 8, maxRows: 16 }"
          spellcheck="false"
        />
      </el-form-item>

      <div class="test-actions">
        <span class="payload-size" :class="{ invalid: payloadBytes > MAX_PAYLOAD_BYTES }">
          {{ formatPayloadSize(payloadBytes) }} / 1 MB
        </span>
        <el-button :icon="RefreshLeft" @click="generatePayload">重置 JSON</el-button>
        <el-button
          type="primary"
          :icon="Promotion"
          :loading="submitting"
          :disabled="!canSubmit"
          @click="submitTest"
        >
          发送测试数据
        </el-button>
      </div>
    </el-form>

    <el-descriptions v-if="lastResult" class="test-result" :column="4" border>
      <el-descriptions-item label="请求编号">{{ lastSentRequestId || '-' }}</el-descriptions-item>
      <el-descriptions-item label="快照 ID">{{ lastResult.snapshotId }}</el-descriptions-item>
      <el-descriptions-item label="接收数量">{{ lastResult.receivedCount }}</el-descriptions-item>
      <el-descriptions-item label="新增">{{ lastResult.insertedCount }}</el-descriptions-item>
      <el-descriptions-item label="覆盖">{{ lastResult.updatedCount }}</el-descriptions-item>
      <el-descriptions-item label="忽略旧数据">
        <el-text :type="lastResult.ignoredOlderCount ? 'warning' : 'success'">
          {{ lastResult.ignoredOlderCount }}
        </el-text>
      </el-descriptions-item>
      <el-descriptions-item label="数据时间">
        {{ formatTime(lastResult.dataTime) }}
      </el-descriptions-item>
      <el-descriptions-item label="中心接收时间">
        {{ formatTime(lastResult.receiveTime) }}
      </el-descriptions-item>
    </el-descriptions>
  </section>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { MagicStick, Promotion, RefreshLeft } from '@element-plus/icons-vue'
  import {
    sendEdgeRealtimeTestData,
    type EdgeRealtimeReceivePayload,
    type EdgeRealtimeReceiveResult
  } from '@/api/edge-gateway'
  import { formatTime, isObject } from '../shared'

  const MAX_PAYLOAD_BYTES = 1024 * 1024
  const emit = defineEmits<{ sent: [] }>()

  const modelMark = ref('PUNCH')
  const tenantMark = ref('geek')
  const deviceMark = ref('PUNCH_13')
  const dataType = ref<number | undefined>(1)
  const payloadText = ref('')
  const apiKey = ref('')
  const submitting = ref(false)
  const lastResult = ref<EdgeRealtimeReceiveResult>()
  const lastSentRequestId = ref('')

  const requestEndpoint = '/api/EdgeGateway/realtime-data'

  const payloadBytes = computed(() => new TextEncoder().encode(payloadText.value).byteLength)
  const canSubmit = computed(
    () => Boolean(payloadText.value.trim()) && payloadBytes.value <= MAX_PAYLOAD_BYTES
  )

  function createRequestId() {
    return (
      globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    )
  }

  const generatePayload = () => {
    const payload: EdgeRealtimeReceivePayload = {
      data: {
        total_output: 6480,
        current_total_output: 0,
        timestamp: new Date().toISOString()
      },
      tenantMark: tenantMark.value.trim(),
      messageId: createRequestId().replaceAll('-', ''),
      time: Date.now(),
      deviceMark: deviceMark.value.trim()
    }
    const normalizedModelMark = modelMark.value.trim()
    if (normalizedModelMark) payload.modelMark = normalizedModelMark
    if (dataType.value !== undefined) payload.dataType = dataType.value
    payloadText.value = JSON.stringify(payload, null, 2)
  }

  const parsePayload = (): EdgeRealtimeReceivePayload => {
    let root: Record<string, unknown>
    try {
      const parsed = JSON.parse(payloadText.value) as unknown
      if (!isObject(parsed)) throw new Error('请求 JSON 必须是对象')
      root = parsed
    } catch (error) {
      throw new Error(
        error instanceof SyntaxError ? `JSON 格式错误：${error.message}` : String(error)
      )
    }

    const data = root.data ?? root.Data
    const modelMark = root.modelMark ?? root.ModelMark
    const dataType = root.dataType ?? root.DataType
    const tenantMark = root.tenantMark ?? root.TenantMark
    const messageId = root.messageId ?? root.MessageId
    const time = root.time ?? root.Time
    const deviceMark = root.deviceMark ?? root.DeviceMark

    if (!isObject(data) || !Object.keys(data).length) throw new Error('data 必须是非空对象')
    if (typeof tenantMark !== 'string' || !tenantMark.trim()) throw new Error('tenantMark 不能为空')
    if (typeof deviceMark !== 'string' || !deviceMark.trim()) throw new Error('deviceMark 不能为空')
    if (tenantMark.trim().length > 64) throw new Error('tenantMark 不能超过 64 个字符')
    if (deviceMark.trim().length > 128) throw new Error('deviceMark 不能超过 128 个字符')

    const payload: EdgeRealtimeReceivePayload = {
      data,
      tenantMark: tenantMark.trim(),
      deviceMark: deviceMark.trim()
    }

    if (modelMark !== undefined && modelMark !== null) {
      if (typeof modelMark !== 'string') throw new Error('modelMark 必须是文本')
      const normalizedModelMark = modelMark.trim()
      if (normalizedModelMark.length > 64) throw new Error('modelMark 不能超过 64 个字符')
      if (normalizedModelMark) payload.modelMark = normalizedModelMark
    }
    if (messageId !== undefined && messageId !== null) {
      if (typeof messageId !== 'string') throw new Error('messageId 必须是文本')
      const normalizedMessageId = messageId.trim()
      if (normalizedMessageId.length > 128) throw new Error('messageId 不能超过 128 个字符')
      if (normalizedMessageId) payload.messageId = normalizedMessageId
    }
    if (dataType !== undefined && dataType !== null) {
      if (
        typeof dataType !== 'number' ||
        !Number.isInteger(dataType) ||
        dataType < -2147483648 ||
        dataType > 2147483647
      ) {
        throw new Error('dataType 必须是 32 位整数')
      }
      payload.dataType = dataType
    }
    if (time !== undefined && time !== null) {
      if (typeof time !== 'number' || !Number.isSafeInteger(time))
        throw new Error('time 必须是 Unix 毫秒整数时间戳')
      payload.time = time
    }
    return payload
  }

  const submitTest = async () => {
    if (payloadBytes.value > MAX_PAYLOAD_BYTES) {
      ElMessage.warning('请求 JSON 不能超过 1 MB')
      return
    }

    let payload: EdgeRealtimeReceivePayload
    try {
      payload = parsePayload()
    } catch (error) {
      ElMessage.warning(error instanceof Error ? error.message : '请求 JSON 校验失败')
      return
    }

    submitting.value = true
    try {
      lastResult.value = await sendEdgeRealtimeTestData(payload, {
        apiKey: apiKey.value.trim() || undefined
      })
      lastSentRequestId.value = payload.messageId || ''
      if (lastResult.value.ignoredOlderCount) {
        ElMessage.warning('请求已接收，但数据时间较旧，未覆盖当前快照')
      } else {
        ElMessage.success(lastResult.value.insertedCount ? '已新增实时快照' : '已覆盖实时快照')
      }
      emit('sent')
    } finally {
      submitting.value = false
    }
  }

  const formatPayloadSize = (bytes: number) =>
    bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`

  const refresh = async () => undefined

  onMounted(generatePayload)
  defineExpose({ refresh })
</script>

<style scoped lang="scss">
  .realtime-test-section {
    padding-bottom: 24px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .section-heading,
  .heading-main,
  .test-actions {
    display: flex;
    align-items: center;
  }

  .section-heading {
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .heading-main {
    gap: 10px;
  }

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .selector-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(180px, 1fr));
    gap: 0 16px;
  }

  .selector-grid :deep(.el-select),
  .selector-grid :deep(.el-input-number) {
    width: 100%;
  }

  .json-editor-item :deep(textarea) {
    font-family: Consolas, 'Courier New', monospace;
    line-height: 1.6;
  }

  .test-actions {
    gap: 10px;
    justify-content: flex-end;
  }

  .payload-size {
    margin-right: auto;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .payload-size.invalid {
    color: var(--el-color-danger);
  }

  .test-result {
    margin-top: 18px;
  }

  @media (width <= 1200px) {
    .selector-grid {
      grid-template-columns: repeat(2, minmax(180px, 1fr));
    }
  }

  @media (width <= 720px) {
    .section-heading,
    .test-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .selector-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .payload-size {
      margin-right: 0;
    }
  }
</style>
