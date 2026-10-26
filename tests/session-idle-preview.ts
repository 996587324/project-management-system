// 仅供本地界面回归：模拟时间和 API，不访问真实后端或使用真实账号。
// 与正式入口保持相同的模块初始化顺序。
import '../src/App.vue'
import { createApp, h, ref } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { initStore } from '../src/store'
import { useUserStore } from '../src/store/modules/user'
import SessionIdleWarning from '../src/components/business/session-idle-warning/index.vue'

const realNow = Date.now.bind(Date)
let offset = 0
Date.now = () => realNow() + offset
let deadline = Date.now() + 20 * 60_000
const sessionId = `ui-test-${realNow()}`
let renewals = 0
window.fetch = async (input, options) => {
  const path = String(input)
  const sessionRequest =
    path.includes('/system-applications/session') || path.includes('/system-applications/activity')
  if (!sessionRequest)
    return new Response(JSON.stringify({ code: 200, data: {} }), {
      headers: { 'Content-Type': 'application/json' }
    })
  if (deadline <= Date.now()) return new Response(JSON.stringify({ code: 401 }), { status: 401 })
  if (path.includes('/activity')) {
    const age = JSON.parse(String(options?.body)).idleMilliseconds
    deadline = Math.max(deadline, Date.now() + 20 * 60_000 - age)
    renewals++
  }
  return new Response(
    JSON.stringify({
      code: 200,
      data: {
        sessionId,
        serverTimeUtc: new Date(Date.now()).toISOString(),
        expiresAtUtc: new Date(deadline).toISOString(),
        idleTimeoutSeconds: 1200
      }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
const mode = ref('正常使用')
const app = createApp({
  setup() {
    const user = useUserStore()
    const jwt = `mock.${btoa(JSON.stringify({ SessionId: sessionId, TokenPurpose: 'portal', exp: Math.floor((Date.now() + 25 * 60_000) / 1000) }))}.mock`
    user.setToken(jwt)
    user.setLoginStatus(true)
    return () =>
      h('main', { style: 'padding:48px;font:16px system-ui;background:#f5f7fa;min-height:100vh' }, [
        h('h1', '空闲退出界面测试'),
        h('p', '模拟数据，不会连接真实后端。'),
        h('p', `登录状态：${user.isLogin ? '已登录' : '已退出'}；当前场景：${mode.value}`),
        h(
          'button',
          {
            onClick: () => {
              offset += 19 * 60_000
              mode.value = '无操作19分钟'
            }
          },
          '模拟19分钟无操作'
        ),
        h(
          'button',
          {
            onClick: () => {
              offset += 20 * 60_000 + 1000
              mode.value = `无操作超过20分钟，续期次数${renewals}`
            },
            style: 'margin-left:16px'
          },
          '模拟超过20分钟无操作'
        ),
        h(SessionIdleWarning)
      ])
  }
})
initStore(app)
app.use(ElementPlus)
app.mount('#app')
