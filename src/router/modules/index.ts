import { AppRouteRecord } from '@/types/router'
import { dashboardRoutes } from './dashboard'
import { systemRoutes } from './system'
import { resultRoutes } from './result'
import { exceptionRoutes } from './exception'
import { agentRoutes } from './agent'
import { edgeGatewayRoutes } from './edge-gateway'
import { productionDashboardRoutes } from './production-dashboard'
import { pdaRoutes } from './pda'

/**
 * 导出所有模块化路由
 */
export const routeModules: AppRouteRecord[] = [
  dashboardRoutes,
  productionDashboardRoutes,
  edgeGatewayRoutes,
  agentRoutes,
  pdaRoutes,
  systemRoutes,
  resultRoutes,
  exceptionRoutes
]
