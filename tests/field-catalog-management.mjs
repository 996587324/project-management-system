import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { transformWithEsbuild } from 'vite'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
const { createRenderer, nextTick } = require('vue')

async function evaluate(source, dependencies) {
  const compiled = await transformWithEsbuild(source, 'catalog-test.ts', {
    loader: 'ts',
    format: 'cjs'
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.code)(
    (name) => dependencies[name] ?? require(name),
    module,
    module.exports
  )
  return module.exports
}

const calls = []
const api = (
  await evaluate(await readFile('src/api/field-catalog.ts', 'utf8'), {
    '@/utils/system-applications/client': {
      applicationRequest: async (...args) => {
        calls.push(args)
        return {}
      }
    }
  })
).fieldCatalogApi
await api.page({
  modelMark: 'MODEL & 模型',
  removed: false,
  keyword: '/data/a&b',
  current: 2,
  size: 20
})
const url = new URL(calls[0][0], 'http://test')
assert.equal(url.searchParams.get('removed'), 'false')
assert.equal(url.searchParams.get('modelMark'), 'MODEL & 模型')
assert.equal(url.searchParams.get('keyword'), '/data/a&b')
await api.change('MODEL', [17, 18], true)
assert.deepEqual(calls[1][1], { modelMark: 'MODEL', ids: [17, 18], removed: true, confirm: true })

const file = 'src/components/business/historical-field-catalog/FieldCatalogManager.vue'
const { descriptor } = parse(await readFile(file, 'utf8'), { filename: file })
assert.deepEqual(
  compileTemplate({ source: descriptor.template.content, filename: file, id: 'catalog-test' })
    .errors,
  []
)
const compiled = compileScript(descriptor, { id: 'catalog-test' })
const renderer = createRenderer({
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  insert() {},
  remove() {},
  setText() {},
  setElementText() {},
  patchProp() {},
  parentNode: () => null,
  nextSibling: () => null
})

const row = {
  id: 17,
  modelMark: 'MODEL',
  sourcePath: '/data/unused',
  removed: false,
  referenceCount: 0
}
async function mount(permissions, administrator = false) {
  const writes = []
  const queries = []
  const errors = []
  const events = []
  const fixture = {
    confirm: async () => true,
    page: async () => ({ total: 1, records: [row] }),
    mutation: { applied: true, changedCount: 1, references: [], referenceCount: 0 }
  }
  const component = (
    await evaluate(compiled.content, {
      '@/utils/system-applications/client': {
        applicationRequest: async () => ({ permissions, platformAdministrator: administrator })
      },
      '@/api/field-catalog': {
        fieldCatalogApi: {
          models: async () => ['MODEL'],
          page: async (query) => {
            queries.push(query)
            return fixture.page(query)
          },
          references: async () => [
            { sourcePath: row.sourcePath, module: '卡片', location: 'LINE/CARD#1' }
          ],
          change: async (...args) => {
            writes.push(args)
            return fixture.mutation
          }
        }
      },
      'element-plus': {
        ElMessageBox: { confirm: (...args) => fixture.confirm(...args) },
        ElMessage: { success() {}, error: (message) => errors.push(message) }
      }
    })
  ).default
  const app = renderer.createApp(
    { ...component, render: () => null },
    { initialModel: 'MODEL', onChanged: () => events.push('changed') }
  )
  const state = app.mount({}).$.setupState
  for (let index = 0; index < 6; index++) await nextTick()
  return { app, state, writes, queries, errors, events, fixture }
}

const writer = await mount(['shared-dictionary.read', 'shared-dictionary.write'])
try {
  const { state, fixture, writes, queries, events } = writer
  assert.equal(state.canWrite, true)
  assert.equal(queries[0].removed, false)
  state.keyword = '温度'
  state.status = 'removed'
  state.range = ['2026-10-01 00:00:00', '2026-10-16 23:59:59']
  state.current = 3
  await state.search()
  assert.equal(queries.at(-1).current, 1)
  assert.equal(queries.at(-1).removed, true)
  assert.equal(queries.at(-1).keyword, '温度')
  assert.equal(queries.at(-1).lastSeenStart, state.range[0])
  fixture.confirm = async () => {
    throw 'cancel'
  }
  await state.changeSelection([row], true)
  assert.equal(writes.length, 0)
  assert.equal(state.mutating, false)
  fixture.confirm = async () => true
  fixture.mutation = {
    applied: false,
    referenceCount: 1,
    references: [{ sourcePath: row.sourcePath, module: '工艺变量', location: 'CARD#2' }]
  }
  await state.changeSelection([row], true)
  assert.equal(state.referenceOpen, true)
  assert.equal(state.references.length, 1)
  assert.equal(events.length, 0, 'blocked batch must not emit successful change')
  fixture.mutation = { applied: true, changedCount: 1, referenceCount: 0, references: [] }
  await state.changeSelection([row, row], true)
  assert.deepEqual(writes.at(-1), ['MODEL', [17], true])
  assert.equal(events.length, 1)
  assert.deepEqual(state.selection, [])
  await state.showReferences(row)
  assert.equal(state.references[0].location, 'LINE/CARD#1')
  state.status = 'all'
  await state.search()
  assert.equal(queries.at(-1).removed, undefined)
  const pending = []
  fixture.page = (query) => new Promise((resolve) => pending.push({ query, resolve }))
  state.model = 'OLD'
  const first = state.loadPage()
  state.model = 'NEW'
  const second = state.loadPage()
  pending[1].resolve({ total: 1, records: [{ ...row, modelMark: 'NEW' }] })
  await second
  pending[0].resolve({ total: 1, records: [{ ...row, modelMark: 'OLD' }] })
  await first
  assert.equal(
    state.records[0].modelMark,
    'NEW',
    'late response must not overwrite another selected model'
  )
} finally {
  writer.app.unmount()
}

for (const permissions of [[], ['shared-dictionary.read']]) {
  const reader = await mount(permissions)
  try {
    assert.equal(reader.state.canWrite, false)
    await reader.state.changeSelection([row], true)
    assert.equal(reader.writes.length, 0)
    if (permissions.length === 0) {
      assert.ok(reader.state.accessError)
      assert.equal(reader.queries.length, 0)
    }
  } finally {
    reader.app.unmount()
  }
}
const administrator = await mount([], true)
assert.equal(administrator.state.canWrite, true)
administrator.app.unmount()

for (const file of [
  'src/components/business/historical-field-catalog/FieldCatalogDialog.vue',
  'src/views/process-board/components/SourceBindingEditor.vue',
  'src/views/shared-data/model-dictionary.vue',
  'src/views/production-dashboard/device-card-config/index.vue'
]) {
  const { descriptor } = parse(await readFile(file, 'utf8'), { filename: file })
  assert.deepEqual(
    compileTemplate({ source: descriptor.template.content, filename: file, id: 'catalog-entry' })
      .errors,
    []
  )
}
console.log(
  'PASS: catalog search/filter, permission gates, confirmation/cancel, batch blockers, successful refresh, model-response race and entry templates'
)
