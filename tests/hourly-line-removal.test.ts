import assert from 'node:assert/strict'
import { removeHourlyLine } from '../src/views/hourly-production/components/process-config-rules'
import type { HourlyBoard } from '../src/api/hourly-production'
const make = () =>
  ({
    lines: [{ code: 'A' }, { code: 'B' }, { code: 'C' }],
    layout: {
      mode: 'Rotate',
      rotationSeconds: 15,
      groups: [
        ['A', 'B'],
        ['B', 'C']
      ]
    },
    push: { enabled: true, lineCodes: ['A'] },
    shiftChange: { dayTargets: { A: [1], 'A/P1': [2], B: [3] }, nightTargets: { A: [4] } },
    shiftHistory: [{ dayTargets: { A: [99] } }]
  }) as unknown as HourlyBoard
const board = make()
assert.equal(removeHourlyLine(board, board.lines[0]), true)
assert.deepEqual(board.layout?.groups, [['B', 'C']])
assert.equal(board.push.enabled, false)
assert.deepEqual(board.shiftChange?.dayTargets, { B: [3] })
assert.deepEqual(board.shiftHistory?.[0].dayTargets.A, [99])
assert.equal(removeHourlyLine(board, board.lines[0]), true)
assert.equal(board.layout?.mode, 'Single')
assert.deepEqual(board.layout?.groups, [['C']])
assert.equal(removeHourlyLine(board, board.lines[0]), false)
const all = make()
all.push.lineCodes = []
removeHourlyLine(all, all.lines[0])
assert.equal(all.push.enabled, true)
console.log(
  'PASS removal cleans layout and draft targets, preserves history, protects last line and avoids broadening push scope'
)
