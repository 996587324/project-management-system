import assert from 'node:assert/strict'
import {
  loadReportedModels,
  mergeModelMappings,
  UNCLASSIFIED_MODEL
} from '../src/views/production-dashboard/config-center/model-mappings'
import type { DashboardModelDisplayMapping } from '../src/api/edge-dashboard'
import type { CatalogModel } from '../src/api/source-catalog'

const saved: DashboardModelDisplayMapping[] = [
  {
    id: 7,
    dashboardCode: 'production-dashboard',
    modelMark: 'Robot_A',
    displayName: '已有中文名',
    equipmentType: 'Robot',
    sort: 10,
    enabled: false
  },
  {
    id: 8,
    dashboardCode: 'production-dashboard',
    modelMark: 'FUTURE',
    displayName: '预配置设备',
    equipmentType: 'Inspection',
    sort: 20,
    enabled: true
  }
]
const observed: CatalogModel[] = [
  {
    modelMark: 'robot_a',
    modelName: '原始名称',
    deviceCount: 3,
    latestReceiveTime: '2026-10-23T09:00:00'
  },
  {
    modelMark: 'NEW_MODEL',
    modelName: 'NEW_MODEL',
    deviceCount: 2,
    latestReceiveTime: '2026-10-23T10:00:00'
  },
  { modelMark: UNCLASSIFIED_MODEL, modelName: '未分类模型', deviceCount: 1 }
]
const before = JSON.stringify(saved)
let rows = mergeModelMappings(saved, observed)
assert.equal(rows.length, 4, 'case variants merge into one model')
const existing = rows.find((row) => row.id === 7)!
assert.equal(existing.modelMark, 'Robot_A', 'original saved code is preserved')
assert.equal(existing.displayName, '已有中文名')
assert.equal(existing.enabled, false, 'incoming reports must not re-enable mappings')
assert.equal(existing.equipmentType, 'Robot')
assert.equal(existing.deviceCount, 3)
assert.equal(existing.latestReceiveTime, '2026-10-23T09:00:00')
assert.equal(
  rows.find((row) => row.id === 8)?.deviceCount,
  0,
  'preconfigured model remains without reports'
)
const discovered = rows.find((row) => row.modelMark === 'NEW_MODEL')!
assert.equal(discovered.configured, false)
assert.equal(discovered.id, 0)
assert.equal(discovered.displayName, '', 'Chinese name is not guessed from the code')
assert.equal(rows.at(-1)?.unclassified, true)
assert.equal(JSON.stringify(saved), before, 'reading reports cannot mutate stored settings')

saved.push({ ...discovered, id: 9, displayName: '新模型中文名', equipmentType: 'Machine' })
rows = mergeModelMappings(saved, observed)
assert.equal(
  rows.find((row) => row.modelMark === 'NEW_MODEL')?.configured,
  true,
  'saving links to the existing reported model'
)
rows = mergeModelMappings(
  saved.filter((row) => row.id !== 9),
  observed
)
assert.equal(
  rows.find((row) => row.modelMark === 'NEW_MODEL')?.configured,
  false,
  'deletion leaves the observed model available to configure again'
)

// 超过 500 个模型完整分页；分页边界不丢失尾部模型，空页也能停止。
const many = Array.from({ length: 527 }, (_, index) => ({
  modelMark: `M${index}`,
  modelName: `模型${index}`,
  deviceCount: 1
}))
const pages: number[] = []
const all = await loadReportedModels(async (page) => {
  pages.push(page)
  return { records: many.slice((page - 1) * 100, page * 100), total: many.length, page, size: 100 }
})
assert.deepEqual(pages, [1, 2, 3, 4, 5, 6])
assert.equal(all.length, 527)
assert.equal(all.at(-1)?.modelMark, 'M526')
assert.deepEqual(
  await loadReportedModels(async (page) => ({ records: [], total: 30, page, size: 100 })),
  []
)
console.log(
  'PASS: model discovery, existing/disabled settings, preconfiguration, save/delete association, unknown models and 527-model pagination.'
)
