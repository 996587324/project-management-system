<template>
  <section class="production-dashboard__main-grid">
    <aside class="production-dashboard__column production-dashboard__column--left">
      <section class="dashboard-panel">
        <header class="dashboard-panel__title">
          <span>设备运行状态</span><small>HTTP 实时数据 · 5 秒刷新</small>
        </header>
        <div class="status-overview">
          <div v-for="item in statusItems" :key="item.status" class="status-overview__item">
            <div>
              <i :style="{ backgroundColor: item.color }" />
              <span>{{ item.label }}</span
              ><b>{{ item.count }}</b>
            </div>
            <div class="status-overview__rail">
              <i
                :style="{
                  width: `${robots.length ? (item.count / robots.length) * 100 : 0}%`,
                  backgroundColor: item.color
                }"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="dashboard-panel dashboard-panel--robots">
        <header class="dashboard-panel__title">
          <span>机械手工位</span><small>{{ robots.length }} 台设备</small>
        </header>
        <div ref="robotStationListRef" class="robot-station-list">
          <button
            v-for="robot in robots"
            :key="robot.id"
            :class="['robot-row', { 'robot-row--active': selectedId === robot.id }]"
            type="button"
            @click="emit('update:selectedId', robot.id)"
          >
            <i :style="{ backgroundColor: statusMeta(robot.status).color }" />
            <span
              ><b>{{ robot.name }}</b
              ><small>{{ robot.station }}</small></span
            >
            <em :style="{ color: statusMeta(robot.status).color }">
              {{ statusMeta(robot.status).label }}
            </em>
          </button>
        </div>
      </section>
    </aside>

    <section class="production-dashboard__column production-dashboard__column--center">
      <section class="dashboard-panel dashboard-panel--scene">
        <header class="dashboard-panel__title">
          <span>线体数字孪生</span>
          <div class="scene-caption"><i /> 运行 <i /> 停止 <i /> 报警</div>
        </header>
        <robot-line-scene
          :robots="robots"
          :layout="layout"
          :selected-id="selectedId"
          :selected-layout="selectedSceneItem"
          :runtime-robots="runtimeRobots"
          :runtime-devices="runtimeDevices"
          @select-scene="emit('update:selectedSceneItem', $event)"
        />
      </section>
    </section>

    <aside class="production-dashboard__column production-dashboard__column--right">
      <section class="dashboard-panel dashboard-panel--status-pie">
        <header class="dashboard-panel__title">
          <span>当前线体状态分布</span><small>{{ robots.length }} 台机械手</small>
        </header>
        <div class="status-pie-wrap">
          <div class="status-pie" :style="statusPieStyle">
            <div
              ><b>{{ runningCount }}</b
              ><span>运行中</span></div
            >
          </div>
          <div class="status-pie-legend">
            <div v-for="item in statusItems" :key="item.status">
              <i :style="{ backgroundColor: item.color }" />
              <span>{{ item.label }}</span
              ><b>{{ item.count }}</b>
            </div>
          </div>
        </div>
      </section>

      <section class="dashboard-panel dashboard-panel--alarms">
        <header class="dashboard-panel__title">
          <span>当前报警与事件</span><small class="alarm-count">{{ alarms.length }} 条</small>
        </header>
        <ol class="alarm-list">
          <li v-for="alarm in alarms" :key="alarm.id">
            <i :class="`alarm-list__level--${alarm.level.toLowerCase()}`" />
            <div>
              <b>{{ alarm.message }}</b>
              <span>{{ alarm.time }} · {{ alarm.robotId }} · 持续 {{ alarm.duration }}</span>
            </div>
          </li>
        </ol>
      </section>
    </aside>
  </section>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, ref, watch } from 'vue'
  import RobotLineScene from '@/views/production-dashboard/components/RobotLineScene.vue'
  import { ROBOT_STATUS_META } from '@/views/production-dashboard/config/robotLine'
  import type { DashboardDeviceRuntime, DashboardRobotRuntime } from '@/api/edge-dashboard'
  import type { LayoutSelection } from '@/store/modules/production-dashboard'
  import type {
    ProductionLineLayout,
    RobotDevice,
    RobotStatus
  } from '@/views/production-dashboard/config/robotLine'
  import type { ProductionAlarm } from '@/views/production-dashboard/config/productionDashboard'

  interface DashboardStatusOverviewItem {
    status: RobotStatus
    label: string
    color: string
    count: number
  }

  const props = defineProps<{
    robots: RobotDevice[]
    layout: ProductionLineLayout
    selectedId: string
    selectedSceneItem: LayoutSelection | null
    runtimeRobots: DashboardRobotRuntime[]
    runtimeDevices: DashboardDeviceRuntime[]
    statusItems: DashboardStatusOverviewItem[]
    statusPieStyle: Record<string, string>
    runningCount: number
    alarms: ProductionAlarm[]
  }>()

  const emit = defineEmits<{
    'update:selectedId': [robotId: string]
    'update:selectedSceneItem': [selection: LayoutSelection | null]
  }>()

  const robotStationListRef = ref<HTMLElement | null>(null)
  let robotStationScrollFrame = 0

  const statusMeta = (status: RobotStatus) => ROBOT_STATUS_META[status]

  /** 自动轮动或手动切换机械手时，让选中工位保持在列表可视区域。 */
  const scrollSelectedRobotIntoView = () => {
    window.cancelAnimationFrame(robotStationScrollFrame)
    robotStationScrollFrame = window.requestAnimationFrame(() => {
      robotStationListRef.value
        ?.querySelector<HTMLElement>('.robot-row--active')
        ?.scrollIntoView({ block: 'nearest' })
    })
  }

  watch(() => props.selectedId, scrollSelectedRobotIntoView, { immediate: true })
  onBeforeUnmount(() => window.cancelAnimationFrame(robotStationScrollFrame))
</script>

<style scoped lang="scss">
  .production-dashboard__main-grid {
    display: grid;
    grid-template-columns: minmax(205px, 0.8fr) minmax(560px, 2fr) minmax(245px, 0.92fr);
    gap: 10px;
    min-height: 0;
  }

  .production-dashboard__column {
    display: grid;
    gap: 10px;
    min-height: 0;
  }

  .production-dashboard__column--left {
    grid-template-rows: minmax(125px, 0.6fr) minmax(0, 1.4fr);
  }

  .production-dashboard__column--center {
    grid-template-rows: minmax(0, 1fr);
  }

  .production-dashboard__column--right {
    grid-template-rows: minmax(150px, 0.72fr) minmax(0, 1.28fr);
  }

  .dashboard-panel {
    min-width: 0;
    overflow: hidden;
    background: linear-gradient(150deg, rgb(10 33 51 / 86%), rgb(4 16 28 / 90%));
    border: 1px solid rgb(72 166 211 / 25%);
    box-shadow: inset 0 0 25px rgb(35 111 150 / 5%);
  }

  .dashboard-panel__title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 34px;
    padding: 0 11px;
    font-size: 13px;
    font-weight: 600;
    color: #eaf8ff;
    border-bottom: 1px solid rgb(80 165 207 / 15%);
  }

  .dashboard-panel__title > span {
    flex: 0 0 auto;
  }

  .dashboard-panel__title > span::before {
    display: inline-block;
    width: 3px;
    height: 12px;
    margin-right: 7px;
    vertical-align: -1px;
    content: '';
    background: #5bd8ff;
    box-shadow: 0 0 8px #5bd8ff;
  }

  .dashboard-panel__title small {
    min-width: 0;
    overflow: hidden;
    font-size: 10px;
    font-weight: 400;
    color: #7191a4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-overview {
    padding: 8px 12px;
  }

  .status-overview__item {
    margin-bottom: 9px;
  }

  .status-overview__item > div:first-child {
    display: flex;
    align-items: center;
  }

  .status-overview__item i {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 6px;
    border-radius: 50%;
  }

  .status-overview__item span {
    font-size: 11px;
    color: #a8c1d0;
  }

  .status-overview__item b {
    margin-left: auto;
    font-family: Consolas, monospace;
    font-size: 12px;
    color: #e7f7ff;
  }

  .status-overview__rail {
    height: 4px;
    margin: 5px 0 0 13px;
    background: rgb(91 140 165 / 15%);
  }

  .status-overview__rail i {
    display: block;
    height: 100%;
    margin: 0;
    box-shadow: 0 0 7px currentcolor;
  }

  .robot-row {
    display: grid;
    grid-template-columns: 8px minmax(0, 1fr) auto;
    gap: 7px;
    align-items: center;
    width: 100%;
    padding: 8px 10px;
    color: #dfeef6;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-bottom: 1px solid rgb(90 151 183 / 11%);
  }

  .robot-row:hover,
  .robot-row--active {
    background: rgb(40 133 177 / 16%);
  }

  .robot-row > i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    box-shadow: 0 0 8px currentcolor;
  }

  .robot-row b,
  .robot-row small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .robot-row b {
    font-size: 11px;
  }

  .robot-row small {
    margin-top: 3px;
    font-size: 10px;
    color: #6f90a4;
  }

  .robot-row em {
    font-size: 10px;
    font-style: normal;
  }

  .dashboard-panel--robots {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .robot-station-list {
    flex: 1;
    min-height: 0;
    overflow: hidden auto;
    overscroll-behavior: contain;
    scrollbar-color: rgb(91 216 255 / 45%) rgb(7 24 38 / 35%);
    scrollbar-width: thin;
  }

  .robot-station-list::-webkit-scrollbar {
    width: 6px;
  }

  .robot-station-list::-webkit-scrollbar-track {
    background: rgb(7 24 38 / 35%);
  }

  .robot-station-list::-webkit-scrollbar-thumb {
    background: rgb(91 216 255 / 45%);
    border-radius: 3px;
  }

  .dashboard-panel--scene {
    display: flex;
    flex-direction: column;
  }

  .dashboard-panel--scene :deep(.robot-line-scene) {
    flex: 1;
    height: auto;
    min-height: 0;
    border: 0;
    border-radius: 0;
  }

  .scene-caption {
    font-size: 10px;
    font-weight: 400;
    color: #7f9eaf;
  }

  .scene-caption i {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin: 0 3px 0 7px;
    background: #36dca0;
    border-radius: 50%;
  }

  .scene-caption i:nth-of-type(2) {
    background: #a6b3bf;
  }

  .scene-caption i:nth-of-type(3) {
    background: #fb6176;
  }

  .dashboard-panel--status-pie {
    display: flex;
    flex-direction: column;
  }

  .status-pie-wrap {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: space-evenly;
    min-height: 0;
    padding: 5px 10px;
  }

  .status-pie {
    display: grid;
    place-items: center;
    width: 108px;
    height: 108px;
    border-radius: 50%;
    box-shadow: 0 0 20px rgb(46 187 234 / 16%);
  }

  .status-pie > div {
    display: grid;
    place-content: center;
    width: 77px;
    height: 77px;
    text-align: center;
    background: #0a2133;
    border-radius: 50%;
  }

  .status-pie b {
    font-family: Consolas, monospace;
    font-size: 22px;
    color: #effbff;
  }

  .status-pie span {
    margin-top: 2px;
    font-size: 10px;
    color: #86a5b7;
  }

  .status-pie-legend {
    min-width: 95px;
  }

  .status-pie-legend div {
    display: grid;
    grid-template-columns: 8px 1fr 18px;
    gap: 5px;
    align-items: center;
    padding: 3px 0;
  }

  .status-pie-legend i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .status-pie-legend span {
    font-size: 10px;
    color: #9eb9c9;
  }

  .status-pie-legend b {
    font-family: Consolas, monospace;
    font-size: 11px;
    color: #e2f6ff;
    text-align: right;
  }

  .alarm-count {
    color: #fb7788 !important;
  }

  .alarm-list {
    padding: 5px 9px;
    margin: 0;
    list-style: none;
  }

  .alarm-list li {
    display: grid;
    grid-template-columns: 7px 1fr;
    gap: 8px;
    padding: 8px 1px;
    border-bottom: 1px solid rgb(96 143 170 / 12%);
  }

  .alarm-list li > i {
    width: 6px;
    height: 6px;
    margin-top: 4px;
    border-radius: 50%;
  }

  .alarm-list__level--alarm {
    background: #fb6176;
    box-shadow: 0 0 9px #fb6176;
  }

  .alarm-list__level--warning {
    background: #f7c650;
    box-shadow: 0 0 9px #f7c650;
  }

  .alarm-list b,
  .alarm-list span {
    display: block;
  }

  .alarm-list b {
    overflow: hidden;
    font-size: 11px;
    color: #d7ecf5;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .alarm-list span {
    margin-top: 4px;
    font-family: Consolas, monospace;
    font-size: 9px;
    color: #68899e;
  }

  @media (resolution <= 1.1dppx) and (width >= 1440px) and (height >= 760px) {
    .production-dashboard__main-grid {
      grid-template-columns: minmax(245px, 0.8fr) minmax(640px, 2fr) minmax(285px, 0.92fr);
      gap: 12px;
    }

    .production-dashboard__column {
      gap: 12px;
    }

    .production-dashboard__column--left {
      grid-template-rows: minmax(155px, 0.62fr) minmax(0, 1.38fr);
    }

    .production-dashboard__column--right {
      grid-template-rows: minmax(185px, 0.75fr) minmax(0, 1.25fr);
    }

    .dashboard-panel__title {
      height: 40px;
      padding: 0 14px;
      font-size: 18px;
    }

    .dashboard-panel__title > span::before {
      width: 4px;
      height: 15px;
      margin-right: 9px;
    }

    .dashboard-panel__title small,
    .scene-caption {
      font-size: 14px;
    }

    .scene-caption i {
      width: 8px;
      height: 8px;
    }

    .status-overview {
      padding: 10px 15px;
    }

    .status-overview__item {
      margin-bottom: 11px;
    }

    .status-overview__item i {
      width: 9px;
      height: 9px;
      margin-right: 8px;
    }

    .status-overview__item span {
      font-size: 16px;
    }

    .status-overview__item b {
      font-size: 17px;
    }

    .status-overview__rail {
      height: 6px;
      margin-left: 17px;
    }

    .robot-row {
      grid-template-columns: 10px minmax(0, 1fr) auto;
      gap: 9px;
      padding: 10px 13px;
    }

    .robot-row > i {
      width: 8px;
      height: 8px;
    }

    .robot-row b {
      font-size: 16px;
    }

    .robot-row small,
    .robot-row em {
      font-size: 14px;
    }

    .robot-station-list::-webkit-scrollbar {
      width: 8px;
    }

    .dashboard-panel--scene :deep(.robot-line-scene__legend) {
      gap: 12px;
      padding: 8px 10px;
      font-size: 16px;
    }

    .dashboard-panel--scene :deep(.robot-line-scene__legend-item i) {
      width: 9px;
      height: 9px;
    }

    .dashboard-panel--scene :deep(.robot-line-scene__detail) {
      width: min(440px, calc(100% - 24px));
      min-width: 300px;
      padding: 14px 16px;
      font-size: 18px;
    }

    .dashboard-panel--scene :deep(.robot-line-scene__detail-fields div) {
      min-height: 34px;
    }

    .dashboard-panel--scene :deep(.robot-line-scene__detail-heading) {
      font-size: 20px;
    }

    .dashboard-panel--scene :deep(.robot-line-scene__detail-fields span) {
      font-size: 17px;
    }

    .dashboard-panel--scene :deep(.robot-line-scene__detail-fields b) {
      font-size: 18px;
    }

    .dashboard-panel--scene :deep(.robot-line-scene__tip) {
      font-size: 15px;
    }

    .dashboard-panel--status-pie .dashboard-panel__title {
      font-size: 20px;
    }

    .status-pie {
      width: 156px;
      height: 156px;
    }

    .status-pie > div {
      width: 112px;
      height: 112px;
    }

    .status-pie b {
      font-size: 38px;
    }

    .status-pie span {
      font-size: 16px;
    }

    .status-pie-legend {
      min-width: 120px;
    }

    .status-pie-legend div {
      grid-template-columns: 11px minmax(0, 1fr) 28px;
      gap: 8px;
      padding: 5px 0;
    }

    .status-pie-legend i {
      width: 10px;
      height: 10px;
    }

    .status-pie-legend span {
      font-size: 16px;
    }

    .status-pie-legend b {
      font-size: 18px;
    }

    .alarm-list {
      padding: 7px 12px;
    }

    .alarm-list li {
      grid-template-columns: 9px minmax(0, 1fr);
      gap: 10px;
      padding: 10px 2px;
    }

    .alarm-list li > i {
      width: 8px;
      height: 8px;
    }

    .alarm-list b {
      font-size: 16px;
    }

    .alarm-list span {
      font-size: 13px;
    }
  }

  @media (width <= 1350px) {
    .production-dashboard__main-grid {
      grid-template-columns: 218px minmax(520px, 1fr) 245px;
    }
  }

  @media (height <= 820px) and (width >= 768px) {
    .production-dashboard__main-grid,
    .production-dashboard__column {
      gap: 6px;
    }

    .dashboard-panel__title {
      height: 30px;
    }

    .status-overview {
      padding: 5px 10px;
    }

    .status-overview__item {
      margin-bottom: 5px;
    }

    .robot-row,
    .alarm-list li {
      padding-top: 5px;
      padding-bottom: 5px;
    }
  }

  @media (width <= 767px) {
    .production-dashboard__main-grid {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .production-dashboard__column {
      display: grid;
      grid-template-rows: none;
    }

    .production-dashboard__column--center {
      order: 1;
    }

    .production-dashboard__column--left {
      order: 2;
    }

    .production-dashboard__column--right {
      order: 3;
    }

    .dashboard-panel--scene {
      height: 420px;
    }

    .dashboard-panel--scene :deep(.robot-line-scene__legend) {
      right: 8px;
      flex-wrap: wrap;
    }

    .dashboard-panel--scene :deep(.robot-line-scene__detail) {
      top: 48px;
      right: 8px;
    }

    .dashboard-panel--status-pie {
      min-height: 225px;
    }

    .dashboard-panel--alarms {
      min-height: 220px;
    }
  }
</style>
