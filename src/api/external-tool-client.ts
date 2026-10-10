import request from '@/utils/http'

export interface ExternalToolClient {
  id: number
  clientId: string
  clientName: string
  scopes: string
  allowedLineCodes: string
  allowedProjectCodes: string
  allowedDeviceCodes: string
  enabled: boolean
  expireTime?: string
  createTime: string
  updateTime: string
}

export interface ExternalToolClientSaveParams {
  id?: number
  clientName: string
  scopes: string
  allowedLineCodes: string
  allowedProjectCodes: string
  allowedDeviceCodes: string
  enabled: boolean
  expireTime?: string
  rotateSecret?: boolean
}

export interface ExternalToolClientSecretResult {
  client: ExternalToolClient
  clientSecret?: string
}

export interface ExternalToolServerSetting {
  serverName: string
  version: string
  updatedBy?: string
  updateTime: string
}

export interface ExternalToolServerSettingSaveParams {
  serverName: string
  version: string
  configurationPassword: string
}

type RawObject = Record<string, unknown>

function read<T>(source: RawObject, camelName: string, pascalName: string, fallback: T): T {
  return (source[camelName] ?? source[pascalName] ?? fallback) as T
}

function normalizeClient(source: RawObject): ExternalToolClient {
  return {
    id: Number(read(source, 'id', 'Id', 0)),
    clientId: String(read(source, 'clientId', 'ClientId', '')),
    clientName: String(read(source, 'clientName', 'ClientName', '')),
    scopes: String(read(source, 'scopes', 'Scopes', '')),
    allowedLineCodes: String(read(source, 'allowedLineCodes', 'AllowedLineCodes', '')),
    allowedProjectCodes: String(read(source, 'allowedProjectCodes', 'AllowedProjectCodes', '')),
    allowedDeviceCodes: String(read(source, 'allowedDeviceCodes', 'AllowedDeviceCodes', '')),
    enabled: Boolean(read(source, 'enabled', 'Enabled', false)),
    expireTime: read<string | undefined>(source, 'expireTime', 'ExpireTime', undefined),
    createTime: String(read(source, 'createTime', 'CreateTime', '')),
    updateTime: String(read(source, 'updateTime', 'UpdateTime', ''))
  }
}

export async function fetchExternalToolClients() {
  const data = await request.get<RawObject[]>({ url: '/api/external-tool-clients' })
  return data.map(normalizeClient)
}

export async function saveExternalToolClient(data: ExternalToolClientSaveParams) {
  const result = await request.post<RawObject>({
    url: '/api/external-tool-clients',
    data
  })
  return {
    client: normalizeClient(read<RawObject>(result, 'client', 'Client', {})),
    clientSecret: read<string | undefined>(result, 'clientSecret', 'ClientSecret', undefined)
  } satisfies ExternalToolClientSecretResult
}

export async function fetchExternalToolServerSetting() {
  const data = await request.get<RawObject>({ url: '/api/external-tool-clients/server-setting' })
  return {
    serverName: String(read(data, 'serverName', 'ServerName', 'calmadmin-external-tools')),
    version: String(read(data, 'version', 'Version', '1.0.0')),
    updatedBy: read<string | undefined>(data, 'updatedBy', 'UpdatedBy', undefined),
    updateTime: String(read(data, 'updateTime', 'UpdateTime', ''))
  } satisfies ExternalToolServerSetting
}

export async function saveExternalToolServerSetting(data: ExternalToolServerSettingSaveParams) {
  const result = await request.post<RawObject>({
    url: '/api/external-tool-clients/server-setting',
    data
  })
  return {
    serverName: String(read(result, 'serverName', 'ServerName', 'calmadmin-external-tools')),
    version: String(read(result, 'version', 'Version', '1.0.0')),
    updatedBy: read<string | undefined>(result, 'updatedBy', 'UpdatedBy', undefined),
    updateTime: String(read(result, 'updateTime', 'UpdateTime', ''))
  } satisfies ExternalToolServerSetting
}
