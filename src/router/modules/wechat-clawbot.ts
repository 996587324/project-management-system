import { AppRouteRecord } from '@/types/router'

export const weChatClawBotRoutes: AppRouteRecord = {
  path: '/wechat-clawbot',
  name: 'WeChatClawBotRoot',
  component: '/index/index',
  meta: {
    title: '推送中心',
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
    },
    {
      path: 'email',
      name: 'EmailPush',
      component: '/push-center/email',
      meta: { title: '邮件推送', icon: 'ri:mail-send-line', keepAlive: true }
    },
    {
      path: '/agent/clawbot-management',
      name: 'WeChatClawBotManagement',
      component: '/agent/clawbot-management',
      meta: {
        title: '微信管理与调试',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    }
  ]
}
