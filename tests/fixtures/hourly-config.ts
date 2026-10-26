import type { HourlyBoard, HourlyProcess } from '../../src/api/hourly-production'

export function hourlyConfigFixture(): HourlyBoard {
  const process = (code: string, name: string): HourlyProcess => ({
    code,
    name,
    rowCode: code,
    enabled: true,
    mode: 'DistinctSn',
    reworkMinutes: 30,
    reworkRequiresDifferentHour: true,
    includeReworkInOutput: false,
    targets: [],
    bindings: [
      {
        code: 'binding',
        kind: 'Realtime',
        sourceKey: 'tenant',
        deviceKey: `device-${code}`,
        sourceDeviceCode: '',
        snPath: '/SN',
        timePath: '',
        quantityPath: '',
        filterPath: '',
        filterValue: '',
        reworkPath: '',
        reworkValue: '1'
      }
    ]
  })
  return {
    code: 'delete-test',
    name: '删除工序回归看板',
    version: 1,
    published: false,
    startTime: '08:00',
    endTime: '20:00',
    refreshSeconds: 10,
    aiEnabled: false,
    aiIntervalMinutes: 5,
    aiAgentCode: 'production-dashboard',
    lines: ['A', 'B'].map((code) => ({
      code,
      name: `${code}线`,
      summaryProcessCode: 'P3',
      targets: [],
      processes: [process('P1', '气密'), process('P2', '注氟'), process('P3', '商检')]
    })),
    push: {
      enabled: false,
      delayMinutes: 2,
      catchUpHours: 2,
      lineCodes: [],
      weChatUserIds: [],
      emailUserIds: []
    }
  }
}
