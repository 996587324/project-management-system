import assert from 'node:assert/strict'
import { readFile, access, mkdtemp, realpath, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { transformWithEsbuild } from 'vite'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'
import * as sass from 'sass'

const testRequire = createRequire(import.meta.url)
const { createRenderer, nextTick } = testRequire('vue')

async function evaluateTypeScript(source, file, dependencies) {
  const result = await transformWithEsbuild(source, file, { loader: 'ts', format: 'cjs' })
  const module = { exports: {} }
  const requireModule = (name) => dependencies[name] ?? testRequire(name)
  new Function('require', 'module', 'exports', result.code)(requireModule, module, module.exports)
  return module.exports
}

const api = await evaluateTypeScript(await readFile('src/api/process-board.ts', 'utf8'), 'api.ts', {
  '@/utils/http': { default: {} }
})
for (const kind of ['Region', 'Line', 'Card']) {
  assert.equal(api.emptyDefinition(kind).fieldColumns, 1)
  assert.equal(api.emptyDefinition(kind).columns, 3)
}
for (const value of [undefined, null, 0, -1, 7, 1.5, '3', NaN, Infinity]) {
  assert.equal(api.normalizeFieldColumns(value), 1)
}
for (let columns = 1; columns <= 6; columns++) {
  assert.equal(api.normalizeFieldColumns(columns), columns)
}

const configFile = 'src/views/process-board/config/index.vue'
const { descriptor } = parse(await readFile(configFile, 'utf8'), { filename: configFile })
const script = compileScript(descriptor, { id: 'card-field-config-test' })
const saved = []
const warnings = []
const setting = { sampleIntervalSeconds: 5, retentionHours: 120, pushIntervalSeconds: 5 }
const componentModule = await evaluateTypeScript(script.content, 'config-test.ts', {
  '@/api/process-board': {
    ...api,
    processApi: {
      definitions: async () => saved,
      setting: async () => setting,
      save: async (value) => {
        saved.push(value)
        return value
      }
    }
  },
  'vue-router': { useRouter: () => ({ push() {} }) },
  'element-plus': { ElMessage: { warning: (message) => warnings.push(message), success() {} } },
  '../components/ParameterFieldEditor.vue': {},
  '../components/SourceBindingEditor.vue': {}
})
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
const app = renderer.createApp({ ...componentModule.default, render: () => null })
try {
  const state = app.mount({}).$.setupState
  await nextTick()
  await nextTick()
  state.kind = 'Card'
  const legacy = api.emptyDefinition('Card', 8)
  delete legacy.fieldColumns
  legacy.id = 9
  legacy.code = 'legacy'
  legacy.name = '历史卡片'
  state.open(legacy)
  assert.equal(state.form.fieldColumns, 1)
  assert.equal(legacy.fieldColumns, undefined, 'opening must not mutate original row')
  for (let columns = 1; columns <= 6; columns++) {
    state.open({ ...legacy, fieldColumns: columns })
    assert.equal(state.form.fieldColumns, columns)
    await state.save()
    assert.equal(saved.at(-1).fieldColumns, columns)
    assert.equal(saved.at(-1).columns, 3)
    state.open(saved.at(-1))
    assert.equal(state.form.fieldColumns, columns, 'read-back retains selected number')
  }
  const savedCount = saved.length
  for (const value of [undefined, 0, -1, 7, 1.5]) {
    state.form.fieldColumns = value
    await state.save()
  }
  assert.equal(saved.length, savedCount, 'invalid input must not be submitted')
  assert.equal(warnings.length, 5)
} finally {
  app.unmount()
}

const boardFile = 'src/views/process-board/board/index.vue'
const board = parse(await readFile(boardFile, 'utf8'), { filename: boardFile }).descriptor
const template = compileTemplate({
  source: board.template.content,
  filename: boardFile,
  id: 'field-grid-test'
})
assert.deepEqual(template.errors, [])
assert.match(board.template.content, /normalizeFieldColumns\(card\.definition\.fieldColumns\)/)
assert.match(board.template.content, /@dblclick="openHistory\(card\.definition\.id, field\)"/)
const css = sass.compileString(board.styles[0].content).css
assert.match(css, /repeat\(auto-fit/)
assert.match(css, /overflow-wrap: anywhere/)
console.log(
  'PASS: defaults, legacy fallback, per-card config save/read-back, input bounds, Vue template and SCSS'
)

if (process.argv.includes('--browser')) {
  await verifyBrowserLayout(css)
}

async function verifyBrowserLayout(boardCss) {
  // 仅在隔离的 headless 浏览器中测试合成参数；不登录、不调用项目 API。
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ]
  let browser
  for (const candidate of candidates) {
    try {
      await access(candidate)
      browser = candidate
      break
    } catch {
      // 继续检查另一个本机已安装浏览器，不下载新软件。
    }
  }
  assert.ok(browser, 'browser layout verification requires installed Chrome or Edge')
  const profile = await mkdtemp(path.join(tmpdir(), 'process-field-layout-'))
  const markup = Array.from(
    { length: 12 },
    (_, index) => `
    <button class="parameter-row">
      <span class="state-dot Normal"></span>
      <span class="parameter-key">工艺温度参数LongParameterName${index}</span>
      <span class="parameter-value"><strong>12345678901234567890.123456789</strong><em>摄氏度LongUnit</em></span>
    </button>`
  ).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    :root { --el-text-color-primary: #303133; --el-text-color-secondary: #909399; --el-border-color-lighter: #ebeef5; --el-color-success: #67c23a; }
    body { font-family: Arial, sans-serif; }
    ${boardCss}
  </style></head><body><article class="parameter-card"><div class="parameter-fields">${markup}</div></article><pre id="layout-results"></pre><script>
    const grid = document.querySelector('.parameter-fields');
    const card = document.querySelector('.parameter-card');
    const results = [];
    for (let configured = 1; configured <= 6; configured++) {
      for (const width of [118, 160, 220, 360, 480, 692, 720, 960, 1320, 1800]) {
        card.style.width = (width + 42) + 'px';
        grid.style.setProperty('--field-columns', configured);
        const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        const expected = Math.max(1, Math.min(configured, Math.floor((width + 16) / 236)));
        const overflow = grid.scrollWidth > grid.clientWidth + 1;
        const buttons = [...grid.children];
        const firstRow = buttons.filter(button => Math.abs(button.getBoundingClientRect().y - buttons[0].getBoundingClientRect().y) < 1).length;
        results.push({ configured, width, columns, expected, overflow, firstRow });
      }
    }
    document.querySelector('#layout-results').textContent = JSON.stringify(results);
  </script></body></html>`
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(html)
  })
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${server.address().port}/`
    const output = await new Promise((resolve, reject) => {
      const process = spawn(
        browser,
        [
          '--headless=new',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-background-networking',
          '--disable-extensions',
          '--disable-component-update',
          `--user-data-dir=${profile}`,
          '--dump-dom',
          '--virtual-time-budget=2500',
          url
        ],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
      )
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        process.kill()
        reject(new Error('Headless layout test timed out'))
      }, 30000)
      process.stdout.on('data', (data) => {
        stdout += data
      })
      process.stderr.on('data', (data) => {
        stderr += data
      })
      process.on('error', reject)
      process.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) resolve(stdout)
        else reject(new Error(`Headless browser exited with ${code}: ${stderr.slice(0, 500)}`))
      })
    })
    const result = output.match(/<pre id="layout-results">([^<]+)<\/pre>/)
    assert.ok(result, 'headless browser must finish layout script')
    const results = JSON.parse(result[1])
    assert.equal(results.length, 60)
    for (const result of results) {
      assert.equal(result.columns, result.expected, JSON.stringify(result))
      assert.equal(result.firstRow, result.expected, 'fields should flow in configured grid order')
      assert.equal(
        result.overflow,
        false,
        'long key/value/unit must not create horizontal overflow'
      )
    }
    console.log(
      'PASS: real browser 1–6 columns across 60 widths, automatic reduction and long-content wrapping'
    )
  } finally {
    await new Promise((resolve) => server.close(resolve))
    // 只删除本次测试创建的独立浏览器配置目录，不触及用户浏览器配置。
    const resolved = await realpath(profile)
    const temporaryRoot = await realpath(tmpdir())
    assert.equal(path.dirname(resolved).toLowerCase(), temporaryRoot.toLowerCase())
    assert.ok(path.basename(resolved).startsWith('process-field-layout-'))
    await rm(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
  }
}
