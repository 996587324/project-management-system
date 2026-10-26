import assert from 'node:assert/strict'
import { normalizeHourlyBoards } from '../src/api/hourly-production-contract'

const expected = [
  { code: 'first', name: '第一产量看板', published: false },
  { code: 'second', name: '第二产量看板', published: true }
]
assert.deepEqual(normalizeHourlyBoards(expected), expected)
assert.deepEqual(
  normalizeHourlyBoards(
    expected.map((row) => ({
      Code: row.code,
      Name: row.name,
      Published: row.published
    }))
  ),
  expected
)
assert.deepEqual(
  normalizeHourlyBoards([{ Code: 'first', Name: '第一产量看板', Published: false }, expected[1]]),
  expected
)
assert.deepEqual(normalizeHourlyBoards([]), [])
assert.deepEqual(normalizeHourlyBoards([{ Name: '无编码项' }]), [])
assert.deepEqual(normalizeHourlyBoards([{ Code: 'fallback' }]), [
  { code: 'fallback', name: 'fallback', published: false }
])
console.log(
  'PASS: old/new/mixed board-list contracts, publication flags, empty list and valid option identities.'
)
