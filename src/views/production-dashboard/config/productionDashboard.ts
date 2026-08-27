import {
  cloneDefaultLineLayout,
  LINE_W1_ROBOTS,
  ProductionLineLayout,
  RobotDevice,
  RobotStatus
} from '@/views/production-dashboard/config/robotLine'

export type StatisticPeriod = 'day' | 'week' | 'month'

export interface ProductionTrendItem {
  label: string
  runningMinutes: number
  stoppedMinutes: number
  alarmMinutes: number
}

export interface ProductionAlarm {
  id: string
  time: string
  robotId: string
  message: string
  level: 'ALARM' | 'WARNING'
  duration: string
}

export interface ProductionLineBoard {
  id: string
  name: string
  area: string
  color: string
  enabled: boolean
  robots: RobotDevice[]
  todayRunningMinutes: number
  todayStoppedMinutes: number
  todayAlarmMinutes: number
  plannedMaintenanceMinutes: number
  energyKwh: number
  mtbfHours: number
  mttrMinutes: number
  trends: Record<StatisticPeriod, ProductionTrendItem[]>
  alarms: ProductionAlarm[]
}

/** 线体配置弹窗提交的可编辑基础信息。 */
export interface ProductionLineConfigDraft {
  originalId?: string
  id: string
  name: string
  area: string
  color: string
  enabled: boolean
}

const makeBindings = (id: string) => {
  const path = id.toLowerCase().replace(/-/g, '')
  return {
    deviceId: id,
    status: `robot.${path}.status`,
    alarmCode: `robot.${path}.alarmCode`,
    runningMinutes: `robot.${path}.todayRunningMinutes`,
    stoppedMinutes: `robot.${path}.todayStoppedMinutes`
  }
}

const makeRobot = (
  id: string,
  name: string,
  station: string,
  status: RobotStatus,
  position: [number, number],
  rotation: number,
  runningMinutes: number,
  stoppedMinutes: number,
  currentAlarm?: string
): RobotDevice => ({
  id,
  name,
  station,
  status,
  position,
  rotation,
  sourcePoint: [0, 0],
  today: { runningMinutes, stoppedMinutes, alarmMinutes: status === 'ALARM' ? 18 : 0 },
  currentAlarm,
  bindings: makeBindings(id)
})

const buildTrends = (alarmBias: number): Record<StatisticPeriod, ProductionTrendItem[]> => ({
  day: [
    ['08:00', 54, 6, 0],
    ['10:00', 112, 8, 0],
    ['12:00', 94, 26, 5],
    ['14:00', 117, 3, alarmBias + 8],
    ['16:00', 108, 12, alarmBias],
    ['18:00', 96, 19, 4],
    ['20:00', 72, 8, 0]
  ].map(([label, runningMinutes, stoppedMinutes, alarmMinutes]) => ({
    label: String(label),
    runningMinutes: Number(runningMinutes),
    stoppedMinutes: Number(stoppedMinutes),
    alarmMinutes: Number(alarmMinutes)
  })),
  week: [
    ['周一', 765, 75, alarmBias + 12],
    ['周二', 790, 50, alarmBias + 5],
    ['周三', 721, 119, alarmBias + 30],
    ['周四', 802, 38, alarmBias + 8],
    ['周五', 778, 62, alarmBias + 16],
    ['周六', 706, 134, alarmBias + 41],
    ['周日', 592, 128, alarmBias + 23]
  ].map(([label, runningMinutes, stoppedMinutes, alarmMinutes]) => ({
    label: String(label),
    runningMinutes: Number(runningMinutes),
    stoppedMinutes: Number(stoppedMinutes),
    alarmMinutes: Number(alarmMinutes)
  })),
  month: [
    ['第 1 周', 4_891, 549, 92 + alarmBias],
    ['第 2 周', 5_016, 424, 71 + alarmBias],
    ['第 3 周', 4_726, 714, 148 + alarmBias],
    ['第 4 周', 5_134, 306, 58 + alarmBias]
  ].map(([label, runningMinutes, stoppedMinutes, alarmMinutes]) => ({
    label: String(label),
    runningMinutes: Number(runningMinutes),
    stoppedMinutes: Number(stoppedMinutes),
    alarmMinutes: Number(alarmMinutes)
  }))
})

export const STATIC_PRODUCTION_LINES: ProductionLineBoard[] = [
  {
    id: 'W1',
    name: 'W1 阀体自动化线',
    area: '南沙工厂 · 二层 B 区',
    color: '#55d5ff',
    enabled: true,
    robots: LINE_W1_ROBOTS,
    todayRunningMinutes: 1_506,
    todayStoppedMinutes: 297,
    todayAlarmMinutes: 44,
    plannedMaintenanceMinutes: 30,
    energyKwh: 1_248,
    mtbfHours: 87.5,
    mttrMinutes: 18,
    trends: buildTrends(3),
    alarms: [
      {
        id: 'W1-A-01',
        time: '14:28:16',
        robotId: 'W1-R-02',
        message: '末端执行器扭矩超限',
        level: 'ALARM',
        duration: '36 分钟'
      },
      {
        id: 'W1-A-02',
        time: '13:56:04',
        robotId: 'W1-R-03',
        message: '循环节拍偏离预警',
        level: 'WARNING',
        duration: '8 分钟'
      },
      {
        id: 'W1-A-03',
        time: '09:12:49',
        robotId: 'W1-R-04',
        message: '安全门互锁已恢复',
        level: 'WARNING',
        duration: '12 分钟'
      }
    ]
  },
  {
    id: 'W2',
    name: 'W2 装配与包装线',
    area: '南沙工厂 · 二层 C 区',
    color: '#72e4a7',
    enabled: true,
    robots: [
      makeRobot('W2-R-01', '机械手 01', '装配工位 A', 'RUNNING', [-2.6, 1.6], -0.3, 463, 17),
      makeRobot('W2-R-02', '机械手 02', '装配工位 B', 'RUNNING', [0.4, 1.2], 0.2, 451, 29),
      makeRobot('W2-R-03', '机械手 03', '自动封箱工位', 'IDLE', [2.9, -1], 0.6, 382, 98),
      makeRobot(
        'W2-R-04',
        '机械手 04',
        '码垛工位',
        'WARNING',
        [5.2, -1.8],
        -0.4,
        421,
        52,
        '真空压力低于预设值'
      )
    ],
    todayRunningMinutes: 1_717,
    todayStoppedMinutes: 196,
    todayAlarmMinutes: 22,
    plannedMaintenanceMinutes: 20,
    energyKwh: 1_032,
    mtbfHours: 112.8,
    mttrMinutes: 14,
    trends: buildTrends(1),
    alarms: [
      {
        id: 'W2-A-01',
        time: '15:06:30',
        robotId: 'W2-R-04',
        message: '真空压力低于预设值',
        level: 'WARNING',
        duration: '5 分钟'
      },
      {
        id: 'W2-A-02',
        time: '11:43:08',
        robotId: 'W2-R-03',
        message: '包装物料待补充',
        level: 'WARNING',
        duration: '17 分钟'
      }
    ]
  },
  {
    id: 'W3',
    name: 'W3 检测下料线',
    area: '南沙工厂 · 二层 D 区',
    color: '#b799ff',
    enabled: true,
    robots: [
      makeRobot('W3-R-01', '机械手 01', '视觉检测上料', 'RUNNING', [-3.1, 1.1], 0.1, 478, 2),
      makeRobot('W3-R-02', '机械手 02', '不良品分拣', 'RUNNING', [0.3, 1.1], -0.25, 468, 12),
      makeRobot('W3-R-03', '机械手 03', '成品下料', 'STOPPED', [3.4, -1.1], 0.55, 311, 169)
    ],
    todayRunningMinutes: 1_257,
    todayStoppedMinutes: 183,
    todayAlarmMinutes: 36,
    plannedMaintenanceMinutes: 40,
    energyKwh: 816,
    mtbfHours: 68.2,
    mttrMinutes: 26,
    trends: buildTrends(5),
    alarms: [
      {
        id: 'W3-A-01',
        time: '14:48:55',
        robotId: 'W3-R-03',
        message: '下料缓存区满位',
        level: 'ALARM',
        duration: '23 分钟'
      },
      {
        id: 'W3-A-02',
        time: '10:21:37',
        robotId: 'W3-R-01',
        message: '视觉识别置信度波动',
        level: 'WARNING',
        duration: '6 分钟'
      }
    ]
  }
]

export const cloneStaticProductionLines = () =>
  JSON.parse(JSON.stringify(STATIC_PRODUCTION_LINES)) as ProductionLineBoard[]

export const PRODUCTION_LINE_CONFIG_STORAGE_KEY = 'production-dashboard-lines-v1'
export const PRODUCTION_DASHBOARD_LAST_LINE_STORAGE_KEY = 'production-dashboard-last-line-v1'

/** 读取用户维护的线体列表，异常或无配置时使用内置线体。 */
export const loadConfiguredProductionLines = () => {
  try {
    const saved = window.localStorage.getItem(PRODUCTION_LINE_CONFIG_STORAGE_KEY)
    const parsed = saved ? JSON.parse(saved) : null
    if (
      Array.isArray(parsed) &&
      parsed.length &&
      parsed.every(
        (line) =>
          line?.id &&
          Array.isArray(line.robots) &&
          typeof line.todayAlarmMinutes === 'number' &&
          typeof line.plannedMaintenanceMinutes === 'number'
      )
    ) {
      return parsed as ProductionLineBoard[]
    }
  } catch {
    // 本地线体配置损坏时回退到内置线体，避免看板无法进入。
  }
  return cloneStaticProductionLines()
}

/** 保存最近点击的有效线体，供布局编辑器直接定位。 */
export const rememberProductionDashboardLine = (lineCode: string) => {
  window.localStorage.setItem(PRODUCTION_DASHBOARD_LAST_LINE_STORAGE_KEY, lineCode)
}

/** 返回最近点击的线体；记录失效时回退到列表第一条。 */
export const getRecentProductionDashboardLine = (lines: ProductionLineBoard[]) => {
  const recent = window.localStorage.getItem(PRODUCTION_DASHBOARD_LAST_LINE_STORAGE_KEY)
  return lines.some((line) => line.id === recent) ? recent! : lines[0]?.id || 'W1'
}

/** 根据线体主数据生成可编辑的 Three.js 初始场景。 */
export const createProductionLineLayout = (line: ProductionLineBoard): ProductionLineLayout => {
  const layout = cloneDefaultLineLayout()
  layout.lineId = line.id
  layout.lineName = line.name
  layout.lineArea = line.area
  layout.lineColor = line.color
  layout.enabled = line.enabled
  layout.updatedAt = new Date().toISOString()
  layout.robots = JSON.parse(JSON.stringify(line.robots)) as RobotDevice[]

  if (line.id !== 'W1') {
    layout.workCells = layout.robots.map((robot, index) => ({
      id: `${line.id}-cell-${index + 1}`,
      name: `${robot.name} 工位`,
      position: [...robot.position] as [number, number],
      width: 2.6,
      depth: 1.35,
      rotation: 0
    }))
  }
  return layout
}
