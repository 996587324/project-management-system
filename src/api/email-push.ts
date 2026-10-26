import request from '@/utils/http'

export interface EmailSetting {
  enabled: boolean
  host: string
  port: number
  security: 'StartTls' | 'SslOnConnect'
  userName: string
  fromAddress: string
  fromName: string
  timeoutSeconds: number
  intervalSeconds: number
  maxAttempts: number
  version: number
  hasPassword: boolean
  updateTime?: string
}

export type EmailSettingSave = Omit<EmailSetting, 'hasPassword' | 'updateTime'> & {
  password?: string
}

export interface EmailRecipient {
  userId: string
  userName: string
  nickName?: string
  email?: string
  available: boolean
}

export interface EmailPage<T> {
  records: T[]
  current: number
  size: number
  total: number
}

export interface EmailSubmission {
  recipientUserIds: string[]
  ccUserIds: string[]
  subject: string
  body: string
  idempotencyKey: string
  confirm: boolean
}

export interface EmailSubmissionResult {
  taskId: number
  status: string
  duplicate: boolean
  message: string
}

export interface EmailRecord {
  id: number
  taskId: number
  createdBy: string
  appCode: string
  source: string
  subject: string
  recipientUserId: string
  address: string
  recipientKind: string
  fromAddress?: string
  settingVersion?: number
  status: string
  attemptCount: number
  errorMessage?: string
  createTime: string
  sentTime?: string
}

export interface EmailRecordQuery {
  current: number
  size: number
  keyword?: string
  status?: string
  source?: string
  startTime?: string
  endTime?: string
}

// Match both existing PascalCase and camelCase backend serialization conventions.
function normalize<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((item) => normalize(item)) as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.charAt(0).toLowerCase() + key.slice(1),
        normalize(item)
      ])
    ) as T
  }
  return value as T
}

export function createEmailRequestKey() {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

export async function fetchEmailCapabilities() {
  return normalize<{ canConfigure: boolean }>(
    await request.get({ url: '/api/email-push/capabilities' })
  )
}

export async function fetchEmailSetting() {
  return normalize<EmailSetting>(await request.get({ url: '/api/email-push/setting' }))
}

export async function saveEmailSetting(data: EmailSettingSave) {
  return normalize<EmailSetting>(await request.post({ url: '/api/email-push/setting', data }))
}

export function testEmailConnection() {
  return request.post({ url: '/api/email-push/test-connection', timeout: 135000 })
}

export async function sendEmailTest(idempotencyKey: string) {
  return normalize<EmailSubmissionResult>(
    await request.post({
      url: '/api/email-push/test-send',
      data: { idempotencyKey, confirm: true }
    })
  )
}

export async function fetchEmailRecipients(params: {
  keyword?: string
  current: number
  size: number
}) {
  return normalize<EmailPage<EmailRecipient>>(
    await request.get({ url: '/api/email-push/recipients', params })
  )
}

export async function enqueueEmail(data: EmailSubmission) {
  return normalize<EmailSubmissionResult>(await request.post({ url: '/api/email-push/send', data }))
}

export async function fetchEmailRecords(params: EmailRecordQuery) {
  return normalize<EmailPage<EmailRecord>>(
    await request.get({ url: '/api/email-push/records', params })
  )
}

export function retryEmail(id: number, acknowledgeDuplicateRisk: boolean) {
  return request.post({
    url: `/api/email-push/records/${id}/retry`,
    data: { confirm: true, acknowledgeDuplicateRisk }
  })
}

export const emailStatusLabels: Record<string, string> = {
  Pending: '待发送',
  Processing: '发送中',
  Retrying: '等待重试',
  Sent: '邮件服务器已接受',
  Failed: '发送失败',
  Unknown: '结果待核实',
  Cancelled: '已取消'
}
