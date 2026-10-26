import '../src/App.vue'
import { createApp, h } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { initStore } from '../src/store'
import { router } from '../src/router'
import { useUserStore } from '../src/store/modules/user'
import Board from '../src/views/hourly-production/board/index.vue'

window.__APP_RUNTIME_CONFIG__ = { apiBaseUrl: 'http://127.0.0.1:31995' }
const app = createApp({
  setup() {
    useUserStore().setToken(
      `mock.${btoa(JSON.stringify({ SessionId: 'hourly-selection-preview', TokenPurpose: 'app', exp: Math.floor(Date.now() / 1000) + 3600 }))}.mock`
    )
    useUserStore().setLoginStatus(true)
    return () => h(Board)
  }
})
initStore(app)
app.use(router)
app.use(ElementPlus)
app.mount('#app')
