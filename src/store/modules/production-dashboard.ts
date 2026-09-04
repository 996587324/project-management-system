import { defineStore, storeToRefs } from 'pinia'
import { ref } from 'vue'
import { fetchDashboardSceneLayout, saveDashboardSceneLayout } from '@/api/edge-dashboard'
import {
  cloneDefaultLineLayout,
  type ConveyorLayoutItem,
  type DeviceLayoutItem,
  type JunctionLayoutItem,
  type LayoutItemType,
  type ProductionLineLayout,
  type RobotDevice,
  type WorkCellLayoutItem
} from '@/views/production-dashboard/config/robotLine'

export interface LayoutSelection {
  type: LayoutItemType
  id: string
}

export interface LayoutMove extends LayoutSelection {
  position: [number, number]
  delta?: [number, number]
}

const nextId = (prefix: string, collection: Array<{ id: string }>) => {
  let sequence = collection.length + 1
  let candidate = `${prefix}-${String(sequence).padStart(2, '0')}`
  while (collection.some((item) => item.id === candidate)) {
    sequence += 1
    candidate = `${prefix}-${String(sequence).padStart(2, '0')}`
  }
  return candidate
}

const DASHBOARD_CODE = 'production-dashboard'
const LEGACY_LAYOUT_STORAGE_KEY = 'production-dashboard-layout'

const isProductionLineLayout = (value: unknown): value is ProductionLineLayout => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ProductionLineLayout>
  return (
    typeof candidate.lineId === 'string' &&
    typeof candidate.lineName === 'string' &&
    Array.isArray(candidate.robots) &&
    (candidate.devices === undefined || Array.isArray(candidate.devices)) &&
    Array.isArray(candidate.conveyors) &&
    Array.isArray(candidate.workCells) &&
    Array.isArray(candidate.junctions)
  )
}

const normalizeLayout = (source: ProductionLineLayout): ProductionLineLayout => ({
  ...source,
  devices: Array.isArray(source.devices) ? source.devices : [],
  // 已保存的旧布局没有高度字段，继续使用原有固定高度，保存后会自动写入新字段。
  workCells: source.workCells.map((cell) => ({
    ...cell,
    height: Number.isFinite(cell.height) ? Math.max(cell.height, 0.3) : 1.15
  }))
})

const readLegacyLayout = () => {
  try {
    const saved = window.localStorage.getItem(LEGACY_LAYOUT_STORAGE_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved)
    const candidate = parsed?.layout ?? parsed
    return isProductionLineLayout(candidate) ? normalizeLayout(candidate) : null
  } catch {
    return null
  }
}

/**
 * 保存产线布局编辑状态，并通过 EdgeDashboard 接口持久化到中心数据库。
 */
export const useProductionDashboardStore = defineStore('productionDashboard', () => {
  const layout = ref<ProductionLineLayout>(cloneDefaultLineLayout())
  const layoutLoading = ref(false)
  const layoutSaving = ref(false)
  const layoutLoaded = ref(false)
  const loadedLineCode = ref('')
  const initialLayout = ref<ProductionLineLayout>(cloneDefaultLineLayout())
  let loadSequence = 0

  const findItem = (selection: LayoutSelection) => {
    switch (selection.type) {
      case 'robot':
        return layout.value.robots.find((item) => item.id === selection.id)
      case 'device':
        return layout.value.devices.find((item) => item.id === selection.id)
      case 'conveyor':
        return layout.value.conveyors.find((item) => item.id === selection.id)
      case 'workCell':
        return layout.value.workCells.find((item) => item.id === selection.id)
      case 'junction':
        return layout.value.junctions.find((item) => item.id === selection.id)
    }
  }

  const touch = () => {
    layout.value.updatedAt = new Date().toISOString()
  }

  const saveLayout = async () => {
    touch()
    layoutSaving.value = true
    try {
      const saved = await saveDashboardSceneLayout({
        dashboardCode: DASHBOARD_CODE,
        lineCode: layout.value.lineId,
        lineName: layout.value.lineName,
        layoutVersion: layout.value.version,
        layoutJson: JSON.stringify(layout.value)
      })
      layoutLoaded.value = true
      loadedLineCode.value = layout.value.lineId
      window.localStorage.removeItem(LEGACY_LAYOUT_STORAGE_KEY)
      return saved
    } finally {
      layoutSaving.value = false
    }
  }

  const resetLayout = async () => {
    layout.value = JSON.parse(JSON.stringify(initialLayout.value)) as ProductionLineLayout
    return saveLayout()
  }

  /** 使用首屏聚合接口返回的场景直接初始化 Store，避免再次请求单线场景接口。 */
  const hydrateLayout = (source: ProductionLineLayout) => {
    if (!isProductionLineLayout(source)) throw new Error('场景布局结构无效')
    loadSequence += 1
    const hydrated = normalizeLayout(JSON.parse(JSON.stringify(source)) as ProductionLineLayout)
    layout.value = hydrated
    initialLayout.value = JSON.parse(JSON.stringify(hydrated)) as ProductionLineLayout
    loadedLineCode.value = hydrated.lineId
    layoutLoaded.value = true
    layoutLoading.value = false
  }

  /** 按线体加载数据库场景；快速切换时只允许最后一次请求更新页面。 */
  const loadLayout = async (
    lineCode = layout.value.lineId,
    fallbackLayout?: ProductionLineLayout,
    force = false,
    publicAccess = false
  ) => {
    if (loadedLineCode.value === lineCode && layoutLoaded.value && !force) return

    const requestSequence = ++loadSequence
    const fallback = JSON.parse(
      JSON.stringify(fallbackLayout || cloneDefaultLineLayout())
    ) as ProductionLineLayout
    fallback.lineId = lineCode
    initialLayout.value = fallback
    layout.value = JSON.parse(JSON.stringify(fallback)) as ProductionLineLayout
    layoutLoaded.value = false
    layoutLoading.value = true

    try {
      const saved = await fetchDashboardSceneLayout(DASHBOARD_CODE, lineCode, publicAccess)
      if (requestSequence !== loadSequence) return
      if (saved) {
        const parsed = JSON.parse(saved.layoutJson)
        if (!isProductionLineLayout(parsed) || parsed.lineId !== lineCode)
          throw new Error('数据库中的场景布局结构无效')
        layout.value = normalizeLayout(parsed)
        window.localStorage.removeItem(LEGACY_LAYOUT_STORAGE_KEY)
      } else if (lineCode === 'W1') {
        const legacyLayout = readLegacyLayout()
        if (legacyLayout) {
          layout.value = legacyLayout
          await saveLayout()
        }
      }
      loadedLineCode.value = lineCode
      layoutLoaded.value = true
    } finally {
      if (requestSequence === loadSequence) layoutLoading.value = false
    }
  }

  const addRobot = (): LayoutSelection => {
    const id = nextId(`${layout.value.lineId}-R`, layout.value.robots)
    const robot: RobotDevice = {
      id,
      name: `机械手 ${id.slice(-2)}`,
      station: '新建工位',
      status: 'OFFLINE',
      position: [0, 2.9],
      rotation: 0,
      sourcePoint: [0, 0],
      today: { runningMinutes: 0, stoppedMinutes: 0, alarmMinutes: 0 },
      bindings: {
        deviceId: '',
        status: '',
        alarmCode: '',
        runningMinutes: '',
        stoppedMinutes: ''
      }
    }
    layout.value.robots.push(robot)
    touch()
    return { type: 'robot', id }
  }

  const addDevice = (): LayoutSelection => {
    const id = nextId('device', layout.value.devices)
    const device: DeviceLayoutItem = {
      id,
      name: `设备 ${id.slice(-2)}`,
      deviceType: 'generic',
      position: [0, 0],
      rotation: 0,
      width: 1.4,
      height: 1.5,
      depth: 1.1,
      color: '#4db7d8'
    }
    layout.value.devices.push(device)
    touch()
    return { type: 'device', id }
  }

  const addConveyor = (): LayoutSelection => {
    const id = nextId('conveyor', layout.value.conveyors)
    const conveyor: ConveyorLayoutItem = {
      id,
      name: '新建输送线',
      from: [-1.2, 0],
      to: [1.2, 0],
      width: 0.8
    }
    layout.value.conveyors.push(conveyor)
    touch()
    return { type: 'conveyor', id }
  }

  const addWorkCell = (): LayoutSelection => {
    const id = nextId('cell', layout.value.workCells)
    const cell: WorkCellLayoutItem = {
      id,
      name: '新建工位',
      position: [0, -2.9],
      width: 2.6,
      height: 1.15,
      depth: 1.4,
      rotation: 0
    }
    layout.value.workCells.push(cell)
    touch()
    return { type: 'workCell', id }
  }

  const addJunction = (kind: JunctionLayoutItem['kind']): LayoutSelection => {
    const id = nextId('junction', layout.value.junctions)
    layout.value.junctions.push({
      id,
      name: kind === 'merge' ? '合流' : '分流',
      kind,
      position: [0, 0]
    })
    touch()
    return { type: 'junction', id }
  }

  const removeItem = (selection: LayoutSelection) => {
    const collections: Record<LayoutItemType, Array<{ id: string }>> = {
      robot: layout.value.robots,
      device: layout.value.devices,
      conveyor: layout.value.conveyors,
      workCell: layout.value.workCells,
      junction: layout.value.junctions
    }
    const target = collections[selection.type]
    const index = target.findIndex((item) => item.id === selection.id)
    if (index < 0) return false
    target.splice(index, 1)
    touch()
    return true
  }

  const moveItem = (move: LayoutMove) => {
    const item = findItem(move)
    if (!item) return
    if (move.type === 'conveyor') {
      const conveyor = item as ConveyorLayoutItem
      const [deltaX, deltaZ] = move.delta || [0, 0]
      conveyor.from = [conveyor.from[0] + deltaX, conveyor.from[1] + deltaZ]
      conveyor.to = [conveyor.to[0] + deltaX, conveyor.to[1] + deltaZ]
    } else {
      const movableItem = item as
        | RobotDevice
        | DeviceLayoutItem
        | WorkCellLayoutItem
        | JunctionLayoutItem
      movableItem.position = move.position
    }
    touch()
  }

  return {
    layout,
    layoutLoading,
    layoutSaving,
    layoutLoaded,
    loadedLineCode,
    hydrateLayout,
    loadLayout,
    findItem,
    saveLayout,
    resetLayout,
    addRobot,
    addDevice,
    addConveyor,
    addWorkCell,
    addJunction,
    removeItem,
    moveItem,
    touch
  }
})

/**
 * 保留源看板的组合式调用接口，让看板和编辑器共享同一份 Pinia 布局状态。
 */
export const useLineLayout = () => {
  const store = useProductionDashboardStore()
  const { layout, layoutLoading, layoutSaving, layoutLoaded, loadedLineCode } = storeToRefs(store)
  return {
    layout,
    layoutLoading,
    layoutSaving,
    layoutLoaded,
    loadedLineCode,
    hydrateLayout: store.hydrateLayout,
    loadLayout: store.loadLayout,
    findItem: store.findItem,
    saveLayout: store.saveLayout,
    resetLayout: store.resetLayout,
    addRobot: store.addRobot,
    addDevice: store.addDevice,
    addConveyor: store.addConveyor,
    addWorkCell: store.addWorkCell,
    addJunction: store.addJunction,
    removeItem: store.removeItem,
    moveItem: store.moveItem,
    touch: store.touch
  }
}
