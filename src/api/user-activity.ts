import request from '@/utils/http'

export interface UserActivityOverview {
  onlineUserCount: number
  onlineSessionCount: number
  todayLoginCount: number
  todayOperationCount: number
  onlineUsers: UserActivityOnlineUser[]
}

export interface UserActivityOnlineUser {
  userId: string
  userName: string
  loginType: string
  loginTime: string
  lastActiveTime: string
  onlineSeconds: number
}

export interface UserLoginRecord {
  id: number
  userId?: string
  userName: string
  loginType: string
  success: boolean
  failureReason?: string
  clientIp?: string
  loginTime: string
  lastActiveTime: string
  logoutTime?: string
  onlineSeconds: number
  status: string
}

export interface UserOperationRecord {
  id: number
  userId?: string
  userName: string
  module: string
  action: string
  httpMethod: string
  requestPath: string
  target?: string
  success: boolean
  statusCode: number
  durationMs: number
  clientIp?: string
  createTime: string
}

export interface UserOperationEvent {
  module?: string
  action: string
  pagePath?: string
  target?: string
  operationType?: string
}

export interface UserActivityPage<T> {
  records: T[]
  current: number
  size: number
  total: number
}

type RawObject = Record<string, any>

const read = <T>(data: RawObject, key: string, fallback?: T): T => {
  const pascalKey = `${key.charAt(0).toUpperCase()}${key.slice(1)}`
  return (data[key] ?? data[pascalKey] ?? fallback) as T
}

const normalizeOnlineUser = (data: RawObject): UserActivityOnlineUser => ({
  userId: read(data, 'userId', ''),
  userName: read(data, 'userName', ''),
  loginType: read(data, 'loginType', ''),
  loginTime: read(data, 'loginTime', ''),
  lastActiveTime: read(data, 'lastActiveTime', ''),
  onlineSeconds: Number(read(data, 'onlineSeconds', 0))
})

const normalizeOverview = (data: RawObject): UserActivityOverview => ({
  onlineUserCount: Number(read(data, 'onlineUserCount', 0)),
  onlineSessionCount: Number(read(data, 'onlineSessionCount', 0)),
  todayLoginCount: Number(read(data, 'todayLoginCount', 0)),
  todayOperationCount: Number(read(data, 'todayOperationCount', 0)),
  onlineUsers: read<RawObject[]>(data, 'onlineUsers', []).map(normalizeOnlineUser)
})

const normalizeLogin = (data: RawObject): UserLoginRecord => ({
  id: Number(read(data, 'id', 0)),
  userId: read(data, 'userId'),
  userName: read(data, 'userName', ''),
  loginType: read(data, 'loginType', ''),
  success: Boolean(read(data, 'success', false)),
  failureReason: read(data, 'failureReason'),
  clientIp: read(data, 'clientIp'),
  loginTime: read(data, 'loginTime', ''),
  lastActiveTime: read(data, 'lastActiveTime', ''),
  logoutTime: read(data, 'logoutTime'),
  onlineSeconds: Number(read(data, 'onlineSeconds', 0)),
  status: read(data, 'status', '')
})

const normalizeOperation = (data: RawObject): UserOperationRecord => ({
  id: Number(read(data, 'id', 0)),
  userId: read(data, 'userId'),
  userName: read(data, 'userName', ''),
  module: read(data, 'module', ''),
  action: read(data, 'action', ''),
  httpMethod: read(data, 'httpMethod', ''),
  requestPath: read(data, 'requestPath', ''),
  target: read(data, 'target'),
  success: Boolean(read(data, 'success', false)),
  statusCode: Number(read(data, 'statusCode', 0)),
  durationMs: Number(read(data, 'durationMs', 0)),
  clientIp: read(data, 'clientIp'),
  createTime: read(data, 'createTime', '')
})

const normalizePage = <T>(
  data: RawObject,
  mapper: (item: RawObject) => T
): UserActivityPage<T> => ({
  records: read<RawObject[]>(data, 'records', []).map(mapper),
  current: Number(read(data, 'current', 1)),
  size: Number(read(data, 'size', 20)),
  total: Number(read(data, 'total', 0))
})

export async function fetchUserActivityOverview() {
  const data = await request.get<RawObject>({ url: '/api/user-activity/overview' })
  return normalizeOverview(data)
}

export async function fetchUserLoginRecords(params: RawObject) {
  const data = await request.get<RawObject>({ url: '/api/user-activity/login-records', params })
  return normalizePage(data, normalizeLogin)
}

export async function fetchUserOperationRecords(params: RawObject) {
  const data = await request.get<RawObject>({ url: '/api/user-activity/operation-records', params })
  return normalizePage(data, normalizeOperation)
}

/** 上报用户在页面中实际触发的业务操作，失败时静默，不影响原按钮行为。 */
export function recordUserOperation(data: UserOperationEvent) {
  return request.post<boolean>({
    url: '/api/user-activity/operation',
    data,
    showErrorMessage: false
  })
}
