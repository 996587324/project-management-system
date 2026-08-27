import { AppRouteRecord } from '@/types/router'

export const agentRoutes: AppRouteRecord = {
  path: '/agent',
  name: 'Agent',
  component: '/index/index',
  meta: {
    title: 'Agent 中心',
    icon: 'ri:robot-2-line',
    roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
  },
  children: [
    {
      path: 'executor',
      name: 'AgentExecutor',
      component: '/agent/executor',
      meta: {
        title: '项目管理助手',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    },
    {
      path: 'edge-gateway',
      name: 'EdgeGatewayAgent',
      component: '/agent/edge-gateway',
      meta: {
        title: '边缘计算助手',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    }
  ]
}
