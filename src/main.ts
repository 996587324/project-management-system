import App from './App.vue'
import { createApp } from 'vue'
import { initStore } from './store'                 // Store
import { initRouter } from './router'               // Router
import language from './locales'                    // 国际化
import '@styles/core/tailwind.css'                  // tailwind
import '@styles/index.scss'                         // 样式
import '@utils/sys/console.ts'                      // 控制台输出内容
import { setupGlobDirectives } from './directives'
import { setupErrorHandle } from './utils/sys/error-handle'
import { setupUserOperationTracking } from './utils/user-operation'
import {
  configureApplicationClient,
  getApplicationCode,
  loadApplicationEntryInformation
} from './utils/system-applications/client'
import { useUserStore } from './store/modules/user'

document.addEventListener(
  'touchstart',
  function () {},
  { passive: false }
)

const app = createApp(App)
initStore(app)
configureApplicationClient(getApplicationCode(), () => useUserStore().accessToken,
  (token) => useUserStore().setToken(token, useUserStore().refreshToken))
void loadApplicationEntryInformation().catch(() => undefined)
initRouter(app)
setupGlobDirectives(app)
setupErrorHandle(app)
setupUserOperationTracking()

app.use(language)
app.mount('#app')
