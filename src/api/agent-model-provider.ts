import request from '@/utils/http'

export interface AgentModelProvider {
  id: number
  providerCode: string
  providerName: string
  protocolType: string
  baseUrl: string
  endpointPath: string
  apiKeyHeader: string
  apiKeyMask?: string
  hasApiKey: boolean
  model: string
  temperature: number
  maxTokens: number
  clientTimeoutSeconds: number
  platformTimeoutSeconds: number
  maxRetries: number
  fallbacksJson?: string
  remark?: string
  enabled: boolean
  createTime: string
  updateTime?: string
}

export interface AgentModelProviderSaveParams {
  id?: number
  providerCode: string
  providerName: string
  protocolType: string
  baseUrl: string
  endpointPath: string
  apiKey?: string
  apiKeyHeader: string
  model: string
  temperature: number
  maxTokens: number
  clientTimeoutSeconds: number
  platformTimeoutSeconds: number
  maxRetries: number
  fallbacksJson?: string
  remark?: string
  enabled: boolean
}

export interface AgentModelProviderPage {
  records: AgentModelProvider[]
  current: number
  size: number
  total: number
}

export interface AgentModelBinding {
  id?: number
  agentCode: string
  agentName: string
  providerId?: number
  providerName?: string
  isPrimary: boolean
  priority: number
  enabled: boolean
}

export interface AgentModelBindingSaveParams {
  agentCode: string
  providerId: number
  isPrimary: boolean
  priority: number
  enabled: boolean
}

export interface AgentModelProviderTestResult {
  success: boolean
  message: string
  providerCode: string
  model: string
  traceId?: string
  durationMs: number
}

type RawObject = Record<string, unknown>

function read<T>(source: RawObject, camelName: string, pascalName: string, fallback: T): T {
  return (source[camelName] ?? source[pascalName] ?? fallback) as T
}

function normalizeProvider(source: RawObject): AgentModelProvider {
  return {
    id: Number(read(source, 'id', 'Id', 0)),
    providerCode: String(read(source, 'providerCode', 'ProviderCode', '')),
    providerName: String(read(source, 'providerName', 'ProviderName', '')),
    protocolType: String(read(source, 'protocolType', 'ProtocolType', 'OpenAIChatCompletions')),
    baseUrl: String(read(source, 'baseUrl', 'BaseUrl', '')),
    endpointPath: String(read(source, 'endpointPath', 'EndpointPath', '/chat/completions')),
    apiKeyHeader: String(read(source, 'apiKeyHeader', 'ApiKeyHeader', 'Authorization')),
    apiKeyMask: read<string | undefined>(source, 'apiKeyMask', 'ApiKeyMask', undefined),
    hasApiKey: Boolean(read(source, 'hasApiKey', 'HasApiKey', false)),
    model: String(read(source, 'model', 'Model', '')),
    temperature: Number(read(source, 'temperature', 'Temperature', 0.2)),
    maxTokens: Number(read(source, 'maxTokens', 'MaxTokens', 1200)),
    clientTimeoutSeconds: Number(read(source, 'clientTimeoutSeconds', 'ClientTimeoutSeconds', 90)),
    platformTimeoutSeconds: Number(
      read(source, 'platformTimeoutSeconds', 'PlatformTimeoutSeconds', 75)
    ),
    maxRetries: Number(read(source, 'maxRetries', 'MaxRetries', 1)),
    fallbacksJson: read<string | undefined>(source, 'fallbacksJson', 'FallbacksJson', undefined),
    remark: read<string | undefined>(source, 'remark', 'Remark', undefined),
    enabled: Boolean(read(source, 'enabled', 'Enabled', false)),
    createTime: String(read(source, 'createTime', 'CreateTime', '')),
    updateTime: read<string | undefined>(source, 'updateTime', 'UpdateTime', undefined)
  }
}

function normalizeBinding(source: RawObject): AgentModelBinding {
  const providerId = read<number | undefined>(source, 'providerId', 'ProviderId', undefined)
  return {
    id: read<number | undefined>(source, 'id', 'Id', undefined),
    agentCode: String(read(source, 'agentCode', 'AgentCode', '')),
    agentName: String(read(source, 'agentName', 'AgentName', '')),
    providerId: providerId == null ? undefined : Number(providerId),
    providerName: read<string | undefined>(source, 'providerName', 'ProviderName', undefined),
    isPrimary: Boolean(read(source, 'isPrimary', 'IsPrimary', false)),
    priority: Number(read(source, 'priority', 'Priority', 100)),
    enabled: Boolean(read(source, 'enabled', 'Enabled', false))
  }
}

export async function fetchAgentModelProviderPage(params: {
  current: number
  size: number
  keyword?: string
  enabled?: boolean
}) {
  const data = await request.get<RawObject>({
    url: '/api/AgentModelProvider/page',
    params
  })
  const records = read<RawObject[]>(data, 'records', 'Records', [])
  return {
    records: records.map(normalizeProvider),
    current: Number(read(data, 'current', 'Current', params.current)),
    size: Number(read(data, 'size', 'Size', params.size)),
    total: Number(read(data, 'total', 'Total', 0))
  } satisfies AgentModelProviderPage
}

export async function fetchAgentModelProviderOptions() {
  const data = await request.get<RawObject[]>({ url: '/api/AgentModelProvider/options' })
  return data.map(normalizeProvider)
}

export async function fetchAgentModelProvider(id: number) {
  const data = await request.get<RawObject>({ url: `/api/AgentModelProvider/${id}` })
  return normalizeProvider(data)
}

export async function saveAgentModelProvider(data: AgentModelProviderSaveParams) {
  const result = await request.post<RawObject>({
    url: '/api/AgentModelProvider/save',
    data
  })
  return normalizeProvider(result)
}

export async function setAgentModelProviderEnabled(id: number, enabled: boolean) {
  const result = await request.post<RawObject>({
    url: `/api/AgentModelProvider/${id}/enabled`,
    data: { enabled }
  })
  return normalizeProvider(result)
}

export function deleteAgentModelProvider(id: number) {
  return request.post<number>({ url: `/api/AgentModelProvider/delete/${id}` })
}

export async function testAgentModelProvider(id: number) {
  const data = await request.post<RawObject>({ url: `/api/AgentModelProvider/${id}/test` })
  return {
    success: Boolean(read(data, 'success', 'Success', false)),
    message: String(read(data, 'message', 'Message', '')),
    providerCode: String(read(data, 'providerCode', 'ProviderCode', '')),
    model: String(read(data, 'model', 'Model', '')),
    traceId: read<string | undefined>(data, 'traceId', 'TraceId', undefined),
    durationMs: Number(read(data, 'durationMs', 'DurationMs', 0))
  } satisfies AgentModelProviderTestResult
}

export async function fetchAgentModelBindings() {
  const data = await request.get<RawObject[]>({ url: '/api/AgentModelProvider/bindings' })
  return data.map(normalizeBinding)
}

export async function saveAgentModelBinding(data: AgentModelBindingSaveParams) {
  const result = await request.post<RawObject>({
    url: '/api/AgentModelProvider/bindings/save',
    data
  })
  return normalizeBinding(result)
}
