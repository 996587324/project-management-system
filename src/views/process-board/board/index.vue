<template>
  <main class="process-board" v-loading="loading">
    <header class="board-header">
      <div
        ><p>PROCESS PARAMETER BOARD</p><h1>产线工艺看板</h1
        ><span>区域 / 工艺线体 / 参数卡片 · 数值每 5 秒刷新</span></div
      >
      <div class="header-actions">
        <el-select
          v-model="regionId"
          clearable
          filterable
          placeholder="选择区域"
          @change="chooseRegion"
        >
          <el-option
            v-for="region in regions"
            :key="region.id"
            :value="region.id"
            :label="region.name"
          />
        </el-select>
        <el-select
          v-model="lineId"
          clearable
          filterable
          placeholder="选择工艺线体"
          @change="chooseLine"
        >
          <el-option
            v-for="line in lines"
            :key="line.id"
            :value="line.id"
            :label="`${line.name} (${line.code})`"
          />
        </el-select>
        <el-button @click="back">返回上一级</el-button>
        <template v-if="canConfigure">
          <el-button @click="router.push({ name: 'ProcessBoardConfig' })">配置管理</el-button>
          <el-button v-if="lineId && !editing" @click="beginEdit">编辑布局 / 流程</el-button>
          <el-button v-if="editing" type="primary" :loading="saving" @click="saveLayout"
            >保存布局</el-button
          >
          <el-button v-if="editing" @click="cancelEdit">取消编辑</el-button>
        </template>
      </div>
    </header>
    <el-alert v-if="refreshError" :title="refreshError" type="warning" :closable="false" />
    <section v-if="!regionId && !lineId" class="overview-grid">
      <button
        v-for="region in regions"
        :key="region.id"
        class="overview-tile"
        @click="enterRegion(region.id)"
      >
        <span>区域</span><h2>{{ region.name }}</h2
        ><p>{{ region.code }}</p
        ><small
          >{{
            definitions.filter(
              (item) => item.kind === 'Line' && item.parentId === region.id && item.enabled
            ).length
          }}
          条工艺线体</small
        >
      </button>
      <el-empty v-if="!regions.length" description="尚未配置区域，或当前用户没有工艺线体授权" />
    </section>
    <section
      v-else-if="!lineId"
      :class="['overview-grid', region?.layout]"
      :style="{ '--columns': region?.columns || 3 }"
    >
      <button
        v-for="line in lines"
        :key="line.id"
        class="overview-tile"
        :style="{ minHeight: `${line.height}px`, maxWidth: `${line.width}px` }"
        @click="enterLine(line.id)"
      >
        <span>工艺线体</span><h2>{{ line.name }}</h2
        ><p>{{ line.code }}</p
        ><small>{{ line.devices.length }} 台关联设备 · {{ cardCount(line.id) }} 张参数卡片</small>
      </button>
      <el-empty v-if="!lines.length" description="该区域尚无可用线体" />
    </section>
    <template v-else-if="lineDefinition">
      <div v-if="editing" class="layout-toolbar">
        <span>排列方式</span
        ><el-select v-model="lineDefinition.layout"
          ><el-option label="网格" value="grid" /><el-option
            label="横向"
            value="horizontal" /><el-option label="纵向" value="vertical" /><el-option
            label="自由定位"
            value="free"
        /></el-select>
        <span>每行数量</span><el-input-number v-model="lineDefinition.columns" :min="1" :max="12" />
        <small>自由定位时拖动卡片标题；拖动右下角调整大小。普通排列可用标题旁按钮调整顺序。</small>
      </div>
      <ProcessFlow
        v-model="lineDefinition"
        :editable="editing"
        :can-edit="canConfigure"
        :cards="cardDefinitions"
        @card="focusCard"
        @edit="beginEdit"
      />
      <el-tabs v-model="activeTab">
        <el-tab-pane label="工艺参数" name="cards">
          <div class="card-scroll">
            <section
              :class="['parameter-grid', lineDefinition.layout, { editing }]"
              :style="gridStyle"
            >
              <article
                v-for="(card, index) in cards"
                :id="`process-card-${card.definition.id}`"
                :key="card.definition.id"
                :class="['parameter-card', { selected: highlighted === card.definition.id }]"
                :style="cardStyle(card.definition, index)"
                @pointerup="measureCard($event, card.definition.id)"
              >
                <header @pointerdown="startDrag($event, card.definition.id, index)"
                  ><div
                    ><h3>{{ card.definition.name }}</h3
                    ><small>{{ card.definition.code }}</small></div
                  >
                  <div v-if="editing"
                    ><el-button link @click.stop="shiftCard(index, -1)">前移</el-button
                    ><el-button link @click.stop="shiftCard(index, 1)">后移</el-button></div
                  >
                </header>
                <div
                  class="parameter-fields"
                  :style="{
                    '--field-columns': normalizeFieldColumns(card.definition.fieldColumns)
                  }"
                >
                  <button
                    v-for="field in card.definition.fields"
                    :key="field.code"
                    class="parameter-row"
                    @dblclick="openHistory(card.definition.id, field)"
                  >
                    <span
                      :class="['state-dot', stateOf(card.fields, field.code)]"
                      :title="
                        valueOf(card.fields, field.code)?.error ||
                        stateLabel(stateOf(card.fields, field.code))
                      "
                    />
                    <span class="parameter-key" :title="field.name">{{ field.name }}</span>
                    <span class="parameter-value">
                      <strong>{{
                        formatValue(valueOf(card.fields, field.code), field.precision)
                      }}</strong>
                      <em>{{ field.unit }}</em>
                    </span>
                  </button>
                </div>
                <footer>数据时间 {{ latestTime(card.fields) }} · 双击参数查看历史</footer>
              </article>
            </section>
          </div>
          <el-empty v-if="!cards.length" description="该线体尚未配置启用的参数卡片" />
        </el-tab-pane>
        <el-tab-pane
          v-if="lineDefinition.panelLayout === 'tabs'"
          label="线体趋势"
          name="trends"
          lazy
        >
          <ParameterTrends
            v-if="activeTab === 'trends'"
            :key="lineId"
            :line="lineDefinition"
            :cards="cardDefinitions"
          />
        </el-tab-pane>
        <el-tab-pane v-if="canConfigure" label="推送记录" name="push">
          <el-button @click="loadPushTasks">刷新记录</el-button>
          <el-table :data="pushTasks" border
            ><el-table-column prop="displayName" label="参数" /><el-table-column
              prop="userName"
              label="接收人" /><el-table-column prop="eventType" label="事件" /><el-table-column
              prop="status"
              label="发送状态" /><el-table-column
              prop="createTime"
              label="入队时间" /><el-table-column
              prop="errorMessage"
              label="异常"
              show-overflow-tooltip
          /></el-table>
        </el-tab-pane>
      </el-tabs>
      <ParameterTrends
        v-if="lineDefinition.panelLayout === 'split'"
        :key="`split-${lineId}`"
        :line="lineDefinition"
        :cards="cardDefinitions"
      />
    </template>
    <ParameterHistory
      v-model="history"
      :card-id="historyField.cardId"
      :field-code="historyField.fieldCode"
      :name="historyField.name"
    />
  </main>
</template>

<script setup lang="ts">
  import {
    computed,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
    type CSSProperties
  } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { applicationRequest } from '@/utils/system-applications/client'
  import {
    formatValue,
    normalizeFieldColumns,
    processApi,
    type FieldRuntime,
    type ProcessDefinition,
    type ProcessField,
    type ProcessRuntime
  } from '@/api/process-board'
  import ProcessFlow from '../components/ProcessFlow.vue'
  import ParameterTrends from '../components/ParameterTrends.vue'
  import ParameterHistory from '../components/ParameterHistory.vue'

  const router = useRouter()
  const route = useRoute()
  const definitions = ref<ProcessDefinition[]>([])
  const runtime = ref<ProcessRuntime>()
  const loading = ref(false)
  const saving = ref(false)
  const editing = ref(false)
  const canConfigure = ref(false)
  const regionId = ref<number>()
  const lineId = ref<number>()
  const lineDefinition = ref<ProcessDefinition>()
  const highlighted = ref(0)
  const activeTab = ref('cards')
  const refreshError = ref('')
  const pushTasks = ref<Record<string, unknown>[]>([])
  const history = ref(false)
  const historyField = reactive({ cardId: 0, fieldCode: '', name: '' })
  const regions = computed(() =>
    definitions.value.filter((item) => item.kind === 'Region' && item.enabled)
  )
  const region = computed(() => regions.value.find((item) => item.id === regionId.value))
  const lines = computed(() =>
    definitions.value.filter(
      (item) =>
        item.kind === 'Line' &&
        item.enabled &&
        (!regionId.value || item.parentId === regionId.value)
    )
  )
  const cardDefinitions = computed(() => {
    const rows = definitions.value.filter(
      (item) => item.kind === 'Card' && item.parentId === lineId.value && item.enabled
    )
    const order = lineDefinition.value?.blocks.map((block) => block.cardId) || []
    return rows.sort((left, right) => {
      const a = order.indexOf(left.id)
      const b = order.indexOf(right.id)
      return (a < 0 ? 100000 + left.sort : a) - (b < 0 ? 100000 + right.sort : b)
    })
  })
  const cards = computed(() =>
    cardDefinitions.value.map((definition) => ({
      definition,
      fields:
        runtime.value?.cards.find((item) => item.definition.id === definition.id)?.fields || []
    }))
  )
  const gridStyle = computed<CSSProperties>(() => ({
    '--columns': lineDefinition.value?.columns || 3,
    minHeight:
      lineDefinition.value?.layout === 'free'
        ? `${Math.max(600, ...lineDefinition.value.blocks.map((block) => block.y + block.height + 30))}px`
        : undefined,
    minWidth:
      lineDefinition.value?.layout === 'free'
        ? `${Math.max(900, ...lineDefinition.value.blocks.map((block) => block.x + block.width + 30))}px`
        : undefined
  }))
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let revision = 0

  function cardCount(id: number) {
    return definitions.value.filter(
      (item) => item.kind === 'Card' && item.parentId === id && item.enabled
    ).length
  }

  function valueOf(fields: FieldRuntime[], code: string) {
    return fields.find((field) => field.code === code)
  }

  function stateOf(fields: FieldRuntime[], code: string) {
    const field = valueOf(fields, code)
    return field?.error ? 'Unknown' : field?.state || 'Unknown'
  }

  function stateLabel(state: string) {
    return (
      {
        Normal: '在设定范围内',
        Upper: '超过上限',
        Lower: '低于下限',
        Unknown: '未配置范围或暂无有效值'
      } as Record<string, string>
    )[state]
  }

  function latestTime(fields: FieldRuntime[]) {
    return (
      fields
        .map((field) => field.dataTime)
        .filter(Boolean)
        .sort()
        .at(-1) || '—'
    )
  }

  async function navigate() {
    await router.replace({
      name: 'ProcessBoard',
      query: {
        ...(regionId.value ? { region: regionId.value } : {}),
        ...(lineId.value ? { line: lineId.value } : {})
      }
    })
  }

  function chooseRegion() {
    revision++
    editing.value = false
    lineId.value = undefined
    runtime.value = undefined
    lineDefinition.value = undefined
    navigate()
  }

  function enterRegion(id: number) {
    regionId.value = id
    chooseRegion()
  }

  function enterLine(id: number) {
    lineId.value = id
    chooseLine()
  }

  function chooseLine() {
    revision++
    editing.value = false
    const line = definitions.value.find((item) => item.id === lineId.value && item.kind === 'Line')
    if (line) regionId.value = line.parentId
    lineDefinition.value = line ? JSON.parse(JSON.stringify(line)) : undefined
    runtime.value = undefined
    navigate()
    refreshRuntime()
  }

  function back() {
    if (lineId.value) {
      lineId.value = undefined
      chooseLine()
    } else {
      regionId.value = undefined
      chooseRegion()
    }
  }

  async function refreshRuntime() {
    const id = lineId.value
    if (!id || stopped) return
    const current = ++revision
    try {
      const result = await processApi.runtime(id)
      if (current !== revision || lineId.value !== id || stopped) return
      runtime.value = result
      refreshError.value = ''
    } catch (error) {
      if (current === revision)
        refreshError.value =
          error instanceof Error ? error.message : '实时读取失败，保留最后一次成功数据'
    }
  }

  async function poll() {
    await refreshRuntime()
    if (!stopped) timer = setTimeout(poll, 5000)
  }

  function beginEdit() {
    if (!canConfigure.value || !lineDefinition.value) return
    editing.value = true
  }

  function cancelEdit() {
    const current = definitions.value.find((item) => item.id === lineId.value)
    lineDefinition.value = current ? JSON.parse(JSON.stringify(current)) : undefined
    editing.value = false
  }

  async function saveLayout() {
    if (!lineDefinition.value) return
    saving.value = true
    try {
      const result = await processApi.save(JSON.parse(JSON.stringify(lineDefinition.value)))
      definitions.value = definitions.value.map((item) => (item.id === result.id ? result : item))
      lineDefinition.value = result
      editing.value = false
      ElMessage.success('工艺流程和布局已保存')
    } finally {
      saving.value = false
    }
  }

  function blockFor(cardId: number, index = 0) {
    const line = lineDefinition.value!
    let block = line.blocks.find((item) => item.cardId === cardId)
    if (!block) {
      const card = cardDefinitions.value.find((item) => item.id === cardId)!
      block = {
        cardId,
        x: (index % line.columns) * (card.width + 18),
        y: Math.floor(index / line.columns) * (card.height + 18),
        width: card.width,
        height: card.height
      }
      line.blocks.push(block)
    }
    return block
  }

  function cardStyle(card: ProcessDefinition, index: number): CSSProperties {
    const block = lineDefinition.value?.blocks.find((item) => item.cardId === card.id)
    if (lineDefinition.value?.layout === 'free') {
      const columns = lineDefinition.value.columns
      return {
        position: 'absolute',
        left: `${block?.x ?? (index % columns) * (card.width + 18)}px`,
        top: `${block?.y ?? Math.floor(index / columns) * (card.height + 18)}px`,
        width: `${block?.width || card.width}px`,
        height: `${block?.height || card.height}px`
      }
    }
    return {
      minHeight: `${block?.height || card.height}px`,
      width:
        lineDefinition.value?.layout === 'horizontal'
          ? `${block?.width || card.width}px`
          : undefined
    }
  }

  function startDrag(event: PointerEvent, cardId: number, index: number) {
    if (
      !editing.value ||
      lineDefinition.value?.layout !== 'free' ||
      (event.target as HTMLElement).closest('button')
    )
      return
    const block = blockFor(cardId, index)
    const start = { x: event.clientX, y: event.clientY, left: block.x, top: block.y }
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
    const move = (next: PointerEvent) => {
      block.x = Math.round(Math.max(0, Math.min(8000, start.left + next.clientX - start.x)))
      block.y = Math.round(Math.max(0, Math.min(8000, start.top + next.clientY - start.y)))
    }
    const finish = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', finish)
      target.removeEventListener('pointercancel', finish)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', finish)
    target.addEventListener('pointercancel', finish)
  }

  function measureCard(event: PointerEvent, cardId: number) {
    if (!editing.value || lineDefinition.value?.layout !== 'free') return
    const element = event.currentTarget as HTMLElement
    const index = cardDefinitions.value.findIndex((card) => card.id === cardId)
    const block = blockFor(cardId, index)
    block.width = Math.round(Math.min(3840, Math.max(160, element.offsetWidth)))
    block.height = Math.round(Math.min(2160, Math.max(100, element.offsetHeight)))
  }

  async function shiftCard(index: number, offset: number) {
    const ordered = cardDefinitions.value
    const next = index + offset
    if (next < 0 || next >= ordered.length) return
    // 排列顺序作为线体 Blocks 顺序保存，不修改其他人的卡片字段配置。
    const ids = ordered.map((card, i) => blockFor(card.id, i))
    const [item] = ids.splice(index, 1)
    ids.splice(next, 0, item)
    lineDefinition.value!.blocks = ids
  }

  function focusCard(id: number) {
    activeTab.value = 'cards'
    highlighted.value = id
    setTimeout(
      () =>
        document
          .getElementById(`process-card-${id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      0
    )
  }

  function openHistory(cardId: number, field: ProcessField) {
    Object.assign(historyField, { cardId, fieldCode: field.code, name: field.name })
    history.value = true
  }

  async function loadPushTasks() {
    if (lineId.value) pushTasks.value = (await processApi.pushTasks(lineId.value)).records
  }

  watch(activeTab, (tab) => {
    if (tab === 'push') loadPushTasks()
  })
  watch(
    () => [route.query.region, route.query.line],
    () => {
      const nextRegion = Number(route.query.region) || undefined
      const nextLine = Number(route.query.line) || undefined
      if (nextRegion === regionId.value && nextLine === lineId.value) return
      revision++
      editing.value = false
      regionId.value = nextRegion
      lineId.value = nextLine
      const line = definitions.value.find((item) => item.kind === 'Line' && item.id === nextLine)
      lineDefinition.value = line ? JSON.parse(JSON.stringify(line)) : undefined
      runtime.value = undefined
      refreshRuntime()
    }
  )
  onMounted(async () => {
    loading.value = true
    try {
      const [rows, access] = await Promise.all([
        processApi.definitions(),
        applicationRequest<{ permissions: string[] }>('/api/system-applications/context')
      ])
      definitions.value = rows
      canConfigure.value =
        access.permissions.includes('*') || access.permissions.includes('ProcessBoardConfig')
      regionId.value = Number(route.query.region) || undefined
      lineId.value = Number(route.query.line) || undefined
      const line = rows.find((item) => item.kind === 'Line' && item.id === lineId.value)
      if (line) {
        regionId.value = line.parentId
        lineDefinition.value = JSON.parse(JSON.stringify(line))
      }
      if (route.query.edit === '1' && canConfigure.value) editing.value = true
      await poll()
    } finally {
      loading.value = false
    }
  })
  onBeforeUnmount(() => {
    stopped = true
    revision++
    clearTimeout(timer)
  })
</script>

<style scoped lang="scss">
  .process-board {
    padding: 24px;
    background: var(--el-bg-color-page);
    color: var(--el-text-color-primary);
    min-height: 80vh;
    border-radius: var(--business-radius);
  }
  .board-header {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    p {
      margin: 0;
      font-size: 11px;
      letter-spacing: 2px;
      color: var(--el-color-primary);
    }
    h1 {
      margin: 7px 0;
      font-size: 26px;
    }
    span {
      color: var(--el-text-color-secondary);
      font-size: 13px;
    }
  }
  .header-actions,
  .layout-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    .el-select {
      width: 220px;
    }
  }
  .layout-toolbar {
    margin-bottom: 16px;
    small {
      color: var(--el-text-color-secondary);
    }
  }
  .overview-grid {
    display: grid;
    grid-template-columns: repeat(var(--columns, 3), minmax(0, 1fr));
    gap: 20px;
  }
  .overview-grid.horizontal {
    display: flex;
    overflow: auto;
    .overview-tile {
      min-width: 300px;
    }
  }
  .overview-grid.vertical {
    grid-template-columns: 1fr;
  }
  .overview-tile {
    box-shadow: var(--business-card-shadow);
    text-align: left;
    border: 1px solid var(--el-border-color-lighter);
    background: var(--el-bg-color);
    border-radius: var(--business-radius);
    padding: 28px;
    cursor: pointer;
    color: var(--el-text-color-primary);
    transition: box-shadow 0.2s;
    &:hover {
      box-shadow: var(--business-card-shadow);
    }
    span,
    small {
      color: var(--el-text-color-secondary);
    }
  }
  .card-scroll {
    overflow: auto;
  }
  .parameter-grid {
    display: grid;
    grid-template-columns: repeat(var(--columns, 3), minmax(0, 1fr));
    gap: 18px;
    position: relative;
  }
  .parameter-grid.horizontal {
    display: flex;
    .parameter-card {
      flex-shrink: 0;
    }
  }
  .parameter-grid.vertical {
    grid-template-columns: 1fr;
  }
  .parameter-grid.free {
    display: block;
  }
  .parameter-card {
    box-shadow: var(--business-card-shadow);
    padding: 20px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--business-radius);
    overflow: auto;
    box-sizing: border-box;
    min-width: 0;
    header {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      border-bottom: 1px solid var(--el-border-color-lighter);
      padding-bottom: 14px;
      h3 {
        margin: 0 0 6px;
        font-size: 19px;
      }
      small {
        color: var(--el-text-color-secondary);
      }
    }
    footer {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-top: 14px;
    }
    &.selected {
      border: 2px solid var(--el-color-primary);
    }
  }
  .editing.free .parameter-card {
    resize: both;
    min-width: 160px;
    min-height: 100px;
    header {
      cursor: move;
      touch-action: none;
    }
  }
  .parameter-fields {
    display: grid;
    // 220px 为参数组的舒适宽度；每行不超过配置数量，窄卡片自动减列。
    grid-template-columns: repeat(
      auto-fit,
      minmax(
        min(
          100%,
          max(220px, calc((100% - (var(--field-columns, 1) - 1) * 16px) / var(--field-columns, 1)))
        ),
        1fr
      )
    );
    column-gap: 16px;
    min-width: 0;
  }
  .parameter-row {
    display: grid;
    grid-template-columns: 14px minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 10px;
    align-items: center;
    padding: 15px 0;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    border: 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: none;
    text-align: left;
    color: inherit;
    cursor: pointer;
    .parameter-key {
      font-size: 16px;
      overflow-wrap: anywhere;
    }
    .parameter-value {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 6px;
      align-items: baseline;
      justify-content: flex-end;
      min-width: 0;
      text-align: right;
      overflow-wrap: anywhere;
    }
    strong {
      min-width: 0;
      max-width: 100%;
      font-size: 23px;
      font-variant-numeric: tabular-nums;
    }
    em {
      min-width: 0;
      max-width: 100%;
      color: var(--el-text-color-secondary);
      font-style: normal;
      font-size: 13px;
    }
  }
  .state-dot {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--el-text-color-placeholder);
    &.Normal {
      background: var(--el-color-success);
      box-shadow: 0 0 0 4px var(--el-color-success-light-9);
    }
    &.Upper,
    &.Lower {
      background: var(--el-color-danger);
      box-shadow: 0 0 0 4px var(--el-color-danger-light-9);
    }
  }
  @media (max-width: 1100px) {
    .parameter-grid:not(.free):not(.horizontal),
    .overview-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 650px) {
    .process-board {
      padding: 14px;
    }
    .parameter-grid:not(.free):not(.horizontal),
    .overview-grid {
      grid-template-columns: 1fr;
    }
    .header-actions .el-select {
      width: 100%;
    }
  }
</style>
