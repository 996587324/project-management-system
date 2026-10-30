import path from 'node:path'
import { createServer } from 'vite'
const target = process.env.HOURLY_UI_API || ''
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(target))
  throw new Error('请提供 HourlyProductionSmoke 输出的隔离后端回环地址')
const server = await createServer({
  cacheDir: path.resolve('../.codex-build/hourly-readd-preview/cache'),
  server: {
    host: '127.0.0.1',
    port: 31996,
    strictPort: true,
    open: false,
    proxy: {
      '/api': {
        target,
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (request) => request.setHeader('X-Test-User', 'owner'))
        }
      }
    }
  }
})
await server.listen()
console.log('真实隔离库验证：http://127.0.0.1:31996/tests/hourly-readd-preview.html')
