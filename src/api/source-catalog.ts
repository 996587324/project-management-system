import request from '@/utils/http'

export interface SourceIdentity {
  sourceKey: string
  deviceKey: string
  sourceDeviceCode?: string
}

export interface CatalogDevice extends SourceIdentity {
  kind: 'Realtime' | 'Edge'
  modelMark: string
  modelName: string
  deviceName: string
  gatewayId: number
  connectionId: number
  gatewayName: string
  connectionName: string
  receiveTime?: string
}

export type CatalogPurpose =
  'dashboard' | 'device-card' | 'process' | 'hourly' | 'trace' | 'b-mapping' | 'shared'
export interface CatalogQuery {
  purpose: CatalogPurpose
  kind: 'Realtime' | 'Edge'
  keyword?: string
  modelMark?: string
  gatewayId?: number
  connectionKey?: string
  processLineId?: number
  page?: number
  size?: number
}
export interface CatalogModel {
  modelMark: string
  modelName: string
  deviceCount: number
  latestReceiveTime?: string
}
export interface CatalogPage<T> {
  records: T[]
  total: number
  page: number
  size: number
}

export function sourceIdentityKey(value?: SourceIdentity | null): string {
  return value?.deviceKey
    ? JSON.stringify([value.sourceKey, value.deviceKey, value.sourceDeviceCode || ''])
    : ''
}

export const sourceCatalogApi = {
  models: (params: CatalogQuery) =>
    request.get<CatalogPage<CatalogModel>>({ url: '/api/source-catalog/models', params }),
  devices: (params: CatalogQuery) =>
    request.get<CatalogPage<CatalogDevice>>({ url: '/api/source-catalog/devices', params }),
  resolve: (params: CatalogQuery & SourceIdentity) =>
    request.get<CatalogDevice | null>({ url: '/api/source-catalog/resolve', params })
}
