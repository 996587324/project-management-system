import assert from 'node:assert/strict'
import { hourlyConfigFixture } from '../tests/fixtures/hourly-config'
import {
  hourlyConfigIssue,
  removeHourlyProcess
} from '../src/views/hourly-production/components/process-config-rules'

const board = hourlyConfigFixture()
const [line, other] = board.lines
const originalOther = structuredClone(other)
const remaining = structuredClone(line.processes.slice(1))
assert.equal(removeHourlyProcess(line, line.processes[0]), true)
assert.deepEqual(line.processes, remaining, 'deletion preserves remaining bindings and targets')
assert.deepEqual(other, originalOther, 'other line is unchanged')
assert.equal(hourlyConfigIssue(board), undefined)
assert.equal(removeHourlyProcess(line, line.processes[1]), true)
assert.equal(line.summaryProcessCode, '', 'deleted summary process must be explicitly replaced')
assert.match(hourlyConfigIssue(board)!.message, /A线.*总产出口径/)
line.summaryProcessCode = line.processes[0].code
assert.equal(hourlyConfigIssue(board), undefined)
assert.equal(removeHourlyProcess(line, line.processes[0]), false, 'keep at least one process')
assert.equal(
  removeHourlyProcess(line, other.processes[0]),
  false,
  'stale row must not delete another process'
)
const binding = other.processes[1].bindings[0]
binding.deviceKey = ''
assert.match(hourlyConfigIssue(board)!.message, /B线.*注氟.*数据绑定 1.*设备/)
assert.equal(hourlyConfigIssue(board)!.processCode, 'P2')
assert.equal(removeHourlyProcess(other, other.processes[1]), true)
assert.equal(hourlyConfigIssue(board), undefined, 'removed incomplete process is not validated')
binding.deviceKey = 'unused'
line.processes[0].mode = 'Sum'
assert.match(hourlyConfigIssue(board)!.message, /求和字段/)
line.processes[0].bindings[0].quantityPath = '/quantity'
assert.equal(hourlyConfigIssue(board), undefined)
line.processes[0].bindings = []
assert.equal(
  hourlyConfigIssue(board),
  undefined,
  'unbound process is allowed, incomplete binding is not'
)
console.log(
  'PASS: hourly process deletion, retained bindings, summary replacement and contextual binding validation.'
)
