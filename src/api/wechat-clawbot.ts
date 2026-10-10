import request from '@/utils/http'

export interface WeChatClawBotAccount {
  userId: string
  userName: string
  status: string
  bound: boolean
  mcpPushEnabled: boolean
  adminDisabled: boolean
  lastOnlineTime?: string
  lastSendTime?: string
  lastError?: string
  updateTime?: string
  hasConversationContext: boolean
  lastInboundTime?: string
}

export interface WeChatClawBotBinding {
  sessionId: number
  status: string
  qrcode?: string
  qrcodeUrl?: string
  expireTime?: string
  message?: string
}

export interface WeChatClawBotDelivery {
  id: number
  userId: string
  userName: string
  source: string
  externalTaskId?: string
  idempotencyKey?: string
  content: string
  status: string
  weChatMessageId?: string
  attemptCount: number
  durationMs: number
  errorMessage?: string
  sentTime?: string
  createTime: string
}

export interface WeChatClawBotPage<T> {
  records: T[]
  current: number
  size: number
  total: number
}

export interface WeChatClawBotInboundMessage {
  id: number
  weChatMessageId?: string
  senderId: string
  messageType: string
  content: string
  messageTime?: string
  receivedTime: string
}

type RawObject = Record<string, any>

const read = <T>(data: RawObject, key: string, fallback?: T): T => {
  const pascalKey = `${key.charAt(0).toUpperCase()}${key.slice(1)}`
  return (data[key] ?? data[pascalKey] ?? fallback) as T
}

const normalizeAccount = (data: RawObject): WeChatClawBotAccount => ({
  userId: read(data, 'userId', ''),
  userName: read(data, 'userName', ''),
  status: read(data, 'status', 'Unbound'),
  bound: Boolean(read(data, 'bound', false)),
  mcpPushEnabled: Boolean(read(data, 'mcpPushEnabled', true)),
  adminDisabled: Boolean(read(data, 'adminDisabled', false)),
  lastOnlineTime: read(data, 'lastOnlineTime'),
  lastSendTime: read(data, 'lastSendTime'),
  lastError: read(data, 'lastError'),
  updateTime: read(data, 'updateTime'),
  hasConversationContext: Boolean(read(data, 'hasConversationContext', false)),
  lastInboundTime: read(data, 'lastInboundTime')
})

const normalizeBinding = (data: RawObject): WeChatClawBotBinding => ({
  sessionId: Number(read(data, 'sessionId', 0)),
  status: read(data, 'status', 'Waiting'),
  qrcode: read(data, 'qrcode'),
  qrcodeUrl: read(data, 'qrcodeUrl'),
  expireTime: read(data, 'expireTime'),
  message: read(data, 'message')
})

const normalizeDelivery = (data: RawObject): WeChatClawBotDelivery => ({
  id: Number(read(data, 'id', 0)),
  userId: read(data, 'userId', ''),
  userName: read(data, 'userName', ''),
  source: read(data, 'source', ''),
  externalTaskId: read(data, 'externalTaskId'),
  idempotencyKey: read(data, 'idempotencyKey'),
  content: read(data, 'content', ''),
  status: read(data, 'status', ''),
  weChatMessageId: read(data, 'weChatMessageId'),
  attemptCount: Number(read(data, 'attemptCount', 0)),
  durationMs: Number(read(data, 'durationMs', 0)),
  errorMessage: read(data, 'errorMessage'),
  sentTime: read(data, 'sentTime'),
  createTime: read(data, 'createTime', '')
})

const normalizePage = <T>(
  data: RawObject,
  mapper: (source: RawObject) => T
): WeChatClawBotPage<T> => ({
  records: read<RawObject[]>(data, 'records', []).map(mapper),
  current: Number(read(data, 'current', 1)),
  size: Number(read(data, 'size', 20)),
  total: Number(read(data, 'total', 0))
})

export async function fetchMyClawBotAccount() {
  return normalizeAccount(
    await request.get<RawObject>({ url: '/api/wechat-clawbot/me', showErrorMessage: false })
  )
}

export async function createClawBotBinding() {
  return normalizeBinding(await request.post<RawObject>({ url: '/api/wechat-clawbot/binding' }))
}

export async function fetchClawBotBindingStatus(sessionId: number, signal?: AbortSignal) {
  return normalizeBinding(
    await request.get<RawObject>({
      url: `/api/wechat-clawbot/binding/${sessionId}`,
      timeout: 50000,
      signal,
      showErrorMessage: false
    })
  )
}

export async function verifyClawBotBinding(
  sessionId: number,
  verifyCode: string,
  signal?: AbortSignal
) {
  return normalizeBinding(
    await request.post<RawObject>({
      url: `/api/wechat-clawbot/binding/${sessionId}/verify`,
      data: { verifyCode },
      timeout: 50000,
      signal,
      showErrorMessage: false
    })
  )
}

export async function fetchMyClawBotMessages(params: { current: number; size: number }) {
  const data = await request.get<RawObject>({
    url: '/api/wechat-clawbot/me/messages',
    params,
    showErrorMessage: false
  })
  return normalizePage<WeChatClawBotInboundMessage>(data, (message) => ({
    id: Number(read(message, 'id', 0)),
    weChatMessageId: read(message, 'weChatMessageId'),
    senderId: read(message, 'senderId', ''),
    messageType: read(message, 'messageType', 'Other'),
    content: read(message, 'content', ''),
    messageTime: read(message, 'messageTime'),
    receivedTime: read(message, 'receivedTime', '')
  }))
}

export async function sendMyClawBotTest(content: string) {
  return normalizeDelivery(
    await request.post<RawObject>({
      url: '/api/wechat-clawbot/me/test-send',
      data: { content },
      timeout: 60000
    })
  )
}

export function unbindClawBot() {
  return request.del<boolean>({ url: '/api/wechat-clawbot/binding' })
}

export function setMyClawBotMcpPushEnabled(enabled: boolean) {
  return request.post<boolean>({
    url: '/api/wechat-clawbot/me/mcp-push-enabled',
    data: { enabled }
  })
}

export async function fetchMyClawBotDeliveries(params: RawObject) {
  return normalizePage(
    await request.get<RawObject>({
      url: '/api/wechat-clawbot/me/deliveries',
      params,
      showErrorMessage: false
    }),
    normalizeDelivery
  )
}

export async function fetchClawBotAccounts(params: RawObject) {
  return normalizePage(
    await request.get<RawObject>({ url: '/api/wechat-clawbot/accounts', params }),
    normalizeAccount
  )
}

export function setClawBotAdminDisabled(userId: string, disabled: boolean) {
  return request.post<boolean>({
    url: `/api/wechat-clawbot/accounts/${encodeURIComponent(userId)}/admin-disabled`,
    data: { disabled }
  })
}

export async function fetchClawBotDeliveries(params: RawObject) {
  return normalizePage(
    await request.get<RawObject>({ url: '/api/wechat-clawbot/deliveries', params }),
    normalizeDelivery
  )
}

export async function sendClawBotDebugMessage(data: { userId: string; content: string }) {
  return normalizeDelivery(
    await request.post<RawObject>({ url: '/api/wechat-clawbot/debug/send', data })
  )
}
