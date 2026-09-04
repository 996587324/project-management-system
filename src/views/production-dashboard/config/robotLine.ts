export type RobotStatus =
  | 'RUNNING'
  | 'IDLE'
  | 'FAULT'
  | 'STOPPED'
  | 'WARNING'
  | 'ALARM'
  | 'OFFLINE'
  | 'UNKNOWN'
  | 'MAINTENANCE'

export interface RobotDataBindings {
  /** 后端设备主键或 PLC 设备号。 */
  deviceId: string
  status: string
  alarmCode: string
  runningMinutes: string
  stoppedMinutes: string
}

export interface RobotDevice {
  id: string
  name: string
  station: string
  status: RobotStatus
  /** Three.js 地面坐标，后端可直接按此结构下发。 */
  position: [number, number]
  rotation: number
  /** 标注 CAD 截图中的像素坐标，用于追溯点位来源。 */
  sourcePoint: [number, number]
  today: {
    runningMinutes: number
    stoppedMinutes: number
    alarmMinutes: number
  }
  currentAlarm?: string
  /** 数据字段映射由布局编辑器维护，实时接口可按此映射返回设备数据。 */
  bindings: RobotDataBindings
}

export type LayoutItemType = 'robot' | 'device' | 'conveyor' | 'workCell' | 'junction'

export type DeviceLayoutType = 'generic' | 'machine' | 'inspection'

export interface DeviceLayoutItem {
  id: string
  name: string
  deviceType: DeviceLayoutType
  position: [number, number]
  rotation: number
  width: number
  height: number
  depth: number
  color: string
}

export interface ConveyorLayoutItem {
  id: string
  name: string
  from: [number, number]
  to: [number, number]
  width: number
}

export interface WorkCellLayoutItem {
  id: string
  name: string
  position: [number, number]
  width: number
  /** 工位框在 Three.js 场景中的垂直高度。 */
  height: number
  depth: number
  rotation: number
}

export interface JunctionLayoutItem {
  id: string
  name: string
  kind: 'merge' | 'split'
  position: [number, number]
}

export interface ProductionLineLayout {
  version: 1
  lineId: string
  lineName: string
  lineArea?: string
  lineColor?: string
  enabled?: boolean
  updatedAt: string
  robots: RobotDevice[]
  devices: DeviceLayoutItem[]
  conveyors: ConveyorLayoutItem[]
  workCells: WorkCellLayoutItem[]
  junctions: JunctionLayoutItem[]
}

export const ROBOT_STATUS_META: Record<RobotStatus, { label: string; color: string }> = {
  RUNNING: { label: '运行中', color: '#20e5a3' },
  IDLE: { label: '待机', color: '#38bdf8' },
  FAULT: { label: '故障', color: '#ff4d67' },
  STOPPED: { label: '已停止', color: '#94a3b8' },
  WARNING: { label: '预警', color: '#ffc857' },
  ALARM: { label: '报警', color: '#ff4d67' },
  OFFLINE: { label: '离线', color: '#64748b' },
  UNKNOWN: { label: '未知', color: '#7f8f99' },
  MAINTENANCE: { label: '维护中', color: '#b28dff' }
}

/**
 * W1 自动化线的初始布局。4 个点位来自已标注的 CAD 截图：
 * 1: 自动上快装、2: 自动拧紧角阀、3: 自动取预拧紧角阀 2、4: 左侧紧凑工位。
 */
export const LINE_W1_ROBOTS: RobotDevice[] = [
  {
    id: 'W1-R-01',
    name: '机械手 01',
    station: 'B 区 · 自动上快装',
    status: 'RUNNING',
    position: [1.05, 1.78],
    rotation: -0.35,
    sourcePoint: [745, 265],
    today: { runningMinutes: 438, stoppedMinutes: 29, alarmMinutes: 0 },
    bindings: {
      deviceId: 'W1-R-01',
      status: 'robot.w1r01.status',
      alarmCode: 'robot.w1r01.alarmCode',
      runningMinutes: 'robot.w1r01.todayRunningMinutes',
      stoppedMinutes: 'robot.w1r01.todayStoppedMinutes'
    }
  },
  {
    id: 'W1-R-02',
    name: '机械手 02',
    station: 'B 区 · 自动拧紧角阀',
    status: 'ALARM',
    position: [5.37, -0.04],
    rotation: 0.35,
    sourcePoint: [955, 405],
    today: { runningMinutes: 390, stoppedMinutes: 41, alarmMinutes: 36 },
    currentAlarm: '末端执行器扭矩超限',
    bindings: {
      deviceId: 'W1-R-02',
      status: 'robot.w1r02.status',
      alarmCode: 'robot.w1r02.alarmCode',
      runningMinutes: 'robot.w1r02.todayRunningMinutes',
      stoppedMinutes: 'robot.w1r02.todayStoppedMinutes'
    }
  },
  {
    id: 'W1-R-03',
    name: '机械手 03',
    station: 'A 区 · 自动取预拧紧角阀 2',
    status: 'WARNING',
    position: [0.84, -2.7],
    rotation: -0.55,
    sourcePoint: [725, 548],
    today: { runningMinutes: 412, stoppedMinutes: 45, alarmMinutes: 8 },
    currentAlarm: '循环节拍偏离预警',
    bindings: {
      deviceId: 'W1-R-03',
      status: 'robot.w1r03.status',
      alarmCode: 'robot.w1r03.alarmCode',
      runningMinutes: 'robot.w1r03.todayRunningMinutes',
      stoppedMinutes: 'robot.w1r03.todayStoppedMinutes'
    }
  },
  {
    id: 'W1-R-04',
    name: '机械手 04',
    station: '左侧 · 紧凑型机械手工位',
    status: 'STOPPED',
    position: [-3.73, -0.93],
    rotation: 1.1,
    sourcePoint: [304, 404],
    today: { runningMinutes: 266, stoppedMinutes: 182, alarmMinutes: 0 },
    bindings: {
      deviceId: 'W1-R-04',
      status: 'robot.w1r04.status',
      alarmCode: 'robot.w1r04.alarmCode',
      runningMinutes: 'robot.w1r04.todayRunningMinutes',
      stoppedMinutes: 'robot.w1r04.todayStoppedMinutes'
    }
  }
]

/**
 * 初始布局。编辑器保存后会优先使用浏览器中保存的布局；后续接入后端时，
 * 将此对象替换为 GET /api/production-lines/:lineId/layout 的返回值即可。
 */
export const LINE_W1_LAYOUT: ProductionLineLayout = {
  version: 1,
  lineId: 'W1',
  lineName: 'W1 自动化线',
  updatedAt: '2026-08-20T00:00:00.000Z',
  robots: LINE_W1_ROBOTS.map((robot) => ({
    ...robot,
    position: [...robot.position] as [number, number],
    sourcePoint: [...robot.sourcePoint] as [number, number],
    today: { ...robot.today },
    bindings: { ...robot.bindings }
  })),
  devices: [],
  conveyors: [
    { id: 'in-01', name: '入口输送线', from: [-7.8, -0.1], to: [-5.15, 0.1], width: 0.8 },
    { id: 'merge-01', name: '合流输送线', from: [-5.15, 0.1], to: [-3.45, -0.1], width: 0.8 },
    { id: 'main-01', name: '主输送线', from: [-3.45, -0.1], to: [0.55, -0.1], width: 0.8 },
    { id: 'split-01-a', name: '上分流线', from: [0.55, -0.1], to: [2.15, 0.98], width: 0.8 },
    { id: 'split-01-b', name: '下分流线', from: [0.55, -0.1], to: [2.15, -1.2], width: 0.8 },
    { id: 'out-01-a', name: '上出口输送线', from: [2.15, 0.98], to: [7.8, 0.98], width: 0.8 },
    { id: 'out-01-b', name: '下出口输送线', from: [2.15, -1.2], to: [7.8, -1.2], width: 0.8 }
  ],
  workCells: [
    {
      id: 'cell-01',
      name: '机械手 01 工位',
      position: [1.05, 1.84],
      width: 3.2,
      height: 1.15,
      depth: 1.36,
      rotation: 0
    },
    {
      id: 'cell-02',
      name: '机械手 02 工位',
      position: [5.37, -0.1],
      width: 3.2,
      height: 1.15,
      depth: 1.38,
      rotation: 0
    },
    {
      id: 'cell-03',
      name: '机械手 03 工位',
      position: [0.84, -2.7],
      width: 3.4,
      height: 1.15,
      depth: 1.32,
      rotation: 0
    },
    {
      id: 'cell-04',
      name: '机械手 04 工位',
      position: [-3.73, -0.1],
      width: 2.6,
      height: 1.15,
      depth: 1.34,
      rotation: 0
    }
  ],
  junctions: [{ id: 'junction-01', name: '分流', kind: 'split', position: [0.55, -0.1] }]
}

export const cloneDefaultLineLayout = (): ProductionLineLayout =>
  JSON.parse(JSON.stringify(LINE_W1_LAYOUT)) as ProductionLineLayout
