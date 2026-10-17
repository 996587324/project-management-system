import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { runInNewContext } from 'node:vm'

// 不连接后端、不修改浏览器或业务数据；验证两套构建的入口、缓存分区和路由布局。
for (const mode of ['development', 'system-b']) {
  const server = await createServer({ mode, server: { middlewareMode: true } })
  try {
    const client = await server.ssrLoadModule('/src/utils/system-applications/client.ts')
    const expected = mode === 'system-b' ? 'B' : 'A'
    assert.equal(client.getApplicationCode(), expected)
    assert.equal(client.applicationStorageKey('user'), `calmadmin:${expected}:user`)
    assert.equal(client.applicationStorageKey('worktab'), `calmadmin:${expected}:worktab`)
    const storage = await server.ssrLoadModule('/src/utils/storage/storage-config.ts')
    assert.equal(storage.StorageConfig.THEME_KEY, `calmadmin:${expected}:theme`)
    assert.equal(storage.StorageConfig.LAST_USER_ID_KEY, `calmadmin:${expected}:last-user-id`)

    const html = await server.transformIndexHtml('/', await readFile('index.html', 'utf8'))
    assert.ok(html.includes(`data-application="${expected}"`))
    assert.ok(html.includes('/src/main.ts'))
    assert.ok(!html.includes('/src/system-b/main.ts'))
    if (expected === 'B') assert.ok(!html.includes('<title>系统 B</title>'))

    const { RouteTransformer } = await server.ssrLoadModule('/src/router/core/RouteTransformer.ts')
    const layout = () => Promise.resolve({})
    const requested = []
    const loader = {
      loadLayout: () => layout,
      loadIframe: () => () => Promise.resolve({}),
      load: (path) => {
        requested.push(path)
        return () => Promise.resolve({})
      }
    }
    const transformer = new RouteTransformer(loader)
    const workbench = transformer.transform({
      name: 'SystemBWorkbench',
      path: '/workbench',
      component: '/system-b/workbench',
      meta: { title: '工作台' },
      children: []
    })
    assert.equal(workbench.component, layout)
    assert.equal(workbench.children[0].name, 'SystemBWorkbench')
    const reused = transformer.transform({
      name: 'CustomProject',
      path: '/business',
      component: '/index/index',
      meta: { title: 'B 业务' },
      children: [
        {
          name: 'IndependentProjectPage',
          path: '/business/projects',
          component: '/projectmanage/project',
          meta: { title: '项目列表', permissionKey: 'ProjectLedger' }
        }
      ]
    })
    assert.equal(reused.children[0].meta.permissionKey, 'ProjectLedger')
    assert.ok(requested.includes('/index/index'))
    assert.ok(requested.includes('/projectmanage/project'))
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousFetch = globalThis.fetch
    const previousCustomEvent = globalThis.CustomEvent
    const names = new Map([
      ['calmadmin:A:display-name', '智能制造管理系统'],
      ['calmadmin:B:display-name', '工艺智能管理系统']
    ])
    const localStorage = {
      getItem: (key) => names.get(key) ?? null,
      setItem: (key, value) => names.set(key, value)
    }
    try {
      const initialDocument = {
        title: '正在加载…',
        documentElement: { dataset: { application: expected }, classList: { add() {} } }
      }
      const startupScript = html.match(/<script>([\s\S]*?)<\/script>/)[1]
      runInNewContext(startupScript, {
        Storage: function () {},
        window: { localStorage },
        localStorage,
        document: initialDocument
      })
      assert.equal(initialDocument.title, names.get(`calmadmin:${expected}:display-name`))
      globalThis.window = { localStorage, dispatchEvent: () => true }
      globalThis.document = { title: `工作台 - ${client.getApplicationName()}` }
      globalThis.CustomEvent = class {
        constructor(type, options) {
          this.type = type
          this.detail = options.detail
        }
      }
      const configuredName = expected === 'B' ? '工艺智能管理系统' : '智能制造管理系统'
      let calls = 0
      globalThis.fetch = async (url, options) => {
        assert.ok(url.endsWith(`/api/system-applications/entry-information?appCode=${expected}`))
        assert.equal(options.headers.Authorization, undefined)
        assert.equal(options.cache, 'no-store')
        calls += 1
        return {
          ok: true,
          json: async () => ({
            code: 200,
            data: {
              appCode: expected,
              displayName: configuredName,
              portalUrl: 'http://localhost:3006/#/portal'
            }
          })
        }
      }
      const first = client.loadApplicationEntryInformation()
      assert.equal(first, client.loadApplicationEntryInformation())
      await first
      assert.equal(calls, 1)
      assert.equal(client.applicationDisplayName.value, configuredName)
      assert.equal(document.title, `工作台 - ${configuredName}`)
      assert.equal(names.get(`calmadmin:${expected}:display-name`), configuredName)
      globalThis.fetch = async () => {
        throw new Error('network unavailable')
      }
      await assert.rejects(client.loadApplicationEntryInformation())
      assert.equal(client.getApplicationName(), configuredName)
      console.log(
        `PASS: ${expected} cached loading title, configured branding, deduplicated lookup and network fallback.`
      )
    } finally {
      globalThis.window = previousWindow
      globalThis.document = previousDocument
      globalThis.fetch = previousFetch
      globalThis.CustomEvent = previousCustomEvent
    }
    console.log(`PASS: ${expected} common bootstrap, isolated storage and full dynamic layout.`)
  } finally {
    await server.close()
  }
}
// 部分 Vite 插件在 SSR 验证后保留依赖优化句柄；本脚本已完成并关闭两个验证服务器。
process.exit(0)
