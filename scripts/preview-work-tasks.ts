import path from 'node:path'
import { createServer } from 'vite'

// 仅连接 WorkTaskSmoke 创建的随机隔离库测试主机，不读取生产配置或模拟业务成功。
const target = process.env.WORK_TASK_UI_API || ''
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(target))
  throw new Error('请先启动 WorkTaskSmoke 的 UI 保留模式，并传入其实际回环地址')
const server = await createServer({
  cacheDir: path.resolve('../.codex-build/work-task-preview/cache'),
  server: {
    host: '127.0.0.1',
    port: 31994,
    strictPort: true,
    open: false,
    proxy: { '/api': { target, changeOrigin: true }, '/mcp': { target, changeOrigin: true } }
  }
})
await server.listen()
console.log(
  '工作任务真实隔离后端验证：http://127.0.0.1:31994/tests/work-task-preview.html?user=employee#/my'
)
