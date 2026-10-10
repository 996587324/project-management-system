import type { AppRouteRecord } from '@/types/router'

/**
 * 产线看板默认使用管理后台布局，并由看板组件自行切换全屏显示。
 */
export const productionDashboardRoutes: AppRouteRecord = {
  path: '/production-dashboard',
  name: 'ProductionDashboard',
  component: '/index/index',
  meta: {
    title: '产线看板',
    icon: 'ri:dashboard-3-line',
    roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
  },
  children: [
    {
      path: 'board',
      name: 'ProductionDashboardBoard',
      component: '/production-dashboard/board',
      meta: {
        title: '生产监控',
        keepAlive: false,
        isFullPage: false,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    },
    {
      path: 'layout-editor',
      name: 'ProductionDashboardLayoutEditor',
      component: '/production-dashboard/layout-editor',
      meta: {
        title: '布局编辑',
        keepAlive: false,
        isFullPage: true,
        isHide: true,
        activePath: '/production-dashboard/config',
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    },
    {
      path: 'config',
      name: 'ProductionDashboardConfig',
      component: '/production-dashboard/config-center',
      meta: {
        title: '产线看板配置',
        keepAlive: false,
        isFullPage: false,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    },
    {
      path: 'device-cards',
      name: 'ProductionDashboardDeviceCards',
      component: '/production-dashboard/device-card-board',
      meta: {
        title: '设备卡片看板',
        keepAlive: false,
        isFullPage: false,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    },
    {
      path: 'device-card-config',
      name: 'ProductionDashboardDeviceCardConfig',
      component: '/production-dashboard/device-card-config',
      meta: {
        title: '设备卡片配置',
        keepAlive: false,
        isFullPage: false,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    }
  ]
}
