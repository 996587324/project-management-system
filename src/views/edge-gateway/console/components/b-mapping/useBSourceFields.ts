import { computed, ref, watch } from 'vue'
import { fetchDeviceConfigs, fetchEdgeQueue, fetchWebSocketSources } from '@/api/edge-gateway'
import { getObjectValue, isObject } from '../shared'

export interface BSourceFieldOption {
  value: string
  label: string
}

export const standardBSourceOptions: BSourceFieldOption[] = [
  { value: 'messageId', label: '消息 ID（messageId）' },
  { value: 'deviceId', label: '边缘设备编码（deviceId）' },
  { value: 'sourceId', label: '数据源标识（sourceId）' },
  { value: 'sourceDeviceCode', label: '来源业务设备编码（sourceDeviceCode）' },
  { value: 'timestamp', label: '采集时间（timestamp）' },
  { value: 'dataType', label: '数据类型（dataType）' },
  { value: 'values', label: '全部采集值（values）' },
  { value: 'rawPayload', label: '原始报文（rawPayload）' },
  { value: 'schemaVersion', label: '消息格式版本（schemaVersion）' }
]

export const useBSourceFields = (
  getDeviceId: () => number | undefined,
  getDeviceCode: () => string | undefined,
  getSourceId: () => string | undefined,
  getSourceDeviceCode: () => string | undefined
) => {
  const deviceFieldOptions = ref<BSourceFieldOption[]>([])
  const candidatePaths = ref(new Set<string>())
  const loading = ref(false)
  let requestSequence = 0

  const sourcePlaceholder = computed(() =>
    getDeviceId() ? '选择当前设备的标准字段或采集字段' : '选择或输入全局字段路径'
  )

  const addDeviceField = (
    fields: Map<string, BSourceFieldOption>,
    path: string,
    nameCn?: string
  ) => {
    const value = path.trim()
    if (!value || fields.has(value.toLowerCase())) return
    fields.set(value.toLowerCase(), {
      value,
      label: nameCn ? `${nameCn}（${value}）` : `采集字段（${value}）`
    })
  }

  const collectConfigFields = (configJson: string, fields: Map<string, BSourceFieldOption>) => {
    try {
      const parsed = JSON.parse(configJson) as unknown
      if (!isObject(parsed)) return
      const mappings = getObjectValue(parsed, 'mappings')
      if (!Array.isArray(mappings)) return
      mappings.forEach((mapping) => {
        if (!isObject(mapping)) return
        const targetField = getObjectValue(mapping, 'targetField')
        if (typeof targetField === 'string' && targetField.trim()) {
          addDeviceField(fields, `values.${targetField.trim()}`)
        }
      })
    } catch {
      // 历史配置 JSON 异常时只忽略候选字段。
    }
  }

  const canonicalizePayloadPath = (path: string) => {
    const [root, ...segments] = path.split('.')
    const canonicalRoots: Record<string, string> = {
      messageid: 'messageId',
      deviceid: 'deviceId',
      sourceid: 'sourceId',
      sourcedevicecode: 'sourceDeviceCode',
      timestamp: 'timestamp',
      datatype: 'dataType',
      values: 'values',
      rawpayload: 'rawPayload',
      schemaversion: 'schemaVersion'
    }
    return [canonicalRoots[root.toLowerCase()] || root, ...segments].join('.')
  }

  const collectPayloadFields = (
    value: unknown,
    fields: Map<string, BSourceFieldOption>,
    path = '',
    depth = 0
  ) => {
    if (path) {
      const canonicalPath = canonicalizePayloadPath(path)
      if (canonicalPath.includes('.')) addDeviceField(fields, canonicalPath)
    }
    if (!isObject(value) || depth >= 6) return
    Object.entries(value).forEach(([key, child]) => {
      collectPayloadFields(child, fields, path ? `${path}.${key}` : key, depth + 1)
    })
  }

  const load = async () => {
    const sequence = ++requestSequence
    deviceFieldOptions.value = []
    candidatePaths.value = new Set(
      standardBSourceOptions.map((option) => option.value.toLowerCase())
    )
    const deviceId = getDeviceId()
    const deviceCode = getDeviceCode()
    const sourceId = getSourceId()
    const sourceDeviceCode = getSourceDeviceCode()
    if (!deviceId || !deviceCode) return

    loading.value = true
    try {
      const [configsResult, sourcesResult, queueResult] = await Promise.allSettled([
        fetchDeviceConfigs(deviceId),
        fetchWebSocketSources(deviceId),
        fetchEdgeQueue({ current: 1, size: 20, deviceCode })
      ])
      if (sequence !== requestSequence) return

      const fields = new Map<string, BSourceFieldOption>()
      let hasConfiguredTargetFields = false
      if (configsResult.status === 'fulfilled') {
        const published = configsResult.value.filter((config) => config.isPublished)
        ;(published.length ? published : configsResult.value.slice(0, 1)).forEach((config) =>
          collectConfigFields(config.configJson, fields)
        )
        hasConfiguredTargetFields = fields.size > 0
      }

      if (!hasConfiguredTargetFields && sourcesResult.status === 'fulfilled') {
        sourcesResult.value
          .filter((source) => !sourceId || source.sourceId.toLowerCase() === sourceId.toLowerCase())
          .forEach((source) => {
            source.subscriptionDevices
              .filter(
                (device) =>
                  !sourceDeviceCode ||
                  device.deviceCode.toLowerCase() === sourceDeviceCode.toLowerCase()
              )
              .forEach((device) => {
                device.parameters.forEach((parameter) => {
                  addDeviceField(
                    fields,
                    `values.${parameter.parameterName.trim()}`,
                    parameter.parameterNameCn?.trim()
                  )
                })
              })
          })
      }

      if (queueResult.status === 'fulfilled') {
        queueResult.value.records
          .filter(
            (record) =>
              (!sourceId || record.sourceId.toLowerCase() === sourceId.toLowerCase()) &&
              (!sourceDeviceCode ||
                record.sourceDeviceCode?.toLowerCase() === sourceDeviceCode.toLowerCase())
          )
          .forEach((record) => {
            try {
              collectPayloadFields(JSON.parse(record.standardPayloadJson), fields)
            } catch {
              // 单条历史消息异常时忽略，不影响其他候选字段。
            }
          })
      }

      deviceFieldOptions.value = [...fields.values()].sort((left, right) =>
        left.value.localeCompare(right.value)
      )
      candidatePaths.value = new Set([
        ...standardBSourceOptions.map((option) => option.value.toLowerCase()),
        ...deviceFieldOptions.value.map((option) => option.value.toLowerCase())
      ])
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  watch([getDeviceId, getDeviceCode, getSourceId, getSourceDeviceCode], load, { immediate: true })

  return {
    candidatePaths,
    deviceFieldOptions,
    loading,
    sourcePlaceholder,
    standardOptions: standardBSourceOptions,
    reload: load
  }
}
