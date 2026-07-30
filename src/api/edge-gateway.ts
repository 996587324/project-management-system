import request from '@/utils/http'

export interface EdgePageResult<T> {
  records: T[]
  current: number
  size: number
  total: number
}

export interface EdgeOverview {
  deviceCount: number
  onlineCount: number
  offlineCount: number
  disabledCount: number
  queueDepth: number
  failedCount: number
  activeAlarmCount: number
  successfulForwardCount: number
  uploadSuccessRate: number
  recentEvents: EdgeEvent[]
}

export interface EdgeDevice {
  id: number
  deviceCode: string
  deviceName: string
  siteName?: string
  configuredIpAddress?: string
  deviceType?: string
  groupName?: string
  enabled: boolean
  online: boolean
  lastHeartbeat?: string
  ipAddress?: string
  appVersion?: string
  cpuUsage: number
  memoryUsage: number
  queueDepth: number
  collectedCount: number
  uploadedCount: number
  lastError?: string
  createTime?: string
}

export type EdgeDeviceSave = Pick<
  EdgeDevice,
  | 'id'
  | 'deviceCode'
  | 'deviceName'
  | 'siteName'
  | 'configuredIpAddress'
  | 'deviceType'
  | 'groupName'
  | 'enabled'
>

export interface EdgeWebSocketSource {
  id: number
  deviceId: number
  sourceId: string
  sourceName: string
  endpoint: string
  subscriptionPayload?: string
  headersJson?: string
  dataType: string
  reconnectIntervalSeconds: number
  enabled: boolean
  version: number
  subscriptionVersion: number
  subscriptionDevices: EdgeWebSocketSubscriptionDevice[]
  createTime?: string
  updateTime?: string
}

export type EdgeWebSocketSourceSave = Omit<
  EdgeWebSocketSource,
  | 'deviceId'
  | 'version'
  | 'subscriptionVersion'
  | 'subscriptionDevices'
  | 'createTime'
  | 'updateTime'
>

export interface EdgeWebSocketSubscriptionParameter {
  id?: number
  parameterName: string
  parameterNameCn?: string
  dataType?: string
  enabled: boolean
  sort: number
}

export interface EdgeWebSocketSubscriptionDevice {
  id?: number
  deviceCode: string
  deviceName?: string
  enabled: boolean
  sort: number
  parameters: EdgeWebSocketSubscriptionParameter[]
}

export interface EdgeWebSocketReconnectResult {
  deviceCount: number
  connectionCount: number
}

export interface EdgeDeviceConfig {
  id: number
  deviceId: number
  version: number
  configName: string
  configJson: string
  isPublished: boolean
  createdBy?: string
  createTime?: string
  publishTime?: string
}

export interface EdgeRule {
  id: number
  deviceId?: number
  ruleCode: string
  ruleName: string
  ruleType: string
  ruleJson: string
  priority: number
  enabled: boolean
  createTime?: string
  updateTime?: string
}

export interface EdgeRuleVersion {
  id: number
  deviceId?: number
  version: number
  snapshotJson: string
  remark?: string
  publishedBy?: string
  publishTime?: string
}

export interface EdgeQueueMessage {
  id: number
  messageId: string
  deviceCode: string
  sourceId: string
  sourceDeviceCode?: string
  dataType: string
  status: string
  standardPayloadJson: string
  retryCount: number
  nextRetryTime?: string
  lastError?: string
  messageTime?: string
  createTime?: string
  uploadTime?: string
}

export interface EdgeUploadRecord {
  id: number
  queueId: number
  messageId: string
  deviceCode: string
  targetUrl?: string
  success: boolean
  statusCode?: number
  errorMessage?: string
  responseContent?: string
  responseContentTruncated: boolean
  durationMs: number
  createTime?: string
}

export interface EdgeEvent {
  id: number
  deviceCode: string
  level: string
  eventType: string
  message: string
  detailJson?: string
  createTime?: string
}

export type EdgeBTransportProtocol = 'HTTP' | 'MQTT'

export interface EdgeBMapping {
  id: number
  deviceId?: number
  payloadTemplateId?: number
  payloadTemplateName?: string
  mappingName: string
  protocol: EdgeBTransportProtocol
  targetUrl: string
  httpMethod: string
  mqttTopic?: string
  mqttClientId?: string
  mqttUsername?: string
  mqttPassword?: string
  hasMqttPassword?: boolean
  mqttQosLevel: number
  mqttRetain: boolean
  mappingJson: string
  headersJson?: string
  enabled: boolean
  createTime?: string
  updateTime?: string
}

export interface EdgeBPayloadTemplate {
  id: number
  templateCode: string
  templateName: string
  templateJson: string
  description?: string
  enabled: boolean
  createTime?: string
  updateTime?: string
}

export interface EdgeBAutoForwardSetting {
  enabled: boolean
  scanIntervalSeconds: number
  batchSize: number
  lastRunTime?: string
  lastSuccessTime?: string
  lastError?: string
  lastRequestedCount: number
  lastSuccessCount: number
  lastFailedCount: number
  updateTime?: string
}

type RawObject = Record<string, any>

const value = <T>(data: RawObject, key: string, fallback?: T): T => {
  const pascalKey = `${key.charAt(0).toUpperCase()}${key.slice(1)}`
  return (data[key] ?? data[pascalKey] ?? fallback) as T
}

const normalizeEvent = (data: RawObject): EdgeEvent => ({
  id: Number(value(data, 'id', 0)),
  deviceCode: value(data, 'deviceCode', ''),
  level: value(data, 'level', 'Info'),
  eventType: value(data, 'eventType', ''),
  message: value(data, 'message', ''),
  detailJson: value(data, 'detailJson'),
  createTime: value(data, 'createTime')
})

const normalizeDevice = (data: RawObject): EdgeDevice => ({
  id: Number(value(data, 'id', 0)),
  deviceCode: value(data, 'deviceCode', ''),
  deviceName: value(data, 'deviceName', ''),
  siteName: value(data, 'siteName'),
  configuredIpAddress: value(data, 'configuredIpAddress'),
  deviceType: value(data, 'deviceType'),
  groupName: value(data, 'groupName'),
  enabled: Boolean(value(data, 'enabled', true)),
  online: Boolean(value(data, 'online', false)),
  lastHeartbeat: value(data, 'lastHeartbeat'),
  ipAddress: value(data, 'ipAddress'),
  appVersion: value(data, 'appVersion'),
  cpuUsage: Number(value(data, 'cpuUsage', 0)),
  memoryUsage: Number(value(data, 'memoryUsage', 0)),
  queueDepth: Number(value(data, 'queueDepth', 0)),
  collectedCount: Number(value(data, 'collectedCount', 0)),
  uploadedCount: Number(value(data, 'uploadedCount', 0)),
  lastError: value(data, 'lastError'),
  createTime: value(data, 'createTime')
})

const normalizeConfig = (data: RawObject): EdgeDeviceConfig => ({
  id: Number(value(data, 'id', 0)),
  deviceId: Number(value(data, 'deviceId', 0)),
  version: Number(value(data, 'version', 0)),
  configName: value(data, 'configName', ''),
  configJson: value(data, 'configJson', '{}'),
  isPublished: Boolean(value(data, 'isPublished', false)),
  createdBy: value(data, 'createdBy'),
  createTime: value(data, 'createTime'),
  publishTime: value(data, 'publishTime')
})

const normalizeWebSocketSubscriptionParameter = (
  data: RawObject
): EdgeWebSocketSubscriptionParameter => ({
  id: Number(value(data, 'id', 0)) || undefined,
  parameterName: value(data, 'parameterName', ''),
  parameterNameCn: value(data, 'parameterNameCn'),
  dataType: value(data, 'dataType'),
  enabled: Boolean(value(data, 'enabled', true)),
  sort: Number(value(data, 'sort', 0))
})

const normalizeWebSocketSubscriptionDevice = (
  data: RawObject
): EdgeWebSocketSubscriptionDevice => ({
  id: Number(value(data, 'id', 0)) || undefined,
  deviceCode: value(data, 'deviceCode', ''),
  deviceName: value(data, 'deviceName'),
  enabled: Boolean(value(data, 'enabled', true)),
  sort: Number(value(data, 'sort', 0)),
  parameters: value<RawObject[]>(data, 'parameters', []).map(
    normalizeWebSocketSubscriptionParameter
  )
})

const normalizeWebSocketSource = (data: RawObject): EdgeWebSocketSource => ({
  id: Number(value(data, 'id', 0)),
  deviceId: Number(value(data, 'deviceId', 0)),
  sourceId: value(data, 'sourceId', ''),
  sourceName: value(data, 'sourceName', ''),
  endpoint: value(data, 'endpoint', ''),
  subscriptionPayload: value(data, 'subscriptionPayload'),
  headersJson: value(data, 'headersJson'),
  dataType: value(data, 'dataType', 'Telemetry'),
  reconnectIntervalSeconds: Number(value(data, 'reconnectIntervalSeconds', 5)),
  enabled: Boolean(value(data, 'enabled', true)),
  version: Number(value(data, 'version', 0)),
  subscriptionVersion: Number(value(data, 'subscriptionVersion', 0)),
  subscriptionDevices: value<RawObject[]>(data, 'subscriptionDevices', []).map(
    normalizeWebSocketSubscriptionDevice
  ),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizeWebSocketReconnectResult = (data: RawObject): EdgeWebSocketReconnectResult => ({
  deviceCount: Number(value(data, 'deviceCount', 0)),
  connectionCount: Number(value(data, 'connectionCount', 0))
})

const normalizeRule = (data: RawObject): EdgeRule => ({
  id: Number(value(data, 'id', 0)),
  deviceId: value(data, 'deviceId'),
  ruleCode: value(data, 'ruleCode', ''),
  ruleName: value(data, 'ruleName', ''),
  ruleType: value(data, 'ruleType', 'Filter'),
  ruleJson: value(data, 'ruleJson', '{}'),
  priority: Number(value(data, 'priority', 100)),
  enabled: Boolean(value(data, 'enabled', true)),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizeRuleVersion = (data: RawObject): EdgeRuleVersion => ({
  id: Number(value(data, 'id', 0)),
  deviceId: value(data, 'deviceId'),
  version: Number(value(data, 'version', 0)),
  snapshotJson: value(data, 'snapshotJson', '[]'),
  remark: value(data, 'remark'),
  publishedBy: value(data, 'publishedBy'),
  publishTime: value(data, 'publishTime')
})

const normalizeQueue = (data: RawObject): EdgeQueueMessage => ({
  id: Number(value(data, 'id', 0)),
  messageId: value(data, 'messageId', ''),
  deviceCode: value(data, 'deviceCode', ''),
  sourceId: value(data, 'sourceId', ''),
  sourceDeviceCode: value(data, 'sourceDeviceCode'),
  dataType: value(data, 'dataType', ''),
  status: value(data, 'status', 'Pending'),
  standardPayloadJson: value(data, 'standardPayloadJson', '{}'),
  retryCount: Number(value(data, 'retryCount', 0)),
  nextRetryTime: value(data, 'nextRetryTime'),
  lastError: value(data, 'lastError'),
  messageTime: value(data, 'messageTime'),
  createTime: value(data, 'createTime'),
  uploadTime: value(data, 'uploadTime')
})

const normalizeUploadRecord = (data: RawObject): EdgeUploadRecord => ({
  id: Number(value(data, 'id', 0)),
  queueId: Number(value(data, 'queueId', 0)),
  messageId: value(data, 'messageId', ''),
  deviceCode: value(data, 'deviceCode', ''),
  targetUrl: value(data, 'targetUrl'),
  success: Boolean(value(data, 'success', false)),
  statusCode: value(data, 'statusCode'),
  errorMessage: value(data, 'errorMessage'),
  responseContent: value(data, 'responseContent'),
  responseContentTruncated: Boolean(value(data, 'responseContentTruncated', false)),
  durationMs: Number(value(data, 'durationMs', 0)),
  createTime: value(data, 'createTime')
})

const normalizeBMapping = (data: RawObject): EdgeBMapping => ({
  id: Number(value(data, 'id', 0)),
  deviceId: value(data, 'deviceId'),
  payloadTemplateId: value(data, 'payloadTemplateId'),
  payloadTemplateName: value(data, 'payloadTemplateName'),
  mappingName: value(data, 'mappingName', ''),
  protocol: String(
    value(data, 'protocol', 'HTTP') || 'HTTP'
  ).toUpperCase() as EdgeBTransportProtocol,
  targetUrl: value(data, 'targetUrl', ''),
  httpMethod: value(data, 'httpMethod', 'POST'),
  mqttTopic: value(data, 'mqttTopic'),
  mqttClientId: value(data, 'mqttClientId'),
  mqttUsername: value(data, 'mqttUsername'),
  mqttPassword: undefined,
  hasMqttPassword: Boolean(value(data, 'hasMqttPassword', false)),
  mqttQosLevel: Number(value(data, 'mqttQosLevel', 1)),
  mqttRetain: Boolean(value(data, 'mqttRetain', false)),
  mappingJson: value(data, 'mappingJson', '{}'),
  headersJson: value(data, 'headersJson'),
  enabled: Boolean(value(data, 'enabled', true)),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizeBPayloadTemplate = (data: RawObject): EdgeBPayloadTemplate => ({
  id: Number(value(data, 'id', 0)),
  templateCode: value(data, 'templateCode', ''),
  templateName: value(data, 'templateName', ''),
  templateJson: value(data, 'templateJson', '{}'),
  description: value(data, 'description'),
  enabled: Boolean(value(data, 'enabled', true)),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizeBAutoForwardSetting = (data: RawObject): EdgeBAutoForwardSetting => ({
  enabled: Boolean(value(data, 'enabled', false)),
  scanIntervalSeconds: Number(value(data, 'scanIntervalSeconds', 5)),
  batchSize: Number(value(data, 'batchSize', 100)),
  lastRunTime: value(data, 'lastRunTime'),
  lastSuccessTime: value(data, 'lastSuccessTime'),
  lastError: value(data, 'lastError'),
  lastRequestedCount: Number(value(data, 'lastRequestedCount', 0)),
  lastSuccessCount: Number(value(data, 'lastSuccessCount', 0)),
  lastFailedCount: Number(value(data, 'lastFailedCount', 0)),
  updateTime: value(data, 'updateTime')
})

const normalizePage = <T>(data: RawObject, mapper: (item: RawObject) => T): EdgePageResult<T> => ({
  records: (value<RawObject[]>(data, 'records', []) || []).map(mapper),
  current: Number(value(data, 'current', 1)),
  size: Number(value(data, 'size', 20)),
  total: Number(value(data, 'total', 0))
})

export async function fetchEdgeOverview() {
  const data = await request.get<RawObject>({ url: '/api/EdgeGateway/overview' })
  return {
    deviceCount: Number(value(data, 'deviceCount', 0)),
    onlineCount: Number(value(data, 'onlineCount', 0)),
    offlineCount: Number(value(data, 'offlineCount', 0)),
    disabledCount: Number(value(data, 'disabledCount', 0)),
    queueDepth: Number(value(data, 'queueDepth', 0)),
    failedCount: Number(value(data, 'failedCount', 0)),
    activeAlarmCount: Number(value(data, 'activeAlarmCount', 0)),
    successfulForwardCount: Number(value(data, 'successfulForwardCount', 0)),
    uploadSuccessRate: Number(value(data, 'uploadSuccessRate', 0)),
    recentEvents: value<RawObject[]>(data, 'recentEvents', []).map(normalizeEvent)
  } as EdgeOverview
}

export async function fetchEdgeDevices(params: RawObject) {
  const data = await request.get<RawObject>({ url: '/api/EdgeGateway/devices', params })
  return normalizePage(data, normalizeDevice)
}

export function saveEdgeDevice(params: EdgeDeviceSave) {
  return request.post({ url: '/api/EdgeGateway/devices', params })
}

export function setEdgeDeviceEnabled(id: number, enabled: boolean) {
  return request.post({ url: `/api/EdgeGateway/devices/${id}/enabled`, params: { enabled } })
}

export function deleteEdgeDevice(id: number) {
  return request.post({ url: `/api/EdgeGateway/devices/${id}/delete` })
}

export async function fetchWebSocketSources(deviceId: number) {
  const data = await request.get<RawObject[]>({
    url: `/api/EdgeGateway/devices/${deviceId}/websocket-sources`
  })
  return data.map(normalizeWebSocketSource)
}

export async function saveWebSocketSource(deviceId: number, params: EdgeWebSocketSourceSave) {
  const data = await request.post<RawObject>({
    url: `/api/EdgeGateway/devices/${deviceId}/websocket-sources`,
    params
  })
  return Number(value(data, 'id', 0))
}

export async function fetchWebSocketSubscriptions(sourceId: number) {
  const data = await request.get<RawObject[]>({
    url: `/api/EdgeGateway/websocket-sources/${sourceId}/subscriptions`
  })
  return data.map(normalizeWebSocketSubscriptionDevice)
}

export async function saveWebSocketSubscriptions(
  sourceId: number,
  devices: EdgeWebSocketSubscriptionDevice[]
) {
  const data = await request.post<RawObject>({
    url: `/api/EdgeGateway/websocket-sources/${sourceId}/subscriptions`,
    params: { devices }
  })
  return Number(value(data, 'version', 0))
}

export function setWebSocketSourceEnabled(id: number, enabled: boolean) {
  return request.post({
    url: `/api/EdgeGateway/websocket-sources/${id}/enabled`,
    params: { enabled }
  })
}

export function deleteWebSocketSource(id: number) {
  return request.post({ url: `/api/EdgeGateway/websocket-sources/${id}/delete` })
}

export async function reconnectDeviceWebSocketSources(deviceId: number) {
  const data = await request.post<RawObject>({
    url: `/api/EdgeGateway/devices/${deviceId}/websocket-sources/reconnect`
  })
  return normalizeWebSocketReconnectResult(data)
}

export async function reconnectAllWebSocketSources() {
  const data = await request.post<RawObject>({
    url: '/api/EdgeGateway/websocket-sources/reconnect-all'
  })
  return normalizeWebSocketReconnectResult(data)
}

export async function fetchDeviceConfigs(deviceId: number) {
  const data = await request.get<RawObject[]>({
    url: `/api/EdgeGateway/devices/${deviceId}/configs`
  })
  return data.map(normalizeConfig)
}

export function saveDeviceConfig(
  deviceId: number,
  params: { configName: string; configJson: string }
) {
  return request.post({ url: `/api/EdgeGateway/devices/${deviceId}/configs`, params })
}

export function publishDeviceConfig(configId: number) {
  return request.post({ url: `/api/EdgeGateway/configs/${configId}/publish` })
}

export function deleteDeviceConfig(configId: number) {
  return request.post({ url: `/api/EdgeGateway/configs/${configId}/delete` })
}

export async function fetchEdgeRules(params: RawObject) {
  const data = await request.get<RawObject>({ url: '/api/EdgeGateway/rules', params })
  return normalizePage(data, normalizeRule)
}

export function saveEdgeRule(params: EdgeRule) {
  return request.post({ url: '/api/EdgeGateway/rules', params })
}

export function publishEdgeRules(params: { deviceId?: number; remark?: string }) {
  return request.post({ url: '/api/EdgeGateway/rules/publish', params })
}

export function rollbackEdgeRules(versionId: number) {
  return request.post({
    url: '/api/EdgeGateway/rules/rollback',
    params: { versionId, remark: `运行中心回滚版本 #${versionId}` }
  })
}

export async function fetchEdgeRuleVersions(deviceId?: number) {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/rule-versions',
    params: { deviceId }
  })
  return data.map(normalizeRuleVersion)
}

export async function fetchEdgeQueue(params: RawObject) {
  const data = await request.get<RawObject>({ url: '/api/EdgeGateway/queue', params })
  return normalizePage(data, normalizeQueue)
}

export async function fetchEdgeUploadRecords(params: RawObject) {
  const data = await request.get<RawObject>({
    url: '/api/EdgeGateway/upload-records',
    params
  })
  return normalizePage(data, normalizeUploadRecord)
}

export function retryEdgeQueue(ids: number[]) {
  return request.post<number>({ url: '/api/EdgeGateway/queue/retry', params: { ids } })
}

export function forwardEdgeQueue(ids: number[]) {
  return request.post<RawObject>({ url: '/api/EdgeGateway/queue/forward', params: { ids } })
}

export async function fetchEdgeEvents(params: RawObject) {
  const data = await request.get<RawObject>({ url: '/api/EdgeGateway/events', params })
  return normalizePage(data, normalizeEvent)
}

export async function fetchEdgeBMappings() {
  const data = await request.get<RawObject[]>({ url: '/api/EdgeGateway/b-mappings' })
  return data.map(normalizeBMapping)
}

export function saveEdgeBMapping(params: EdgeBMapping) {
  return request.post({ url: '/api/EdgeGateway/b-mappings', params })
}

export async function fetchEdgeBPayloadTemplates() {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/b-payload-templates'
  })
  return data.map(normalizeBPayloadTemplate)
}

export function saveEdgeBPayloadTemplate(params: EdgeBPayloadTemplate) {
  return request.post<{ id: number }>({
    url: '/api/EdgeGateway/b-payload-templates',
    params
  })
}

export function deleteEdgeBPayloadTemplate(id: number) {
  return request.post({
    url: `/api/EdgeGateway/b-payload-templates/${id}/delete`
  })
}

export async function fetchEdgeBAutoForwardSetting() {
  const data = await request.get<RawObject>({
    url: '/api/EdgeGateway/b-auto-forward-setting'
  })
  return normalizeBAutoForwardSetting(data)
}

export async function saveEdgeBAutoForwardSetting(
  params: Pick<EdgeBAutoForwardSetting, 'enabled' | 'scanIntervalSeconds' | 'batchSize'>
) {
  const data = await request.post<RawObject>({
    url: '/api/EdgeGateway/b-auto-forward-setting',
    params
  })
  return normalizeBAutoForwardSetting(data)
}
