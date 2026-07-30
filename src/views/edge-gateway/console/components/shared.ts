import { fetchEdgeDevices, type EdgeDevice, type EdgePageResult } from '@/api/edge-gateway'

export type JsonDialogPayload = {
  content: string
  title: string
}

export type RefreshablePanel = {
  refresh: () => Promise<void>
}

export const emptyPage = <T>(): EdgePageResult<T> => ({
  records: [],
  current: 1,
  size: 20,
  total: 0
})

export const fetchDeviceOptions = async (): Promise<EdgeDevice[]> =>
  (await fetchEdgeDevices({ current: 1, size: 200 })).records

export const formatTime = (value?: string) => (value ? value.replace('T', ' ').slice(0, 19) : '-')

export const formatJson = (content: string) => {
  try {
    return JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    return content
  }
}

export const getObjectValue = (config: Record<string, unknown>, name: string) => {
  const entry = Object.entries(config).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return entry?.[1]
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const getDeviceName = (devices: EdgeDevice[], deviceId?: number) => {
  if (!deviceId) return '全局'
  return devices.find((item) => item.id === deviceId)?.deviceName || `设备 #${deviceId}`
}
