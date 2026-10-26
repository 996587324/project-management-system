import request from '@/utils/http'
import { useUserStore } from '@/store/modules/user'
import { getWebSocketBaseUrl } from '@/utils/runtime-config'

type RawConversation = Api.Agent.Conversation & {
  Id?: number
  AgentCode?: string
  UserId?: string
  Title?: string
  ScopeProjectName?: string
  Mode?: string
  Status?: string
  CreateTime?: string
  UpdateTime?: string
}

type RawMessage = Api.Agent.Message & {
  Id?: number
  ConversationId?: number
  Role?: string
  Content?: string
  CreateTime?: string
}

type RawPlanStep = Api.Agent.PlanStep & {
  Sort?: number
  Title?: string
  Description?: string
  ToolName?: string
  RequiresConfirmation?: boolean
}

type RawToolCall = Api.Agent.ToolCall & {
  Id?: number
  ConversationId?: number
  AgentCode?: string
  ToolName?: string
  ToolTitle?: string
  RequestJson?: string
  ResponseJson?: string
  Status?: string
  RequiresConfirmation?: boolean
  Confirmed?: boolean
  CreateTime?: string
}

type RawToolDefinition = Api.Agent.ToolDefinition & {
  AgentCode?: string
  Name?: string
  Title?: string
  Description?: string
  IsWriteAction?: boolean
  RequiresConfirmation?: boolean
  Enabled?: boolean
}

type RawConversationList = Api.Agent.ConversationList & {
  Records?: RawConversation[]
  Current?: number
  Size?: number
  Total?: number
}

type RawConversationDetail = Api.Agent.ConversationDetail & {
  Conversation?: RawConversation
  Messages?: RawMessage[]
  ToolCalls?: RawToolCall[]
}

type RawAgentResponse = Api.Agent.Response & {
  ConversationId?: number
  Reply?: string
  Plan?: RawPlanStep[]
  ToolCalls?: RawToolCall[]
  RequiresConfirmation?: boolean
  Suggestions?: string[]
}

type RawEmailDraft = Api.Agent.EmailDraft & {
  Subject?: string
  Body?: string
  ConversationId?: number
  SourceToolCallId?: number
}

type RawEmailSendResult = Api.Agent.EmailSendResult & {
  TaskId?: number
  Status?: string
  Success?: boolean
  Message?: string
  ToEmails?: string[]
  CcEmails?: string[]
  SendTime?: string
}

function normalizeConversation(item: RawConversation): Api.Agent.Conversation {
  return {
    id: Number(item.id ?? item.Id ?? 0),
    agentCode: item.agentCode ?? item.AgentCode ?? 'project-management',
    userId: item.userId ?? item.UserId ?? '',
    title: item.title ?? item.Title ?? 'Agent 会话',
    scopeProjectName: item.scopeProjectName ?? item.ScopeProjectName,
    mode: item.mode ?? item.Mode ?? 'Online',
    status: item.status ?? item.Status ?? 'Active',
    createTime: item.createTime ?? item.CreateTime ?? '',
    updateTime: item.updateTime ?? item.UpdateTime
  }
}

function normalizeMessage(item: RawMessage): Api.Agent.Message {
  return {
    id: Number(item.id ?? item.Id ?? 0),
    conversationId: Number(item.conversationId ?? item.ConversationId ?? 0),
    role: item.role ?? item.Role ?? 'assistant',
    content: item.content ?? item.Content ?? '',
    createTime: item.createTime ?? item.CreateTime ?? ''
  }
}

function normalizePlanStep(item: RawPlanStep): Api.Agent.PlanStep {
  return {
    sort: Number(item.sort ?? item.Sort ?? 0),
    title: item.title ?? item.Title ?? '',
    description: item.description ?? item.Description ?? '',
    toolName: item.toolName ?? item.ToolName ?? '',
    requiresConfirmation: Boolean(item.requiresConfirmation ?? item.RequiresConfirmation ?? false)
  }
}

function normalizeToolCall(item: RawToolCall): Api.Agent.ToolCall {
  return {
    id: Number(item.id ?? item.Id ?? 0),
    conversationId: Number(item.conversationId ?? item.ConversationId ?? 0),
    agentCode: item.agentCode ?? item.AgentCode ?? 'project-management',
    toolName: item.toolName ?? item.ToolName ?? '',
    toolTitle: item.toolTitle ?? item.ToolTitle ?? '',
    requestJson: item.requestJson ?? item.RequestJson ?? '',
    responseJson: item.responseJson ?? item.ResponseJson ?? '',
    status: item.status ?? item.Status ?? '',
    requiresConfirmation: Boolean(item.requiresConfirmation ?? item.RequiresConfirmation ?? false),
    confirmed: Boolean(item.confirmed ?? item.Confirmed ?? false),
    createTime: item.createTime ?? item.CreateTime ?? ''
  }
}

function normalizeToolDefinition(item: RawToolDefinition): Api.Agent.ToolDefinition {
  return {
    agentCode: item.agentCode ?? item.AgentCode ?? 'project-management',
    name: item.name ?? item.Name ?? '',
    title: item.title ?? item.Title ?? '',
    description: item.description ?? item.Description ?? '',
    isWriteAction: Boolean(item.isWriteAction ?? item.IsWriteAction ?? false),
    requiresConfirmation: Boolean(item.requiresConfirmation ?? item.RequiresConfirmation ?? false),
    enabled: Boolean(item.enabled ?? item.Enabled ?? true)
  }
}

function normalizeConversationList(data: RawConversationList): Api.Agent.ConversationList {
  return {
    records: (data.records ?? data.Records ?? []).map(normalizeConversation),
    current: Number(data.current ?? data.Current ?? 1),
    size: Number(data.size ?? data.Size ?? 20),
    total: Number(data.total ?? data.Total ?? 0)
  }
}

function normalizeConversationDetail(data: RawConversationDetail): Api.Agent.ConversationDetail {
  return {
    conversation: normalizeConversation(
      (data.conversation ?? data.Conversation ?? {}) as RawConversation
    ),
    messages: (data.messages ?? data.Messages ?? []).map(normalizeMessage),
    toolCalls: (data.toolCalls ?? data.ToolCalls ?? []).map(normalizeToolCall)
  }
}

function normalizeAgentResponse(data: RawAgentResponse): Api.Agent.Response {
  return {
    conversationId: Number(data.conversationId ?? data.ConversationId ?? 0),
    reply: data.reply ?? data.Reply ?? '',
    plan: (data.plan ?? data.Plan ?? []).map(normalizePlanStep),
    toolCalls: (data.toolCalls ?? data.ToolCalls ?? []).map(normalizeToolCall),
    requiresConfirmation: Boolean(data.requiresConfirmation ?? data.RequiresConfirmation ?? false),
    suggestions: data.suggestions ?? data.Suggestions ?? []
  }
}

function normalizeEmailDraft(data: RawEmailDraft): Api.Agent.EmailDraft {
  return {
    subject: data.subject ?? data.Subject ?? '',
    body: data.body ?? data.Body ?? '',
    conversationId: data.conversationId ?? data.ConversationId,
    sourceToolCallId: data.sourceToolCallId ?? data.SourceToolCallId
  }
}

function normalizeEmailSendResult(data: RawEmailSendResult): Api.Agent.EmailSendResult {
  return {
    taskId: Number(data.taskId ?? data.TaskId ?? 0),
    status: data.status ?? data.Status ?? 'Pending',
    success: Boolean(data.success ?? data.Success ?? false),
    message: data.message ?? data.Message ?? '',
    toEmails: data.toEmails ?? data.ToEmails ?? [],
    ccEmails: data.ccEmails ?? data.CcEmails ?? [],
    sendTime: data.sendTime ?? data.SendTime ?? ''
  }
}

export async function fetchAgentConversations(params?: {
  userId?: number | string
  current?: number
  size?: number
  agentCode?: string
}) {
  const data = await request.get<RawConversationList>({
    url: '/api/Agent/conversations',
    params
  })
  return normalizeConversationList(data)
}

export async function fetchAgentConversation(id: number | string) {
  const data = await request.get<RawConversationDetail>({
    url: `/api/Agent/conversations/${id}`
  })
  return normalizeConversationDetail(data)
}

export async function createAgentConversation(params: Api.Agent.StartRequest) {
  const data = await request.post<RawConversation>({
    url: '/api/Agent/conversations',
    data: params
  })
  return normalizeConversation(data)
}

export function deleteAgentConversation(params: { id: number | string; userId?: number | string }) {
  return request.post<boolean>({
    url: '/api/Agent/conversations/delete',
    data: params
  })
}

type AgentSocketEvent = {
  type: 'accepted' | 'progress' | 'heartbeat' | 'chunk' | 'completed' | 'error' | 'pong'
  requestId?: string
  stage?: string
  message?: string
  chunk?: string
  conversationId?: number
  data?: RawAgentResponse
}

type AgentStreamCallbacks = {
  onAccepted?: (progress: Api.Agent.StreamProgress) => void
  onProgress?: (progress: Api.Agent.StreamProgress) => void
  onChunk?: (chunk: string) => void
}

type PendingAgentRequest = AgentStreamCallbacks & {
  resolve: (response: Api.Agent.Response) => void
  reject: (reason: Error) => void
}

let agentSocket: WebSocket | null = null
let agentSocketToken = ''
let agentSocketReady: Promise<WebSocket> | null = null
const pendingAgentRequests = new Map<string, PendingAgentRequest>()

function getAgentAccessToken() {
  const token = useUserStore().accessToken || ''
  return token.startsWith('Bearer ') ? token.slice(7) : token
}

function createAgentSocketUrl(token: string) {
  const webSocketBase = getWebSocketBaseUrl()
  const base = webSocketBase || '/'
  const endpoint = `${base.replace(/\/$/, '')}/ws/agent`
  const url = new URL(endpoint, window.location.origin)
  if (url.protocol === 'https:') url.protocol = 'wss:'
  if (url.protocol === 'http:') url.protocol = 'ws:'
  url.searchParams.set('access_token', token)
  return url.toString()
}

function rejectPendingAgentRequests(message: string) {
  const error = new Error(message)
  pendingAgentRequests.forEach((pending) => pending.reject(error))
  pendingAgentRequests.clear()
}

export function closeAgentSocket() {
  const socket = agentSocket
  agentSocket = null
  agentSocketReady = null
  agentSocketToken = ''
  rejectPendingAgentRequests('Agent WebSocket 已关闭')

  if (socket && socket.readyState < WebSocket.CLOSING) {
    socket.close(1000, 'Authentication changed')
  }
}

function handleAgentSocketEvent(event: MessageEvent<string>) {
  let payload: AgentSocketEvent
  try {
    payload = JSON.parse(event.data) as AgentSocketEvent
  } catch {
    return
  }

  if (!payload.requestId) return
  const pending = pendingAgentRequests.get(payload.requestId)
  if (!pending) return

  const progress = {
    stage: payload.stage || payload.type,
    message: payload.message || 'Agent 正在处理',
    conversationId: payload.conversationId
  }

  if (payload.type === 'accepted') {
    pending.onAccepted?.(progress)
    return
  }
  if (payload.type === 'progress' || payload.type === 'heartbeat') {
    pending.onProgress?.(progress)
    return
  }
  if (payload.type === 'chunk') {
    if (payload.chunk) pending.onChunk?.(payload.chunk)
    return
  }
  if (payload.type === 'completed') {
    pendingAgentRequests.delete(payload.requestId)
    pending.resolve(normalizeAgentResponse(payload.data || ({} as RawAgentResponse)))
    return
  }
  if (payload.type === 'error') {
    pendingAgentRequests.delete(payload.requestId)
    pending.reject(new Error(payload.message || 'Agent 处理失败'))
  }
}

async function getAgentSocket() {
  const token = getAgentAccessToken()
  if (!token) throw new Error('登录状态已失效，请重新登录')

  if (agentSocket?.readyState === WebSocket.OPEN && agentSocketToken === token) {
    return agentSocket
  }
  if (agentSocketReady && agentSocketToken === token) return agentSocketReady

  if (agentSocket) closeAgentSocket()

  agentSocketToken = token
  const ready = new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(createAgentSocketUrl(token))
    agentSocket = socket
    const connectionTimeout = window.setTimeout(() => {
      socket.close()
      reject(new Error('Agent WebSocket 连接超时'))
    }, 10000)

    socket.onopen = () => {
      window.clearTimeout(connectionTimeout)
      agentSocket = socket
      resolve(socket)
    }
    socket.onmessage = handleAgentSocketEvent
    socket.onerror = () => {
      window.clearTimeout(connectionTimeout)
      reject(new Error('Agent WebSocket 连接失败'))
    }
    socket.onclose = () => {
      window.clearTimeout(connectionTimeout)
      if (agentSocket === socket) {
        agentSocket = null
        agentSocketReady = null
        rejectPendingAgentRequests('Agent WebSocket 连接已断开，请重新发送')
      }
    }
  })
  agentSocketReady = ready

  try {
    return await ready
  } finally {
    if (agentSocketReady === ready) agentSocketReady = null
  }
}

export async function streamAgentMessage(
  params: Api.Agent.SendRequest,
  callbacks: AgentStreamCallbacks = {}
) {
  const socket = await getAgentSocket()
  const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`

  return new Promise<Api.Agent.Response>((resolve, reject) => {
    pendingAgentRequests.set(requestId, { ...callbacks, resolve, reject })
    try {
      socket.send(
        JSON.stringify({
          type: 'message',
          requestId,
          data: params
        })
      )
    } catch (error) {
      pendingAgentRequests.delete(requestId)
      reject(error instanceof Error ? error : new Error('Agent 消息发送失败'))
    }
  })
}

export async function readAgentProjectCsv(file: File) {
  if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('请选择 CSV 文件')
  if (file.size <= 0) throw new Error('CSV 文件内容为空')
  if (file.size > 128 * 1024) throw new Error('CSV 文件不能超过 128 KB')

  const bytes = new Uint8Array(await file.arrayBuffer())
  let content = ''
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    content = new TextDecoder('gb18030').decode(bytes)
  }

  content = content.replace(/^\uFEFF/, '').trim()
  if (!content) throw new Error('CSV 文件内容为空')
  if (content.split(/\r?\n/).filter((line) => line.trim()).length < 2) {
    throw new Error('CSV 至少需要一行表头和一行项目数据')
  }
  return content
}

export async function createAgentEmailDraft(params: Api.Agent.EmailDraftRequest) {
  const data = await request.post<RawEmailDraft>({
    url: '/api/Agent/email/draft',
    data: params
  })
  return normalizeEmailDraft(data)
}

export async function sendAgentEmail(params: Api.Agent.EmailSendRequest) {
  const data = await request.post<RawEmailSendResult>({
    url: '/api/Agent/email/send',
    data: params
  })
  return normalizeEmailSendResult(data)
}

export async function fetchAgentTools(agentCode = 'project-management') {
  const data = await request.get<RawToolDefinition[]>({
    url: '/api/Agent/tools',
    params: { agentCode }
  })
  return data.map(normalizeToolDefinition)
}

export async function confirmAgentToolCall(id: number | string, params: Api.Agent.ConfirmRequest) {
  const data = await request.post<RawToolCall>({
    url: `/api/Agent/tool-calls/${id}/confirm`,
    data: params
  })
  return normalizeToolCall(data)
}
