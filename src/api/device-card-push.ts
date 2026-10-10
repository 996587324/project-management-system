import request from '@/utils/http'

export interface DeviceCardPushConfig {
  enabled: boolean
  channel: 'WeChat' | 'ExternalMcp'
  recipientUserIds: string[]
  onChange: boolean
  onLimit: boolean
  onRecovery: boolean
  changeThreshold?: number
  changeIntervalSeconds: number
  messageTemplate?: string
}

export interface DeviceCardPushRecipient {
  userId: string
  userName: string
  selectable: boolean
  ready: boolean
  status: string
}

export interface DeviceCardPushTask {
  id: number
  cardId: number
  lineCode: string
  deviceMark: string
  fieldCode: string
  displayName: string
  userId: string
  userName?: string
  eventType: string
  content: string
  status: string
  attemptCount: number
  deliveryId?: number
  errorMessage?: string
  dataTime: string
  sentTime?: string
  createTime: string
}

const baseUrl = '/api/EdgeGateway/dashboard/device-card-push'
const read = <T>(data: Record<string, any>, key: string, fallback?: T): T =>
  (data[key] ?? data[`${key[0].toUpperCase()}${key.slice(1)}`] ?? fallback) as T

export async function fetchDeviceCardPushQueueSetting() {
  const data = await request.get<Record<string, any>>({ url: `${baseUrl}/queue-setting` })
  return { intervalSeconds: Number(read(data, 'intervalSeconds', 5)) }
}

export function saveDeviceCardPushQueueSetting(intervalSeconds: number) {
  return request.post<boolean>({
    url: `${baseUrl}/queue-setting`,
    data: { intervalSeconds }
  })
}

export const defaultDeviceCardPush = (): DeviceCardPushConfig => ({
  enabled: false,
  channel: 'WeChat',
  recipientUserIds: [],
  onChange: false,
  onLimit: true,
  onRecovery: false,
  changeIntervalSeconds: 300
})

export function normalizeDeviceCardPush(data?: Record<string, any>): DeviceCardPushConfig {
  if (!data) return defaultDeviceCardPush()
  return {
    enabled: Boolean(read(data, 'enabled', false)),
    channel: read(data, 'channel', 'WeChat'),
    recipientUserIds: read<string[]>(data, 'recipientUserIds', []),
    onChange: Boolean(read(data, 'onChange', false)),
    onLimit: Boolean(read(data, 'onLimit', true)),
    onRecovery: Boolean(read(data, 'onRecovery', false)),
    changeThreshold: read(data, 'changeThreshold'),
    changeIntervalSeconds: Number(read(data, 'changeIntervalSeconds', 300)),
    messageTemplate: read(data, 'messageTemplate')
  }
}

export async function fetchDeviceCardPushRecipients(): Promise<DeviceCardPushRecipient[]> {
  const rows = await request.get<Record<string, any>[]>({ url: `${baseUrl}/recipients` })
  return rows.map((row) => ({
    userId: read(row, 'userId', ''),
    userName: read(row, 'userName', ''),
    selectable: Boolean(read(row, 'selectable', false)),
    ready: Boolean(read(row, 'ready', false)),
    status: read(row, 'status', '')
  }))
}

export function queueDeviceCardPushTest(data: {
  cardId: number
  fieldCode: string
  recipientUserIds: string[]
  messageTemplate?: string
}) {
  return request.post<number>({ url: `${baseUrl}/test`, data })
}

export async function fetchDeviceCardPushTasks(params: Record<string, unknown>) {
  const data = await request.get<Record<string, any>>({ url: `${baseUrl}/tasks`, params })
  return {
    total: Number(read(data, 'total', 0)),
    records: read<Record<string, any>[]>(data, 'records', []).map((row): DeviceCardPushTask => ({
      id: Number(read(row, 'id', 0)),
      cardId: Number(read(row, 'cardId', 0)),
      lineCode: read(row, 'lineCode', ''),
      deviceMark: read(row, 'deviceMark', ''),
      fieldCode: read(row, 'fieldCode', ''),
      displayName: read(row, 'displayName', ''),
      userId: read(row, 'userId', ''),
      userName: read(row, 'userName'),
      eventType: read(row, 'eventType', ''),
      content: read(row, 'content', ''),
      status: read(row, 'status', ''),
      attemptCount: Number(read(row, 'attemptCount', 0)),
      deliveryId: read(row, 'deliveryId'),
      errorMessage: read(row, 'errorMessage'),
      dataTime: read(row, 'dataTime', ''),
      sentTime: read(row, 'sentTime'),
      createTime: read(row, 'createTime', '')
    }))
  }
}

export function retryDeviceCardPushTask(taskId: number) {
  return request.post<boolean>({ url: `${baseUrl}/tasks/${taskId}/retry` })
}
