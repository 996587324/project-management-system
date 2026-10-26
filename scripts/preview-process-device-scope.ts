// 本地内存模拟，不连接业务后端或发送真实推送。
import { createServer } from 'vite'

const binding = (deviceMark: string) => ({ tenantMark: 'tenant', deviceMark, sourcePath: '/value' })
const definition = (
  id: number,
  kind: string,
  name: string,
  parentId = 0,
  devices: ReturnType<typeof binding>[] = [],
  fields: object[] = []
) => ({
  id,
  kind,
  name,
  parentId,
  code: `TEST_${id}`,
  sort: id,
  enabled: true,
  version: 1,
  layout: 'grid',
  columns: 3,
  fieldColumns: 1,
  width: 360,
  height: 240,
  panelLayout: 'tabs',
  flowHeight: 270,
  trendHeight: 400,
  flowWidth: 0,
  trendWidth: 0,
  devices,
  fields,
  flow: [],
  edges: [],
  blocks: []
})
const oldField = {
  code: 'legacy',
  name: '历史温度',
  unit: '℃',
  source: binding('device-c'),
  fixedText: null,
  formula: '',
  recalculateEverySample: false,
  variables: {},
  constants: {},
  functions: [],
  precision: 2,
  comparisonPrecision: 6,
  traceEnabled: false,
  trendEnabled: false,
  traceRawValue: false,
  changeThreshold: 0,
  pushEnabled: false,
  pushOnChange: false,
  pushOnLimit: true,
  pushOnRecovery: false,
  recipientUserIds: []
}
let definitions = [
  definition(1, 'Region', '测试区域'),
  definition(2, 'Line', '关联设备A和B的线体', 1, [binding('device-a'), binding('device-b')]),
  definition(3, 'Line', '未关联设备的线体', 1),
  definition(4, 'Card', '历史越界卡片', 2, [], [oldField])
]
const devices = ['a', 'b', 'c'].map((letter) => ({
  kind: 'Realtime',
  sourceKey: 'tenant',
  deviceKey: `device-${letter}`,
  modelMark: 'MODEL',
  modelName: '测试设备模型',
  deviceName: `设备${letter.toUpperCase()}`,
  sourceDeviceCode: '',
  gatewayId: 0,
  connectionId: 0,
  gatewayName: '',
  connectionName: ''
}))
let nextId = 10
const server = await createServer({
  server: { host: '127.0.0.1', port: 31993, strictPort: true, open: false },
  plugins: [
    {
      name: 'process-device-scope-mock',
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
            if (url.pathname.endsWith('/definitions')) {
              if (request.method === 'POST') {
                let body = ''
                for await (const chunk of request) body += String(chunk)
                const value = JSON.parse(body)
                value.id ||= nextId++
                value.version++
                definitions = [...definitions.filter((row) => row.id !== value.id), value]
                data = value
              } else data = definitions
            } else if (url.pathname.endsWith('/setting'))
              data = {
                formulaUseType: 'Personal',
                formulaSignature: '',
                formulaTermsAccepted: false,
                sampleIntervalSeconds: 5,
                retentionHours: 120,
                pushIntervalSeconds: 5
              }
            else if (url.pathname.startsWith('/api/source-catalog/')) {
              // 账号拥有 A/C；线体关联 A/B；交集仅 A。
              let visible = devices.filter((device) => device.deviceKey !== 'device-b')
              const lineId = Number(url.searchParams.get('processLineId'))
              if (lineId) {
                const line = definitions.find((row) => row.id === lineId && row.kind === 'Line')
                visible = visible.filter((device) =>
                  line?.devices.some(
                    (source) =>
                      source.tenantMark === device.sourceKey &&
                      source.deviceMark === device.deviceKey
                  )
                )
              }
              const keyword = url.searchParams.get('keyword') || ''
              visible = visible.filter((device) =>
                `${device.deviceKey} ${device.deviceName} ${device.modelName}`.includes(keyword)
              )
              if (url.pathname.endsWith('/resolve'))
                data =
                  visible.find(
                    (device) => device.deviceKey === url.searchParams.get('deviceKey')
                  ) || null
              else
                data = {
                  records: url.pathname.endsWith('/models')
                    ? visible.length
                      ? [
                          {
                            modelMark: 'MODEL',
                            modelName: '测试设备模型',
                            deviceCount: visible.length
                          }
                        ]
                      : []
                    : visible,
                  total: url.pathname.endsWith('/models')
                    ? Number(visible.length > 0)
                    : visible.length,
                  page: 1,
                  size: 50
                }
            } else if (url.pathname.endsWith('/source-fields'))
              data = [{ sourcePath: '/value', fieldName: '温度', currentValue: 25 }]
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
console.log('工艺设备范围测试：http://127.0.0.1:31993/tests/process-device-scope-preview.html')
