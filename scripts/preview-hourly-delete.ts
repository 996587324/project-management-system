// 仅使用内存模拟接口，不连接真实业务服务。
import { createServer } from 'vite'
import { hourlyConfigFixture } from '../tests/fixtures/hourly-config'
import { hourlyConfigIssue } from '../src/views/hourly-production/components/process-config-rules'

let board = hourlyConfigFixture()
const server = await createServer({
  server: { host: '127.0.0.1', port: 31994, strictPort: true, open: false },
  plugins: [
    {
      name: 'hourly-delete-mock',
      enforce: 'pre',
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          const url = new URL(request.url || '/', 'http://localhost')
          if (!url.pathname.startsWith('/api/')) return next()
          void (async () => {
            let data: unknown = []
            let msg = '模拟数据'
            let code = 200
            if (url.pathname.endsWith('/definitions')) {
              if (request.method === 'POST') {
                let body = ''
                for await (const chunk of request) body += String(chunk)
                const incoming = JSON.parse(body)
                const issue = hourlyConfigIssue(incoming)
                if (issue || incoming.name === '模拟后端校验失败') {
                  code = 400
                  msg =
                    issue?.message ||
                    '线体“B线”工序“注氟”数据绑定 1：请完整配置接入类型、设备及SN/求和字段'
                } else {
                  board = incoming
                  board.version++
                  console.log(
                    'PASS: saved mock definition',
                    JSON.stringify(
                      board.lines.map((line) => ({
                        code: line.code,
                        summary: line.summaryProcessCode,
                        processes: line.processes.map((process) => ({
                          code: process.code,
                          bindings: process.bindings
                        }))
                      }))
                    )
                  )
                }
                data = board
              } else data = [board]
            } else if (url.pathname.endsWith('/resolve')) data = null
            else if (url.pathname.endsWith('/fields'))
              data = [{ sourcePath: '/SN', fieldName: 'SN' }]
            response.statusCode = code
            response.setHeader('Content-Type', 'application/json; charset=utf-8')
            response.end(JSON.stringify({ code, msg, data }))
          })().catch((error) => {
            response.statusCode = 500
            response.end(String(error))
          })
        })
      }
    }
  ]
})
await server.listen()
console.log('小时产量删除回归：http://127.0.0.1:31994/tests/hourly-delete-preview.html')
