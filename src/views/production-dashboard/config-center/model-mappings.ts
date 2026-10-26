import type { DashboardModelDisplayMapping } from '@/api/edge-dashboard'
import type { CatalogModel, CatalogPage } from '@/api/source-catalog'

export const UNCLASSIFIED_MODEL = '__UNCLASSIFIED__'
export const modelIdentity = (value: string) => value.trim().toLowerCase()

export interface ModelMappingRow extends DashboardModelDisplayMapping {
  configured: boolean
  deviceCount: number
  latestReceiveTime?: string
  unclassified: boolean
}

/** 逐页读取授权模型，避免仅显示前 100/500 个；按标识去重，保留原始编码。 */
export async function loadReportedModels(
  fetchPage: (page: number) => Promise<CatalogPage<CatalogModel>>
): Promise<CatalogModel[]> {
  const models = new Map<string, CatalogModel>()
  for (let page = 1; ; page++) {
    const result = await fetchPage(page)
    result.records.forEach((model) => models.set(modelIdentity(model.modelMark), model))
    if (!result.records.length || page * result.size >= result.total) break
  }
  return [...models.values()]
}

/** 已保存配置优先；读取实时模型只补充来源统计，不自动创建或启用映射。 */
export function mergeModelMappings(
  mappings: DashboardModelDisplayMapping[],
  reported: CatalogModel[]
): ModelMappingRow[] {
  const rows = new Map<string, ModelMappingRow>()
  for (const mapping of mappings) {
    rows.set(modelIdentity(mapping.modelMark), {
      ...mapping,
      configured: true,
      deviceCount: 0,
      unclassified: modelIdentity(mapping.modelMark) === modelIdentity(UNCLASSIFIED_MODEL)
    })
  }
  for (const model of reported) {
    const key = modelIdentity(model.modelMark)
    const existing = rows.get(key)
    if (existing) {
      existing.deviceCount = model.deviceCount
      existing.latestReceiveTime = model.latestReceiveTime
    } else {
      rows.set(key, {
        id: 0,
        dashboardCode: 'production-dashboard',
        modelMark: model.modelMark,
        displayName: '',
        equipmentType: 'Device',
        sort: 0,
        enabled: true,
        configured: false,
        deviceCount: model.deviceCount,
        latestReceiveTime: model.latestReceiveTime,
        unclassified: key === modelIdentity(UNCLASSIFIED_MODEL)
      })
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      Number(a.unclassified) - Number(b.unclassified) ||
      Number(a.configured) - Number(b.configured) ||
      a.sort - b.sort ||
      a.modelMark.localeCompare(b.modelMark)
  )
}
