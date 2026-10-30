import '../src/App.vue'
import { createApp, h } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import language from '../src/locales'
import { initStore } from '../src/store'
import { useUserStore } from '../src/store/modules/user'
import MenuPage from '../src/views/system/menu/index.vue'

window.__APP_RUNTIME_CONFIG__ = { apiBaseUrl: location.origin }
const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', component: { render: () => null } }]
})
const app = createApp({
  setup() {
    const store = useUserStore()
    store.setToken(
      `mock.${btoa(JSON.stringify({ SessionId: 'menu-isolated', TokenPurpose: 'app', AppCode: 'A', exp: Math.floor(Date.now() / 1000) + 3600 }))}.mock`
    )
    store.info.userId = 'admin'
    store.setLoginStatus(true)
    return () => h('div', [h('p', '随机隔离 SQL 库 · 菜单新增验证'), h(MenuPage)])
  }
})
initStore(app)
app.directive('auth', {})
app.directive('ripple', {})
app.use(router)
app.use(language)
app.use(ElementPlus)
app.mount('#app')
