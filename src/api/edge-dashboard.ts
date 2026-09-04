import request from '@/utils/http'
import type { EdgePageResult } from '@/api/edge-gateway'
import { getApiUrl } from '@/utils/runtime-config'

export type DashboardRobotState = 'RUNNING' | 'IDLE' | 'FAULT' | 'STOPPED' | 'OFFLINE' | 'UNKNOWN'

export interface DashboardDataSourceModelOption {
  modelMark: string
  displayName: string
  deviceCount: number
  latestReceiveTime: string
}

export interface DashboardDataSourceOption {
  tenantMark: string
  deviceMark: string
  modelMark?: string
  dataOnline: boolean
  receiveTime: string
}

export interface DashboardSourceFieldOption {
  sourcePath: string
  fieldName: string
  valueType: string
  currentValue: unknown
}

export interface DashboardRobotField {
  id: number
  fieldCode: string
  sourcePath: string
  displayName: string
  purpose: string
  valueType: string
  formatType: string
  unit?: string
  decimals?: number
  mappingJson?: string
  sort: number
  enabled: boolean
}

export interface DashboardRobotStateRule {
  id: number
  ruleCode: string
  ruleName: string
  targetState: DashboardRobotState
  sourcePath: string
  operator: string
  compareValue?: string
  faultCode?: string
  faultReason?: string
  faultReasonPath?: string
  faultSeverity?: string
  priority: number
  enabled: boolean
}

export interface DashboardModelAlarmRule {
  id: number
  dashboardCode?: string
  modelMark?: string
  ruleCode: string
  ruleName: string
  sourcePath: string
  operator: string
  compareValue?: string
  faultCode?: string
  faultReason?: string
  faultReasonPath?: string
  faultSeverity?: string
  priority: number
  ruleVersion?: number
  enabled: boolean
}

export interface DashboardRobotBinding {
  id: number
  dashboardCode: string
  lineCode: string
  robotCode: string
  robotName: string
  tenantMark: string
  deviceMark: string
  onlineTimeoutSeconds: number
  businessDayStartHour: number
  ruleVersion?: number
  enabled: boolean
  fields: DashboardRobotField[]
  stateRules: DashboardRobotStateRule[]
  createTime?: string
  updateTime?: string
}

/** Three.js 设备组件的数据源绑定；仅展示实时字段，不参与机械手状态统计。 */
export interface DashboardDeviceBinding {
  id: number
  dashboardCode: string
  lineCode: string
  deviceCode: string
  deviceName: string
  tenantMark: string
  sourceDeviceMark: string
  onlineTimeoutSeconds: number
  enabled: boolean
  fields: DashboardRobotField[]
  createTime?: string
  updateTime?: string
}

export interface DashboardRuntimeField {
  fieldCode: string
  sourcePath: string
  displayName: string
  purpose: string
  rawValue: unknown
  displayValue: unknown
  unit?: string
  sort: number
}

export interface DashboardRobotRuntime {
  bindingId: number
  lineCode: string
  robotCode: string
  robotName: string
  tenantMark: string
  deviceMark: string
  status: DashboardRobotState
  dataOnline: boolean
  dataTime?: string
  receiveTime?: string
  fields: DashboardRuntimeField[]
}

export interface DashboardDeviceRuntime {
  bindingId: number
  lineCode: string
  deviceCode: string
  deviceName: string
  tenantMark: string
  sourceDeviceMark: string
  dataOnline: boolean
  dataTime?: string
  receiveTime?: string
  fields: DashboardRuntimeField[]
}

export interface DashboardLineRuntime {
  lineCode: string
  generatedAt: string
  robots: DashboardRobotRuntime[]
  devices: DashboardDeviceRuntime[]
}

export interface DashboardDailyStatistic {
  id: number
  robotBindingId: number
  statDate: string
  lineCode: string
  robotCode: string
  robotName: string
  runningSeconds: number
  idleSeconds: number
  faultSeconds: number
  stoppedSeconds: number
  offlineSeconds: number
  unknownSeconds: number
  faultCount: number
  sampleCount: number
  lastState: DashboardRobotState
  availabilityRate: number
  updateTime?: string
}

export interface DashboardFaultRecord {
  id: number
  lineCode: string
  robotCode: string
  robotName: string
  deviceMark: string
  faultCode: string
  faultReason: string
  severity: string
  rawValue?: string
  startTime: string
  lastSeenTime: string
  endTime?: string
  durationSeconds: number
  status: string
}

export interface DashboardFaultSummary {
  faultCode: string
  faultReason: string
  faultCount: number
  durationSeconds: number
}

export interface DashboardWidgetField {
  id: number
  fieldKey: string
  displayName: string
  role: string
  aggregate: string
  unit?: string
  decimals?: number
  color?: string
  width?: number
  sort: number
  visible: boolean
}

export interface DashboardWidget {
  id: number
  dashboardCode: string
  lineCode?: string
  widgetCode: string
  title: string
  widgetType: 'Table' | 'Pie' | 'Bar'
  dataSourceType: 'RealtimeRobot' | 'DailyStatistics' | 'FaultRecords' | 'FaultSummary'
  period: 'Day' | 'Week' | 'Month'
  refreshSeconds: number
  topN: number
  stacked: boolean
  orientation: 'Vertical' | 'Horizontal'
  configJson: string
  sort: number
  enabled: boolean
  fields: DashboardWidgetField[]
  createTime?: string
  updateTime?: string
}

export interface DashboardFieldCatalog {
  fieldKey: string
  displayName: string
  valueType: string
  dataSourceTypes: string[]
}

export interface DashboardLineConfig {
  id: number
  dashboardCode: string
  lineCode: string
  lineName: string
  area: string
  color: string
  enabled: boolean
  sort: number
  createTime?: string
  updateTime?: string
}

export interface DashboardLineConfigSaveData {
  id?: number
  dashboardCode: string
  lineCode: string
  lineName: string
  area: string
  color: string
  enabled: boolean
  sort: number
}

export interface DashboardExportSetting {
  id: number
  dashboardCode: string
  enabled: boolean
  exportTime: string
  exportDayOffset: 0 | 1
  updatedBy?: string
  lastScheduledRunDate?: string
  nextScheduledRunTime?: string
  createTime?: string
  updateTime?: string
}

export interface DashboardExportRecord {
  id: number
  dashboardCode: string
  lineCode: string
  lineName: string
  reportDate: string
  triggerType: string
  fileName: string
  fileSize: number
  status: 'Pending' | 'Success' | 'Failed'
  errorMessage?: string
  completeTime?: string
  createTime: string
}

export interface DashboardSceneLayout {
  id: number
  dashboardCode: string
  lineCode: string
  lineName: string
  layoutVersion: number
  revision: number
  layoutJson: string
  createTime?: string
  updateTime?: string
}

export interface DashboardSceneLayoutSaveData {
  dashboardCode: string
  lineCode: string
  lineName: string
  layoutVersion: number
  layoutJson: string
}

export interface DashboardLineCodeChangeData {
  dashboardCode: string
  oldLineCode: string
  newLineCode: string
  lineName: string
  layoutVersion: number
  layoutJson: string
}

export interface DashboardBootstrap {
  dashboardCode: string
  lines: DashboardLineConfig[]
  sceneLayouts: DashboardSceneLayout[]
}

type RawObject = Record<string, any>

const value = <T>(data: RawObject, key: string, fallback?: T): T => {
  const pascalKey = `${key.charAt(0).toUpperCase()}${key.slice(1)}`
  return (data?.[key] ?? data?.[pascalKey] ?? fallback) as T
}

const normalizeField = (data: RawObject): DashboardRobotField => ({
  id: Number(value(data, 'id', 0)),
  fieldCode: value(data, 'fieldCode', ''),
  sourcePath: value(data, 'sourcePath', ''),
  displayName: value(data, 'displayName', ''),
  purpose: value(data, 'purpose', 'DisplayValue'),
  valueType: value(data, 'valueType', 'String'),
  formatType: value(data, 'formatType', 'Direct'),
  unit: value(data, 'unit'),
  decimals: value(data, 'decimals'),
  mappingJson: value(data, 'mappingJson'),
  sort: Number(value(data, 'sort', 0)),
  enabled: Boolean(value(data, 'enabled', true))
})

const normalizeRule = (data: RawObject): DashboardRobotStateRule => ({
  id: Number(value(data, 'id', 0)),
  ruleCode: value(data, 'ruleCode', ''),
  ruleName: value(data, 'ruleName', ''),
  targetState: value(data, 'targetState', 'UNKNOWN'),
  sourcePath: value(data, 'sourcePath', ''),
  operator: value(data, 'operator', 'Equals'),
  compareValue: value(data, 'compareValue'),
  faultCode: value(data, 'faultCode'),
  faultReason: value(data, 'faultReason'),
  faultReasonPath: value(data, 'faultReasonPath'),
  faultSeverity: value(data, 'faultSeverity'),
  priority: Number(value(data, 'priority', 100)),
  enabled: Boolean(value(data, 'enabled', true))
})

const normalizeModelAlarmRule = (data: RawObject): DashboardModelAlarmRule => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode'),
  modelMark: value(data, 'modelMark'),
  ruleCode: value(data, 'ruleCode', ''),
  ruleName: value(data, 'ruleName', ''),
  sourcePath: value(data, 'sourcePath', ''),
  operator: value(data, 'operator', 'Equals'),
  compareValue: value(data, 'compareValue'),
  faultCode: value(data, 'faultCode'),
  faultReason: value(data, 'faultReason'),
  faultReasonPath: value(data, 'faultReasonPath'),
  faultSeverity: value(data, 'faultSeverity'),
  priority: Number(value(data, 'priority', 100)),
  ruleVersion: Number(value(data, 'ruleVersion', 0)),
  enabled: Boolean(value(data, 'enabled', true))
})

const normalizeBinding = (data: RawObject): DashboardRobotBinding => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode', 'production-dashboard'),
  lineCode: value(data, 'lineCode', ''),
  robotCode: value(data, 'robotCode', ''),
  robotName: value(data, 'robotName', ''),
  tenantMark: value(data, 'tenantMark', ''),
  deviceMark: value(data, 'deviceMark', ''),
  onlineTimeoutSeconds: Number(value(data, 'onlineTimeoutSeconds', 15)),
  businessDayStartHour: Number(value(data, 'businessDayStartHour', 0)),
  ruleVersion: Number(value(data, 'ruleVersion', 0)),
  enabled: Boolean(value(data, 'enabled', true)),
  fields: value<RawObject[]>(data, 'fields', []).map(normalizeField),
  stateRules: value<RawObject[]>(data, 'stateRules', []).map(normalizeRule),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizeDeviceBinding = (data: RawObject): DashboardDeviceBinding => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode', 'production-dashboard'),
  lineCode: value(data, 'lineCode', ''),
  deviceCode: value(data, 'deviceCode', ''),
  deviceName: value(data, 'deviceName', ''),
  tenantMark: value(data, 'tenantMark', ''),
  sourceDeviceMark: value(data, 'sourceDeviceMark', ''),
  onlineTimeoutSeconds: Number(value(data, 'onlineTimeoutSeconds', 15)),
  enabled: Boolean(value(data, 'enabled', true)),
  fields: value<RawObject[]>(data, 'fields', []).map(normalizeField),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizeRuntime = (data: RawObject): DashboardRobotRuntime => ({
  bindingId: Number(value(data, 'bindingId', 0)),
  lineCode: value(data, 'lineCode', ''),
  robotCode: value(data, 'robotCode', ''),
  robotName: value(data, 'robotName', ''),
  tenantMark: value(data, 'tenantMark', ''),
  deviceMark: value(data, 'deviceMark', ''),
  status: value(data, 'status', 'UNKNOWN'),
  dataOnline: Boolean(value(data, 'dataOnline', false)),
  dataTime: value(data, 'dataTime'),
  receiveTime: value(data, 'receiveTime'),
  fields: value<RawObject[]>(data, 'fields', []).map((item) => ({
    fieldCode: value(item, 'fieldCode', ''),
    sourcePath: value(item, 'sourcePath', ''),
    displayName: value(item, 'displayName', ''),
    purpose: value(item, 'purpose', ''),
    rawValue: value(item, 'rawValue'),
    displayValue: value(item, 'displayValue'),
    unit: value(item, 'unit'),
    sort: Number(value(item, 'sort', 0))
  }))
})

const normalizeDeviceRuntime = (data: RawObject): DashboardDeviceRuntime => ({
  bindingId: Number(value(data, 'bindingId', 0)),
  lineCode: value(data, 'lineCode', ''),
  deviceCode: value(data, 'deviceCode', ''),
  deviceName: value(data, 'deviceName', ''),
  tenantMark: value(data, 'tenantMark', ''),
  sourceDeviceMark: value(data, 'sourceDeviceMark', ''),
  dataOnline: Boolean(value(data, 'dataOnline', false)),
  dataTime: value(data, 'dataTime'),
  receiveTime: value(data, 'receiveTime'),
  fields: value<RawObject[]>(data, 'fields', []).map((item) => ({
    fieldCode: value(item, 'fieldCode', ''),
    sourcePath: value(item, 'sourcePath', ''),
    displayName: value(item, 'displayName', ''),
    purpose: value(item, 'purpose', ''),
    rawValue: value(item, 'rawValue'),
    displayValue: value(item, 'displayValue'),
    unit: value(item, 'unit'),
    sort: Number(value(item, 'sort', 0))
  }))
})

const normalizeDaily = (data: RawObject): DashboardDailyStatistic => ({
  id: Number(value(data, 'id', 0)),
  robotBindingId: Number(value(data, 'robotBindingId', 0)),
  statDate: value(data, 'statDate', ''),
  lineCode: value(data, 'lineCode', ''),
  robotCode: value(data, 'robotCode', ''),
  robotName: value(data, 'robotName', ''),
  runningSeconds: Number(value(data, 'runningSeconds', 0)),
  idleSeconds: Number(value(data, 'idleSeconds', 0)),
  faultSeconds: Number(value(data, 'faultSeconds', 0)),
  stoppedSeconds: Number(value(data, 'stoppedSeconds', 0)),
  offlineSeconds: Number(value(data, 'offlineSeconds', 0)),
  unknownSeconds: Number(value(data, 'unknownSeconds', 0)),
  faultCount: Number(value(data, 'faultCount', 0)),
  sampleCount: Number(value(data, 'sampleCount', 0)),
  lastState: value(data, 'lastState', 'UNKNOWN'),
  availabilityRate: Number(value(data, 'availabilityRate', 0)),
  updateTime: value(data, 'updateTime')
})

const normalizeFault = (data: RawObject): DashboardFaultRecord => ({
  id: Number(value(data, 'id', 0)),
  lineCode: value(data, 'lineCode', ''),
  robotCode: value(data, 'robotCode', ''),
  robotName: value(data, 'robotName', ''),
  deviceMark: value(data, 'deviceMark', ''),
  faultCode: value(data, 'faultCode', ''),
  faultReason: value(data, 'faultReason', ''),
  severity: value(data, 'severity', ''),
  rawValue: value(data, 'rawValue'),
  startTime: value(data, 'startTime', ''),
  lastSeenTime: value(data, 'lastSeenTime', ''),
  endTime: value(data, 'endTime'),
  durationSeconds: Number(value(data, 'durationSeconds', 0)),
  status: value(data, 'status', '')
})

const normalizeWidgetField = (data: RawObject): DashboardWidgetField => ({
  id: Number(value(data, 'id', 0)),
  fieldKey: value(data, 'fieldKey', ''),
  displayName: value(data, 'displayName', ''),
  role: value(data, 'role', 'Column'),
  aggregate: value(data, 'aggregate', 'None'),
  unit: value(data, 'unit'),
  decimals: value(data, 'decimals'),
  color: value(data, 'color'),
  width: value(data, 'width'),
  sort: Number(value(data, 'sort', 0)),
  visible: Boolean(value(data, 'visible', true))
})

const normalizeWidget = (data: RawObject): DashboardWidget => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode', 'production-dashboard'),
  lineCode: value(data, 'lineCode'),
  widgetCode: value(data, 'widgetCode', ''),
  title: value(data, 'title', ''),
  widgetType: value(data, 'widgetType', 'Table'),
  dataSourceType: value(data, 'dataSourceType', 'DailyStatistics'),
  period: value(data, 'period', 'Day'),
  refreshSeconds: Number(value(data, 'refreshSeconds', 30)),
  topN: Number(value(data, 'topN', 10)),
  stacked: Boolean(value(data, 'stacked', true)),
  orientation: value(data, 'orientation', 'Vertical'),
  configJson: value(data, 'configJson', '{}'),
  sort: Number(value(data, 'sort', 0)),
  enabled: Boolean(value(data, 'enabled', true)),
  fields: value<RawObject[]>(data, 'fields', []).map(normalizeWidgetField),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizeSceneLayout = (data: RawObject): DashboardSceneLayout => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode', 'production-dashboard'),
  lineCode: value(data, 'lineCode', ''),
  lineName: value(data, 'lineName', ''),
  layoutVersion: Number(value(data, 'layoutVersion', 1)),
  revision: Number(value(data, 'revision', 0)),
  layoutJson: value(data, 'layoutJson', '{}'),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizeLineConfig = (data: RawObject): DashboardLineConfig => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode', 'production-dashboard'),
  lineCode: value(data, 'lineCode', ''),
  lineName: value(data, 'lineName', ''),
  area: value(data, 'area', ''),
  color: value(data, 'color', '#55d5ff'),
  enabled: Boolean(value(data, 'enabled', true)),
  sort: Number(value(data, 'sort', 0)),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizePage = <T>(data: RawObject, mapper: (item: RawObject) => T): EdgePageResult<T> => ({
  records: value<RawObject[]>(data, 'records', []).map(mapper),
  current: Number(value(data, 'current', 1)),
  size: Number(value(data, 'size', 20)),
  total: Number(value(data, 'total', 0))
})

const normalizeExportSetting = (data: RawObject): DashboardExportSetting => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode', 'production-dashboard'),
  enabled: Boolean(value(data, 'enabled', false)),
  exportTime: value(data, 'exportTime', '00:10'),
  exportDayOffset: Number(value(data, 'exportDayOffset', 1)) === 0 ? 0 : 1,
  updatedBy: value(data, 'updatedBy'),
  lastScheduledRunDate: value(data, 'lastScheduledRunDate'),
  nextScheduledRunTime: value(data, 'nextScheduledRunTime'),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizeExportRecord = (data: RawObject): DashboardExportRecord => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode', ''),
  lineCode: value(data, 'lineCode', ''),
  lineName: value(data, 'lineName', ''),
  reportDate: value(data, 'reportDate', ''),
  triggerType: value(data, 'triggerType', ''),
  fileName: value(data, 'fileName', ''),
  fileSize: Number(value(data, 'fileSize', 0)),
  status: value(data, 'status', 'Pending'),
  errorMessage: value(data, 'errorMessage'),
  completeTime: value(data, 'completeTime'),
  createTime: value(data, 'createTime', '')
})

export async function fetchDashboardDataSources(keyword?: string) {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/data-sources',
    params: { keyword }
  })
  return data.map((item) => ({
    tenantMark: value(item, 'tenantMark', ''),
    deviceMark: value(item, 'deviceMark', ''),
    modelMark: value(item, 'modelMark'),
    dataOnline: Boolean(value(item, 'dataOnline', false)),
    receiveTime: value(item, 'receiveTime', '')
  })) as DashboardDataSourceOption[]
}

export async function fetchDashboardDataSourceModels() {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/data-source-models'
  })
  return data.map((item) => ({
    modelMark: value(item, 'modelMark', ''),
    displayName: value(item, 'displayName', ''),
    deviceCount: Number(value(item, 'deviceCount', 0)),
    latestReceiveTime: value(item, 'latestReceiveTime', '')
  })) as DashboardDataSourceModelOption[]
}

export async function fetchDashboardDataSourcesByModel(modelMark: string, keyword?: string) {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/data-sources/by-model',
    params: { modelMark, keyword }
  })
  return data.map((item) => ({
    tenantMark: value(item, 'tenantMark', ''),
    deviceMark: value(item, 'deviceMark', ''),
    modelMark: value(item, 'modelMark'),
    dataOnline: Boolean(value(item, 'dataOnline', false)),
    receiveTime: value(item, 'receiveTime', '')
  })) as DashboardDataSourceOption[]
}

export async function fetchDashboardSourceFields(tenantMark: string, deviceMark: string) {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/source-fields',
    params: { tenantMark, deviceMark }
  })
  return data.map((item) => ({
    sourcePath: value(item, 'sourcePath', ''),
    fieldName: value(item, 'fieldName', ''),
    valueType: value(item, 'valueType', 'String'),
    currentValue: value(item, 'currentValue')
  })) as DashboardSourceFieldOption[]
}

export async function fetchDashboardModelSourceFields(modelMark: string) {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/model-source-fields',
    params: { modelMark }
  })
  return data.map((item) => ({
    sourcePath: value(item, 'sourcePath', ''),
    fieldName: value(item, 'fieldName', ''),
    valueType: value(item, 'valueType', 'String'),
    currentValue: value(item, 'currentValue')
  })) as DashboardSourceFieldOption[]
}

export async function fetchDashboardModelAlarmRules(dashboardCode: string, modelMark: string) {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/model-alarm-rules',
    params: { dashboardCode, modelMark }
  })
  return data.map(normalizeModelAlarmRule)
}

export async function saveDashboardModelAlarmRules(
  dashboardCode: string,
  modelMark: string,
  rules: DashboardModelAlarmRule[]
) {
  const data = await request.post<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/model-alarm-rules',
    data: { dashboardCode, modelMark, rules }
  })
  return data.map(normalizeModelAlarmRule)
}

export async function fetchDashboardBindings(lineCode: string) {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/bindings',
    params: { lineCode }
  })
  return data.map(normalizeBinding)
}

export async function fetchDashboardDeviceBindings(lineCode: string) {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/device-bindings',
    params: { lineCode }
  })
  return data.map(normalizeDeviceBinding)
}

export async function saveDashboardBinding(data: DashboardRobotBinding) {
  const result = await request.post<RawObject>({
    url: '/api/EdgeGateway/dashboard/bindings',
    data
  })
  return normalizeBinding(result)
}

export async function saveDashboardDeviceBinding(data: DashboardDeviceBinding) {
  const result = await request.post<RawObject>({
    url: '/api/EdgeGateway/dashboard/device-bindings',
    data
  })
  return normalizeDeviceBinding(result)
}

export function deleteDashboardBinding(id: number) {
  return request.del({ url: `/api/EdgeGateway/dashboard/bindings/${id}` })
}

export function deleteDashboardDeviceBinding(id: number) {
  return request.del({ url: `/api/EdgeGateway/dashboard/device-bindings/${id}` })
}

const dashboardReadUrl = (path: string, publicAccess = false) =>
  `/api/EdgeGateway/dashboard${publicAccess ? '/public' : ''}/${path}`

export async function fetchDashboardRuntime(lineCode: string, publicAccess = false) {
  const data = await request.get<RawObject>({
    url: dashboardReadUrl('runtime', publicAccess),
    params: { lineCode },
    showErrorMessage: false
  })
  return {
    lineCode: value(data, 'lineCode', lineCode),
    generatedAt: value(data, 'generatedAt', ''),
    robots: value<RawObject[]>(data, 'robots', []).map(normalizeRuntime),
    devices: value<RawObject[]>(data, 'devices', []).map(normalizeDeviceRuntime)
  } as DashboardLineRuntime
}

export async function fetchDashboardDailyStatistics(params: RawObject, publicAccess = false) {
  const data = await request.get<RawObject>({
    url: dashboardReadUrl('daily-statistics', publicAccess),
    params,
    showErrorMessage: false
  })
  return normalizePage(data, normalizeDaily)
}

export async function fetchDashboardFaultRecords(params: RawObject, publicAccess = false) {
  const data = await request.get<RawObject>({
    url: dashboardReadUrl('fault-records', publicAccess),
    params,
    showErrorMessage: false
  })
  return normalizePage(data, normalizeFault)
}

export async function fetchDashboardFaultSummary(params: RawObject, publicAccess = false) {
  const data = await request.get<RawObject[]>({
    url: dashboardReadUrl('fault-summary', publicAccess),
    params,
    showErrorMessage: false
  })
  return data.map((item) => ({
    faultCode: value(item, 'faultCode', ''),
    faultReason: value(item, 'faultReason', ''),
    faultCount: Number(value(item, 'faultCount', 0)),
    durationSeconds: Number(value(item, 'durationSeconds', 0))
  })) as DashboardFaultSummary[]
}

export async function fetchDashboardWidgets(
  dashboardCode: string,
  lineCode?: string,
  publicAccess = false
) {
  const data = await request.get<RawObject[]>({
    url: dashboardReadUrl('widgets', publicAccess),
    params: { dashboardCode, lineCode },
    showErrorMessage: false
  })
  return data.map(normalizeWidget)
}

export async function saveDashboardWidget(data: DashboardWidget) {
  const result = await request.post<RawObject>({
    url: '/api/EdgeGateway/dashboard/widgets',
    data
  })
  return normalizeWidget(result)
}

export function deleteDashboardWidget(id: number) {
  return request.del({ url: `/api/EdgeGateway/dashboard/widgets/${id}` })
}

export async function fetchDashboardWidgetFieldCatalog() {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/widget-field-catalog'
  })
  return data.map((item) => ({
    fieldKey: value(item, 'fieldKey', ''),
    displayName: value(item, 'displayName', ''),
    valueType: value(item, 'valueType', 'String'),
    dataSourceTypes: value<string[]>(item, 'dataSourceTypes', [])
  })) as DashboardFieldCatalog[]
}

export async function fetchDashboardSceneLayout(
  dashboardCode: string,
  lineCode: string,
  publicAccess = false
): Promise<DashboardSceneLayout | null> {
  const data = await request.get<RawObject | null>({
    url: dashboardReadUrl('scene-layout', publicAccess),
    params: { dashboardCode, lineCode },
    showErrorMessage: false
  })
  return data ? normalizeSceneLayout(data) : null
}

/** 首次进入看板时一次读取线体列表和全部 Three.js 场景。 */
export async function fetchDashboardBootstrap(
  dashboardCode: string,
  publicAccess = false
): Promise<DashboardBootstrap> {
  const data = await request.get<RawObject>({
    url: dashboardReadUrl('bootstrap', publicAccess),
    params: { dashboardCode },
    showErrorMessage: false
  })
  return {
    dashboardCode: value(data, 'dashboardCode', dashboardCode),
    lines: value<RawObject[]>(data, 'lines', []).map(normalizeLineConfig),
    sceneLayouts: value<RawObject[]>(data, 'sceneLayouts', []).map(normalizeSceneLayout)
  }
}

/** 保存线体导航和展示元数据。 */
export async function saveDashboardLineConfig(
  data: DashboardLineConfigSaveData,
  showSuccessMessage = true
) {
  const result = await request.post<RawObject>({
    url: '/api/EdgeGateway/dashboard/lines',
    data,
    showSuccessMessage
  })
  return normalizeLineConfig(result)
}

/** 软删除线体主配置及对应场景。 */
export function deleteDashboardLineConfig(dashboardCode: string, lineCode: string) {
  return request.del({
    url: `/api/EdgeGateway/dashboard/lines/${encodeURIComponent(lineCode)}`,
    params: { dashboardCode },
    showSuccessMessage: true
  })
}

export async function saveDashboardSceneLayout(
  data: DashboardSceneLayoutSaveData,
  showSuccessMessage = true
) {
  const result = await request.post<RawObject>({
    url: '/api/EdgeGateway/dashboard/scene-layout',
    data,
    showSuccessMessage
  })
  return normalizeSceneLayout(result)
}

/** 修改线体编码，并由后端事务同步迁移该线体的全部关联配置。 */
export async function changeDashboardLineCode(data: DashboardLineCodeChangeData) {
  const result = await request.post<RawObject>({
    url: '/api/EdgeGateway/dashboard/line-code',
    data,
    showSuccessMessage: true
  })
  return normalizeSceneLayout(result)
}

/** 读取数据库中的看板日报定时导出配置。 */
export async function fetchDashboardExportSetting(dashboardCode: string) {
  const data = await request.get<RawObject>({
    url: '/api/EdgeGateway/dashboard/exports/setting',
    params: { dashboardCode }
  })
  return normalizeExportSetting(data)
}

/** 保存每日执行时间和导出日期口径。 */
export async function saveDashboardExportSetting(
  data: Pick<
    DashboardExportSetting,
    'dashboardCode' | 'enabled' | 'exportTime' | 'exportDayOffset' | 'updatedBy'
  >
) {
  const result = await request.post<RawObject>({
    url: '/api/EdgeGateway/dashboard/exports/setting',
    data,
    showSuccessMessage: true
  })
  return normalizeExportSetting(result)
}

/** 查询后端定时生成的分线体日报记录。 */
export async function fetchDashboardExportRecords(params: RawObject) {
  const data = await request.get<RawObject>({
    url: '/api/EdgeGateway/dashboard/exports/records',
    params
  })
  return normalizePage(data, normalizeExportRecord)
}

const buildDashboardExportUrl = (path: string, params?: Record<string, string>) => {
  const query = params ? `?${new URLSearchParams(params).toString()}` : ''
  return `${getApiUrl(`/api/EdgeGateway/dashboard/exports/${path}`)}${query}`
}

/** 当前选定线体的手动流式导出地址。 */
export function getDashboardLineExportUrl(
  dashboardCode: string,
  lineCode: string,
  reportDate: string
) {
  return buildDashboardExportUrl('line', { dashboardCode, lineCode, reportDate })
}

/** 后台已生成日报文件的流式下载地址。 */
export function getDashboardExportRecordFileUrl(id: number) {
  return buildDashboardExportUrl(`records/${id}/file`)
}
