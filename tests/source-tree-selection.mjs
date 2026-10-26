import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const targets = new Map([
  ['hourly-production/components/BindingEditor.vue', 'hourly'],
  ['process-board/components/SourceBindingEditor.vue', 'process'],
  ['production-dashboard/components/DashboardRobotBindingDialog.vue', 'dashboard'],
  ['production-dashboard/components/DashboardDeviceBindingDialog.vue', 'dashboard'],
  ['production-dashboard/components/DashboardLineOutputBindingDialog.vue', 'dashboard'],
  ['production-dashboard/device-card-config/index.vue', 'device-card'],
  ['edge-gateway/data-trace/index.vue', 'trace'],
  ['edge-gateway/console/components/b-mapping/EdgeBMappingDialog.vue', 'b-mapping']
])
for (const [path, purpose] of targets) {
  const text = readFileSync(new URL(`../src/views/${path}`, import.meta.url), 'utf8')
  assert.ok(text.includes('<SourceTreeSelect'), `${path}: shared tree selector`)
  assert.ok(text.includes(`purpose="${purpose}"`), `${path}: correct business permission context`)
  assert.ok(
    !text.includes('fetchDashboardDataSourcesByModel'),
    `${path}: no capped flat source selector`
  )
}
const tree = readFileSync(
  new URL('../src/components/business/source-tree-select/index.vue', import.meta.url),
  'utf8'
)
assert.ok(tree.includes('sourceCatalogApi.resolve'), 'exact old selection resolution')
assert.ok(tree.includes('current !== revision'), 'reject stale search responses')
assert.ok(tree.includes('loadChildren'), 'model children loaded on demand')
assert.ok(tree.includes('sourceIdentityKey'), 'composite identity instead of label keys')
console.log(
  'Source tree integration regression passed: all 8 binding entry components share the catalog selector.'
)
