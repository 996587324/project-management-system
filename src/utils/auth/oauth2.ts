import { getApiUrl } from '@/utils/runtime-config'

/** 构造统一身份平台单点登出入口，始终经当前环境的后端代理跳转。 */
export function getOAuth2LogoutUrl() {
  return getApiUrl('/api/auth/oauth2/logout')
}
