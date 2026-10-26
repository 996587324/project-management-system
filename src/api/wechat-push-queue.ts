import request from '@/utils/http'
import { normalizeClawBotAi } from './wechat-clawbot-ai'
import type { EmailPage } from './email-push'

export interface WeChatPushQueueRecord {
  id: number
  recipientUserId: string
  content: string
  status: string
  attempt: number
  deliveryId?: number
  error?: string
  createTime: string
  sentTime?: string
}

const baseUrl = '/api/wechat-clawbot/push-queue'

export async function fetchWeChatPushQueueSetting() {
  return normalizeClawBotAi<{ intervalSeconds: number; canConfigure: boolean }>(
    await request.get({ url: `${baseUrl}/setting` })
  )
}

export function saveWeChatPushQueueSetting(intervalSeconds: number) {
  return request.post({ url: `${baseUrl}/setting`, data: { intervalSeconds } })
}

export async function fetchWeChatPushQueue(current: number, size: number, taskId?: number) {
  return normalizeClawBotAi<EmailPage<WeChatPushQueueRecord>>(
    await request.get({ url: `${baseUrl}/records`, params: { current, size, taskId } })
  )
}
