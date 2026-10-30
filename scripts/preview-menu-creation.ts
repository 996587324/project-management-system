import path from 'node:path'
import { createServer } from 'vite'

// 使用真实菜单接口及随机测试库；代理仅为隔离测试主机设置测试身份。
const target = process.env.MENU_UI_API || ''
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(target)) throw new Error('请提供菜单测试主机的回环地址')
const server = await createServer({
  cacheDir: path.resolve('../.codex-build/menu-creation/cache'),
  server: {
    host: '127.0.0.1',
    port: 31997,
    strictPort: true,
    open: false,
    proxy: {
      '/api': {
        target,
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (req) => req.setHeader('X-Test-User', 'admin'))
        }
      }
    }
  }
})
await server.listen()
console.log('隔离菜单验证：http://127.0.0.1:31997/tests/menu-creation-preview.html')
