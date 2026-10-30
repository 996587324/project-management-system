import assert from 'node:assert/strict'
import { createWorkRequestKey } from '../src/utils/work-request-key'

const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
try {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: () => 'native-uuid' }
  })
  assert.equal(createWorkRequestKey(), 'native-uuid')
  let calls = 0
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(++calls)
        return bytes
      }
    }
  })
  const first = createWorkRequestKey()
  const second = createWorkRequestKey()
  assert.match(first, /^[a-f0-9]{32}$/)
  assert.notEqual(first, second)
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined })
  const fallback = new Set(Array.from({ length: 1000 }, () => createWorkRequestKey()))
  assert.equal(fallback.size, 1000)
  assert.ok([...fallback].every((key) => key.length > 0 && key.length <= 128))
  console.log('PASS: native UUID, HTTP-compatible random values, and fallback request identifiers')
} finally {
  if (original) Object.defineProperty(globalThis, 'crypto', original)
  else Reflect.deleteProperty(globalThis, 'crypto')
}
