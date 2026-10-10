import { AppRouteRecord } from '@/types/router'

export const weChatClawBotRoutes: AppRouteRecord = {
  path: '/wechat-clawbot',
  name: 'WeChatClawBotRoot',
  component: '/index/index',
  meta: {
    title: '微信 ClawBot',
    icon: 'ri:wechat-line',
    roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER', 'R_USER']
  },
  children: [
    {
      path: 'binding',
      name: 'WeChatClawBot',
      component: '/wechat-clawbot',
      meta: {
        title: '我的微信推送',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER', 'R_USER']
      }
    }
  ]
}
