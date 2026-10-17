import request from '@/utils/http'

export interface ClawBotAiConfiguration {
  enabled: boolean
  appCode: string
  mode: 'Chat' | 'Work'
  agentCode: string
  agentCodes: string[]
  validHours: number
  dailyLimit: number
  botDailyLimit: number
  sendIntervalSeconds: number
  timeoutSeconds: number
  limitMessage: string
}

export interface ClawBotAiState {
  configuration: ClawBotAiConfiguration
  hasSecret: boolean
  state: string
  authorizedUntilUtc?: string
  lockedUntilUtc?: string
  used: number
  remaining: number
  dailyLimited: boolean
  day: string
  conversationId?: number
  activeAgentCode?: string
}

export interface ClawBotAiOption {
  appCode: string
  displayName: string
  allResources: boolean
  agents: Array<{ agentCode: string; name: string }>
}

export interface ClawBotAiJob {
  id: number
  inboundId: number
  status: string
  kind: string
  agentCode?: string
  reply?: string
  error?: string
  conversationId?: number
  deliveryId?: number
  createTimeUtc: string
  updateTimeUtc: string
}

// 兼容旧项目部分接口仍使用 PascalCase 的序列化设置。
export function normalizeClawBotAi<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeClawBotAi(item)) as T
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.charAt(0).toLowerCase() + key.slice(1),
        normalizeClawBotAi(item)
      ])
    ) as T
  }
  return value as T
}

const baseUrl = '/api/wechat-clawbot/ai'

export async function fetchClawBotAiState() {
  const state = normalizeClawBotAi<ClawBotAiState>(await request.get({ url: baseUrl }))
  const configuration = state.configuration
  if (configuration && !Array.isArray(configuration.agentCodes)) {
    configuration.agentCodes =
      configuration.mode === 'Work' && configuration.agentCode ? [configuration.agentCode] : []
  }
  return state
}

export async function fetchClawBotAiOptions() {
  return normalizeClawBotAi<ClawBotAiOption[]>(await request.get({ url: `${baseUrl}/options` }))
}

export function saveClawBotAiConfiguration(data: ClawBotAiConfiguration) {
  return request.post({ url: baseUrl, data })
}

export async function resetClawBotAiSecret() {
  return normalizeClawBotAi<{ secret: string }>(
    await request.post({ url: `${baseUrl}/secret/reset` })
  )
}

export function disconnectClawBotAi() {
  return request.post({ url: `${baseUrl}/disconnect` })
}

export function resetClawBotAiContext() {
  return request.post({ url: `${baseUrl}/context/reset` })
}

export async function fetchClawBotAiJobs(current = 1, size = 20) {
  return normalizeClawBotAi<ClawBotAiJob[]>(
    await request.get({ url: `${baseUrl}/jobs`, params: { current, size } })
  )
}
