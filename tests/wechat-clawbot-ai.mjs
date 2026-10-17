import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { transformWithEsbuild } from 'vite'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
const { createRenderer, nextTick } = require('vue')

async function evaluate(source, dependencies) {
  const compiled = await transformWithEsbuild(source, 'wechat-ai-test.ts', {
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

const requests = []
let apiState = { Configuration: { AppCode: 'B' }, State: 'Authorized', Used: 2 }
const api = await evaluate(await readFile('src/api/wechat-clawbot-ai.ts', 'utf8'), {
  '@/utils/http': {
    __esModule: true,
    default: {
      get: async (config) => {
        requests.push(config)
        return apiState
      },
      post: async (config) => {
        requests.push(config)
        return { Secret: 'one-time-fixture' }
      }
    }
  }
})
assert.deepEqual(await api.fetchClawBotAiState(), {
  configuration: { appCode: 'B', agentCodes: [] },
  state: 'Authorized',
  used: 2
})
apiState = { Configuration: { AppCode: 'B', Mode: 'Work', AgentCode: 'edge-gateway' } }
assert.deepEqual((await api.fetchClawBotAiState()).configuration.agentCodes, ['edge-gateway'])
apiState = {
  Configuration: {
    AppCode: 'B',
    Mode: 'Work',
    AgentCode: 'edge-gateway',
    AgentCodes: ['edge-gateway', 'production-dashboard']
  }
}
assert.deepEqual((await api.fetchClawBotAiState()).configuration.agentCodes, [
  'edge-gateway',
  'production-dashboard'
])
await api.saveClawBotAiConfiguration({ appCode: 'B', enabled: true })
assert.deepEqual(requests.at(-1).data, { appCode: 'B', enabled: true })
assert.equal(
  'userId' in requests.at(-1).data,
  false,
  'identity must be derived from authenticated backend account'
)
assert.deepEqual(await api.resetClawBotAiSecret(), { secret: 'one-time-fixture' })
await api.fetchClawBotAiJobs(3, 20)
assert.deepEqual(requests.at(-1).params, { current: 3, size: 20 })
assert.deepEqual(api.normalizeClawBotAi([{ AgentCode: 'chat', Name: '聊天' }]), [
  { agentCode: 'chat', name: '聊天' }
])

const file = 'src/views/wechat-clawbot/components/ClawBotAiConnection.vue'
const { descriptor } = parse(await readFile(file, 'utf8'), { filename: file })
assert.deepEqual(
  compileTemplate({ source: descriptor.template.content, filename: file, id: 'wechat-ai' }).errors,
  []
)
const compiled = compileScript(descriptor, { id: 'wechat-ai' })
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
const saved = []
const errors = []
let confirmation = true
let resetCount = 0
let disconnectCount = 0
let contextCount = 0
let optionsCount = 0
let serverState = {
  configuration: {
    enabled: false,
    appCode: 'B',
    mode: 'Chat',
    agentCode: 'chat',
    validHours: 24,
    dailyLimit: 50,
    botDailyLimit: 0,
    sendIntervalSeconds: 5,
    timeoutSeconds: 120,
    limitMessage: '额度已用完'
  },
  state: 'Unverified',
  hasSecret: true,
  used: 4,
  remaining: 46,
  day: '20261016'
}
const component = (
  await evaluate(
    `const {ref,reactive,computed,onMounted,onDeactivated}=require('vue');\n${compiled.content}`,
    {
      '@/api/wechat-clawbot-ai': {
        fetchClawBotAiState: async () => structuredClone(serverState),
        fetchClawBotAiOptions: async () => {
          optionsCount++
          return [
            {
              appCode: 'B',
              displayName: '工艺智能管理系统',
              allResources: false,
              agents: [
                { agentCode: 'chat', name: '聊天' },
                { agentCode: 'production-dashboard', name: '生产助手' },
                { agentCode: 'edge-gateway', name: '边缘计算助手' }
              ]
            }
          ]
        },
        fetchClawBotAiJobs: async () => [{ id: 1, status: 'Sent', kind: 'Agent' }],
        saveClawBotAiConfiguration: async (config) => {
          saved.push(config)
          serverState.configuration = config
        },
        resetClawBotAiSecret: async () => {
          resetCount++
          return { secret: 'one-time-fixture' }
        },
        disconnectClawBotAi: async () => {
          disconnectCount++
        },
        resetClawBotAiContext: async () => {
          contextCount++
        }
      },
      'element-plus': {
        ElMessage: { success() {}, warning: (text) => errors.push(text) },
        ElMessageBox: {
          confirm: async () => {
            if (!confirmation) throw 'cancel'
          }
        }
      }
    }
  )
).default
const app = renderer.createApp({ ...component, render: () => null })
const state = app.mount({}).$.setupState
try {
  for (let i = 0; i < 8; i++) await nextTick()
  assert.equal(state.form.appCode, 'B')
  assert.equal(state.options[0].displayName, '工艺智能管理系统')
  assert.equal(state.state.remaining, 46)
  assert.equal(state.stateLabel, '未验证')
  assert.equal(state.form.enabled, false)
  state.form.mode = 'Work'
  state.onModeChange()
  assert.equal(state.form.agentCode, 'production-dashboard')
  assert.deepEqual([...state.form.agentCodes], ['production-dashboard'])
  state.form.agentCodes = ['production-dashboard', 'edge-gateway']
  state.onAgentSelectionChange()
  assert.equal(state.selectedApplication.allResources, false)
  await state.save()
  assert.equal(saved.length, 1)
  assert.equal(saved[0].appCode, 'B')
  assert.equal(saved[0].mode, 'Work')
  assert.deepEqual(saved[0].agentCodes, ['production-dashboard', 'edge-gateway'])
  state.form.agentCodes = ['production-dashboard']
  state.form.limitMessage = '尚未保存的编辑'
  const optionsBeforeRefresh = optionsCount
  await state.refresh(false)
  assert.deepEqual(
    [...state.form.agentCodes],
    ['production-dashboard'],
    'periodic refresh must preserve unsaved multiple selection'
  )
  assert.equal(
    state.form.limitMessage,
    '尚未保存的编辑',
    'status refresh must not overwrite unsaved configuration'
  )
  assert.equal(
    optionsCount,
    optionsBeforeRefresh,
    'five-second status refresh must not repeatedly initialize agent definitions'
  )
  state.form.agentCodes = []
  await state.save()
  assert.equal(saved.length, 1)
  state.form.agentCodes = ['production-dashboard', 'unauthorized']
  await state.save()
  assert.equal(saved.length, 1)
  state.form.appCode = 'unauthorized'
  await state.save()
  assert.equal(saved.length, 1)
  assert.equal(errors.length, 3)
  confirmation = false
  await state.resetSecret()
  await state.disconnect()
  await state.clearContext()
  assert.equal(
    resetCount + disconnectCount + contextCount,
    0,
    'cancelled confirmations must not mutate connection or key'
  )
  confirmation = true
  await state.resetSecret()
  assert.equal(state.secretVisible, true)
  assert.equal(state.secret, 'one-time-fixture')
  await state.disconnect()
  await state.clearContext()
  assert.equal(disconnectCount, 1)
  assert.equal(contextCount, 1)
  assert.equal(state.jobStatusLabel('Unknown'), '结果待核对')
  assert.equal(state.kindLabel('Limit'), '额度提示')
  assert.equal(state.formatUtc(undefined), '-')
  assert.equal(state.formatUtc('not-a-date'), '-')
} finally {
  app.unmount()
}
assert.match(
  await readFile('src/views/wechat-clawbot/index.vue', 'utf8'),
  /<ClawBotAiConnection ref="aiConnection"/
)
console.log(
  'PASS: WeChat AI API normalization, actual page integration, configuration, confirmation, key display and refresh checks'
)
