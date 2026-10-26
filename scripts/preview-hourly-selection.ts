// 使用真实页面与 HTTP 客户端，接口数据仅存内存，不读写业务数据库。
import { createServer } from 'vite'

const boards = [
  { Code: 'hourly-one', Name: '第一产量看板', Published: false },
  { Code: 'hourly-two', Name: '第二产量看板', Published: true }
]
const server = await createServer({
  server: { host: '127.0.0.1', port: 31995, strictPort: true, open: false },
  plugins: [
    {
      name: 'hourly-selection-mock',
      enforce: 'pre',
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          const url = new URL(request.url || '/', 'http://localhost')
          if (!url.pathname.startsWith('/api/')) return next()
          let data: unknown = []
          let status = 200
          if (url.pathname.endsWith('/boards')) {
            // 正在运行的旧后端按 DefaultContractResolver 返回大写属性。
            data = boards
          } else if (url.pathname.endsWith('/runtime')) {
            const board = boards.find((item) => item.Code === url.searchParams.get('code'))
            console.log('RUNTIME', url.searchParams.get('code'))
            if (!board) status = 400
            else
              data = {
                code: board.Code,
                name: board.Name,
                version: 1,
                refreshSeconds: 300,
                productionDate: '2026-10-23',
                serverTime: '2026-10-23T17:30:00',
                lines: ['A', 'B'].map((code) => ({
                  code,
                  name: `${code}线`,
                  totalOutput: board.Code === 'hourly-one' ? 11 : 22,
                  achievedProcesses: 0,
                  targetedProcesses: 0,
                  summaryProcessName: '商检',
                  summaryPoints: [],
                  processes: []
                }))
              }
          }
          response.statusCode = status
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(
            JSON.stringify({
              code: status,
              msg: status === 200 ? '模拟数据' : '看板编码无效',
              data
            })
          )
        })
      }
    }
  ]
})
await server.listen()
console.log('小时看板选择复现：http://127.0.0.1:31995/tests/hourly-selection-preview.html')
