import { AppRouteRecord } from '@/types/router'

export const pdaRoutes: AppRouteRecord = {
  path: '/pda',
  name: 'Pda',
  component: '/index/index',
  meta: {
    title: 'PDA 管理',
    icon: 'ri:barcode-box-line',
    roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
  },
  children: [
    {
      path: 'scan-logs',
      name: 'PdaScanLog',
      component: '/pda/scan-log',
      meta: {
        title: '扫码记录',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    },
    {
      path: 'devices',
      name: 'PdaDevice',
      component: '/pda/device',
      meta: {
        title: 'PDA 设备',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    },
    {
      path: 'barcode-rules',
      name: 'PdaBarcodeRule',
      component: '/pda/barcode-rule',
      meta: {
        title: '条码规则',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      }
    }
  ]
}
