import request from '@/utils/http'

export interface SourceBinding {
  tenantMark: string
  deviceMark: string
  sourcePath: string
  fixedValue?: number | null
}

export interface ProcessField {
  code: string
  name: string
  unit: string
  source: SourceBinding
  fixedText?: string | null
  formula: string
  recalculateEverySample: boolean
  variables: Record<string, SourceBinding>
  constants: Record<string, number>
  functions: string[]
  precision: number
  comparisonPrecision: number
  lowerLimit?: number | null
  upperLimit?: number | null
  traceEnabled: boolean
  trendEnabled: boolean
  traceRawValue: boolean
  changeThreshold: number
  pushEnabled: boolean
  pushOnChange: boolean
  pushOnLimit: boolean
  pushOnRecovery: boolean
  recipientUserIds: string[]
}

export interface FlowNode {
  id: string
  name: string
  x: number
  y: number
  cardId?: number | null
}

export interface ProcessDefinition {
  id: number
  kind: 'Region' | 'Line' | 'Card'
  parentId: number
  code: string
  name: string
  sort: number
  enabled: boolean
  version: number
  layout: 'grid' | 'horizontal' | 'vertical' | 'free'
  columns: number
  fieldColumns: number
  width: number
  height: number
  panelLayout: 'tabs' | 'split'
  flowHeight: number
  trendHeight: number
  flowWidth: number
  trendWidth: number
  devices: SourceBinding[]
  fields: ProcessField[]
  flow: FlowNode[]
  edges: { from: string; to: string }[]
  blocks: { cardId: number; x: number; y: number; width: number; height: number }[]
}

export interface FieldRuntime {
  code: string
  rawJson: string
  valueJson: string
  state: 'Normal' | 'Upper' | 'Lower' | 'Unknown'
  error?: string | null
  dataTime?: string | null
  calculatedAt: string
}

export interface ProcessRuntime {
  line: ProcessDefinition
  cards: { definition: ProcessDefinition; fields: FieldRuntime[] }[]
  generatedAt: string
}

export interface ProcessSettings {
  formulaUseType: 'Personal' | 'Commercial'
  formulaSignature: string
  formulaTermsAccepted: boolean
  sampleIntervalSeconds: number
  retentionHours: number
  pushIntervalSeconds: number
}

export interface ProcessSource {
  tenantMark: string
  deviceMark: string
  modelMark?: string
  displayName: string
}

export interface SourceField {
  sourcePath: string
  fieldName: string
  unit?: string
  decimals?: number
  currentValue?: unknown
}

export interface HistoryRecord {
  id: number
  version: number
  eventType?: string
  previousJson?: string
  runtimeJson: string
  createTime: string
}

const base = '/api/process-board'

export function emptyBinding(): SourceBinding {
  return { tenantMark: '', deviceMark: '', sourcePath: '' }
}

export function emptyDefinition(kind: ProcessDefinition['kind'], parentId = 0): ProcessDefinition {
  return {
    id: 0,
    kind,
    parentId,
    code: '',
    name: '',
    sort: 0,
    enabled: true,
    version: 0,
    layout: 'grid',
    columns: 3,
    fieldColumns: 1,
    width: 360,
    height: 240,
    panelLayout: 'tabs',
    flowHeight: 270,
    trendHeight: 400,
    flowWidth: 0,
    trendWidth: 0,
    devices: [],
    fields: [],
    flow: [],
    edges: [],
    blocks: []
  }
}

/** 旧配置没有该属性时保留原单列展示；异常历史值也不参与布局计算。 */
export function normalizeFieldColumns(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6
    ? value
    : 1
}

export function emptyField(): ProcessField {
  return {
    code: '',
    name: '',
    unit: '',
    source: emptyBinding(),
    formula: '',
    recalculateEverySample: false,
    variables: {},
    constants: {},
    functions: [],
    precision: 2,
    comparisonPrecision: 6,
    traceEnabled: false,
    trendEnabled: false,
    traceRawValue: false,
    changeThreshold: 0,
    pushEnabled: false,
    pushOnChange: false,
    pushOnLimit: true,
    pushOnRecovery: false,
    recipientUserIds: []
  }
}

export const processApi = {
  definitions: () => request.get<ProcessDefinition[]>({ url: `${base}/definitions` }),
  save: (data: ProcessDefinition) =>
    request.post<ProcessDefinition>({ url: `${base}/definitions`, data }),
  runtime: (lineId: number) =>
    request.get<ProcessRuntime>({ url: `${base}/runtime`, params: { lineId } }),
  sources: (keyword = '') =>
    request.get<ProcessSource[]>({ url: `${base}/sources`, params: { keyword } }),
  fields: (source: SourceBinding) =>
    request.get<SourceField[]>({
      url: `${base}/source-fields`,
      params: { tenantMark: source.tenantMark, deviceMark: source.deviceMark }
    }),
  preview: (data: {
    formula: string
    variables: Record<string, number>
    constants: Record<string, number>
    functions: string[]
  }) =>
    request.post<{ success: boolean; value?: number; error?: string }>({
      url: `${base}/formula-preview`,
      data
    }),
  setting: () => request.get<ProcessSettings>({ url: `${base}/setting` }),
  saveSetting: (data: ProcessSettings) => request.post<boolean>({ url: `${base}/setting`, data }),
  recipients: () =>
    request.get<{ userId: string; userName: string; selectable: boolean; status: string }[]>({
      url: `${base}/recipients`
    }),
  history: (params: Record<string, unknown>) =>
    request.get<{ records: HistoryRecord[]; total: number }>({ url: `${base}/history`, params }),
  curve: (params: Record<string, unknown>) =>
    request.get<{
      bucketSeconds: number
      points: {
        time: string
        average: number | null
        minimum: number | null
        maximum: number | null
        count: number
      }[]
    }>({ url: `${base}/curve`, params }),
  pushTasks: (lineId: number, page = 1) =>
    request.get<{ records: Record<string, unknown>[]; total: number }>({
      url: `${base}/push-tasks`,
      params: { lineId, page }
    }),
  createExport: (data: Record<string, unknown>) =>
    request.post<{ id: number; status: string }>({ url: `${base}/exports`, data }),
  exportStatus: (id: number) =>
    request.get<{ id: number; status: string; error?: string; rowCount: number }>({
      url: `${base}/exports/${id}`
    })
}

export function parseValue(json: string | undefined): unknown {
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function formatValue(runtime: FieldRuntime | undefined, precision: number): string {
  const value = parseValue(runtime?.valueJson)
  if (value == null || runtime?.error) return '—'
  if (typeof value === 'number') return value.toFixed(precision)
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
