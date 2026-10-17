import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

const files = [
  'src/views/agent/process-board/index.vue',
  'src/views/agent/assistant/index.vue',
  'src/views/agent/executor/index.vue'
]
for (const file of files) {
  const source = await readFile(file, 'utf8')
  const { descriptor, errors } = parse(source, { filename: file })
  assert.deepEqual(errors, [])
  assert.deepEqual(
    compileTemplate({ source: descriptor.template.content, filename: file, id: 'process-agent' })
      .errors,
    []
  )
  compileScript(descriptor, { id: 'process-agent' })
}
const profile = await readFile('src/views/agent/executor/index.vue', 'utf8')
assert.match(profile, /code: 'process-board'/)
assert.match(profile, /label: '产线工艺看板'/)
assert.match(profile, /给参数卡片新增温度字段/)
const domain = profile.slice(profile.indexOf("code: 'process-board'"))
assert.match(domain.slice(0, domain.indexOf('const chatProfile')), /confirmByReplyOnly: true/)
const assistant = await readFile('src/views/agent/assistant/index.vue', 'utf8')
assert.match(assistant, /enabledDomains[\s\S]*?'process-board'/)
const page = await readFile('src/views/agent/process-board/index.vue', 'utf8')
assert.match(page, /agent-code="process-board"/)
assert.match(page, /:confirm-by-reply-only="true"/)
const route = await readFile('src/router/modules/agent.ts', 'utf8')
assert.match(route, /name: 'ProcessBoardAgent'/)
assert.match(route, /component: '\/agent\/process-board'/)
console.log(
  'PASS: ProcessBoard Agent page/profile, unified work selector, direct route and reply-confirmation compile checks'
)
