import '../src/App.vue'
import { createApp, h } from 'vue'
import { createRouter, createWebHashHistory, RouterLink, RouterView } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { initStore } from '../src/store'
import { useUserStore } from '../src/store/modules/user'

const user = new URLSearchParams(location.search).get('user') || 'employee'
if (!['employee', 'lead', '1'].includes(user)) throw new Error('仅允许固定测试身份')
window.__APP_RUNTIME_CONFIG__ = { apiBaseUrl: location.origin }
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/my', component: () => import('../src/views/work-tasks/my/index.vue') },
    { path: '/team', component: () => import('../src/views/work-tasks/team/index.vue') },
    { path: '/settings', component: () => import('../src/views/work-tasks/settings/index.vue') },
    { path: '/keys', component: () => import('../src/views/work-tasks/keys/index.vue') }
  ]
})
const app = createApp({
  setup() {
    const store = useUserStore()
    store.setToken(
      `mock.${btoa(JSON.stringify({ uiUser: user, SessionId: 'isolated-work-task-test', TokenPurpose: 'app', AppCode: 'A', exp: Math.floor(Date.now() / 1000) + 3600 }))}.mock`
    )
    store.info.userId = user
    store.setLoginStatus(true)
    return () =>
      h('div', [
        h(
          'nav',
          {
            style:
              'padding:16px;display:flex;gap:16px;flex-wrap:wrap;background:#eef3fa;color:#162638'
          },
          [
            h('strong', '随机隔离库 · 测试身份 ' + user),
            ...[
              ['/my', '我的工作'],
              ['/team', '团队工作'],
              ['/settings', '工作设置'],
              ['/keys', '个人连接']
            ].map(([to, label]) => h(RouterLink, { to }, () => label)),
            h('a', { href: '?user=employee#/my' }, '员工身份'),
            h('a', { href: '?user=lead#/team' }, '主管身份'),
            h('a', { href: '?user=1#/settings' }, '配置管理员')
          ]
        ),
        h(RouterView)
      ])
  }
})
initStore(app)
app.use(router)
app.use(ElementPlus)
app.mount('#app')
