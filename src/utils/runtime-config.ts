/** 由 public/runtime-config.js 在应用启动前写入的运行时配置。 */
export interface AppRuntimeConfig {
  /** HTTP API 公共前缀，例如 /xxtdxm 或 https://example.com/xxtdxm。 */
  apiBaseUrl?: string
  /** WebSocket 公共前缀；未设置时自动使用 apiBaseUrl。 */
  wsBaseUrl?: string
}

declare global {
  interface Window {
    __APP_RUNTIME_CONFIG__?: AppRuntimeConfig
  }
}

function normalizeBaseUrl(value?: string) {
  const normalized = String(value || '').trim().replace(/\/+$/, '')
  return normalized === '/' ? '' : normalized
}

function getRuntimeConfig() {
  return window.__APP_RUNTIME_CONFIG__ || {}
}

/** 统一读取 HTTP API 前缀，优先级：运行时文件 > Vite 环境变量。 */
export function getApiBaseUrl() {
  const config = getRuntimeConfig()
  return normalizeBaseUrl(config.apiBaseUrl || import.meta.env.VITE_API_URL)
}

/** 拼接 API 前缀和后端路径，避免手写前缀造成遗漏。 */
export function getApiUrl(path: string) {
  const apiBaseUrl = getApiBaseUrl()
  const apiPath = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}${apiPath}`
}

/** 统一读取 Agent WebSocket 前缀，默认跟随 HTTP API 前缀。 */
export function getWebSocketBaseUrl() {
  const config = getRuntimeConfig()
  return normalizeBaseUrl(
    config.wsBaseUrl || import.meta.env.VITE_WS_URL || config.apiBaseUrl || import.meta.env.VITE_API_URL
  )
}
