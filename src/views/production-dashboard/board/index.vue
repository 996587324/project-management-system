<template>
  <main
    ref="dashboardRef"
    :class="[
      'production-dashboard',
      {
        'production-dashboard--fullscreen': isDashboardFullscreen,
        'production-dashboard--public': isReadOnly,
        'production-dashboard--has-widgets': dashboardWidgets.length,
        'production-dashboard--bootstrapping': dashboardBootstrapping
      }
    ]"
  >
    <div v-if="dashboardBootstrapping" class="production-dashboard__loading" role="status">
      <i />
      <strong>正在加载线体与 Three.js 场景配置</strong>
      <span>请稍候</span>
    </div>

    <template v-if="!dashboardBootstrapping">
      <dashboard-header-region
        :lines="visibleLines"
        :active-line-id="activeLineId"
        :offline="dashboardOffline"
        :fullscreen="isDashboardFullscreen"
        :exporting="exportLoading"
        :current-time="currentTime"
        :read-only="isReadOnly"
        @update:active-line-id="activeLineId = $event"
        @toggle-fullscreen="toggleDashboardFullscreen"
        @open-binding="bindingDialogOpen = true"
        @open-widgets="widgetConfigOpen = true"
        @open-lines="lineConfigOpen = true"
        @export-current="exportCurrentLine"
        @open-exports="exportDialogOpen = true"
      />

      <dashboard-line-overview-region
        :line="activeLine"
        :online-count="onlineRobots"
        :total-count="sceneRobots.length"
      />

      <dashboard-main-region
        :robots="sceneRobots"
        :layout="activeSceneLayout"
        :selected-id="selectedRobotId"
        :runtime-robots="runtime?.robots || []"
        :status-items="statusOverview"
        :status-pie-style="statusPieStyle"
        :running-count="runningRobotCount"
        :alarms="activeAlarms"
        @update:selected-id="selectedRobotId = $event"
      />

      <dashboard-analytics-region
        v-if="dashboardWidgets.length"
        :widgets="dashboardWidgets"
        :line-code="activeLineId"
        :default-column-span="defaultWidgetColumnSpan"
        :public-access="isReadOnly"
      />

      <production-line-config-dialog
        v-if="!isReadOnly"
        v-model="lineConfigOpen"
        :lines="configuredLines"
        :creating="lineCreating"
        :saving-line-id="lineSavingId"
        @add="addLine"
        @save="saveLineConfig"
        @remove="removeLine"
      />

      <dashboard-robot-binding-dialog
        v-if="!isReadOnly && selectedRobotForBinding"
        v-model="bindingDialogOpen"
        :line-code="activeLineId"
        :robot-code="selectedRobotForBinding.id"
        :robot-name="selectedRobotForBinding.name"
        @saved="refreshDashboardData"
        @deleted="refreshDashboardData"
      />
      <dashboard-widget-config-dialog
        v-if="!isReadOnly"
        v-model="widgetConfigOpen"
        dashboard-code="production-dashboard"
        :line-code="activeLineId"
        @changed="loadDashboardWidgets"
      />
      <dashboard-export-dialog
        v-if="!isReadOnly"
        v-model="exportDialogOpen"
        dashboard-code="production-dashboard"
      />
    </template>
  </main>
</template>

<script lang="ts">
  import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useFullscreen } from '@vueuse/core'
  import { ElMessage } from 'element-plus'
  import DashboardAnalyticsRegion from '@/views/production-dashboard/board/components/DashboardAnalyticsRegion.vue'
  import DashboardHeaderRegion from '@/views/production-dashboard/board/components/DashboardHeaderRegion.vue'
  import DashboardLineOverviewRegion from '@/views/production-dashboard/board/components/DashboardLineOverviewRegion.vue'
  import DashboardMainRegion from '@/views/production-dashboard/board/components/DashboardMainRegion.vue'
  import DashboardRobotBindingDialog from '@/views/production-dashboard/components/DashboardRobotBindingDialog.vue'
  import DashboardExportDialog from '@/views/production-dashboard/components/DashboardExportDialog.vue'
  import DashboardWidgetConfigDialog from '@/views/production-dashboard/components/DashboardWidgetConfigDialog.vue'
  import ProductionLineConfigDialog from '@/views/production-dashboard/components/ProductionLineConfigDialog.vue'
  import {
    ProductionLineLayout,
    ROBOT_STATUS_META,
    RobotDevice,
    RobotStatus
  } from '@/views/production-dashboard/config/robotLine'
  import {
    cloneStaticProductionLines,
    createProductionLineLayout,
    getRecentProductionDashboardLine,
    loadConfiguredProductionLines,
    PRODUCTION_LINE_CONFIG_STORAGE_KEY,
    ProductionLineBoard,
    ProductionLineConfigDraft,
    rememberProductionDashboardLine
  } from '@/views/production-dashboard/config/productionDashboard'
  import { useLineLayout } from '@/store/modules/production-dashboard'
  import { useUserStore } from '@/store/modules/user'
  import { downloadResponseStream } from '@/utils/file/stream-download'
  import {
    DashboardBootstrap,
    DashboardDailyStatistic,
    DashboardFaultRecord,
    DashboardLineRuntime,
    DashboardWidget,
    changeDashboardLineCode,
    deleteDashboardLineConfig,
    fetchDashboardBootstrap,
    fetchDashboardDailyStatistics,
    fetchDashboardFaultRecords,
    getDashboardLineExportUrl,
    fetchDashboardRuntime,
    fetchDashboardSceneLayout,
    fetchDashboardWidgets,
    saveDashboardLineConfig,
    saveDashboardSceneLayout
  } from '@/api/edge-dashboard'

  const statusOrder: RobotStatus[] = [
    'RUNNING',
    'IDLE',
    'FAULT',
    'STOPPED',
    'WARNING',
    'ALARM',
    'OFFLINE',
    'UNKNOWN'
  ]
  const ROBOT_TOUR_IDLE_MS = 30_000
  const ROBOT_TOUR_INTERVAL_MS = 6_000
  const DASHBOARD_CODE = 'production-dashboard'

  export default defineComponent({
    name: 'ProductionDashboard',
    components: {
      DashboardAnalyticsRegion,
      DashboardHeaderRegion,
      DashboardLineOverviewRegion,
      DashboardMainRegion,
      DashboardRobotBindingDialog,
      DashboardExportDialog,
      DashboardWidgetConfigDialog,
      ProductionLineConfigDialog
    },
    setup() {
      const route = useRoute()
      const { layout: sceneLayout, hydrateLayout, loadLayout } = useLineLayout()
      const userStore = useUserStore()
      const isReadOnly = computed(() => route.meta.publicReadOnly === true)
      const dashboardRef = ref<HTMLElement | null>(null)
      const { isFullscreen: isDashboardFullscreen, toggle: toggleDashboardFullscreen } =
        useFullscreen(dashboardRef)
      const configuredLines = ref<ProductionLineBoard[]>(loadConfiguredProductionLines())
      const recentLineId = getRecentProductionDashboardLine(configuredLines.value)
      const initialLine =
        configuredLines.value.find((line) => line.id === recentLineId && line.enabled) ||
        configuredLines.value.find((line) => line.enabled) ||
        configuredLines.value[0]
      const activeLineId = ref(initialLine.id)
      const selectedRobotId = ref(initialLine.robots[0]?.id || '')
      const lineConfigOpen = ref(false)
      const bindingDialogOpen = ref(false)
      const widgetConfigOpen = ref(false)
      const exportDialogOpen = ref(false)
      const exportLoading = ref(false)
      const now = ref(new Date())
      const runtime = ref<DashboardLineRuntime | null>(null)
      const todayStatistics = ref<DashboardDailyStatistic[]>([])
      const currentFaults = ref<DashboardFaultRecord[]>([])
      const dashboardWidgets = ref<DashboardWidget[]>([])
      const defaultWidgetColumnSpan = computed(() => {
        const visibleCount = Math.min(Math.max(dashboardWidgets.value.length, 1), 3)
        return Math.floor(12 / visibleCount)
      })
      const lineCreating = ref(false)
      const lineSavingId = ref('')
      const dashboardBootstrapping = ref(true)
      const dashboardOffline = ref(false)
      const sceneLayoutCache = new Map<string, ProductionLineLayout>()
      let clockTimer = 0
      let dataTimer = 0
      let robotTourIdleTimer = 0
      let robotTourTimer = 0

      /** 公开看板只允许查看，业务方法再次拦截，避免仅依赖按钮隐藏。 */
      const rejectReadOnlyOperation = () => {
        if (!isReadOnly.value) return false
        ElMessage.warning('公开看板为只读模式，请登录管理端后进行配置')
        return true
      }

      const visibleLines = computed(() => configuredLines.value.filter((line) => line.enabled))
      const activeLine = computed(
        () =>
          configuredLines.value.find((line) => line.id === activeLineId.value) ||
          visibleLines.value[0] ||
          configuredLines.value[0]
      )
      const baseSceneRobots = computed<RobotDevice[]>(() =>
        sceneLayout.value.lineId === activeLine.value.id
          ? sceneLayout.value.robots
          : activeLine.value.robots
      )
      const sceneRobots = computed<RobotDevice[]>(() =>
        baseSceneRobots.value.map((robot) => {
          const live = runtime.value?.robots.find((item) => item.robotCode === robot.id)
          const daily = todayStatistics.value.find((item) => item.robotCode === robot.id)
          if (!live && !daily) return robot
          return {
            ...robot,
            status: (live?.status || robot.status) as RobotStatus,
            today: daily
              ? {
                  runningMinutes: Math.floor(daily.runningSeconds / 60),
                  stoppedMinutes: Math.floor(
                    (daily.idleSeconds + daily.stoppedSeconds + daily.offlineSeconds) / 60
                  ),
                  alarmMinutes: Math.floor(daily.faultSeconds / 60)
                }
              : robot.today,
            currentAlarm:
              currentFaults.value.find((item) => item.robotCode === robot.id)?.faultReason ||
              robot.currentAlarm
          }
        })
      )
      const activeSceneLayout = computed<ProductionLineLayout>(() => {
        const source =
          sceneLayout.value.lineId === activeLine.value.id
            ? sceneLayout.value
            : createProductionLineLayout(activeLine.value)
        return { ...source, robots: sceneRobots.value }
      })
      const onlineRobots = computed(
        () => runtime.value?.robots.filter((robot) => robot.dataOnline).length ?? 0
      )
      const runningRobotCount = computed(
        () => sceneRobots.value.filter((robot) => robot.status === 'RUNNING').length
      )
      const selectedRobotForBinding = computed(
        () =>
          baseSceneRobots.value.find((robot) => robot.id === selectedRobotId.value) ||
          baseSceneRobots.value[0]
      )
      const activeAlarms = computed(() => {
        if (!currentFaults.value.length) return activeLine.value.alarms
        return currentFaults.value.map((fault) => ({
          id: String(fault.id),
          time: new Date(fault.startTime).toLocaleTimeString('zh-CN', { hour12: false }),
          robotId: fault.robotName || fault.robotCode,
          message: fault.faultCode || fault.faultReason,
          level: fault.severity === 'Critical' ? ('ALARM' as const) : ('WARNING' as const),
          duration: formatSeconds(fault.durationSeconds)
        }))
      })
      const statusOverview = computed(() =>
        statusOrder
          .map((status) => ({
            status,
            ...ROBOT_STATUS_META[status],
            count: sceneRobots.value.filter((robot) => robot.status === status).length
          }))
          .filter((item) => item.count || ['RUNNING', 'IDLE', 'FAULT'].includes(item.status))
      )
      const statusPieStyle = computed(() => {
        const total = sceneRobots.value.length
        if (!total) return { background: 'conic-gradient(#31495c 0deg 360deg)' }
        let start = 0
        const slices = statusOverview.value
          .filter((item) => item.count)
          .map((item) => {
            const end = start + (item.count / total) * 360
            const slice = `${item.color} ${start}deg ${end}deg`
            start = end
            return slice
          })
        return { background: `conic-gradient(${slices.join(', ')})` }
      })
      const currentTime = computed(() =>
        now.value
          .toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          })
          .replaceAll('/', '-')
      )

      const formatSeconds = (seconds: number) =>
        seconds >= 3600
          ? `${Math.floor(seconds / 3600)} 小时 ${Math.floor((seconds % 3600) / 60)} 分钟`
          : seconds >= 60
            ? `${Math.floor(seconds / 60)} 分钟`
            : `${Math.max(0, Math.floor(seconds))} 秒`

      /** 停止机械手自动巡检，但保留当前选中的机械手。 */
      const stopRobotTour = () => {
        window.clearInterval(robotTourTimer)
        robotTourTimer = 0
      }

      /** 自动选择当前线体中的下一台机械手。 */
      const selectNextRobot = () => {
        const robots = sceneRobots.value
        if (robots.length < 2) return
        const currentIndex = robots.findIndex((robot) => robot.id === selectedRobotId.value)
        selectedRobotId.value = robots[(currentIndex + 1 + robots.length) % robots.length].id
      }

      /** 空闲达到三十秒后启动巡检，每六秒展示下一台机械手。 */
      const startRobotTour = () => {
        stopRobotTour()
        if (document.hidden || sceneRobots.value.length < 2) return
        selectNextRobot()
        robotTourTimer = window.setInterval(selectNextRobot, ROBOT_TOUR_INTERVAL_MS)
      }

      /** 用户发生操作时立即退出巡检，并重新计算三十秒空闲时间。 */
      const resetRobotTour = () => {
        window.clearTimeout(robotTourIdleTimer)
        stopRobotTour()
        if (document.hidden) return
        robotTourIdleTimer = window.setTimeout(startRobotTour, ROBOT_TOUR_IDLE_MS)
      }

      const handleVisibilityChange = () => resetRobotTour()

      /** 首屏和离线模式均先清除场景中的历史状态，实时接口返回后再覆盖。 */
      const markRobotsOffline = (robots: RobotDevice[]) =>
        robots.map((robot) => ({
          ...robot,
          status: 'OFFLINE' as RobotStatus,
          currentAlarm: undefined,
          today: { runningMinutes: 0, stoppedMinutes: 0, alarmMinutes: 0 }
        }))

      const markLinesOffline = (lines: ProductionLineBoard[]) =>
        lines.map((line) => ({
          ...line,
          robots: markRobotsOffline(line.robots),
          todayRunningMinutes: 0,
          todayStoppedMinutes: 0,
          todayAlarmMinutes: 0,
          alarms: []
        }))

      /** 解析后端场景；单条场景损坏时只回退该线体，不影响其他线体进入。 */
      const parseBackendScene = (
        layoutJson: string | undefined,
        fallback: ProductionLineLayout
      ) => {
        if (!layoutJson) return fallback
        try {
          const parsed = JSON.parse(layoutJson) as ProductionLineLayout
          if (
            parsed.lineId !== fallback.lineId ||
            !Array.isArray(parsed.robots) ||
            !Array.isArray(parsed.conveyors) ||
            !Array.isArray(parsed.workCells) ||
            !Array.isArray(parsed.junctions)
          )
            return fallback
          parsed.lineName = fallback.lineName
          parsed.lineArea = fallback.lineArea
          parsed.lineColor = fallback.lineColor
          parsed.enabled = fallback.enabled
          parsed.robots = markRobotsOffline(parsed.robots)
          return parsed
        } catch {
          return fallback
        }
      }

      /** 把聚合接口返回的线体主数据和场景合成为现有看板模型。 */
      const buildLinesFromBootstrap = (
        bootstrap: DashboardBootstrap,
        localFallback: ProductionLineBoard[]
      ) => {
        const scenes = new Map(bootstrap.sceneLayouts.map((scene) => [scene.lineCode, scene]))
        const staticTemplate = cloneStaticProductionLines()[2]
        sceneLayoutCache.clear()
        return bootstrap.lines.map((lineConfig) => {
          const template =
            localFallback.find((line) => line.id === lineConfig.lineCode) || staticTemplate
          const robots = markRobotsOffline(
            template.robots.map((robot, index) => ({
              ...robot,
              id:
                template.id === lineConfig.lineCode
                  ? robot.id
                  : `${lineConfig.lineCode}-R-${String(index + 1).padStart(2, '0')}`,
              bindings: {
                ...robot.bindings,
                deviceId:
                  template.id === lineConfig.lineCode
                    ? robot.bindings.deviceId
                    : `${lineConfig.lineCode}-R-${String(index + 1).padStart(2, '0')}`
              }
            }))
          )
          const line: ProductionLineBoard = {
            ...template,
            id: lineConfig.lineCode,
            name: lineConfig.lineName,
            area: lineConfig.area,
            color: lineConfig.color,
            enabled: lineConfig.enabled,
            robots,
            todayRunningMinutes: 0,
            todayStoppedMinutes: 0,
            todayAlarmMinutes: 0,
            plannedMaintenanceMinutes: 0,
            energyKwh: 0,
            mtbfHours: 0,
            mttrMinutes: 0,
            alarms: []
          }
          const fallbackLayout = createProductionLineLayout(line)
          const layout = parseBackendScene(
            scenes.get(lineConfig.lineCode)?.layoutJson,
            fallbackLayout
          )
          line.robots = layout.robots
          sceneLayoutCache.set(line.id, layout)
          return line
        })
      }

      /** 选择最近访问的有效线体，并直接使用首屏返回的场景初始化 Store。 */
      const applyLoadedLines = (lines: ProductionLineBoard[]) => {
        if (!lines.length) return false
        configuredLines.value = lines
        const recentLineId = getRecentProductionDashboardLine(lines)
        const nextLine =
          lines.find((line) => line.id === recentLineId && line.enabled) ||
          lines.find((line) => line.enabled) ||
          lines[0]
        activeLineId.value = nextLine.id
        selectedRobotId.value = nextLine.robots[0]?.id || ''
        const layout = sceneLayoutCache.get(nextLine.id) || createProductionLineLayout(nextLine)
        hydrateLayout(layout)
        return true
      }

      /** 新数据库没有线体时，用现有本地配置完成一次初始化，之后仍由数据库作为数据源。 */
      const initializeEmptyDashboard = async (fallbackLines: ProductionLineBoard[]) => {
        for (const [index, line] of fallbackLines.entries()) {
          const layout = createProductionLineLayout(line)
          await saveDashboardLineConfig(
            {
              dashboardCode: DASHBOARD_CODE,
              lineCode: line.id,
              lineName: line.name,
              area: line.area,
              color: line.color,
              enabled: line.enabled,
              sort: index * 10
            },
            false
          )
          await saveDashboardSceneLayout(
            {
              dashboardCode: DASHBOARD_CODE,
              lineCode: layout.lineId,
              lineName: layout.lineName,
              layoutVersion: layout.version,
              layoutJson: JSON.stringify(layout)
            },
            false
          )
        }
      }

      /** 后端优先完成看板初始化；仅接口异常时提示并进入本地离线模式。 */
      const initializeDashboard = async () => {
        const fallbackLines = markLinesOffline(loadConfiguredProductionLines())
        try {
          let bootstrap = await fetchDashboardBootstrap(DASHBOARD_CODE, isReadOnly.value)
          if (!bootstrap.lines.length) {
            if (isReadOnly.value) throw new Error('后端没有可用的线体配置')
            await initializeEmptyDashboard(fallbackLines)
            bootstrap = await fetchDashboardBootstrap(DASHBOARD_CODE)
          }
          const lines = buildLinesFromBootstrap(bootstrap, fallbackLines)
          if (!applyLoadedLines(lines)) throw new Error('后端没有可用的线体配置')
          dashboardOffline.value = false
        } catch {
          sceneLayoutCache.clear()
          fallbackLines.forEach((line) => {
            sceneLayoutCache.set(line.id, createProductionLineLayout(line))
          })
          applyLoadedLines(fallbackLines)
          dashboardOffline.value = true
          ElMessage.warning('后端线体或场景配置加载失败，已切换为本地离线显示')
        } finally {
          dashboardBootstrapping.value = false
        }
      }

      /** 创建线体及其初始场景，成功后再加入本地线体列表。 */
      const addLine = async (draft: ProductionLineConfigDraft, completed: () => void) => {
        if (rejectReadOnlyOperation()) return
        if (lineCreating.value) return
        if (dashboardOffline.value)
          return ElMessage.warning('当前为离线显示，恢复后端连接后才能新增线体')
        const id = draft.id.trim()
        const name = draft.name.trim()
        if (!id) return ElMessage.warning('请填写线体编码')
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(id))
          return ElMessage.warning('线体编码只能包含字母、数字、下划线和短横线')
        if (configuredLines.value.some((line) => line.id.toLowerCase() === id.toLowerCase()))
          return ElMessage.warning(`线体编码 ${id} 已存在`)
        if (!name) return ElMessage.warning('请填写线体名称')

        const source = cloneStaticProductionLines()[2]
        const newLine: ProductionLineBoard = {
          ...source,
          id,
          name,
          area: draft.area.trim(),
          color: draft.color,
          enabled: draft.enabled,
          robots: source.robots.map((robot, index) => ({
            ...robot,
            id: `${id}-R-${String(index + 1).padStart(2, '0')}`,
            name: `机械手 ${String(index + 1).padStart(2, '0')}`,
            status: 'OFFLINE',
            today: { runningMinutes: 0, stoppedMinutes: 0, alarmMinutes: 0 },
            bindings: {
              ...robot.bindings,
              deviceId: `${id}-R-${String(index + 1).padStart(2, '0')}`
            }
          })),
          todayRunningMinutes: 0,
          todayStoppedMinutes: 0,
          todayAlarmMinutes: 0,
          plannedMaintenanceMinutes: 0,
          energyKwh: 0,
          mtbfHours: 0,
          mttrMinutes: 0,
          alarms: []
        }
        const initialScene = createProductionLineLayout(newLine)
        lineCreating.value = true
        try {
          await saveDashboardLineConfig(
            {
              dashboardCode: DASHBOARD_CODE,
              lineCode: id,
              lineName: name,
              area: newLine.area,
              color: newLine.color,
              enabled: newLine.enabled,
              sort: configuredLines.value.length * 10
            },
            false
          )
          await saveDashboardSceneLayout({
            dashboardCode: DASHBOARD_CODE,
            lineCode: initialScene.lineId,
            lineName: initialScene.lineName,
            layoutVersion: initialScene.version,
            layoutJson: JSON.stringify(initialScene)
          })
          sceneLayoutCache.set(id, initialScene)
          configuredLines.value.push(newLine)
          if (newLine.enabled) {
            activeLineId.value = id
            selectedRobotId.value = newLine.robots[0].id
          }
          completed()
        } catch {
          // HTTP 层已经展示具体错误，创建失败时不写入本地线体列表。
        } finally {
          lineCreating.value = false
        }
      }

      /** 保存线体全部基础信息；编码改变时由后端事务迁移所有关联数据。 */
      const saveLineConfig = async (draft: ProductionLineConfigDraft, completed: () => void) => {
        if (rejectReadOnlyOperation()) return
        if (lineSavingId.value) return
        if (dashboardOffline.value)
          return ElMessage.warning('当前为离线显示，恢复后端连接后才能修改线体')
        const originalId = draft.originalId?.trim() || draft.id.trim()
        const requestedId = draft.id.trim()
        const id = originalId.toLowerCase() === requestedId.toLowerCase() ? originalId : requestedId
        const name = draft.name.trim()
        const line = configuredLines.value.find((item) => item.id === originalId)
        if (!line) return ElMessage.error('未找到需要修改的线体')
        if (!id || !/^[A-Za-z0-9_-]{1,32}$/.test(id))
          return ElMessage.warning('线体编码只能包含字母、数字、下划线和短横线')
        if (
          configuredLines.value.some(
            (item) => item.id !== originalId && item.id.toLowerCase() === id.toLowerCase()
          )
        )
          return ElMessage.warning(`线体编码 ${id} 已存在`)
        if (!name) return ElMessage.warning('请填写线体名称')

        lineSavingId.value = originalId
        let savedSuccessfully = false
        try {
          const cachedLayout = sceneLayoutCache.get(originalId)
          const saved = cachedLayout
            ? null
            : await fetchDashboardSceneLayout(DASHBOARD_CODE, originalId)
          const layout = cachedLayout
            ? (JSON.parse(JSON.stringify(cachedLayout)) as ProductionLineLayout)
            : saved
              ? (JSON.parse(saved.layoutJson) as ProductionLineLayout)
              : createProductionLineLayout(line)
          layout.lineId = id
          layout.lineName = name
          layout.lineArea = draft.area.trim()
          layout.lineColor = draft.color
          layout.enabled = draft.enabled
          layout.updatedAt = new Date().toISOString()
          const layoutVersion = saved?.layoutVersion ?? layout.version
          if (id !== originalId) {
            await changeDashboardLineCode({
              dashboardCode: DASHBOARD_CODE,
              oldLineCode: originalId,
              newLineCode: id,
              lineName: name,
              layoutVersion,
              layoutJson: JSON.stringify(layout)
            })
          } else {
            await saveDashboardLineConfig(
              {
                dashboardCode: DASHBOARD_CODE,
                lineCode: id,
                lineName: name,
                area: draft.area.trim(),
                color: draft.color,
                enabled: draft.enabled,
                sort: configuredLines.value.findIndex((item) => item.id === originalId) * 10
              },
              false
            )
            await saveDashboardSceneLayout({
              dashboardCode: DASHBOARD_CODE,
              lineCode: id,
              lineName: name,
              layoutVersion,
              layoutJson: JSON.stringify(layout)
            })
          }

          if (id !== originalId) sceneLayoutCache.delete(originalId)
          sceneLayoutCache.set(id, layout)

          const wasActive = activeLineId.value === originalId
          line.id = id
          line.name = name
          line.area = draft.area.trim()
          line.color = draft.color
          line.enabled = draft.enabled
          if (wasActive) {
            const nextActive = line.enabled
              ? line
              : configuredLines.value.find((item) => item.enabled) || line
            activeLineId.value = nextActive.id
            selectedRobotId.value = nextActive.robots[0]?.id || ''
            const nextLayout =
              sceneLayoutCache.get(nextActive.id) || createProductionLineLayout(nextActive)
            hydrateLayout(nextLayout)
          }
          savedSuccessfully = true
        } catch {
          ElMessage.error('线体配置保存失败，请稍后重试')
        } finally {
          lineSavingId.value = ''
          if (savedSuccessfully) completed()
        }
      }

      const removeLine = async (id: string) => {
        if (rejectReadOnlyOperation()) return
        if (configuredLines.value.length === 1) return
        if (dashboardOffline.value)
          return ElMessage.warning('当前为离线显示，恢复后端连接后才能删除线体')
        const index = configuredLines.value.findIndex((line) => line.id === id)
        if (index < 0) return
        if (
          configuredLines.value[index].enabled &&
          !configuredLines.value.some((line) => line.id !== id && line.enabled)
        ) {
          ElMessage.warning('至少需要保留一条启用的线体')
          return
        }
        try {
          await deleteDashboardLineConfig(DASHBOARD_CODE, id)
        } catch {
          return
        }
        configuredLines.value.splice(index, 1)
        sceneLayoutCache.delete(id)
        if (activeLineId.value === id) {
          const nextLine =
            configuredLines.value.find((line) => line.enabled) || configuredLines.value[0]
          activeLineId.value = nextLine.id
          selectedRobotId.value = nextLine.robots[0]?.id || ''
        }
      }

      const localDate = () => {
        const date = new Date()
        const year = date.getFullYear()
        const month = `${date.getMonth() + 1}`.padStart(2, '0')
        const day = `${date.getDate()}`.padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      const exportCurrentLine = async () => {
        if (rejectReadOnlyOperation()) return
        if (dashboardOffline.value) return ElMessage.warning('后端连接恢复后才能导出日报')
        if (exportLoading.value) return
        exportLoading.value = true
        const reportDate = localDate()
        try {
          const result = await downloadResponseStream({
            url: getDashboardLineExportUrl(DASHBOARD_CODE, activeLineId.value, reportDate),
            fileName: `看板日报-${activeLineId.value}-${reportDate.replaceAll('-', '')}.xlsx`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            accessToken: userStore.accessToken,
            withCredentials: import.meta.env.VITE_WITH_CREDENTIALS === 'true'
          })
          if (result === 'completed') ElMessage.success('当前线体日报导出完成')
          if (result === 'started') ElMessage.success('当前线体日报已开始下载')
        } catch (error) {
          ElMessage.error(error instanceof Error ? error.message : '当前线体日报导出失败')
        } finally {
          exportLoading.value = false
        }
      }

      const refreshDashboardData = async () => {
        if (dashboardBootstrapping.value || dashboardOffline.value) return
        const lineCode = activeLineId.value
        const date = localDate()
        const [runtimeResult, statisticsResult, faultsResult] = await Promise.allSettled([
          fetchDashboardRuntime(lineCode, isReadOnly.value),
          fetchDashboardDailyStatistics(
            {
              current: 1,
              size: 200,
              lineCode,
              dateFrom: date,
              dateTo: date
            },
            isReadOnly.value
          ),
          fetchDashboardFaultRecords(
            { current: 1, size: 100, lineCode, status: 'Active' },
            isReadOnly.value
          )
        ])
        if (runtimeResult.status === 'fulfilled') runtime.value = runtimeResult.value
        if (statisticsResult.status === 'fulfilled')
          todayStatistics.value = statisticsResult.value.records
        if (faultsResult.status === 'fulfilled') currentFaults.value = faultsResult.value.records
      }

      const loadDashboardWidgets = async () => {
        if (dashboardBootstrapping.value || dashboardOffline.value) {
          dashboardWidgets.value = []
          return
        }
        try {
          dashboardWidgets.value = await fetchDashboardWidgets(
            DASHBOARD_CODE,
            activeLineId.value,
            isReadOnly.value
          )
        } catch {
          dashboardWidgets.value = []
        }
      }

      const loadActiveLineLayout = async () => {
        const cached = sceneLayoutCache.get(activeLine.value.id)
        if (cached) {
          hydrateLayout(cached)
          return
        }
        if (dashboardOffline.value) {
          hydrateLayout(createProductionLineLayout(activeLine.value))
          return
        }
        try {
          await loadLayout(
            activeLine.value.id,
            createProductionLineLayout(activeLine.value),
            false,
            isReadOnly.value
          )
          sceneLayoutCache.set(
            activeLine.value.id,
            JSON.parse(JSON.stringify(sceneLayout.value)) as ProductionLineLayout
          )
        } catch {
          ElMessage.warning('当前线体场景加载失败，已显示默认布局')
          hydrateLayout(createProductionLineLayout(activeLine.value))
        }
      }

      watch(activeLineId, () => {
        if (dashboardBootstrapping.value) return
        rememberProductionDashboardLine(activeLineId.value)
        selectedRobotId.value = sceneRobots.value[0]?.id || ''
        runtime.value = null
        todayStatistics.value = []
        currentFaults.value = []
        refreshDashboardData()
        loadDashboardWidgets()
        loadActiveLineLayout()
        resetRobotTour()
      })
      watch(
        configuredLines,
        (lines) => {
          if (!isReadOnly.value)
            window.localStorage.setItem(PRODUCTION_LINE_CONFIG_STORAGE_KEY, JSON.stringify(lines))
        },
        { deep: true }
      )
      onMounted(async () => {
        clockTimer = window.setInterval(() => {
          now.value = new Date()
        }, 1000)
        await initializeDashboard()
        rememberProductionDashboardLine(activeLineId.value)
        await Promise.allSettled([refreshDashboardData(), loadDashboardWidgets()])
        dataTimer = window.setInterval(refreshDashboardData, 5000)
        window.addEventListener('pointerdown', resetRobotTour, { passive: true })
        window.addEventListener('keydown', resetRobotTour)
        window.addEventListener('wheel', resetRobotTour, { passive: true })
        document.addEventListener('visibilitychange', handleVisibilityChange)
        resetRobotTour()
      })
      onBeforeUnmount(() => {
        window.clearInterval(clockTimer)
        window.clearInterval(dataTimer)
        window.clearTimeout(robotTourIdleTimer)
        stopRobotTour()
        window.removeEventListener('pointerdown', resetRobotTour)
        window.removeEventListener('keydown', resetRobotTour)
        window.removeEventListener('wheel', resetRobotTour)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      })

      return {
        dashboardRef,
        isDashboardFullscreen,
        toggleDashboardFullscreen,
        configuredLines,
        visibleLines,
        activeLineId,
        activeLine,
        sceneRobots,
        activeSceneLayout,
        selectedRobotId,
        runtime,
        lineConfigOpen,
        bindingDialogOpen,
        widgetConfigOpen,
        exportDialogOpen,
        exportLoading,
        currentTime,
        selectedRobotForBinding,
        dashboardWidgets,
        defaultWidgetColumnSpan,
        lineCreating,
        lineSavingId,
        dashboardBootstrapping,
        dashboardOffline,
        isReadOnly,
        onlineRobots,
        runningRobotCount,
        activeAlarms,
        statusOverview,
        statusPieStyle,
        addLine,
        saveLineConfig,
        removeLine,
        refreshDashboardData,
        loadDashboardWidgets,
        exportCurrentLine
      }
    }
  })
</script>

<style lang="scss" scoped>
  .production-dashboard {
    position: relative;
    box-sizing: border-box;
    display: grid;
    grid-template-rows: 56px 52px minmax(0, 1fr);
    gap: 8px;
    width: 100%;
    min-width: 0;
    height: var(--art-full-height, calc(100vh - 80px));
    min-height: 680px;
    padding: 10px 16px 12px;
    overflow: hidden;
    font-family: 'Microsoft YaHei', Arial, sans-serif;
    color: #dcecf8;
    background:
      linear-gradient(rgb(13 44 68 / 11%) 1px, transparent 1px),
      linear-gradient(90deg, rgb(13 44 68 / 11%) 1px, transparent 1px),
      radial-gradient(circle at 50% -10%, #123d5b 0%, #071928 37%, #030b14 78%);
    background-size:
      32px 32px,
      32px 32px,
      cover;

    &--bootstrapping > :not(.production-dashboard__loading) {
      visibility: hidden;
    }

    &--fullscreen {
      width: 100vw;
      height: 100vh;
      min-height: 100vh !important;
      overflow: hidden;
    }

    &--public {
      height: 100vh;
      height: 100dvh;
      min-height: 0;
    }

    &--has-widgets {
      grid-template-rows: 56px 52px minmax(280px, 1.45fr) minmax(220px, 0.9fr);
    }

    &__loading {
      position: absolute;
      inset: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: center;
      justify-content: center;
      color: #dcecf8;
      background: #071928;
    }

    &__loading i {
      width: 34px;
      height: 34px;
      border: 3px solid rgb(91 216 255 / 20%);
      border-top-color: #5bd8ff;
      border-radius: 50%;
      animation: dashboard-loading-spin 0.85s linear infinite;
    }

    &__loading strong {
      font-size: 14px;
      font-weight: 600;
    }

    &__loading span {
      font-size: 11px;
      color: #789bad;
    }
  }

  @media (width <= 1350px) {
    .production-dashboard {
      padding: 10px 12px;
    }
  }

  @media (resolution <= 1.1dppx) and (width >= 1440px) and (height >= 760px) {
    .production-dashboard {
      grid-template-rows: 60px 58px minmax(0, 1fr);
      gap: 9px;
      padding: 11px 18px 13px;

      &--has-widgets {
        grid-template-rows: 60px 58px minmax(270px, 1.45fr) minmax(210px, 0.9fr);
      }
    }
  }

  /* Windows 缩放 100% 的高分辨率屏幕使用更大的阅读尺寸。 */
  @media (resolution <= 1.1dppx) and (width >= 1600px) and (height >= 850px) {
    .production-dashboard {
      grid-template-rows: 66px 62px minmax(0, 1fr);
      gap: 10px;
      padding: 12px 20px 14px;

      &--has-widgets {
        grid-template-rows: 66px 62px minmax(330px, 1.45fr) minmax(250px, 0.9fr);
      }
    }
  }

  @media (height <= 820px) and (width >= 768px) {
    .production-dashboard {
      grid-template-rows: 48px 42px minmax(0, 1fr);
      gap: 6px;
      min-height: 600px;
      padding: 7px 12px 8px;

      &--has-widgets {
        grid-template-rows: 48px 42px minmax(235px, 1.35fr) minmax(180px, 0.9fr);
      }
    }
  }

  @media (width <= 767px) {
    .production-dashboard {
      display: block;
      width: 100%;
      min-width: 0;
      height: auto;
      min-height: 100vh;
      padding: 10px;
      overflow: visible;
    }
  }

  @keyframes dashboard-loading-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
