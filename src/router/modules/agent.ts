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
      path: 'assistant',
      name: 'AgentAssistant',
      component: '/agent/assistant',
      meta: {
        title: '智能助手',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    },
    {
      path: 'executor',
      name: 'AgentExecutor',
      component: '/agent/executor',
      meta: {
        title: '项目管理助手',
        keepAlive: true,
        isHide: true,
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
        isHide: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    },
    {
      path: 'production-dashboard',
      name: 'ProductionDashboardAgent',
      component: '/agent/production-dashboard',
      meta: {
        title: '生产看板助手',
        keepAlive: true,
        isHide: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    },
    {
      path: 'model-providers',
      name: 'AgentModelProvider',
      component: '/agent/model-provider',
      meta: {
        title: '模型平台配置',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    }
  ]
}
