import request from '@/utils/http'

export interface PdaPage<T> {
  records: T[]
  current: number
  size: number
  total: number
}

export type PdaId = number | null

export interface PdaDevice {
  id: PdaId
  deviceCode: string
  deviceName: string
  model?: string
  scannerMode: string
  enabled: boolean
  boundUserId?: string
  lastOnlineTime?: string
  createTime: string
  updateTime?: string
}

export interface PdaDeviceSaveParams {
  id?: PdaId
  deviceCode: string
  deviceName: string
  model?: string
  scannerMode: string
  enabled: boolean
  boundUserId?: string
}

export interface PdaScanLog {
  id: PdaId
  scanId: string
  barcode: string
  deviceCode: string
  userId: string
  userName?: string
  businessType?: string
  success: boolean
  resultCode: string
  message: string
  resultData?: string
  durationMs: number
  traceId: string
  scanTime: string
}

export interface PdaBarcodeRule {
  id: PdaId
  ruleCode: string
  ruleName: string
  prefix?: string
  barcodeLength?: number
  pattern?: string
  businessType: string
  handlerCode: string
  validationSource: 'Local' | 'Remote'
  priority: number
  enabled: boolean
  version: number
  createTime: string
  updateTime?: string
}

export interface PdaBarcodeRuleSaveParams {
  id?: PdaId
  ruleCode: string
  ruleName: string
  prefix?: string
  barcodeLength?: number
  pattern?: string
  businessType: string
  handlerCode: string
  validationSource: 'Local' | 'Remote'
  priority: number
  enabled: boolean
}

type RawObject = Record<string, unknown>

function read<T>(source: RawObject, camelName: string, pascalName: string, fallback: T): T {
  return (source[camelName] ?? source[pascalName] ?? fallback) as T
}

function normalizeId(source: RawObject): PdaId {
  const rawId = source.id ?? source.Id
  if (rawId === null || rawId === undefined || rawId === '') return null
  const id = Number(rawId)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function requirePdaId(id: PdaId, resourceName: string): number {
  if (id === null || !Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`${resourceName} ID 缺失或无效，请刷新页面后重试`)
  }
  return id
}

function normalizePage<T>(
  source: RawObject,
  current: number,
  size: number,
  normalize: (item: RawObject) => T
): PdaPage<T> {
  const records = read<RawObject[]>(source, 'records', 'Records', [])
  return {
    records: records.map(normalize),
    current: Number(read(source, 'current', 'Current', current)),
    size: Number(read(source, 'size', 'Size', size)),
    total: Number(read(source, 'total', 'Total', 0))
  }
}

function normalizeDevice(source: RawObject): PdaDevice {
  return {
    id: normalizeId(source),
    deviceCode: String(read(source, 'deviceCode', 'DeviceCode', '')),
    deviceName: String(read(source, 'deviceName', 'DeviceName', '')),
    model: read<string | undefined>(source, 'model', 'Model', undefined),
    scannerMode: String(read(source, 'scannerMode', 'ScannerMode', 'Keyboard')),
    enabled: Boolean(read(source, 'enabled', 'Enabled', false)),
    boundUserId: read<string | undefined>(source, 'boundUserId', 'BoundUserId', undefined),
    lastOnlineTime: read<string | undefined>(source, 'lastOnlineTime', 'LastOnlineTime', undefined),
    createTime: String(read(source, 'createTime', 'CreateTime', '')),
    updateTime: read<string | undefined>(source, 'updateTime', 'UpdateTime', undefined)
  }
}

function normalizeScanLog(source: RawObject): PdaScanLog {
  return {
    id: normalizeId(source),
    scanId: String(read(source, 'scanId', 'ScanId', '')),
    barcode: String(read(source, 'barcode', 'Barcode', '')),
    deviceCode: String(read(source, 'deviceCode', 'DeviceCode', '')),
    userId: String(read(source, 'userId', 'UserId', '')),
    userName: read<string | undefined>(source, 'userName', 'UserName', undefined),
    businessType: read<string | undefined>(source, 'businessType', 'BusinessType', undefined),
    success: Boolean(read(source, 'success', 'Success', false)),
    resultCode: String(read(source, 'resultCode', 'ResultCode', '')),
    message: String(read(source, 'message', 'Message', '')),
    resultData: read<string | undefined>(source, 'resultData', 'ResultData', undefined),
    durationMs: Number(read(source, 'durationMs', 'DurationMs', 0)),
    traceId: String(read(source, 'traceId', 'TraceId', '')),
    scanTime: String(read(source, 'scanTime', 'ScanTime', ''))
  }
}

function normalizeRule(source: RawObject): PdaBarcodeRule {
  return {
    id: normalizeId(source),
    ruleCode: String(read(source, 'ruleCode', 'RuleCode', '')),
    ruleName: String(read(source, 'ruleName', 'RuleName', '')),
    prefix: read<string | undefined>(source, 'prefix', 'Prefix', undefined),
    barcodeLength: read<number | undefined>(source, 'barcodeLength', 'BarcodeLength', undefined),
    pattern: read<string | undefined>(source, 'pattern', 'Pattern', undefined),
    businessType: String(read(source, 'businessType', 'BusinessType', 'ProductBarcode')),
    handlerCode: String(read(source, 'handlerCode', 'HandlerCode', 'ProductBarcodeQuery')),
    validationSource:
      String(read(source, 'validationSource', 'ValidationSource', 'Local')).toLowerCase() === 'remote'
        ? 'Remote'
        : 'Local',
    priority: Number(read(source, 'priority', 'Priority', 100)),
    enabled: Boolean(read(source, 'enabled', 'Enabled', false)),
    version: Number(read(source, 'version', 'Version', 1)),
    createTime: String(read(source, 'createTime', 'CreateTime', '')),
    updateTime: read<string | undefined>(source, 'updateTime', 'UpdateTime', undefined)
  }
}

export async function fetchPdaDevicePage(params: {
  current: number
  size: number
  keyword?: string
  enabled?: boolean
}) {
  const data = await request.get<RawObject>({ url: '/api/pda/devices', params })
  return normalizePage(data, params.current, params.size, normalizeDevice)
}

export async function savePdaDevice(data: PdaDeviceSaveParams) {
  const result = await request.post<RawObject>({ url: '/api/pda/devices/save', data })
  return normalizeDevice(result)
}

export function deletePdaDevice(id: PdaId) {
  return request.post<number>({ url: `/api/pda/devices/delete/${requirePdaId(id, 'PDA 设备')}` })
}

export async function fetchPdaScanLogPage(params: {
  current: number
  size: number
  barcode?: string
  deviceCode?: string
  userId?: string
  success?: boolean
  startTime?: string
  endTime?: string
}) {
  const data = await request.get<RawObject>({ url: '/api/pda/scan/logs', params })
  return normalizePage(data, params.current, params.size, normalizeScanLog)
}

export async function fetchPdaScanLog(id: PdaId) {
  const data = await request.get<RawObject>({
    url: `/api/pda/scan/logs/${requirePdaId(id, '扫码记录')}`
  })
  return normalizeScanLog(data)
}

export async function fetchPdaBarcodeRulePage(params: {
  current: number
  size: number
  keyword?: string
  enabled?: boolean
}) {
  const data = await request.get<RawObject>({ url: '/api/pda/barcode-rules', params })
  return normalizePage(data, params.current, params.size, normalizeRule)
}

export async function savePdaBarcodeRule(data: PdaBarcodeRuleSaveParams) {
  const result = await request.post<RawObject>({ url: '/api/pda/barcode-rules/save', data })
  return normalizeRule(result)
}

export function deletePdaBarcodeRule(id: PdaId) {
  return request.post<number>({
    url: `/api/pda/barcode-rules/delete/${requirePdaId(id, '条码规则')}`
  })
}
