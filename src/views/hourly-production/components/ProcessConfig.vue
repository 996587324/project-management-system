<template>
  <section>
    <el-button :disabled="board.lines.length >= 20" @click="addLine">新增线体</el-button>
    <el-button type="danger" plain :disabled="board.lines.length <= 1 || !line" @click="removeLine"
      >移除当前线体</el-button
    >
    <el-collapse v-if="board.removedLines?.length"
      ><el-collapse-item title="已移除线体记录"
        ><el-table :data="board.removedLines" size="small"
          ><el-table-column prop="definition.code" label="编码" /><el-table-column
            prop="definition.name"
            label="线体名称" /><el-table-column prop="removedAt" label="移除时间" /><el-table-column
            prop="removedBy"
            label="操作账号" /></el-table></el-collapse-item
    ></el-collapse>
    <el-tabs v-model="lineIndex"
      ><el-tab-pane
        v-for="(line, i) in board.lines"
        :key="i"
        :label="line.name || `线体${i + 1}`"
        :name="String(i)"
    /></el-tabs>
    <el-form v-if="line" label-width="110px" inline>
      <el-form-item label="线体编码"
        ><el-input
          v-model.trim="line.code"
          :disabled="persistedLines.has(line.code)"
          maxlength="30"
      /></el-form-item>
      <el-form-item label="线体名称"
        ><el-input v-model.trim="line.name" maxlength="100"
      /></el-form-item>
      <el-form-item label="总产出口径"
        ><el-select
          v-model="line.summaryProcessCode"
          placeholder="请选择总产出工序"
          style="width: 190px"
          ><el-option
            v-for="p in line.processes.filter((p) => p.enabled)"
            :key="p.code"
            :value="p.code"
            :label="p.name" /></el-select
      ></el-form-item>
    </el-form>
    <el-alert
      type="info"
      :closable="false"
      title="各线体相同对齐行编码的工序横向对齐。删除后可恢复原工序，也可用同编码新建并单独统计；新建不会合并旧历史。线体总产出只取选定工序，不能累加工序产量。"
    />
    <el-table :data="line?.processes ?? []" highlight-current-row @current-change="chooseProcess">
      <el-table-column label="编码" width="125"
        ><template #default="{ row }"
          ><el-input
            v-model.trim="row.code"
            :disabled="
              row.creationMode === 'Restore' ||
              (!!row.instanceId &&
                row.creationMode !== 'New' &&
                persistedCodes.has(`${line?.code}/${row.code}`))
            "
            maxlength="30" /></template
      ></el-table-column>
      <el-table-column label="名称" min-width="140"
        ><template #default="{ row }"><el-input v-model.trim="row.name" maxlength="100" /></template
      ></el-table-column>
      <el-table-column label="对齐行编码" width="145"
        ><template #default="{ row }"
          ><el-input v-model.trim="row.rowCode" maxlength="30" /></template
      ></el-table-column>
      <el-table-column label="启用" width="75"
        ><template #default="{ row }"><el-switch v-model="row.enabled" /></template
      ></el-table-column>
      <el-table-column label="数据绑定" width="90"
        ><template #default="{ row }">{{ row.bindings.length }} 个</template></el-table-column
      >
      <el-table-column label="操作" width="250"
        ><template #default="{ row, $index }"
          ><el-button text type="primary" @click="selectedCode = row.code">配置</el-button
          ><el-button text :disabled="$index === 0" @click="move($index, -1)">上移</el-button
          ><el-button
            text
            :disabled="$index === line!.processes.length - 1"
            @click="move($index, 1)"
            >下移</el-button
          ><el-button
            text
            type="danger"
            :disabled="line!.processes.length <= 1"
            @click.stop="remove($index)"
            >移除</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-button class="add" @click="addProcess">新增工序</el-button>
    <el-button @click="openRemoved">已移除工序 / 恢复</el-button>
    <el-alert
      v-if="process?.creationMode === 'New'"
      type="info"
      :closable="false"
      title="此工序按新实例保存，即使编码与历史相同也单独统计。要延续原历史，请从“已移除工序 / 恢复”选择原工序。"
    />
    <el-alert
      v-if="process?.creationMode === 'Restore'"
      type="info"
      :closable="false"
      title="恢复将延续原历史，并保留原设备、字段及统计方式；不自动补算移除期间的数据。"
    />
    <el-card
      v-if="process"
      :key="`${line!.code}/${process.code}/${process.instanceId || process.creationMode || 'new'}`"
      shadow="never"
    >
      <template #header
        ><strong>{{ process.name }} · 统计规则与绑定</strong></template
      >
      <el-form label-width="160px" :disabled="process.creationMode === 'Restore'">
        <el-form-item label="产出计算方式"
          ><el-select v-model="process.mode" style="width: 250px"
            ><el-option value="DistinctSn" label="SN 去重计数" /><el-option
              value="Count"
              label="条件事件计数" /><el-option
              value="Sum"
              label="数值字段求和（非累计表读数）" /></el-select
        ></el-form-item>
        <template v-if="process.mode === 'DistinctSn'">
          <el-form-item label="重复抑制（分钟）"
            ><el-input-number v-model="process.reworkMinutes" :min="0" :max="1440" /><span
              class="hint"
              >与上次有效过站比较，小于等于该间隔不重复计数</span
            ></el-form-item
          >
          <el-form-item label="返工需跨小时时段"
            ><el-switch v-model="process.reworkRequiresDifferentHour" /><span class="hint"
              >关闭后，超过间隔的同小时过站也算返工；明确返工标识不受跨小时限制</span
            ></el-form-item
          >
        </template>
        <el-form-item label="返工同时计入产出"
          ><el-switch v-model="process.includeReworkInOutput"
        /></el-form-item>
      </el-form>
      <BindingEditor
        v-for="(binding, i) in process.bindings"
        :key="binding.code"
        v-model="process.bindings[i]"
        :index="i"
        :disabled="process.creationMode === 'Restore'"
        @remove="process!.bindings.splice(i, 1)"
      />
      <el-button :disabled="process.creationMode === 'Restore'" @click="addBinding"
        >新增数据绑定</el-button
      >
    </el-card>
    <el-dialog
      v-model="removedVisible"
      title="已移除工序"
      width="min(940px,96vw)"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-alert
        title="恢复原工序：沿用原统计历史；同编码新建：独立统计，旧历史保留。旧配置缺失时只能新建。选择后仍需保存看板才会生效。"
        type="info"
        :closable="false"
      />
      <el-input v-model="removedKeyword" placeholder="搜索工序编码或名称" clearable class="add" />
      <el-alert v-if="removedError" :title="removedError" type="error" :closable="false" />
      <el-table :data="removedMatches" height="350" v-loading="removedLoading" row-key="instanceId">
        <el-table-column prop="code" label="编码" width="95" />
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column label="移除时间" min-width="160"
          ><template #default="{ row }">{{
            row.pending
              ? '本次尚未保存'
              : row.removedAt
                ? new Date(row.removedAt).toLocaleString('zh-CN')
                : '旧数据未记录时间'
          }}</template></el-table-column
        >
        <el-table-column label="说明" min-width="180"
          ><template #default="{ row }">{{
            codeInUse(row.code) ? '当前配置已有同编码工序' : row.reason || '原配置已保留，可以恢复'
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="220"
          ><template #default="{ row }">
            <el-button
              text
              type="primary"
              :disabled="!row.canRestore || codeInUse(row.code)"
              @click="restoreRemoved(row.instanceId)"
              >恢复原工序</el-button
            >
            <el-button
              text
              :disabled="codeInUse(row.code)"
              @click="createFromRemoved(row.instanceId)"
              >同编码新建</el-button
            >
          </template></el-table-column
        >
      </el-table>
      <template #footer
        ><el-button v-if="removedError" @click="openRemoved">重试</el-button
        ><el-button @click="removedVisible = false">关闭</el-button></template
      >
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    createProcess,
    hourlyApi,
    type HourlyBoard,
    type HourlyProcess,
    type HourlyRemovedProcess
  } from '@/api/hourly-production'
  import BindingEditor from './BindingEditor.vue'
  import { removeHourlyLine, removeHourlyProcess } from './process-config-rules'
  const board = defineModel<HourlyBoard>({ required: true })
  const persistedLines = ref(new Set<string>())
  const lineIndex = ref('0')
  async function removeLine() {
    const target = line.value
    if (!target || board.value.lines.length <= 1) return
    const currentBoard = board.value
    await ElMessageBox.confirm(
      `移除“${target.name}”？保存后停止该线体的后续采集与展示，已保存历史会保留。引用此线的对比组会移除；若推送仅选择此线，将关闭小时推送。`,
      '移除线体'
    )
    if (board.value !== currentBoard) return
    if (removeHourlyLine(board.value, target)) {
      lineIndex.value = '0'
      ElMessage.info('线体已从当前配置移除，请保存全部配置后生效')
    }
  }
  function addLine() {
    let index = 1
    while (
      board.value.lines.some((x) => x.code.toLowerCase() === `l${index}`) ||
      [...persistedLines.value].some((code) => code.toLowerCase() === `l${index}`) ||
      board.value.removedLines?.some((x) => x.definition.code.toLowerCase() === `l${index}`)
    )
      index++
    const p = createProcess(1)
    board.value.lines.push({
      code: `L${index}`,
      name: `线体${index}`,
      summaryProcessCode: p.code,
      targets: [],
      processes: [p]
    })
    lineIndex.value = String(board.value.lines.length - 1)
  }
  const selectedCode = ref('')
  const persistedCodes = ref(new Set<string>())
  type RemovedChoice = HourlyRemovedProcess & { pending?: boolean }
  const pendingRemoved = ref<RemovedChoice[]>([])
  const removedRows = ref<RemovedChoice[]>([])
  const removedVisible = ref(false)
  const removedLoading = ref(false)
  const removedKeyword = ref('')
  const removedError = ref('')
  const removedMatches = computed(() =>
    removedRows.value.filter((x) =>
      `${x.code} ${x.name}`.toLowerCase().includes(removedKeyword.value.trim().toLowerCase())
    )
  )
  const codeInUse = (code: string) =>
    !!line.value?.processes.some((x) => x.code.toLowerCase() === code.toLowerCase())
  watch(
    () => board.value,
    (value) => {
      persistedLines.value = new Set(value.version > 0 ? value.lines.map((x) => x.code) : [])
      lineIndex.value = '0'
      pendingRemoved.value = []
      removedVisible.value = false
      persistedCodes.value = new Set(
        value.version > 0
          ? value.lines.flatMap((line) =>
              line.processes.map((process) => `${line.code}/${process.code}`)
            )
          : []
      )
    },
    { immediate: true }
  )
  const line = computed(() => board.value.lines[Number(lineIndex.value)])
  const process = computed(() => line.value?.processes.find((p) => p.code === selectedCode.value))
  watch(
    line,
    () => {
      selectedCode.value = line.value?.processes[0]?.code ?? ''
    },
    { immediate: true }
  )

  function chooseProcess(row: HourlyProcess | null) {
    if (row) selectedCode.value = row.code
  }

  function addProcess() {
    if (!line.value) return
    let index = 1
    while (line.value.processes.some((p) => p.code === `P${index}`)) index++
    const added = createProcess(index)
    line.value.processes.push(added)
    selectedCode.value = added.code
  }

  async function openRemoved() {
    if (!line.value) return
    const currentBoard = board.value
    const currentLine = line.value.code
    removedVisible.value = true
    removedKeyword.value = ''
    removedError.value = ''
    removedLoading.value = true
    const pending = pendingRemoved.value.filter((x) => x.lineCode === currentLine)
    removedRows.value = pending
    try {
      const archived =
        currentBoard.version > 0
          ? await hourlyApi.removedProcesses(currentBoard.code, currentLine)
          : []
      if (board.value !== currentBoard || line.value?.code !== currentLine) return
      removedRows.value = [
        ...pending,
        ...archived.filter((x) => !pending.some((y) => y.instanceId === x.instanceId))
      ]
    } catch {
      removedError.value = '已移除配置加载失败，请重试；当前尚未保存的移除记录仍可恢复。'
    } finally {
      removedLoading.value = false
    }
  }
  function restoreRemoved(instanceId: string) {
    const row = removedRows.value.find((x) => x.instanceId === instanceId)
    if (!row) return
    if (
      !line.value ||
      row.lineCode !== line.value.code ||
      !row.definition ||
      !row.canRestore ||
      codeInUse(row.code)
    )
      return
    const restored: HourlyProcess = JSON.parse(JSON.stringify(row.definition))
    restored.creationMode = row.pending ? restored.creationMode || '' : 'Restore'
    line.value.processes.push(restored)
    selectedCode.value = restored.code
    pendingRemoved.value = pendingRemoved.value.filter((x) => x.instanceId !== row.instanceId)
    removedVisible.value = false
  }
  function createFromRemoved(instanceId: string) {
    const row = removedRows.value.find((x) => x.instanceId === instanceId)
    if (!row) return
    if (!line.value || row.lineCode !== line.value.code || codeInUse(row.code)) return
    const created = createProcess(1, row.name)
    created.code = row.code
    created.rowCode = row.definition?.rowCode || row.code
    line.value.processes.push(created)
    selectedCode.value = created.code
    removedVisible.value = false
    ElMessage.info('已添加同编码新工序，请配置数据绑定；保存后单独统计，原历史保留')
  }

  function move(index: number, offset: number) {
    if (!line.value) return
    const [item] = line.value.processes.splice(index, 1)
    line.value.processes.splice(index + offset, 0, item)
  }

  async function remove(index: number) {
    const targetLine = line.value
    const targetBoard = board.value
    const target = targetLine?.processes[index]
    if (!targetLine || !target || targetLine.processes.length <= 1) return
    const wasSummary = targetLine.summaryProcessCode === target.code
    try {
      await ElMessageBox.confirm(
        `从配置中移除“${target.name}”？已保存的过站记录和报表不会删除。${wasSummary ? '此工序是当前总产出口径，移除后需重新选择。' : ''}`,
        '移除工序'
      )
    } catch {
      return
    }
    if (board.value !== targetBoard || !removeHourlyProcess(targetLine, target)) return
    pendingRemoved.value.push({
      instanceId: target.instanceId || `pending:${crypto.randomUUID()}`,
      lineCode: targetLine.code,
      code: target.code,
      name: target.name,
      removedAt: null,
      canRestore: true,
      reason: '',
      definition: JSON.parse(JSON.stringify(target)),
      pending: true
    })
    if (line.value === targetLine && selectedCode.value === target.code)
      selectedCode.value = targetLine.processes[0]?.code ?? ''
    if (wasSummary) ElMessage.warning('已移除总产出工序，请重新选择总产出口径后保存')
  }

  function addBinding() {
    process.value?.bindings.push({
      code: `bind_${Date.now()}`,
      kind: 'Realtime',
      sourceKey: '',
      deviceKey: '',
      sourceDeviceCode: '',
      snPath: 'SN',
      timePath: '',
      quantityPath: '',
      filterPath: '',
      filterValue: '',
      reworkPath: '',
      reworkValue: '1'
    })
  }

  function focusProcess(lineCode: string, processCode: string) {
    const index = board.value.lines.findIndex((item) => item.code === lineCode)
    if (index < 0) return
    lineIndex.value = String(index)
    nextTick(() => {
      selectedCode.value = processCode || line.value?.processes[0]?.code || ''
    })
  }
  defineExpose({ focusProcess })
</script>

<style scoped>
  .add {
    margin: 14px 0;
  }

  .hint {
    margin-left: 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
</style>
