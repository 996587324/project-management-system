import '../src/App.vue'
import { createApp, h } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { initStore } from '../src/store'
import { useUserStore } from '../src/store/modules/user'
import Configuration from '../src/views/hourly-production/config/index.vue'
window.__APP_RUNTIME_CONFIG__ = { apiBaseUrl: location.origin }
const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', component: { render: () => null } }]
})
const app = createApp({
  setup() {
    const store = useUserStore()
    store.setToken(
      `mock.${btoa(JSON.stringify({ SessionId: 'hourly-readd-isolated', TokenPurpose: 'app', AppCode: 'A', exp: Math.floor(Date.now() / 1000) + 3600 }))}.mock`
    )
    store.info.userId = 'owner'
    store.setLoginStatus(true)
    return () => h('div', [h('p', '随机隔离 SQL 库 · 恢复 / 同编码新建验证'), h(Configuration)])
  }
})
initStore(app)
app.use(router)
app.use(ElementPlus)
app.mount('#app')
