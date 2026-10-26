import '../src/App.vue'
import { createApp, h } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { initStore } from '../src/store'
import { router } from '../src/router'
import { useUserStore } from '../src/store/modules/user'
import Configuration from '../src/views/process-board/config/index.vue'

window.__APP_RUNTIME_CONFIG__ = { apiBaseUrl: 'http://127.0.0.1:31993' }
const app = createApp({
  setup() {
    useUserStore().setToken(
      `mock.${btoa(JSON.stringify({ SessionId: 'process-scope-preview', TokenPurpose: 'app', exp: Math.floor(Date.now() / 1000) + 3600 }))}.mock`
    )
    useUserStore().setLoginStatus(true)
    return () => h(Configuration)
  }
})
initStore(app)
app.use(router)
app.use(ElementPlus)
app.mount('#app')
