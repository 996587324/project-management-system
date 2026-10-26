import request from '@/utils/http'
import { normalizeHourlyBoards } from './hourly-production-contract'

export interface HourlyBinding {
  code: string
  kind: 'Realtime' | 'Edge'
  sourceKey: string
  deviceKey: string
  sourceDeviceCode: string
  snPath: string
  timePath: string
  quantityPath: string
  filterPath: string
  filterValue: string
  reworkPath: string
  reworkValue: string
}

export interface HourlyProcess {
  code: string
  name: string
  rowCode: string
  enabled: boolean
  mode: 'DistinctSn' | 'Count' | 'Sum'
  reworkMinutes: number
  reworkRequiresDifferentHour: boolean
  includeReworkInOutput: boolean
  bindings: HourlyBinding[]
  targets: (number | null)[]
}

export interface HourlyLine {
  code: string
  name: string
  summaryProcessCode: string
  targets: (number | null)[]
  processes: HourlyProcess[]
}

export interface HourlyBoard {
  code: string
  name: string
  version: number
  published: boolean
  startTime: string
  endTime: string
  refreshSeconds: number
  aiEnabled: boolean
  aiIntervalMinutes: number
  aiAgentCode: string
  lines: HourlyLine[]
  push: {
    enabled: boolean
    delayMinutes: number
    catchUpHours: number
    lineCodes: string[]
    weChatUserIds: string[]
    emailUserIds: string[]
  }
}

export interface HourlyPoint {
  start: string
  end: string
  output: number | null
  rework: number | null
  target: number | null
  achievement: number | null
  status: 'Pending' | 'Running' | 'Unbound' | 'NoTarget' | 'Achieved' | 'BelowTarget'
}

export interface HourlyProcessRuntime {
  code: string
  name: string
  rowCode: string
  configured: boolean
  points: HourlyPoint[]
}

export interface HourlyLineRuntime {
  code: string
  name: string
  totalOutput: number
  summaryProcessName?: string
  achievedProcesses: number
  targetedProcesses: number
  latestCompleted?: HourlyPoint
  summaryPoints: HourlyPoint[]
  processes: HourlyProcessRuntime[]
}

export interface HourlyRuntime {
  code: string
  name: string
  version: number
  refreshSeconds: number
  productionDate: string
  serverTime: string
  dataUpdatedAt?: string
  advice?: string
  lines: HourlyLineRuntime[]
}

export interface HourlyReport {
  id: number
  boardCode: string
  slotStart: string
  configVersion: number
  snapshotJson: string
  createdAt: string
}

export interface HourlyDispatch {
  id: number
  reportId: number
  channel: string
  recipientId: string
  status: string
  attempts: number
  error?: string
  queueResultJson?: string
  createdAt: string
}

export interface HourlyDiagnostic {
  id: number
  sourceKey: string
  deviceKey: string
  error: string
  receivedAt: string
}

const base = '/api/hourly-production'
export const hourlyApi = {
  retryDispatch: (id: number) =>
    request.post({ url: `${base}/dispatches/${id}/retry`, data: { confirm: true } }),
  diagnostics: () => request.get<HourlyDiagnostic[]>({ url: `${base}/diagnostics` }),
  boards: async () => {
    const rows = await request.get<Parameters<typeof normalizeHourlyBoards>[0]>({
      url: `${base}/boards`
    })
    return normalizeHourlyBoards(rows)
  },
  definitions: () => request.get<HourlyBoard[]>({ url: `${base}/definitions` }),
  save: (data: HourlyBoard) => request.post<HourlyBoard>({ url: `${base}/definitions`, data }),
  runtime: (code: string, publicRead = false) =>
    request.get<HourlyRuntime>({
      url: `${base}${publicRead ? '/public' : ''}/runtime`,
      params: { code }
    }),
  sources: (kind: string, keyword = '') =>
    request.get<
      { sourceKey: string; deviceKey: string; sourceDeviceCode?: string; name: string }[]
    >({
      url: `${base}/sources`,
      params: { kind, keyword }
    }),
  fields: (sourceKey: string, deviceKey: string) =>
    request.get<{ sourcePath: string; displayName: string; fieldName: string }[]>({
      url: `${base}/fields`,
      params: { sourceKey, deviceKey }
    }),
  reports: (code: string, page = 1) =>
    request.get<HourlyReport[]>({ url: `${base}/reports`, params: { code, page } }),
  dispatches: (code: string, page = 1) =>
    request.get<HourlyDispatch[]>({ url: `${base}/dispatches`, params: { code, page } })
}

export function createProcess(index: number, name = '新工序'): HourlyProcess {
  return {
    code: `P${index}`,
    rowCode: `P${index}`,
    name,
    enabled: true,
    mode: 'DistinctSn',
    reworkMinutes: 30,
    reworkRequiresDifferentHour: true,
    includeReworkInOutput: false,
    bindings: [],
    targets: Array(12).fill(null)
  }
}

export function createBoard(): HourlyBoard {
  const names = ['气密', '抽真空', '注氟', '安规仪', '商检', '上压缩机', '电控']
  return {
    code: `hourly_${Date.now()}`,
    name: '小时产量与目标看板',
    version: 0,
    published: false,
    startTime: '08:00',
    endTime: '20:00',
    refreshSeconds: 10,
    aiEnabled: false,
    aiIntervalMinutes: 5,
    aiAgentCode: 'production-dashboard',
    lines: ['A', 'B'].map((code) => ({
      code,
      name: `${code}线`,
      summaryProcessCode: 'P5',
      targets: [],
      processes: names.map((name, i) => createProcess(i + 1, name))
    })),
    push: {
      enabled: false,
      delayMinutes: 2,
      catchUpHours: 2,
      lineCodes: [],
      weChatUserIds: [],
      emailUserIds: []
    }
  }
}

export function slotLabels(start: string, end: string): string[] {
  const minutes = (text: string) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3))
  const first = minutes(start)
  let last = minutes(end)
  if (!Number.isFinite(first) || !Number.isFinite(last)) return []
  if (last <= first) last += 1440
  const format = (value: number) =>
    `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
  const labels: string[] = []
  for (let time = first; time < last && labels.length < 24; time += 60) {
    labels.push(`${format(time)}–${format(Math.min(time + 60, last))}`)
  }
  return labels
}
