import '../src/App.vue'
import { createApp, h, ref } from 'vue'
import { createRouter, createWebHashHistory, RouterView } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { initStore } from '../src/store'
import { useUserStore } from '../src/store/modules/user'

const counterKey = 'route-lazy-preview-boots'
const boots = Number(sessionStorage.getItem(counterKey) || 0) + 1
sessionStorage.setItem(counterKey, String(boots))
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: { render: () => h('p', '请选择一个尚未加载的页面') } },
    { path: '/hourly', component: () => import('../src/views/hourly-production/config/index.vue') },
    { path: '/process', component: () => import('../src/views/process-board/config/index.vue') },
    { path: '/board', component: () => import('../src/views/hourly-production/board/index.vue') },
    { path: '/editor', component: () => import('./route-lazy-editor.vue') }
  ]
})
window.__APP_RUNTIME_CONFIG__ = { apiBaseUrl: location.origin }
const app = createApp({
  setup() {
    useUserStore().setToken(
      `mock.${btoa(JSON.stringify({ SessionId: 'route-lazy-preview', TokenPurpose: 'app', exp: Math.floor(Date.now() / 1000) + 3600 }))}.mock`
    )
    useUserStore().setLoginStatus(true)
    const draft = ref('首次切换后此输入应保留')
    return () =>
      h('div', [
        h(
          'nav',
          { style: 'padding:16px;display:flex;gap:12px;align-items:center;background:#eef3fa' },
          [
            h('strong', `页面启动次数：${boots}`),
            h('input', {
              'aria-label': '未保存内容',
              value: draft.value,
              onInput: (event: Event) => {
                draft.value = (event.target as HTMLInputElement).value
              }
            }),
            ...[
              ['/hourly', '小时配置'],
              ['/process', '工艺配置'],
              ['/board', '小时看板'],
              ['/editor', '富文本编辑器']
            ].map(([url, text]) => h('button', { onClick: () => router.push(url) }, text))
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
