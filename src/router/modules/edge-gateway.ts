import { AppRouteRecord } from '@/types/router'

export const edgeGatewayRoutes: AppRouteRecord = {
  path: '/edge-gateway',
  name: 'EdgeGateway',
  component: '/index/index',
  meta: {
    title: '中转管理',
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
    },
    {
      path: 'data-trace',
      name: 'EdgeDataTrace',
      component: '/edge-gateway/data-trace',
      meta: {
        title: '数据追溯',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    },
    {
      path: 'data-trace/detail',
      name: 'EdgeDataTraceDetail',
      component: '/edge-gateway/data-trace/detail',
      meta: {
        title: '参数详情',
        hideInMenu: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    }
  ]
}
