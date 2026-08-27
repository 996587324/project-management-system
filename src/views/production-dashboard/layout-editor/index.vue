<template>
  <main class="layout-editor">
    <header class="layout-editor__header">
      <div>
        <p>产线组态编辑器 · {{ layout.lineId }}</p>
        <h1>{{ layout.lineName }}</h1>
      </div>
      <div class="layout-editor__actions">
        <span v-if="saveMessage" class="layout-editor__save-message">{{ saveMessage }}</span>
        <button
          class="layout-editor__button layout-editor__button--ghost"
          type="button"
          :disabled="layoutLoading || layoutSaving"
          @click="restoreDefault"
        >
          恢复初始布局
        </button>
        <router-link
          class="layout-editor__button layout-editor__button--ghost"
          :to="{ name: 'ProductionDashboardBoard' }"
          >返回看板</router-link
        >
        <button
          class="layout-editor__button"
          type="button"
          :disabled="layoutLoading || layoutSaving"
          @click="save"
          >{{
            layoutLoading ? '正在加载...' : layoutSaving ? '正在保存...' : '保存并渲染看板'
          }}</button
        >
      </div>
    </header>

    <section v-loading="layoutLoading" class="layout-editor__workspace">
      <aside class="layout-editor__panel layout-editor__palette">
        <div class="layout-editor__panel-title">组件库</div>
        <button type="button" @click="add('robot')">＋ 机械手</button>
        <button type="button" @click="add('workCell')">＋ 工位框</button>
        <button type="button" @click="add('conveyor')">＋ 输送线</button>
        <button type="button" @click="add('merge')">＋ 合流点</button>
        <button type="button" @click="add('split')">＋ 分流点</button>

        <div class="layout-editor__panel-title layout-editor__panel-title--items">当前组件</div>
        <div class="layout-editor__item-list">
          <button
            v-for="item in layoutItems"
            :key="`${item.type}-${item.id}`"
            :class="['layout-editor__item', { 'layout-editor__item--active': isSelected(item) }]"
            type="button"
            @click="selected = item"
          >
            <i :class="`layout-editor__item-dot layout-editor__item-dot--${item.type}`" />
            <span>{{ item.name }}</span>
            <small>{{ item.id }}</small>
          </button>
        </div>
      </aside>

      <section class="layout-editor__scene-wrap">
        <robot-line-scene
          :robots="layout.robots"
          :layout="layout"
          :editable="true"
          :show-detail="false"
          @select-layout="selectItem"
          @move-layout-item="moveItem"
        />
      </section>

      <aside class="layout-editor__panel layout-editor__inspector">
        <template v-if="selectedRobot">
          <div class="layout-editor__panel-title">机械手属性</div>
          <label>名称<input v-model="selectedRobot.name" /></label>
          <label>工位名称<input v-model="selectedRobot.station" /></label>
          <label>设备编号<input v-model="selectedRobot.id" disabled /></label>
          <div class="layout-editor__field-row">
            <label
              >X<input v-model.number="selectedRobot.position[0]" type="number" step="0.1"
            /></label>
            <label
              >Z<input v-model.number="selectedRobot.position[1]" type="number" step="0.1"
            /></label>
          </div>
          <label
            >朝向（弧度）<input v-model.number="selectedRobot.rotation" type="number" step="0.1"
          /></label>
          <label
            >演示状态
            <select v-model="selectedRobot.status">
              <option v-for="option in statusOptions" :key="option.status" :value="option.status">
                {{ option.label }}
              </option>
            </select>
          </label>

          <div class="layout-editor__binding-title">数据绑定</div>
          <p class="layout-editor__binding-tip">
            从 HTTP 数据源的完整 JSON 中选择多个字段，并配置运行、空闲、故障累计规则。
          </p>
          <div class="layout-editor__binding-summary">
            <span>当前数据源</span>
            <b>{{ selectedRobot.bindings.deviceId || '尚未绑定' }}</b>
          </div>
          <button
            class="layout-editor__binding-button"
            type="button"
            @click="bindingDialogOpen = true"
          >
            配置数据源与状态规则
          </button>
        </template>

        <template v-else-if="selectedCell">
          <div class="layout-editor__panel-title">工位框属性</div>
          <label>名称<input v-model="selectedCell.name" /></label>
          <label>编号<input v-model="selectedCell.id" disabled /></label>
          <div class="layout-editor__field-row">
            <label
              >X<input v-model.number="selectedCell.position[0]" type="number" step="0.1"
            /></label>
            <label
              >Z<input v-model.number="selectedCell.position[1]" type="number" step="0.1"
            /></label>
          </div>
          <div class="layout-editor__field-row">
            <label
              >宽度<input v-model.number="selectedCell.width" type="number" min="0.5" step="0.1"
            /></label>
            <label
              >深度<input v-model.number="selectedCell.depth" type="number" min="0.5" step="0.1"
            /></label>
          </div>
          <label
            >旋转（弧度）<input v-model.number="selectedCell.rotation" type="number" step="0.1"
          /></label>
        </template>

        <template v-else-if="selectedConveyor">
          <div class="layout-editor__panel-title">输送线属性</div>
          <label>名称<input v-model="selectedConveyor.name" /></label>
          <label>编号<input v-model="selectedConveyor.id" disabled /></label>
          <div class="layout-editor__coordinate-title">起点</div>
          <div class="layout-editor__field-row">
            <label
              >X<input v-model.number="selectedConveyor.from[0]" type="number" step="0.1"
            /></label>
            <label
              >Z<input v-model.number="selectedConveyor.from[1]" type="number" step="0.1"
            /></label>
          </div>
          <div class="layout-editor__coordinate-title">终点</div>
          <div class="layout-editor__field-row">
            <label
              >X<input v-model.number="selectedConveyor.to[0]" type="number" step="0.1"
            /></label>
            <label
              >Z<input v-model.number="selectedConveyor.to[1]" type="number" step="0.1"
            /></label>
          </div>
          <label
            >线宽<input
              v-model.number="selectedConveyor.width"
              type="number"
              min="0.3"
              max="2"
              step="0.1"
          /></label>
        </template>

        <template v-else-if="selectedJunction">
          <div class="layout-editor__panel-title"
            >{{ selectedJunction.kind === 'merge' ? '合流点' : '分流点' }}属性</div
          >
          <label>名称<input v-model="selectedJunction.name" /></label>
          <label>编号<input v-model="selectedJunction.id" disabled /></label>
          <label
            >类型
            <select v-model="selectedJunction.kind">
              <option value="merge">合流</option>
              <option value="split">分流</option>
            </select>
          </label>
          <div class="layout-editor__field-row">
            <label
              >X<input v-model.number="selectedJunction.position[0]" type="number" step="0.1"
            /></label>
            <label
              >Z<input v-model.number="selectedJunction.position[1]" type="number" step="0.1"
            /></label>
          </div>
        </template>

        <div v-else class="layout-editor__empty"
          >从左侧选择或新增一个组件，再在中央区域拖动摆放。</div
        >

        <button v-if="selected" class="layout-editor__delete" type="button" @click="deleteSelected">
          删除当前组件
        </button>
      </aside>
    </section>

    <dashboard-robot-binding-dialog
      v-if="selectedRobot"
      v-model="bindingDialogOpen"
      :line-code="layout.lineId"
      :robot-code="selectedRobot.id"
      :robot-name="selectedRobot.name"
      @saved="handleBindingSaved"
      @deleted="handleBindingDeleted"
    />
  </main>
</template>

<script lang="ts">
  import { computed, defineComponent, onMounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import RobotLineScene from '@/views/production-dashboard/components/RobotLineScene.vue'
  import DashboardRobotBindingDialog from '@/views/production-dashboard/components/DashboardRobotBindingDialog.vue'
  import type { DashboardRobotBinding } from '@/api/edge-dashboard'
  import {
    ConveyorLayoutItem,
    JunctionLayoutItem,
    ROBOT_STATUS_META,
    RobotDevice,
    RobotStatus,
    WorkCellLayoutItem
  } from '@/views/production-dashboard/config/robotLine'
  import { LayoutSelection, useLineLayout } from '@/store/modules/production-dashboard'
  import {
    createProductionLineLayout,
    getRecentProductionDashboardLine,
    loadConfiguredProductionLines,
    rememberProductionDashboardLine
  } from '@/views/production-dashboard/config/productionDashboard'

  interface EditorListItem extends LayoutSelection {
    name: string
  }

  export default defineComponent({
    name: 'LineLayoutEditor',
    components: { DashboardRobotBindingDialog, RobotLineScene },
    setup() {
      const route = useRoute()
      const configuredLines = loadConfiguredProductionLines()
      const queryLineCode = Array.isArray(route.query.lineCode)
        ? route.query.lineCode[0]
        : route.query.lineCode
      const requestedLineCode = queryLineCode || getRecentProductionDashboardLine(configuredLines)
      const editingLine =
        configuredLines.find((line) => line.id === requestedLineCode) || configuredLines[0]
      const {
        layout,
        layoutLoading,
        layoutSaving,
        loadLayout,
        findItem,
        saveLayout,
        resetLayout,
        addRobot,
        addConveyor,
        addWorkCell,
        addJunction,
        removeItem,
        moveItem
      } = useLineLayout()
      const selected = ref<LayoutSelection | null>(null)
      const saveMessage = ref('')
      const bindingDialogOpen = ref(false)

      const selectedRobot = computed(() => {
        if (selected.value?.type !== 'robot') return undefined
        return findItem(selected.value) as RobotDevice | undefined
      })
      const selectedConveyor = computed(() => {
        if (selected.value?.type !== 'conveyor') return undefined
        return findItem(selected.value) as ConveyorLayoutItem | undefined
      })
      const selectedCell = computed(() => {
        if (selected.value?.type !== 'workCell') return undefined
        return findItem(selected.value) as WorkCellLayoutItem | undefined
      })
      const selectedJunction = computed(() => {
        if (selected.value?.type !== 'junction') return undefined
        return findItem(selected.value) as JunctionLayoutItem | undefined
      })
      const layoutItems = computed<EditorListItem[]>(() => [
        ...layout.value.robots.map((item) => ({
          type: 'robot' as const,
          id: item.id,
          name: item.name
        })),
        ...layout.value.workCells.map((item) => ({
          type: 'workCell' as const,
          id: item.id,
          name: item.name
        })),
        ...layout.value.conveyors.map((item) => ({
          type: 'conveyor' as const,
          id: item.id,
          name: item.name
        })),
        ...layout.value.junctions.map((item) => ({
          type: 'junction' as const,
          id: item.id,
          name: item.name
        }))
      ])
      const statusOptions = (Object.keys(ROBOT_STATUS_META) as RobotStatus[]).map((status) => ({
        status,
        label: ROBOT_STATUS_META[status].label
      }))

      const selectItem = (item: LayoutSelection) => {
        selected.value = item
      }

      const add = (type: 'robot' | 'workCell' | 'conveyor' | 'merge' | 'split') => {
        const result =
          type === 'robot'
            ? addRobot()
            : type === 'workCell'
              ? addWorkCell()
              : type === 'conveyor'
                ? addConveyor()
                : addJunction(type)
        selected.value = result
        saveMessage.value = '已新增，拖动到目标位置后点击保存。'
      }

      const isSelected = (item: LayoutSelection) =>
        selected.value?.type === item.type && selected.value.id === item.id

      const deleteSelected = () => {
        if (!selected.value) return
        removeItem(selected.value)
        selected.value = null
        saveMessage.value = '组件已从当前布局移除，保存后看板会同步。'
      }

      const save = async () => {
        try {
          await saveLayout()
          saveMessage.value = '布局已保存到数据库，看板将使用这份配置。'
        } catch {
          saveMessage.value = '布局保存失败，请检查后端服务和数据库连接。'
        }
      }

      const restoreDefault = async () => {
        if (!window.confirm('恢复初始布局会覆盖当前未保存的组态，是否继续？')) return
        try {
          await resetLayout()
          selected.value = null
          saveMessage.value = '已恢复初始布局并保存到数据库。'
        } catch {
          saveMessage.value = '初始布局已恢复到页面，但保存数据库失败。'
        }
      }

      const handleBindingSaved = (binding: DashboardRobotBinding) => {
        if (selectedRobot.value) selectedRobot.value.bindings.deviceId = binding.deviceMark
        saveMessage.value = '机械手数据源与状态统计规则已保存。'
      }

      const handleBindingDeleted = () => {
        if (selectedRobot.value) selectedRobot.value.bindings.deviceId = ''
        saveMessage.value = '机械手数据绑定已删除，历史统计仍会保留。'
      }

      onMounted(async () => {
        try {
          rememberProductionDashboardLine(editingLine.id)
          await loadLayout(editingLine.id, createProductionLineLayout(editingLine))
        } catch {
          saveMessage.value = '数据库布局加载失败，当前显示内置初始布局。'
        }
      })

      return {
        layout,
        layoutLoading,
        layoutSaving,
        selected,
        selectedRobot,
        selectedConveyor,
        selectedCell,
        selectedJunction,
        layoutItems,
        statusOptions,
        saveMessage,
        bindingDialogOpen,
        selectItem,
        moveItem,
        add,
        isSelected,
        deleteSelected,
        save,
        restoreDefault,
        handleBindingSaved,
        handleBindingDeleted
      }
    }
  })
</script>

<style lang="scss" scoped>
  .layout-editor {
    display: flex;
    flex-direction: column;
    width: 100vw;
    min-width: 1180px;
    height: 100vh;
    overflow: hidden;
    font-size: 13px;
    color: #ddecf8;
    background: #05101d;

    &__header {
      display: flex;
      flex: 0 0 66px;
      align-items: center;
      justify-content: space-between;
      height: 66px;
      padding: 0 20px;
      background: linear-gradient(90deg, rgb(8 32 54 / 95%), rgb(5 16 29 / 95%));
      border-bottom: 1px solid rgb(91 194 255 / 23%);

      p {
        margin: 0 0 3px;
        font-size: 11px;
        color: #55d5ff;
        letter-spacing: 1px;
      }

      h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #f0fbff;
      }
    }

    &__actions {
      display: flex;
      gap: 9px;
      align-items: center;
    }

    &__save-message {
      font-size: 12px;
      color: #6ee7b7;
    }

    &__button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 31px;
      padding: 0 12px;
      font-size: 12px;
      font-weight: 700;
      color: #03111e;
      text-decoration: none;
      cursor: pointer;
      background: #5bcefa;
      border: 1px solid #1d9ecc;
      border-radius: 4px;

      &--ghost {
        color: #b9e9ff;
        background: rgb(57 137 182 / 14%);
        border-color: rgb(116 205 250 / 40%);
      }
    }

    &__workspace {
      display: grid;
      flex: 1;
      grid-template-columns: 210px minmax(560px, 1fr) 275px;
      min-height: 0;
    }

    &__panel {
      min-height: 0;
      padding: 14px;
      background: rgb(4 17 31 / 96%);
      border-color: rgb(91 194 255 / 18%);
      border-style: solid;
    }

    &__palette {
      border-width: 0 1px 0 0;
    }

    &__inspector {
      overflow-y: auto;
      border-width: 0 0 0 1px;
    }

    &__scene-wrap {
      min-width: 0;
      min-height: 0;
      padding: 12px;
      background: #07121f;
    }

    &__scene-wrap :deep(.robot-line-scene) {
      height: 100%;
    }

    &__panel-title {
      margin-bottom: 10px;
      font-size: 14px;
      font-weight: 700;
      color: #effaff;

      &--items {
        padding-top: 13px;
        margin-top: 22px;
        border-top: 1px solid rgb(91 194 255 / 16%);
      }
    }

    &__palette > button {
      display: block;
      width: 100%;
      padding: 8px 9px;
      margin-bottom: 8px;
      color: #cdeeff;
      text-align: left;
      cursor: pointer;
      background: rgb(21 63 94 / 34%);
      border: 1px solid rgb(105 202 253 / 24%);
      border-radius: 4px;

      &:hover {
        background: rgb(33 103 149 / 52%);
        border-color: #4ecbfa;
      }
    }

    &__item-list {
      max-height: calc(100vh - 330px);
      overflow-y: auto;
    }

    &__item {
      display: grid;
      grid-template-columns: 9px minmax(0, 1fr);
      gap: 6px;
      width: 100%;
      padding: 7px 5px;
      color: #bbd2e3;
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 0;
      border-left: 2px solid transparent;

      span,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        grid-column: 2;
        font-size: 10px;
        color: #66869d;
      }

      &:hover,
      &--active {
        color: #fff;
        background: rgb(55 149 201 / 15%);
        border-left-color: #58d6ff;
      }
    }

    &__item-dot {
      width: 7px;
      height: 7px;
      margin-top: 4px;
      border-radius: 50%;
    }

    &__item-dot--robot {
      background: #f6a928;
    }

    &__item-dot--workCell {
      background: #ffca4d;
    }

    &__item-dot--conveyor {
      background: #6fa7c7;
    }

    &__item-dot--junction {
      background: #00d9ff;
    }

    label {
      display: block;
      margin: 0 0 10px;
      font-size: 11px;
      color: #93b5cb;
    }

    input,
    select {
      box-sizing: border-box;
      width: 100%;
      height: 30px;
      padding: 0 7px;
      margin-top: 4px;
      font-size: 12px;
      color: #e5f6ff;
      background: #0a2034;
      border: 1px solid rgb(105 202 253 / 30%);
      border-radius: 3px;
      outline: none;

      &:focus {
        border-color: #55d5ff;
      }

      &:disabled {
        color: #688399;
        background: #071725;
      }
    }

    &__field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    &__coordinate-title,
    &__binding-title {
      margin: 14px 0 8px;
      font-size: 12px;
      font-weight: 700;
      color: #72dcff;
    }

    &__binding-title {
      padding-top: 12px;
      border-top: 1px solid rgb(91 194 255 / 17%);
    }

    &__binding-tip {
      margin: -2px 0 12px;
      font-size: 11px;
      line-height: 1.5;
      color: #698ca4;
    }

    &__binding-summary {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 9px 10px;
      margin-bottom: 8px;
      font-size: 11px;
      color: #6f91a7;
      background: #081c2e;
      border: 1px solid rgb(91 194 255 / 16%);
      border-radius: 3px;

      b {
        overflow: hidden;
        color: #d8edf8;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &__binding-button {
      width: 100%;
      padding: 8px;
      color: #93e8ff;
      cursor: pointer;
      background: #12364a;
      border: 1px solid #34718d;
      border-radius: 3px;
    }

    &__empty {
      padding: 35px 8px;
      line-height: 1.7;
      color: #7794a8;
      text-align: center;
    }

    &__delete {
      width: 100%;
      padding: 8px;
      margin-top: 18px;
      color: #ff9aa7;
      cursor: pointer;
      background: rgb(166 34 51 / 14%);
      border: 1px solid rgb(255 100 119 / 60%);
      border-radius: 4px;
    }
  }

  @media (width <= 767px) {
    .layout-editor {
      width: 100%;
      min-width: 0;
      height: auto;
      min-height: 100vh;
      overflow: visible;

      &__header {
        flex: none;
        flex-direction: column;
        gap: 10px;
        align-items: stretch;
        height: auto;
        padding: 12px;
      }

      &__actions {
        flex-wrap: wrap;
      }

      &__save-message {
        width: 100%;
      }

      &__workspace {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
      }

      &__panel {
        padding: 12px;
      }

      &__palette,
      &__inspector {
        border-width: 0 0 1px;
      }

      &__item-list {
        max-height: 260px;
      }

      &__scene-wrap {
        height: 430px;
        padding: 8px;
      }

      &__inspector {
        overflow: visible;
      }
    }
  }
</style>
