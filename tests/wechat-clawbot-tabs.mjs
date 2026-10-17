import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { transformWithEsbuild } from 'vite'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
const { createRenderer, nextTick, reactive } = require('vue')
const root = 'src/views/wechat-clawbot'
const calls = []
const events = []
let failPush = false
let deferredRecords = false
const pendingRecords = []
let pollResult = { sessionId: 1, status: 'NeedVerifyCode' }
let pendingPoll
let lastPollSignal
const api = {
  fetchMyClawBotAccount: async () => ({
    userId: 'test-user',
    status: 'Bound',
    bound: true,
    hasConversationContext: true
  }),
  fetchMyClawBotDeliveries: async (params) => {
    calls.push({ kind: 'deliveries', ...params })
    return { records: [], total: 0, ...params }
  },
  fetchMyClawBotMessages: async (params) => {
    calls.push({ kind: 'messages', ...params })
    if (deferredRecords) return new Promise((resolve) => pendingRecords.push({ resolve, params }))
    return { records: [], total: 0, ...params }
  },
  sendMyClawBotTest: async (content) => {
    calls.push({ kind: 'send', content })
    return { id: 1, status: 'Sent' }
  },
  setMyClawBotMcpPushEnabled: async (enabled) => {
    calls.push({ kind: 'push', enabled })
    if (failPush) throw new Error('offline fixture')
  },
  unbindClawBot: async () => {
    calls.push({ kind: 'unbind' })
  },
  createClawBotBinding: async () => ({
    sessionId: 1,
    status: 'Waiting',
    qrcodeUrl: 'https://example.test/qr'
  }),
  fetchClawBotBindingStatus: async (_id, signal) => {
    lastPollSignal = signal
    if (pendingPoll) return pendingPoll
    return pollResult
  },
  verifyClawBotBinding: async (_id, code) => {
    calls.push({ kind: 'verify', code })
    return { sessionId: 1, status: 'Confirmed' }
  }
}
const dependencies = {
  'element-plus': { ElMessage: { success() {}, info() {}, warning() {}, error() {} } },
  'qrcode.vue': { __esModule: true, default: {} },
  '@/api/wechat-clawbot': api
}
const componentNames = [
  'ClawBotBindingTab',
  'ClawBotAiConnection',
  'ClawBotMessageTest',
  'ClawBotReceivedRecords',
  'ClawBotDeliveryRecords',
  'ClawBotBindingDialog'
]
for (const name of componentNames)
  dependencies['./components/' + name + '.vue'] = { __esModule: true, default: {} }
dependencies['./ClawBotBindingDialog.vue'] = { __esModule: true, default: {} }

async function evaluate(source, filename) {
  const compiled = await transformWithEsbuild(source, filename, { loader: 'ts', format: 'cjs' })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.code)(
    (name) => dependencies[name] ?? require(name),
    module,
    module.exports
  )
  return module.exports
}
dependencies['../composables/useClawBotRecordPage'] = await evaluate(
  await readFile(root + '/composables/useClawBotRecordPage.ts', 'utf8'),
  'records.ts'
)
const compiledComponents = {}
for (const file of [
  'index.vue',
  ...componentNames
    .filter((name) => name !== 'ClawBotAiConnection')
    .map((name) => 'components/' + name + '.vue')
]) {
  const filename = root + '/' + file
  const source = await readFile(filename, 'utf8')
  const { descriptor } = parse(source, { filename })
  const template = compileTemplate({ source: descriptor.template.content, filename, id: file })
  assert.deepEqual(template.errors, [], filename + ' template must compile')
  if (file === 'index.vue') {
    const panes = []
    function inspect(node) {
      if (node.type === 1 && node.tag === 'ElTabPane') panes.push(node)
      for (const child of node.children || []) inspect(child)
    }
    inspect(template.ast)
    const attr = (node, name) => node.props.find((prop) => prop.type === 6 && prop.name === name)
    assert.deepEqual(
      panes.map((pane) => attr(pane, 'name').value.content),
      ['binding', 'ai', 'test', 'received', 'sent']
    )
    assert.deepEqual(
      panes.map((pane) =>
        pane.children.filter((child) => child.type === 1).map((child) => child.tag)
      ),
      componentNames.slice(0, 5).map((name) => [name])
    )
    assert.ok(attr(panes[1], 'lazy'))
    assert.ok(
      source.split('\n').length < 250,
      'parent should contain orchestration, not individual tab business'
    )
    assert.doesNotMatch(source, /pollBindingStatus|sendMyClawBotTest|ElTableColumn|QrcodeVue/)
    assert.match(source, /overflow: auto/)
    assert.match(source, /var\(--el-bg-color\)/)
  }
  const script = compileScript(descriptor, { id: file })
  compiledComponents[file] = (
    await evaluate(
      "const {ref,reactive,computed,watch,onMounted,onActivated,onDeactivated,onUnmounted}=require('vue');\n" +
        script.content,
      filename + '.ts'
    )
  ).default
}
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
const apps = []
function mount(file, props = {}) {
  const app = renderer.createApp({ ...compiledComponents[file], render: () => null }, props)
  apps.push(app)
  return app.mount({}).$.setupState
}
async function settle() {
  for (let index = 0; index < 10; index++) await nextTick()
}
const account = reactive({
  userId: 'test-user',
  userName: 'test-user',
  status: 'Bound',
  bound: true,
  mcpPushEnabled: true,
  adminDisabled: false,
  hasConversationContext: true
})
try {
  const received = mount('components/ClawBotReceivedRecords.vue', { autoRefresh: true })
  const delivered = mount('components/ClawBotDeliveryRecords.vue')
  const message = mount('components/ClawBotMessageTest.vue', {
    account,
    onSent: () => events.push('sent')
  })
  const binding = mount('components/ClawBotBindingTab.vue', {
    account,
    statusLabel: '已绑定',
    onChanged: () => events.push('changed'),
    onUnbound: () => events.push('unbound')
  })
  const dialog = mount('components/ClawBotBindingDialog.vue', {
    onConfirmed: () => events.push('confirmed'),
    onStartTest: () => events.push('test')
  })
  const parent = mount('index.vue')
  await settle()
  assert.equal(parent.activeTab, 'binding')
  let aiRefreshes = 0
  parent.aiConnection = {
    refresh: async () => {
      aiRefreshes++
    }
  }
  parent.receivedRecords = { refresh: received.refresh }
  parent.deliveryRecords = { refresh: delivered.refresh }
  parent.messageTest = { resetResult: message.resetResult }
  received.page.current = 3
  delivered.page.current = 2
  message.testContent = '尚未发送的测试消息'
  for (const tab of ['ai', 'received', 'sent', 'test']) parent.activeTab = tab
  await parent.refreshRecords()
  assert.equal(aiRefreshes, 1)
  assert.equal(received.page.current, 3)
  assert.equal(delivered.page.current, 2)
  assert.equal(message.testContent, '尚未发送的测试消息')
  assert.ok(calls.some((call) => call.kind === 'messages' && call.current === 3))
  assert.ok(calls.some((call) => call.kind === 'deliveries' && call.current === 2))
  await message.sendTest()
  assert.equal(message.testResult.status, 'Sent')
  assert.ok(events.includes('sent'))
  await parent.handleUnbound()
  assert.equal(message.testResult, undefined)
  account.adminDisabled = true
  const sends = calls.filter((call) => call.kind === 'send').length
  await message.sendTest()
  assert.equal(calls.filter((call) => call.kind === 'send').length, sends)
  account.adminDisabled = false
  assert.equal(received.messageTypeLabel('Image'), '图片')
  assert.equal(delivered.deliveryStatusLabel('Failed'), '发送失败')
  binding.pushEnabled = false
  await binding.updatePushEnabled(false)
  assert.equal(account.mcpPushEnabled, true, 'binding child must not mutate parent account props')
  account.mcpPushEnabled = false
  await settle()
  failPush = true
  binding.pushEnabled = true
  await binding.updatePushEnabled(true)
  assert.equal(
    binding.pushEnabled,
    false,
    'failed switch update should restore parent-confirmed value'
  )
  failPush = false
  let dialogClosed = 0
  binding.bindingDialog = { close: () => dialogClosed++, open: async () => {} }
  await binding.openBinding()
  assert.equal(binding.bindingLoading, false)
  await binding.unbind()
  assert.equal(dialogClosed, 1)
  assert.ok(events.includes('unbound'))
  await dialog.open()
  await settle()
  assert.equal(dialog.binding.status, 'NeedVerifyCode')
  dialog.verifyCode = '123456'
  await dialog.submitVerifyCode()
  assert.equal(dialog.binding.status, 'Confirmed')
  assert.ok(events.includes('confirmed'))
  dialog.finishBinding()
  assert.equal(dialog.visible, false)
  assert.ok(events.includes('test'))
  let resolveLatePoll
  pendingPoll = new Promise((resolve) => {
    resolveLatePoll = resolve
  })
  await dialog.open()
  await settle()
  dialog.close()
  assert.equal(lastPollSignal.aborted, true)
  const confirmedCount = events.filter((event) => event === 'confirmed').length
  resolveLatePoll({ sessionId: 1, status: 'Confirmed' })
  await settle()
  assert.equal(
    events.filter((event) => event === 'confirmed').length,
    confirmedCount,
    'closed dialog must ignore stale poll result'
  )
  deferredRecords = true
  received.page.current = 1
  const older = received.refresh()
  received.page.current = 2
  const newer = received.refresh()
  pendingRecords[1].resolve({ current: 2, size: 10, total: 20, records: [{ content: 'new page' }] })
  await newer
  pendingRecords[0].resolve({ current: 1, size: 10, total: 20, records: [{ content: 'old page' }] })
  await older
  assert.equal(received.page.current, 2)
  assert.equal(received.page.records[0].content, 'new page')
  assert.equal(received.loading, false)
} finally {
  for (const app of apps.reverse()) app.unmount()
}
console.log(
  'PASS: split tabs, minimal parent, shared refresh, independent paging, stale-response guard, send/unbind events and QR verification/cancellation'
)
