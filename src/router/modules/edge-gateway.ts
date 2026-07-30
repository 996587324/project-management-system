import { AppRouteRecord } from '@/types/router'

export const edgeGatewayRoutes: AppRouteRecord = {
  path: '/edge-gateway',
  name: 'EdgeGateway',
  component: '/index/index',
  meta: {
    title: '边缘网关',
    icon: 'ri:router-line',
    roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
  },
  children: [
    {
      path: 'console',
      name: 'EdgeGatewayConsole',
      component: '/edge-gateway/console',
      meta: {
        title: '运行中心',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    }
  ]
}
