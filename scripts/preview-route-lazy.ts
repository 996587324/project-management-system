// 只使用内存接口，验证真实业务页面懒加载期间没有整页刷新。
import path from 'node:path'
import { createServer } from 'vite'
import { hourlyConfigFixture } from '../tests/fixtures/hourly-config'

const mode = process.argv[2] || 'development'
const appCode = mode === 'system-b' ? 'B' : 'A'
const port = appCode === 'B' ? 31997 : 31996
const board = hourlyConfigFixture()
const server = await createServer({
  mode,
  cacheDir: path.resolve(
    process.env.ROUTE_LAZY_CACHE_DIR || `../.codex-build/route-lazy/cache-${appCode}`
  ),
  server: { host: '127.0.0.1', port, strictPort: true, open: false },
  plugins: [
    {
      name: 'route-lazy-memory-api',
      enforce: 'pre',
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          const url = new URL(request.url || '/', 'http://localhost')
          if (!url.pathname.startsWith('/api/')) return next()
          let data: unknown = []
          if (url.pathname.endsWith('/resolve')) data = null
          else if (url.pathname === '/api/hourly-production/definitions') data = [board]
          else if (url.pathname.endsWith('/boards'))
            data = [{ code: board.code, name: board.name, published: false }]
          else if (url.pathname.endsWith('/runtime'))
            data = {
              code: board.code,
              name: board.name,
              version: 1,
              refreshSeconds: 300,
              productionDate: '2026-10-24',
              serverTime: '2026-10-24T12:00:00',
              lines: []
            }
          else if (url.pathname.endsWith('/setting'))
            data = {
              formulaUseType: 'Personal',
              formulaSignature: '',
              formulaTermsAccepted: false,
              sampleIntervalSeconds: 5,
              retentionHours: 120,
              pushIntervalSeconds: 5
            }
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ code: 200, msg: '隔离测试数据', data }))
        })
      }
    }
  ]
})
await server.listen()
console.log(
  `APP ${appCode}; cache=${server.config.cacheDir}; noDiscovery=${server.config.optimizeDeps.noDiscovery}; include=${server.config.optimizeDeps.include?.length}`
)
console.log(`http://127.0.0.1:${port}/tests/route-lazy-preview.html`)
