// 独立测试入口，配合 scripts/preview-model-mappings.ts 的本地模拟 API 使用。
import '../src/App.vue'
import { createApp, h } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { initStore } from '../src/store'
import { router } from '../src/router'
import { useUserStore } from '../src/store/modules/user'
import Configuration from '../src/views/production-dashboard/config-center/index.vue'

window.__APP_RUNTIME_CONFIG__ = { apiBaseUrl: 'http://127.0.0.1:31992' }
const app = createApp({
  setup() {
    const user = useUserStore()
    user.setToken(
      `mock.${btoa(JSON.stringify({ SessionId: 'model-mapping-preview', TokenPurpose: 'app', exp: Math.floor(Date.now() / 1000) + 3600 }))}.mock`
    )
    user.setLoginStatus(true)
    return () => h(Configuration)
  }
})
initStore(app)
app.use(router)
app.use(ElementPlus)
app.mount('#app')
