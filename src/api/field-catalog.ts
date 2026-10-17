import { applicationRequest } from '@/utils/system-applications/client'

export interface HistoricalField {
  id: number
  modelMark: string
  sourcePath: string
  fieldName: string
  displayName: string
  valueType: string
  removed: boolean
  firstSeenTime: string
  lastSeenTime: string
  seenCount: number
  referenceCount: number
}

export interface FieldReference {
  sourcePath: string
  module: string
  location: string
}

export interface FieldCatalogQuery {
  modelMark: string
  keyword?: string
  removed?: boolean
  lastSeenStart?: string
  lastSeenEnd?: string
  current: number
  size: number
}

export const fieldCatalogApi = {
  models: () => applicationRequest<string[]>('/api/shared-data/catalog/models'),
  page: (query: FieldCatalogQuery) => {
    const parameters = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') parameters.set(key, String(value))
    }
    return applicationRequest<{
      current: number
      size: number
      total: number
      records: HistoricalField[]
    }>(`/api/shared-data/catalog/page?${parameters}`)
  },
  references: (modelMark: string, id: number) =>
    applicationRequest<FieldReference[]>(
      `/api/shared-data/catalog/references?${new URLSearchParams({ modelMark, id: String(id) })}`
    ),
  change: (modelMark: string, ids: number[], removed: boolean) =>
    applicationRequest<{
      applied: boolean
      changedCount: number
      referenceCount: number
      references: FieldReference[]
    }>('/api/shared-data/catalog/selection', { modelMark, ids, removed, confirm: true })
}
