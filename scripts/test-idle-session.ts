import assert from 'node:assert/strict'
import {
  IDLE_TIMEOUT_MS,
  IdleSession,
  type SavedActivity,
  type SessionActivity
} from '../src/utils/auth/idle-session'

const initial = Date.UTC(2026, 9, 23, 8)
let now = initial
let serverDeadline = initial + IDLE_TIMEOUT_MS
let saved: SavedActivity | undefined
let warnings: Array<[number, boolean]> = []
let expired: string[] = []
let calls: Array<number | undefined> = []
let unavailable = false
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

function client() {
  return new IdleSession('same-session', {
    now: () => now,
    load: () => saved,
    save: (value) => {
      saved = value
    },
    sync: async (idle) => {
      calls.push(idle)
      if (unavailable) throw new Error('offline')
      if (serverDeadline <= now) throw Object.assign(new Error('expired'), { status: 401 })
      if (idle !== undefined)
        serverDeadline = Math.max(serverDeadline, now + IDLE_TIMEOUT_MS - idle)
      return {
        sessionId: 'same-session',
        serverTimeUtc: new Date(now).toISOString(),
        expiresAtUtc: new Date(serverDeadline).toISOString(),
        idleTimeoutSeconds: 1200
      } satisfies SessionActivity
    },
    credentials: () => {},
    display: (seconds, warning) => warnings.push([seconds, warning]),
    expire: (reason) => expired.push(reason)
  })
}

function reset() {
  now = initial
  serverDeadline = initial + IDLE_TIMEOUT_MS
  saved = undefined
  warnings = []
  expired = []
  calls = []
  unavailable = false
}

// 自动查询不会续期，19 分钟提示，20 分钟退出。
reset()
let session = client()
await session.start()
for (let minute = 1; minute <= 18; minute++) {
  now = initial + minute * 60_000
  await session.tick()
}
assert.equal(warnings.at(-1)?.[1], false)
now = initial + 19 * 60_000
await session.tick()
assert.deepEqual(warnings.at(-1), [60, true])
assert.ok(calls.every((value) => value === undefined))
assert.equal(serverDeadline, initial + IDLE_TIMEOUT_MS)
now = initial + IDLE_TIMEOUT_MS
await session.tick()
assert.deepEqual(expired, ['idle'])
session.activity()
assert.equal(serverDeadline, initial + IDLE_TIMEOUT_MS, 'expired session cannot be revived')

// 真实操作持续 40 分钟仍可使用，最后一次操作后重新计时。
reset()
session = client()
await session.start()
for (let minute = 1; minute <= 40; minute++) {
  now = initial + minute * 60_000
  session.activity()
  await flush()
  await session.tick()
}
assert.deepEqual(expired, [])
assert.equal(serverDeadline, now + IDLE_TIMEOUT_MS)
now += 19 * 60_000
await session.tick()
assert.deepEqual(warnings.at(-1), [60, true])
session.activity()
await flush()
assert.equal(warnings.at(-1)?.[1], false, 'continue using dismisses warning')

// 刷新恢复保存的时间，不从打开页面重新给 20 分钟。
session.stop()
const lastOperation = now
now += 10 * 60_000
session = client()
await session.start()
assert.deepEqual(warnings.at(-1), [600, false])
now = lastOperation + IDLE_TIMEOUT_MS
await session.tick()
assert.deepEqual(expired, ['idle'])

// 同源标签页共享实际操作；不同源 A/B 通过服务器只读查询同步截止时间。
reset()
session = client()
await session.start()
const otherTab = client()
await otherTab.start()
now += 18 * 60_000
session.activity()
await flush()
await otherTab.tick()
assert.equal(warnings.at(-1)?.[1], false)
saved = undefined // 模拟 B 没有 A 的本地存储。
const systemB = client()
await systemB.start()
now += 3 * 60_000
await systemB.tick()
assert.deepEqual(expired, [], 'idle B cannot expire an active shared session')
session.stop()
otherTab.stop()
systemB.stop()

// 到期前的最后一次操作立即发送，不能被节流延迟到服务器过期之后。
reset()
session = client()
await session.start()
now += IDLE_TIMEOUT_MS - 15_000
await session.tick()
now += 5_000
session.activity()
await flush()
assert.equal(serverDeadline, now + IDLE_TIMEOUT_MS)
session.stop()

// 休眠超过时限后的首个操作不能续期；离线时按已知截止时间退出。
for (const offline of [false, true]) {
  reset()
  session = client()
  await session.start()
  now += IDLE_TIMEOUT_MS + 60_000
  unavailable = offline
  session.activity()
  await flush()
  assert.deepEqual(expired, ['idle'])
  assert.ok(calls.every((value) => value === undefined))
}

// 主动退出标记能同步给同会话其他页面。
reset()
session = client()
await session.start()
now += 5000
session.activity()
assert.equal(session.pendingIdleMilliseconds(), 0, 'pagehide can flush a throttled operation')
now += 4000
assert.equal(session.pendingIdleMilliseconds(), 4000, 'flush carries actual elapsed time')
session.stop()

// 首次打开时断网也不能无限保留登录；点击和反复刷新不能改变保存的操作时间。
reset()
unavailable = true
saved = { lastActivity: initial }
now += 18 * 60_000
session = client()
await session.start()
session.activity()
now += 60_000
await session.tick()
assert.deepEqual(warnings.at(-1), [60, true])
now += 60_000
await session.tick()
assert.deepEqual(expired, ['idle'])

reset()
session = client()
await session.start()
saved = { lastActivity: now, expired: true }
await session.tick()
assert.deepEqual(expired, ['invalid'])

// 切换账号后，旧请求的返回不能覆盖新账号凭据。
reset()
let release!: (value: SessionActivity) => void
let credentials = 0
session = new IdleSession('old', {
  now: () => now,
  load: () => undefined,
  save: () => {},
  sync: () =>
    new Promise((resolve) => {
      release = resolve
    }),
  credentials: () => {
    credentials++
  },
  display: () => {},
  expire: () => {}
})
const pending = session.start()
session.stop()
release({
  sessionId: 'old',
  serverTimeUtc: new Date(now).toISOString(),
  expiresAtUtc: new Date(now + IDLE_TIMEOUT_MS).toISOString(),
  idleTimeoutSeconds: 1200,
  token: 'old'
})
await pending
assert.equal(credentials, 0)
console.log(
  'PASS: idle warning/expiry, 40-minute active renewal, reload, A/B and tab sync, late activity, sleep/offline and stale responses.'
)
