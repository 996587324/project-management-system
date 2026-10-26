import assert from 'node:assert/strict'
import {
  clampProcessPage,
  processPageSize
} from '../src/views/hourly-production/components/process-carousel-layout'

for (const height of [170, 350, 530, 710, 1080, 2160]) {
  for (const total of [0, 1, 7, 30, 100]) {
    const size = processPageSize(height, total)
    assert.ok(size >= 1 && size <= 4)
    if (total > 0) assert.ok(size <= total)
    assert.ok(size * 170 + (size - 1) * 10 <= height)
    const pages = Math.max(1, Math.ceil(total / size))
    const visited = Array.from({ length: pages }, (_, page) =>
      Array.from({ length: total }, (_, index) => index).slice(page * size, (page + 1) * size)
    ).flat()
    assert.deepEqual(
      visited,
      Array.from({ length: total }, (_, index) => index)
    )
    assert.equal(clampProcessPage(999, total, size), pages - 1)
    assert.equal(clampProcessPage(-1, total, size), 0)
  }
}
assert.equal(processPageSize(0, 7), 1)
assert.equal(processPageSize(169, 7), 1)
assert.equal(processPageSize(350, 7), 2)
assert.equal(clampProcessPage(3, 7, 4), 1)
console.log(
  'Hourly carousel layout: page capacity, full coverage, resize clamping and empty data passed.'
)
