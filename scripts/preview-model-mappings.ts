// 所有 /api 请求均在本地拦截，只修改内存中的模拟配置，不连接真实后端。
import { createServer } from 'vite'

let nextId = 10
let mappings = [
  {
    id: 7,
    dashboardCode: 'production-dashboard',
    modelMark: 'ROBOT_A',
    displayName: '穿片下线机器人',
    equipmentType: 'Robot',
    enabled: false,
    sort: 10
  },
  {
    id: 8,
    dashboardCode: 'production-dashboard',
    modelMark: 'FUTURE_MODEL',
    displayName: '预配置检测设备',
    equipmentType: 'Inspection',
    enabled: true,
    sort: 20
  }
]
const models = [
  {
    modelMark: 'ROBOT_A',
    modelName: 'ROBOT_A',
    deviceCount: 3,
    latestReceiveTime: '2026-10-23T09:00:00'
  },
  {
    modelMark: 'INSPECT_NEW',
    modelName: 'INSPECT_NEW',
    deviceCount: 4,
    latestReceiveTime: '2026-10-23T10:30:00'
  },
  {
    modelMark: '__UNCLASSIFIED__',
    modelName: '未分类模型',
    deviceCount: 2,
    latestReceiveTime: '2026-10-23T10:31:00'
  }
]
const server = await createServer({
  server: { host: '127.0.0.1', port: 31992, strictPort: true, open: false },
  plugins: [
    {
      name: 'model-mapping-preview-api',
      enforce: 'pre',
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          const url = new URL(request.url || '/', 'http://localhost')
          if (!url.pathname.startsWith('/api/')) {
            next()
            return
          }
          void (async () => {
            let data: unknown = []
            if (url.pathname.endsWith('/bootstrap'))
              data = {
                lines: [{ id: 1, lineCode: 'TEST', lineName: '测试产线', enabled: true }],
                sceneLayouts: [],
                widgets: []
              }
            else if (url.pathname === '/api/source-catalog/models') {
              const page = Number(url.searchParams.get('page') || 1)
              const size = Number(url.searchParams.get('size') || 100)
              data = {
                records: models.slice((page - 1) * size, page * size),
                total: models.length,
                page,
                size
              }
            } else if (url.pathname.endsWith('/model-display-mappings')) {
              if (request.method === 'POST') {
                let body = ''
                for await (const chunk of request) body += String(chunk)
                const mapping = JSON.parse(body)
                if (!mapping.id) mapping.id = nextId++
                mappings = [...mappings.filter((row) => row.id !== mapping.id), mapping]
                data = mapping
              } else data = mappings
            } else if (request.method === 'DELETE') {
              const id = Number(url.pathname.split('/').at(-1))
              mappings = mappings.filter((row) => row.id !== id)
              data = true
            }
            response.setHeader('Content-Type', 'application/json; charset=utf-8')
            response.end(JSON.stringify({ code: 200, msg: '模拟数据', data }))
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
console.log('本地模型映射测试：http://127.0.0.1:31992/tests/model-mapping-preview.html')
