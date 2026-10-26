import assert from 'node:assert/strict'
import {
  isLineDevice,
  processDeviceIssues
} from '../src/views/process-board/components/device-scope'
import type { ProcessDefinition, ProcessField, SourceBinding } from '../src/api/process-board'

const source = (deviceMark: string, tenantMark = 'tenant'): SourceBinding => ({
  tenantMark,
  deviceMark,
  sourcePath: '/value'
})
const allowed = [source('a'), source('b')]
const field = (code: string, binding = source('a')) =>
  ({ code, name: code, source: binding, fixedText: null, variables: {} }) as ProcessField
const card = (...fields: ProcessField[]) =>
  ({ devices: [], fields }) as unknown as ProcessDefinition

assert.equal(isLineDevice(source('a'), allowed), true)
assert.equal(isLineDevice(source('a', 'other-tenant'), allowed), false)
assert.equal(isLineDevice(source('A'), allowed), false)
assert.equal(processDeviceIssues(card(field('ok')), allowed).length, 0)
assert.equal(processDeviceIssues(card(field('outside', source('c'))), allowed)[0]?.legacy, false)
assert.equal(
  processDeviceIssues(card(field('ok')), []).length,
  1,
  'empty line does not mean all devices'
)

const formula = field('formula')
formula.variables = { pressure: source('outside') }
assert.equal(processDeviceIssues(card(formula), allowed)[0]?.slot, 'variable:pressure')
const original = card(field('old', source('outside')), formula)
const edited = structuredClone(original)
edited.fields[0].name = '只修改显示名称'
assert.ok(processDeviceIssues(edited, allowed, original).every((issue) => issue.legacy))
edited.fields[0].source.sourcePath = '/different'
assert.equal(processDeviceIssues(edited, allowed, original)[0]?.legacy, false)
edited.fields[0] = field('renamed', source('outside'))
assert.equal(processDeviceIssues(edited, allowed, original)[0]?.legacy, false)
edited.fields[1].variables = { another: source('outside') }
assert.equal(processDeviceIssues(edited, allowed, original).at(-1)?.legacy, false)

const fixed = field('fixed', { ...source('outside'), fixedValue: 10 })
fixed.variables = { constant: { ...source('outside'), fixedValue: 3 } }
const text = field('text', source('outside'))
text.fixedText = '工艺设定说明'
assert.equal(processDeviceIssues(card(fixed, text), []).length, 0)
assert.equal(
  processDeviceIssues(card(field('ok', source('b'))), [source('a')]).length,
  1,
  'changing parent line immediately rechecks sources'
)
assert.equal(
  JSON.stringify(original),
  JSON.stringify(card(field('old', source('outside')), formula)),
  'checks do not alter historical values'
)
console.log(
  'PASS: line device bounds, exact tenant/case identity, formula variables, legacy references, parent changes and fixed values.'
)
