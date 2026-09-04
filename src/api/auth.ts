import request from '@/utils/http'
import { getOAuth2LogoutUrl } from '@/utils/auth/oauth2'
import { getApiUrl } from '@/utils/runtime-config'

export { getOAuth2LogoutUrl }

/**
 * 登录
 * @param params 登录参数
 * @returns 登录响应
 */
export function fetchLogin(params: Api.Auth.LoginParams) {
  var item = request.post<Api.Auth.LoginResponse>({
    // url: '/api/Login/GetToken',
    url: '/api/auth/login',
    params: params
    // showSuccessMessage: true // 显示成功消息
    // showErrorMessage: false // 不显示错误消息
  })

  return item
}

/** 获取后台 OAuth 2.0 登录配置状态。 */
export function fetchOAuth2Status() {
  return request.get<Api.Auth.OAuth2Status>({
    url: '/api/auth/oauth2/status',
    showErrorMessage: false
  })
}

/** 使用后端回调生成的一次性票据兑换项目 JWT。 */
export function completeOAuth2Login(params: Api.Auth.OAuth2CompleteParams) {
  return request.post<Api.Auth.LoginResponse>({
    url: '/api/auth/oauth2/complete',
    params
  })
}

/** OAuth 授权必须使用浏览器整页跳转，地址仍经过当前环境的 API 前缀。 */
export function getOAuth2AuthorizeUrl(returnUrl = '/') {
  return `${getApiUrl('/api/auth/oauth2/authorize')}?returnUrl=${encodeURIComponent(returnUrl)}`
}

/**
 * 获取销售额
 * @param params 登录参数
 * @returns 登录响应
 */
export function GetSalesRevenue() {
  return request.get<Api.Auth.LoginResponse>({
    url: '/api/auth/login'
    // showSuccessMessage: true // 显示成功消息
    // showErrorMessage: false // 不显示错误消息
  })
}

/**
 * 获取用户信息
 * @returns 用户信息
 */
export function fetchGetUserInfo() {
  return request.get<Api.Auth.UserInfo>({
    // url: '/api/user/info'
    url: '/api/UserInfo/GetUserInfo'
    // 自定义请求头
    // headers: {
    //   'X-Custom-Header': 'your-custom-value'
    // }
  })
}

/**
 * 修改当前登录用户密码
 */
export function changeCurrentUserPassword(params: Api.Auth.ChangePasswordParams) {
  return request.post({
    url: '/api/UserInfo/ChangePassword',
    params
  })
}
