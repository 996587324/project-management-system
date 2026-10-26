<template>
  <section>
    <el-tabs v-model="lineIndex"
      ><el-tab-pane
        v-for="(line, i) in board.lines"
        :key="i"
        :label="line.name || `线体${i + 1}`"
        :name="String(i)"
    /></el-tabs>
    <el-form v-if="line" label-width="110px" inline>
      <el-form-item label="线体编码"
        ><el-input v-model.trim="line.code" :disabled="board.version > 0" maxlength="30"
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
      title="两线相同对齐行编码的工序横向对齐。已有过站记录的工序不能直接改统计口径；可新增编码，保留历史。线体总产出只取选定工序，不能累加工序产量。"
    />
    <el-table :data="line?.processes ?? []" highlight-current-row @current-change="chooseProcess">
      <el-table-column label="编码" width="125"
        ><template #default="{ row }"
          ><el-input
            v-model.trim="row.code"
            :disabled="persistedCodes.has(`${line?.code}/${row.code}`)"
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
    <el-card v-if="process" :key="`${line!.code}/${process.code}`" shadow="never">
      <template #header
        ><strong>{{ process.name }} · 统计规则与绑定</strong></template
      >
      <el-form label-width="160px">
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
        @remove="process!.bindings.splice(i, 1)"
      />
      <el-button @click="addBinding">新增数据绑定</el-button>
    </el-card>
  </section>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { createProcess, type HourlyBoard, type HourlyProcess } from '@/api/hourly-production'
  import BindingEditor from './BindingEditor.vue'
  import { removeHourlyProcess } from './process-config-rules'
  const board = defineModel<HourlyBoard>({ required: true })
  const lineIndex = ref('0')
  const selectedCode = ref('')
  const persistedCodes = ref(new Set<string>())
  watch(
    () => board.value,
    (value) => {
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
