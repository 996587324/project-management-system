<template>
  <section
    class="process-flow"
    :style="{ width: definition.flowWidth ? `${definition.flowWidth}px` : undefined }"
  >
    <div class="flow-toolbar">
      <strong>工艺流程</strong>
      <el-button @click="scale = Math.min(3, scale + 0.2)">放大</el-button>
      <el-button @click="scale = Math.max(0.25, scale - 0.2)">缩小</el-button>
      <el-button @click="resetView">复位</el-button>
      <el-button v-if="!editable && canEdit" type="primary" @click="emit('edit')">
        编辑流程
      </el-button>
      <template v-if="editable">
        <el-button @click="addNode">新增工序</el-button>
        <el-select v-model="from" placeholder="起始工序"
          ><el-option
            v-for="node in definition.flow"
            :key="node.id"
            :value="node.id"
            :label="node.name"
        /></el-select>
        <el-select v-model="to" placeholder="目标工序"
          ><el-option
            v-for="node in definition.flow"
            :key="node.id"
            :value="node.id"
            :label="node.name"
        /></el-select>
        <el-button @click="addEdge">连线</el-button>
      </template>
    </div>
    <div v-if="editable" class="flow-selection-toolbar">
      <span>{{ selectionLabel }}</span>
      <el-button :disabled="!selectedNode && !selectedEdge" @click="editSelected">
        {{ selectedEdge ? '编辑连线' : '编辑工序' }}
      </el-button>
      <el-button
        type="danger"
        plain
        :disabled="!selectedNode && !selectedEdge"
        @click="deleteSelected"
      >
        {{ selectedEdge ? '删除连线' : '删除工序' }}
      </el-button>
      <small>单击选中，双击编辑；修改后请点击页面顶部“保存布局”。</small>
    </div>
    <el-alert v-if="flowError" :title="flowError" type="warning" :closable="false" />
    <div class="flow-viewport" :style="{ height: `${definition.flowHeight}px` }">
      <svg
        ref="canvas"
        @wheel.prevent="zoom"
        @pointerdown="startPan"
        @pointermove="move"
        @pointerup="finish"
        @pointercancel="finish"
        @lostpointercapture="finish"
      >
        <defs>
          <marker
            id="process-arrow"
            markerWidth="9"
            markerHeight="9"
            refX="8"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8" fill="var(--el-border-color)" />
          </marker>
        </defs>
        <g :transform="`translate(${pan.x},${pan.y}) scale(${scale})`">
          <g
            v-for="(edge, index) in definition.edges"
            :key="index"
            :class="['flow-edge', { 'is-selected': editable && selectedEdge === edge }]"
            role="button"
            :tabindex="editable ? 0 : -1"
            :aria-label="`连线：${nodeName(edge.from)} → ${nodeName(edge.to)}`"
            @pointerdown.stop="selectEdge(edge)"
            @click.stop="selectEdge(edge)"
            @dblclick.stop="openEdge(edge)"
            @keydown.enter.prevent="openEdge(edge)"
          >
            <line
              :x1="position(edge.from).x + 170"
              :y1="position(edge.from).y + 36"
              :x2="position(edge.to).x"
              :y2="position(edge.to).y + 36"
              stroke="transparent"
              stroke-width="16"
              class="flow-edge-hit"
            />
            <line
              :x1="position(edge.from).x + 170"
              :y1="position(edge.from).y + 36"
              :x2="position(edge.to).x"
              :y2="position(edge.to).y + 36"
              :stroke="
                editable && selectedEdge === edge
                  ? 'var(--el-color-primary)'
                  : 'var(--el-border-color)'
              "
              :stroke-width="editable && selectedEdge === edge ? 4 : 2"
              marker-end="url(#process-arrow)"
              pointer-events="none"
            />
          </g>
          <g
            v-for="node in definition.flow"
            :key="node.id"
            :transform="`translate(${node.x},${node.y})`"
            :class="['flow-node', { 'is-selected': editable && selectedNodeId === node.id }]"
            role="button"
            tabindex="0"
            :aria-label="`工序：${node.name}`"
            @pointerdown.stop="startNode($event, node)"
            @click.stop="selectNode(node)"
            @dblclick.stop="openNode(node)"
            @keydown.enter.prevent="openNode(node)"
          >
            <rect
              width="170"
              height="72"
              rx="12"
              fill="var(--el-fill-color-light)"
              :stroke="
                editable && selectedNodeId === node.id
                  ? 'var(--el-color-primary)'
                  : 'var(--el-border-color)'
              "
              :stroke-width="editable && selectedNodeId === node.id ? 3 : 1"
            />
            <text x="85" y="30" text-anchor="middle" fill="var(--el-text-color-primary)">
              {{ node.name }}
            </text>
            <text
              x="85"
              y="54"
              text-anchor="middle"
              fill="var(--el-text-color-secondary)"
              font-size="12"
            >
              {{ cardName(node.cardId) }}
            </text>
          </g>
        </g>
      </svg>
      <el-empty v-if="!definition.flow.length" description="尚未配置工艺流程" />
    </div>
    <el-dialog v-model="nodeDialog" title="编辑工序" width="min(460px, 95vw)">
      <el-form label-width="90px"
        ><el-form-item label="名称"
          ><el-input v-model="nodeForm.name" maxlength="128"
        /></el-form-item>
        <el-form-item label="关联卡片"
          ><el-select v-model="nodeForm.cardId" clearable
            ><el-option
              v-for="card in cards"
              :key="card.id"
              :value="card.id"
              :label="card.name" /></el-select
        ></el-form-item>
      </el-form>
      <el-alert v-if="nodeError" :title="nodeError" type="warning" :closable="false" />
      <template #footer
        ><el-button type="danger" @click="removeNode(nodeForm.id)">删除工序</el-button
        ><el-button @click="nodeDialog = false">取消</el-button
        ><el-button type="primary" @click="saveNode">应用</el-button></template
      >
    </el-dialog>
    <el-dialog v-model="edgeDialog" title="编辑连线" width="min(460px, 95vw)">
      <el-form label-width="90px">
        <el-form-item label="起始工序"
          ><el-select v-model="edgeForm.from">
            <el-option
              v-for="node in definition.flow"
              :key="node.id"
              :value="node.id"
              :label="node.name"
            /> </el-select
        ></el-form-item>
        <el-form-item label="目标工序"
          ><el-select v-model="edgeForm.to">
            <el-option
              v-for="node in definition.flow"
              :key="node.id"
              :value="node.id"
              :label="node.name"
            /> </el-select
        ></el-form-item>
      </el-form>
      <el-alert v-if="edgeError" :title="edgeError" type="warning" :closable="false" />
      <template #footer>
        <el-button type="danger" @click="removeEdge(selectedEdge)">删除连线</el-button>
        <el-button @click="edgeDialog = false">取消</el-button>
        <el-button type="primary" @click="saveEdge">应用</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessageBox } from 'element-plus'
  import type { FlowNode, ProcessDefinition } from '@/api/process-board'

  const definition = defineModel<ProcessDefinition>({ required: true })
  const props = defineProps<{ editable?: boolean; canEdit?: boolean; cards: ProcessDefinition[] }>()
  const emit = defineEmits<{ card: [id: number]; edit: [] }>()
  type FlowEdge = ProcessDefinition['edges'][number]
  const canvas = ref<SVGSVGElement>()
  const scale = ref(1)
  const pan = reactive({ x: 20, y: 20 })
  const from = ref('')
  const to = ref('')
  const nodeDialog = ref(false)
  const nodeForm = reactive<FlowNode>({ id: '', name: '', x: 0, y: 0 })
  const selectedNodeId = ref('')
  const selectedEdge = ref<FlowEdge>()
  const selectedNode = computed(() =>
    definition.value.flow.find((node) => node.id === selectedNodeId.value)
  )
  const selectionLabel = computed(() =>
    selectedNode.value
      ? `已选工序：${selectedNode.value.name}`
      : selectedEdge.value
        ? `已选连线：${nodeName(selectedEdge.value.from)} → ${nodeName(selectedEdge.value.to)}`
        : '请选择工序或连线'
  )
  const edgeDialog = ref(false)
  const edgeForm = reactive<FlowEdge>({ from: '', to: '' })
  const flowError = ref('')
  const nodeError = ref('')
  const edgeError = ref('')
  let gesture:
    | {
        id: number
        x: number
        y: number
        baseX: number
        baseY: number
        node?: FlowNode
        captured?: boolean
      }
    | undefined

  watch([() => props.editable, () => definition.value], () => {
    finish()
    selectedNodeId.value = ''
    selectedEdge.value = undefined
    nodeDialog.value = false
    edgeDialog.value = false
    flowError.value = ''
  })

  function nodeName(id: string) {
    return definition.value.flow.find((node) => node.id === id)?.name || '未知工序'
  }

  function selectNode(node: FlowNode) {
    if (!props.editable) return
    selectedNodeId.value = node.id
    selectedEdge.value = undefined
  }

  function selectEdge(edge: FlowEdge) {
    if (!props.editable) return
    selectedEdge.value = edge
    selectedNodeId.value = ''
  }

  function editSelected() {
    if (selectedNode.value) openNode(selectedNode.value)
    else if (selectedEdge.value) openEdge(selectedEdge.value)
  }

  async function deleteSelected() {
    if (selectedNode.value) await removeNode(selectedNode.value.id)
    else if (selectedEdge.value) await removeEdge(selectedEdge.value)
  }

  function position(id: string) {
    return definition.value.flow.find((node) => node.id === id) || { x: 0, y: 0 }
  }

  function cardName(id?: number | null) {
    return (
      props.cards.find((card) => card.id === id)?.name ||
      (props.editable ? '双击编辑工序' : '未关联参数卡片')
    )
  }

  function resetView() {
    scale.value = 1
    pan.x = 20
    pan.y = 20
  }

  function zoom(event: WheelEvent) {
    const box = canvas.value?.getBoundingClientRect()
    if (!box) return
    const next = Math.max(0.25, Math.min(3, scale.value * (event.deltaY > 0 ? 0.9 : 1.1)))
    const ratio = next / scale.value
    const x = event.clientX - box.left
    const y = event.clientY - box.top
    pan.x = x - (x - pan.x) * ratio
    pan.y = y - (y - pan.y) * ratio
    scale.value = next
  }

  function startPan(event: PointerEvent) {
    if (event.button !== 0) return
    gesture = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      baseX: pan.x,
      baseY: pan.y
    }
    // 单击/双击不捕获到 SVG 根元素，实际拖动后才捕获。
  }

  function startNode(event: PointerEvent, node: FlowNode) {
    if (!props.editable || event.button !== 0) return
    selectNode(node)
    gesture = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      baseX: node.x,
      baseY: node.y,
      node
    }
  }

  function move(event: PointerEvent) {
    if (!gesture || gesture.id !== event.pointerId) return
    if (!gesture.captured) {
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 4) return
      canvas.value?.setPointerCapture(event.pointerId)
      gesture.captured = true
    }
    const divisor = gesture.node ? scale.value : 1
    const x = gesture.baseX + (event.clientX - gesture.x) / divisor
    const y = gesture.baseY + (event.clientY - gesture.y) / divisor
    if (gesture.node) {
      gesture.node.x = Math.max(0, x)
      gesture.node.y = Math.max(0, y)
    } else {
      pan.x = x
      pan.y = y
    }
  }

  function finish() {
    const current = gesture
    gesture = undefined
    if (current?.captured && canvas.value?.hasPointerCapture(current.id)) {
      canvas.value.releasePointerCapture(current.id)
    }
  }

  function uuid() {
    // 优先用原生，没有就用 getRandomValues 兜底
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    // 降级方案：基于 crypto.getRandomValues 生成 v4 UUID
    const buf = new Uint8Array(16)
    crypto.getRandomValues(buf)
    buf[6] = (buf[6] & 0x0f) | 0x40
    buf[8] = (buf[8] & 0x3f) | 0x80
    const hex = [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  function addNode() {
    if (!props.editable) return
    const node = {
      id: uuid(),
      name: `工序 ${definition.value.flow.length + 1}`,
      x: definition.value.flow.length * 220,
      y: 60
    }
    definition.value.flow.push(node)
    selectNode(node)
  }

  function addEdge() {
    if (!props.editable) return
    flowError.value = validateEdge({ from: from.value, to: to.value })
    if (flowError.value) return
    const edge = { from: from.value, to: to.value }
    definition.value.edges.push(edge)
    selectEdge(definition.value.edges[definition.value.edges.length - 1])
  }

  function validateEdge(edge: FlowEdge, original?: FlowEdge) {
    if (
      !definition.value.flow.some((node) => node.id === edge.from) ||
      !definition.value.flow.some((node) => node.id === edge.to)
    )
      return '请选择起始工序和目标工序'
    if (edge.from === edge.to) return '起始工序和目标工序不能相同'
    if (
      definition.value.edges.some(
        (item) => item !== original && item.from === edge.from && item.to === edge.to
      )
    ) {
      return '这两个工序之间已存在相同方向的连线'
    }
    return ''
  }

  function openEdge(edge: FlowEdge) {
    if (!props.editable) return
    selectEdge(edge)
    Object.assign(edgeForm, edge)
    edgeError.value = ''
    edgeDialog.value = true
  }

  function saveEdge() {
    if (
      !props.editable ||
      !selectedEdge.value ||
      !definition.value.edges.includes(selectedEdge.value)
    )
      return
    edgeError.value = validateEdge(edgeForm, selectedEdge.value)
    if (edgeError.value) return
    Object.assign(selectedEdge.value, edgeForm)
    edgeDialog.value = false
  }

  async function removeEdge(edge?: FlowEdge) {
    if (!props.editable || !edge) return
    const originalDefinition = definition.value
    try {
      await ElMessageBox.confirm(
        `确定删除“${nodeName(edge.from)} → ${nodeName(edge.to)}”这条连线吗？`,
        '删除连线',
        { type: 'warning' }
      )
    } catch {
      return
    }
    if (
      !props.editable ||
      definition.value !== originalDefinition ||
      !definition.value.edges.includes(edge)
    )
      return
    definition.value.edges = definition.value.edges.filter((item) => item !== edge)
    selectedEdge.value = undefined
    edgeDialog.value = false
  }

  function openNode(node: FlowNode) {
    if (!props.editable) {
      if (node.cardId) emit('card', node.cardId)
      return
    }
    selectNode(node)
    Object.assign(nodeForm, { cardId: null }, node)
    nodeError.value = ''
    nodeDialog.value = true
  }

  function saveNode() {
    if (!props.editable) return
    const node = definition.value.flow.find((item) => item.id === nodeForm.id)
    if (!node) return
    if (!nodeForm.name.trim()) {
      nodeError.value = '请填写工序名称'
      return
    }
    Object.assign(node, nodeForm, { name: nodeForm.name.trim(), cardId: nodeForm.cardId || null })
    nodeDialog.value = false
  }

  async function removeNode(id: string) {
    if (!props.editable) return
    const originalDefinition = definition.value
    const node = definition.value.flow.find((item) => item.id === id)
    if (!node) return
    try {
      await ElMessageBox.confirm(
        `确定删除工序“${node.name}”吗？与它相连的连线也会一并删除，关联参数卡片不会删除。`,
        '删除工序',
        { type: 'warning' }
      )
    } catch {
      return
    }
    if (!props.editable || definition.value !== originalDefinition) return
    definition.value.flow = definition.value.flow.filter((item) => item.id !== id)
    definition.value.edges = definition.value.edges.filter(
      (edge) => edge.from !== id && edge.to !== id
    )
    if (from.value === id) from.value = ''
    if (to.value === id) to.value = ''
    selectedNodeId.value = ''
    selectedEdge.value = undefined
    nodeDialog.value = false
  }
</script>

<style scoped lang="scss">
  .process-flow {
    color: var(--el-text-color-primary);
    box-shadow: var(--business-card-shadow);
    padding: 16px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--business-radius);
  }
  .flow-toolbar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 12px;
    .el-select {
      width: 150px;
    }
  }
  .flow-viewport {
    height: 270px;
    position: relative;
    overflow: hidden;
    background: var(--el-fill-color-extra-light);
    border-radius: 10px;
    svg {
      width: 100%;
      height: 100%;
      touch-action: none;
    }
    .el-empty {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
  }
  .flow-node {
    cursor: pointer;
    user-select: none;
  }
  .flow-selection-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin-bottom: 12px;
    span {
      color: var(--el-text-color-primary);
    }
    small {
      color: var(--el-text-color-secondary);
    }
  }
  .flow-edge {
    cursor: pointer;
  }
  .flow-edge-hit {
    pointer-events: stroke;
  }
  .flow-node:focus-visible,
  .flow-edge:focus-visible {
    outline: 2px solid var(--el-color-primary);
  }
  .el-alert {
    margin-bottom: 12px;
  }
</style>
