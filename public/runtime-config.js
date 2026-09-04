/**
 * 前端运行时配置。
 *
 * 发布后可直接修改 dist/runtime-config.js，无需重新打包：
 * - apiBaseUrl：所有 HTTP API 的公共前缀
 * - wsBaseUrl：Agent WebSocket 的公共前缀；未填写时沿用 apiBaseUrl
 */
window.__APP_RUNTIME_CONFIG__ = {
  apiBaseUrl: '/xxtdxm',
  wsBaseUrl: '/xxtdxm'
}
