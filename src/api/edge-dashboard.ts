import request from '@/utils/http'
import type { EdgePageResult } from '@/api/edge-gateway'
import { getApiUrl } from '@/utils/runtime-config'
import { normalizeDeviceCardPush, type DeviceCardPushConfig } from '@/api/device-card-push'

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
  hasModelDisplayMapping: boolean
  formatType: 'Direct' | 'ValueMap' | 'UnixMilliseconds'
  unit?: string
  decimals?: number
  mappingJson?: string
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

/** 同一 modelMark 下复用的字段展示格式和值映射。 */
export interface DashboardModelFieldDisplayMapping {
  id: number
  dashboardCode?: string
  modelMark?: string
  sourcePath: string
  displayName: string
  valueType: string
  formatType: 'Direct' | 'ValueMap' | 'UnixMilliseconds'
  unit?: string
  decimals?: number
  mappingJson?: string
  sort: number
  enabled: boolean
  createTime?: string
  updateTime?: string
}

/** 同一 modelMark 内发生状态冲突时的裁决顺序，数值越小越优先。 */
export interface DashboardModelStatePriority {
  id: number
  dashboardCode?: string
  modelMark?: string
  state: 'FAULT' | 'IDLE' | 'STOPPED' | 'RUNNING' | 'UNKNOWN'
  priority: number
  createTime?: string
  updateTime?: string
}

export type DashboardModelConfigurationCsvType =
  'model-display' | 'model-fields' | 'model-state-priorities'

export interface DashboardModelConfigurationImportFailure {
  sheetName: string
  rowIndex: number
  key: string
  reason: string
}

export interface DashboardModelConfigurationImportResult {
  total: number
  successCount: number
  failedCount: number
  message: string
  failures: DashboardModelConfigurationImportFailure[]
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

/** Three.js 设备组件的数据源绑定；可选参与设备日运行统计。 */
export interface DashboardDeviceBinding {
  id: number
  dashboardCode: string
  lineCode: string
  deviceCode: string
  deviceName: string
  tenantMark: string
  sourceDeviceMark: string
  onlineTimeoutSeconds: number
  statisticsEnabled: boolean
  businessDayStartHour: number
  statusSourcePath?: string
  statusMappingJson?: string
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
  status: string
  currentAlarm?: string
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

/** 线体独立绑定的产量来源，不要求设备已配置到 Three.js 场景。 */
export interface DashboardLineOutputBinding {
  id: number
  dashboardCode: string
  lineCode: string
  tenantMark: string
  deviceMark: string
  sourcePath: string
  fieldName: string
  counterMode: 'Cumulative' | 'CurrentValue'
  unit?: string
  decimals: number
  enabled: boolean
  createTime?: string
  updateTime?: string
}

/** 接入侧模型标识在看板中的业务名称配置。 */
export interface DashboardModelDisplayMapping {
  id: number
  dashboardCode: string
  modelMark: string
  displayName: string
  equipmentType: 'Robot' | 'Device' | 'Machine' | 'Inspection'
  sort: number
  enabled: boolean
  createTime?: string
  updateTime?: string
}

export type DashboardDeviceCardStatus =
  'ONLINE' | 'OFFLINE' | 'FAULT' | 'ALARM' | 'WARNING' | string

export interface DashboardDeviceCardField {
  push?: DeviceCardPushConfig
  id: number
  fieldCode: string
  sourcePath: string
  displayName: string
  displayMode: 'Primary' | 'Tag' | 'Detail'
  valueType: string
  formatType: string
  unit?: string
  decimals?: number
  mappingJson?: string
  useModelDisplayMapping: boolean
  traceEnabled: boolean
  traceThreshold?: number
  alarmLowerLimit?: number
  alarmUpperLimit?: number
  aiAnalysisEnabled: boolean
  sort: number
  enabled: boolean
}

export interface DashboardDeviceCard {
  id: number
  dashboardCode: string
  lineCode: string
  cardCode: string
  cardName: string
  tenantMark: string
  deviceMark: string
  modelMark?: string
  statusSourcePath?: string
  statusMappingJson?: string
  onlineTimeoutSeconds: number
  sort: number
  enabled: boolean
  fields: DashboardDeviceCardField[]
  createTime?: string
  updateTime?: string
}

export interface DashboardDeviceCardBoardSetting {
  id: number
  dashboardCode: string
  lineCode: string
  columnCount: number
}

export interface DashboardDeviceCardRuntimeField {
  fieldCode: string
  displayName: string
  displayMode: 'Primary' | 'Tag' | 'Detail'
  rawValue: unknown
  displayValue: unknown
  unit?: string
  sort: number
}

export interface DashboardDeviceCardRuntime {
  cardId: number
  lineCode: string
  cardCode: string
  cardName: string
  deviceMark: string
  modelMark?: string
  dataOnline: boolean
  status: DashboardDeviceCardStatus
  dataTime?: string
  receiveTime?: string
  todayChangeCount: number
  fields: DashboardDeviceCardRuntimeField[]
}

export interface DashboardDeviceCardOverview {
  totalCount: number
  onlineCount: number
  offlineCount: number
  faultCount: number
  alarmCount: number
  todayChangedDeviceCount: number
  todayChangeCount: number
}

export interface DashboardDeviceCardBoardRuntime {
  lineCode?: string
  columnCount: number
  generatedAt: string
  overview: DashboardDeviceCardOverview
  cards: DashboardDeviceCardRuntime[]
}

export interface DashboardDeviceCardChangeRecord {
  id: number
  cardId: number
  lineCode: string
  deviceMark: string
  fieldCode: string
  displayName: string
  sourcePath: string
  oldValueJson?: string
  newValueJson: string
  messageId?: string
  dataTime: string
  receiveTime: string
}

export interface DashboardDeviceCardAlertRecord {
  id: number
  cardId: number
  lineCode: string
  deviceMark: string
  fieldCode: string
  displayName: string
  alertType: 'LowerExceeded' | 'UpperExceeded' | 'Recovered' | string
  numericValue: number
  alarmLowerLimit?: number
  alarmUpperLimit?: number
  pushStatus: 'Pending' | 'Processing' | 'Sent' | 'NotRequired' | string
  claimedBy?: string
  claimExpireTime?: string
  pushedTime?: string
  lastPushError?: string
  messageId?: string
  dataTime: string
  receiveTime: string
  createTime: string
}

export interface DashboardLineOutput {
  configured: boolean
  lineCode: string
  fieldName: string
  unit?: string
  decimals: number
  todayQuantity: number
  currentValue?: number
  latestIncrease?: number
  deviceMark?: string
  dataTime?: string
  dataOnline: boolean
}

/** 后台按线体定时生成、供看板只读展示的 AI 运行建议。 */
export interface DashboardAiInsight {
  id: number
  dashboardCode: string
  lineCode: string
  level: 'Info' | 'Warning' | 'Critical'
  content: string
  evidence?: string
  affectedRobots: string[]
  generatedAt: string
  expiresAt: string
}

export interface DashboardDailyStatistic {
  id: number
  robotBindingId: number
  componentType: 'Robot' | 'Device'
  componentBindingId: number
  componentCode: string
  componentName: string
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

/** 从既有线体复制可编辑配置到一条新线体；不会复制实时状态和历史记录。 */
export interface DashboardLineCopyData {
  dashboardCode: string
  sourceLineCode: string
  targetLineCode: string
  targetLineName: string
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

const normalizeModelFieldDisplayMapping = (data: RawObject): DashboardModelFieldDisplayMapping => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode'),
  modelMark: value(data, 'modelMark'),
  sourcePath: value(data, 'sourcePath', ''),
  displayName: value(data, 'displayName', ''),
  valueType: value(data, 'valueType', 'String'),
  formatType: value(data, 'formatType', 'Direct'),
  unit: value(data, 'unit'),
  decimals: value(data, 'decimals'),
  mappingJson: value(data, 'mappingJson'),
  sort: Number(value(data, 'sort', 0)),
  enabled: Boolean(value(data, 'enabled', true)),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizeModelStatePriority = (data: RawObject): DashboardModelStatePriority => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode'),
  modelMark: value(data, 'modelMark'),
  state: value(data, 'state', 'UNKNOWN') as DashboardModelStatePriority['state'],
  priority: Number(value(data, 'priority', 90)),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
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
  statisticsEnabled: Boolean(value(data, 'statisticsEnabled', false)),
  businessDayStartHour: Number(value(data, 'businessDayStartHour', 0)),
  statusSourcePath: value(data, 'statusSourcePath'),
  statusMappingJson: value(data, 'statusMappingJson'),
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

const normalizeAiInsight = (data: RawObject): DashboardAiInsight => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode', 'production-dashboard'),
  lineCode: value(data, 'lineCode', ''),
  level: value(data, 'level', 'Info'),
  content: value(data, 'content', ''),
  evidence: value(data, 'evidence'),
  affectedRobots: value<string[]>(data, 'affectedRobots', []),
  generatedAt: value(data, 'generatedAt', ''),
  expiresAt: value(data, 'expiresAt', '')
})

const normalizeDeviceRuntime = (data: RawObject): DashboardDeviceRuntime => ({
  bindingId: Number(value(data, 'bindingId', 0)),
  lineCode: value(data, 'lineCode', ''),
  deviceCode: value(data, 'deviceCode', ''),
  deviceName: value(data, 'deviceName', ''),
  tenantMark: value(data, 'tenantMark', ''),
  sourceDeviceMark: value(data, 'sourceDeviceMark', ''),
  status: value(data, 'status', value(data, 'dataOnline', false) ? 'RUNNING' : 'OFFLINE'),
  currentAlarm: value(data, 'currentAlarm'),
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
  componentType: value(data, 'componentType', 'Robot'),
  componentBindingId: Number(value(data, 'componentBindingId', value(data, 'robotBindingId', 0))),
  componentCode: value(data, 'componentCode', value(data, 'robotCode', '')),
  componentName: value(data, 'componentName', value(data, 'robotName', '')),
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

const normalizeLineOutputBinding = (data: RawObject): DashboardLineOutputBinding => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode', 'production-dashboard'),
  lineCode: value(data, 'lineCode', ''),
  tenantMark: value(data, 'tenantMark', ''),
  deviceMark: value(data, 'deviceMark', ''),
  sourcePath: value(data, 'sourcePath', ''),
  fieldName: value(data, 'fieldName', '累计产量'),
  counterMode:
    String(value(data, 'counterMode', 'Cumulative')) === 'CurrentValue'
      ? 'CurrentValue'
      : 'Cumulative',
  unit: value(data, 'unit'),
  decimals: Number(value(data, 'decimals', 0)),
  enabled: Boolean(value(data, 'enabled', true)),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizeModelDisplayMapping = (data: RawObject): DashboardModelDisplayMapping => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode', 'production-dashboard'),
  modelMark: value(data, 'modelMark', ''),
  displayName: value(data, 'displayName', ''),
  equipmentType: value(data, 'equipmentType', 'Device'),
  sort: Number(value(data, 'sort', 0)),
  enabled: Boolean(value(data, 'enabled', true)),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizeDeviceCardField = (data: RawObject): DashboardDeviceCardField => ({
  push: normalizeDeviceCardPush(value(data, 'push')),
  id: Number(value(data, 'id', 0)),
  fieldCode: value(data, 'fieldCode', ''),
  sourcePath: value(data, 'sourcePath', ''),
  displayName: value(data, 'displayName', ''),
  displayMode: value(data, 'displayMode', 'Detail'),
  valueType: value(data, 'valueType', 'String'),
  formatType: value(data, 'formatType', 'Direct'),
  unit: value(data, 'unit'),
  decimals: value(data, 'decimals'),
  mappingJson: value(data, 'mappingJson'),
  useModelDisplayMapping: Boolean(value(data, 'useModelDisplayMapping', true)),
  traceEnabled: Boolean(value(data, 'traceEnabled', false)),
  traceThreshold: value(data, 'traceThreshold'),
  alarmLowerLimit: value(data, 'alarmLowerLimit'),
  alarmUpperLimit: value(data, 'alarmUpperLimit'),
  aiAnalysisEnabled: Boolean(value(data, 'aiAnalysisEnabled', false)),
  sort: Number(value(data, 'sort', 0)),
  enabled: Boolean(value(data, 'enabled', true))
})

const normalizeDeviceCard = (data: RawObject): DashboardDeviceCard => ({
  id: Number(value(data, 'id', 0)),
  dashboardCode: value(data, 'dashboardCode', 'device-card-dashboard'),
  lineCode: value(data, 'lineCode', ''),
  cardCode: value(data, 'cardCode', ''),
  cardName: value(data, 'cardName', ''),
  tenantMark: value(data, 'tenantMark', ''),
  deviceMark: value(data, 'deviceMark', ''),
  modelMark: value(data, 'modelMark'),
  statusSourcePath: value(data, 'statusSourcePath'),
  statusMappingJson: value(data, 'statusMappingJson'),
  onlineTimeoutSeconds: Number(value(data, 'onlineTimeoutSeconds', 30)),
  sort: Number(value(data, 'sort', 0)),
  enabled: Boolean(value(data, 'enabled', true)),
  fields: value<RawObject[]>(data, 'fields', []).map(normalizeDeviceCardField),
  createTime: value(data, 'createTime'),
  updateTime: value(data, 'updateTime')
})

const normalizeDeviceCardRuntime = (data: RawObject): DashboardDeviceCardRuntime => ({
  cardId: Number(value(data, 'cardId', 0)),
  lineCode: value(data, 'lineCode', ''),
  cardCode: value(data, 'cardCode', ''),
  cardName: value(data, 'cardName', ''),
  deviceMark: value(data, 'deviceMark', ''),
  modelMark: value(data, 'modelMark'),
  dataOnline: Boolean(value(data, 'dataOnline', false)),
  status: value(data, 'status', 'OFFLINE'),
  dataTime: value(data, 'dataTime'),
  receiveTime: value(data, 'receiveTime'),
  todayChangeCount: Number(value(data, 'todayChangeCount', 0)),
  fields: value<RawObject[]>(data, 'fields', []).map((field) => ({
    fieldCode: value(field, 'fieldCode', ''),
    displayName: value(field, 'displayName', ''),
    displayMode: value(field, 'displayMode', 'Detail'),
    rawValue: value(field, 'rawValue'),
    displayValue: value(field, 'displayValue'),
    unit: value(field, 'unit'),
    sort: Number(value(field, 'sort', 0))
  }))
})

const normalizeDeviceCardOverview = (data: RawObject): DashboardDeviceCardOverview => ({
  totalCount: Number(value(data, 'totalCount', 0)),
  onlineCount: Number(value(data, 'onlineCount', 0)),
  offlineCount: Number(value(data, 'offlineCount', 0)),
  faultCount: Number(value(data, 'faultCount', 0)),
  alarmCount: Number(value(data, 'alarmCount', 0)),
  todayChangedDeviceCount: Number(value(data, 'todayChangedDeviceCount', 0)),
  todayChangeCount: Number(value(data, 'todayChangeCount', 0))
})

const normalizeDeviceCardChangeRecord = (data: RawObject): DashboardDeviceCardChangeRecord => ({
  id: Number(value(data, 'id', 0)),
  cardId: Number(value(data, 'cardId', 0)),
  lineCode: value(data, 'lineCode', ''),
  deviceMark: value(data, 'deviceMark', ''),
  fieldCode: value(data, 'fieldCode', ''),
  displayName: value(data, 'displayName', ''),
  sourcePath: value(data, 'sourcePath', ''),
  oldValueJson: value(data, 'oldValueJson'),
  newValueJson: value(data, 'newValueJson', ''),
  messageId: value(data, 'messageId'),
  dataTime: value(data, 'dataTime', ''),
  receiveTime: value(data, 'receiveTime', '')
})

const normalizeDeviceCardAlertRecord = (data: RawObject): DashboardDeviceCardAlertRecord => ({
  id: Number(value(data, 'id', 0)),
  cardId: Number(value(data, 'cardId', 0)),
  lineCode: value(data, 'lineCode', ''),
  deviceMark: value(data, 'deviceMark', ''),
  fieldCode: value(data, 'fieldCode', ''),
  displayName: value(data, 'displayName', ''),
  alertType: value(data, 'alertType', ''),
  numericValue: Number(value(data, 'numericValue', 0)),
  alarmLowerLimit: value(data, 'alarmLowerLimit'),
  alarmUpperLimit: value(data, 'alarmUpperLimit'),
  pushStatus: value(data, 'pushStatus', ''),
  claimedBy: value(data, 'claimedBy'),
  claimExpireTime: value(data, 'claimExpireTime'),
  pushedTime: value(data, 'pushedTime'),
  lastPushError: value(data, 'lastPushError'),
  messageId: value(data, 'messageId'),
  dataTime: value(data, 'dataTime', ''),
  receiveTime: value(data, 'receiveTime', ''),
  createTime: value(data, 'createTime', '')
})

const normalizeLineOutput = (data: RawObject, lineCode: string): DashboardLineOutput => ({
  configured: Boolean(value(data, 'configured', false)),
  lineCode: value(data, 'lineCode', lineCode),
  fieldName: value(data, 'fieldName', '当前产出'),
  unit: value(data, 'unit'),
  decimals: Number(value(data, 'decimals', 0)),
  todayQuantity: Number(value(data, 'todayQuantity', 0)),
  currentValue: value(data, 'currentValue'),
  latestIncrease: value(data, 'latestIncrease'),
  deviceMark: value(data, 'deviceMark'),
  dataTime: value(data, 'dataTime'),
  dataOnline: Boolean(value(data, 'dataOnline', false))
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
    currentValue: value(item, 'currentValue'),
    hasModelDisplayMapping: Boolean(value(item, 'hasModelDisplayMapping', false)),
    formatType: value(item, 'formatType', 'Direct'),
    unit: value(item, 'unit'),
    decimals: value(item, 'decimals'),
    mappingJson: value(item, 'mappingJson')
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

export async function fetchDashboardModelFieldDisplayMappings(
  dashboardCode: string,
  modelMark: string
) {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/model-field-display-mappings',
    params: { dashboardCode, modelMark }
  })
  return data.map(normalizeModelFieldDisplayMapping)
}

export async function saveDashboardModelFieldDisplayMappings(
  dashboardCode: string,
  modelMark: string,
  mappings: DashboardModelFieldDisplayMapping[]
) {
  const data = await request.post<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/model-field-display-mappings',
    data: { dashboardCode, modelMark, mappings }
  })
  return data.map(normalizeModelFieldDisplayMapping)
}

export async function fetchDashboardModelStatePriorities(dashboardCode: string, modelMark: string) {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/model-state-priorities',
    params: { dashboardCode, modelMark }
  })
  return data.map(normalizeModelStatePriority)
}

export async function saveDashboardModelStatePriorities(
  dashboardCode: string,
  modelMark: string,
  priorities: DashboardModelStatePriority[]
) {
  const data = await request.post<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/model-state-priorities',
    data: { dashboardCode, modelMark, priorities }
  })
  return data.map(normalizeModelStatePriority)
}

export function getDashboardModelConfigurationTemplateUrl(
  dashboardCode = 'production-dashboard',
  includeData = false
) {
  const query = new URLSearchParams({
    dashboardCode,
    includeData: String(includeData)
  })
  return `${getApiUrl('/api/EdgeGateway/dashboard/model-configuration-template')}?${query.toString()}`
}

export async function importDashboardModelConfiguration(formData: FormData) {
  const data = await request.post<RawObject>({
    url: '/api/EdgeGateway/dashboard/model-configuration-import',
    data: formData
  })
  return {
    total: Number(value(data, 'total', 0)),
    successCount: Number(value(data, 'successCount', 0)),
    failedCount: Number(value(data, 'failedCount', 0)),
    message: value(data, 'message', ''),
    failures: value<RawObject[]>(data, 'failures', []).map((item) => ({
      sheetName: value(item, 'sheetName', ''),
      rowIndex: Number(value(item, 'rowIndex', 0)),
      key: value(item, 'key', ''),
      reason: value(item, 'reason', '')
    }))
  } as DashboardModelConfigurationImportResult
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

export async function fetchDashboardModelDisplayMappings(dashboardCode = 'production-dashboard') {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/model-display-mappings',
    params: { dashboardCode }
  })
  return data.map(normalizeModelDisplayMapping)
}

export async function saveDashboardModelDisplayMapping(data: DashboardModelDisplayMapping) {
  const result = await request.post<RawObject>({
    url: '/api/EdgeGateway/dashboard/model-display-mappings',
    data
  })
  return normalizeModelDisplayMapping(result)
}

export function deleteDashboardModelDisplayMapping(id: number) {
  return request.del({ url: `/api/EdgeGateway/dashboard/model-display-mappings/${id}` })
}

export async function fetchDashboardDeviceCards(lineCode?: string) {
  const data = await request.get<RawObject[]>({
    url: '/api/EdgeGateway/dashboard/device-cards',
    params: { lineCode }
  })
  return data.map(normalizeDeviceCard)
}

export async function saveDashboardDeviceCard(data: DashboardDeviceCard) {
  const result = await request.post<RawObject>({
    url: '/api/EdgeGateway/dashboard/device-cards',
    data
  })
  return normalizeDeviceCard(result)
}

export function deleteDashboardDeviceCard(id: number) {
  return request.del({ url: `/api/EdgeGateway/dashboard/device-cards/${id}` })
}

export async function saveDashboardDeviceCardBoardSetting(data: DashboardDeviceCardBoardSetting) {
  const result = await request.post<RawObject>({
    url: '/api/EdgeGateway/dashboard/device-card-board-setting',
    data
  })
  return {
    id: Number(value(result, 'id', 0)),
    dashboardCode: value(result, 'dashboardCode', 'device-card-dashboard'),
    lineCode: value(result, 'lineCode', ''),
    columnCount: Number(value(result, 'columnCount', 4))
  } as DashboardDeviceCardBoardSetting
}

export async function fetchDashboardDeviceCardRuntime(lineCode?: string) {
  const data = await request.get<RawObject>({
    url: '/api/EdgeGateway/dashboard/device-card-runtime',
    params: { lineCode },
    showErrorMessage: false
  })
  return {
    lineCode: value(data, 'lineCode'),
    columnCount: Number(value(data, 'columnCount', 4)),
    generatedAt: value(data, 'generatedAt', ''),
    overview: normalizeDeviceCardOverview(value<RawObject>(data, 'overview', {})),
    cards: value<RawObject[]>(data, 'cards', []).map(normalizeDeviceCardRuntime)
  } as DashboardDeviceCardBoardRuntime
}

export async function fetchDashboardDeviceCardChangeRecords(params: Record<string, unknown>) {
  const data = await request.get<RawObject>({
    url: '/api/EdgeGateway/dashboard/device-card-change-records',
    params
  })
  return normalizePage(data, normalizeDeviceCardChangeRecord)
}

export async function fetchDashboardDeviceCardAlertRecords(params: Record<string, unknown>) {
  const data = await request.get<RawObject>({
    url: '/api/EdgeGateway/dashboard/device-card-alert-records',
    params
  })
  return normalizePage(data, normalizeDeviceCardAlertRecord)
}

export async function fetchDashboardLineOutput(lineCode: string, publicAccess = false) {
  const data = await request.get<RawObject>({
    url: dashboardReadUrl('line-output', publicAccess),
    params: { lineCode },
    showErrorMessage: false
  })
  return normalizeLineOutput(data, lineCode)
}

export async function fetchDashboardLineOutputBinding(lineCode: string) {
  const data = await request.get<RawObject | null>({
    url: '/api/EdgeGateway/dashboard/line-output-binding',
    params: { lineCode }
  })
  return data ? normalizeLineOutputBinding(data) : null
}

export async function saveDashboardLineOutputBinding(data: DashboardLineOutputBinding) {
  const result = await request.post<RawObject>({
    url: '/api/EdgeGateway/dashboard/line-output-binding',
    data
  })
  return normalizeLineOutputBinding(result)
}

/** 没有可靠数据、模型未配置或 AI 无结论时后端返回空，前端不显示建议条。 */
export async function fetchDashboardAiInsight(
  dashboardCode: string,
  lineCode: string,
  publicAccess = false
): Promise<DashboardAiInsight | null> {
  const data = await request.get<RawObject | null>({
    url: dashboardReadUrl('ai-insight', publicAccess),
    params: publicAccess ? { lineCode } : { dashboardCode, lineCode },
    showErrorMessage: false
  })
  return data ? normalizeAiInsight(data) : null
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

/** 复制场景、数据绑定、图表、产量及设备卡片配置到新线体。 */
export async function copyDashboardLineConfig(data: DashboardLineCopyData) {
  const result = await request.post<RawObject>({
    url: '/api/EdgeGateway/dashboard/lines/copy',
    data,
    showSuccessMessage: true
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
