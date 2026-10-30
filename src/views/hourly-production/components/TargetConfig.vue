<template>
  <section>
    <el-button :disabled="!!board.shiftChange || !!board.cancelShiftEffectiveAt" @click="newVersion"
      >新增白夜班生效版本</el-button
    >
    <el-button v-if="board.shiftChange" @click="cancelDraft">取消本次新增</el-button>
    <el-alert v-if="board.cancelShiftEffectiveAt" type="warning" :closable="false">
      已选择撤销 {{ board.cancelShiftEffectiveAt }} 生效的版本，点击“保存全部配置”后生效。
      <el-button text @click="board.cancelShiftEffectiveAt = null">取消撤销</el-button>
    </el-alert>
    <el-table v-if="board.shiftHistory?.length" :data="board.shiftHistory" size="small"
      ><el-table-column prop="effectiveAt" label="生效时间" /><el-table-column
        prop="dayStart"
        label="白班开始 / 夜班结束"
      /><el-table-column prop="nightStart" label="夜班开始 / 白班结束" /><el-table-column
        label="操作"
        ><template #default="{ row }">
          <el-button
            v-if="new Date(row.effectiveAt).getTime() > Date.now()"
            type="danger"
            text
            :disabled="!!board.shiftChange || !!board.cancelShiftEffectiveAt"
            @click="cancelVersion(String(row.effectiveAt))"
            >撤销版本</el-button
          >
          <span v-else>已生效，保留历史</span>
        </template></el-table-column
      ></el-table
    >
    <el-collapse v-if="board.cancelledShifts?.length"
      ><el-collapse-item title="已撤销版本记录">
        <el-table :data="board.cancelledShifts" size="small"
          ><el-table-column prop="plan.effectiveAt" label="原定生效时间" /><el-table-column
            prop="cancelledAt"
            label="撤销时间" /><el-table-column prop="cancelledBy" label="操作账号"
        /></el-table> </el-collapse-item
    ></el-collapse>
    <template v-if="board.shiftChange"
      ><el-date-picker
        v-model="board.shiftChange.effectiveAt"
        type="datetime"
        value-format="YYYY-MM-DDTHH:mm:ss"
        placeholder="指定生效时间（北京时间）"
      /><el-input v-model="board.shiftChange.dayStart" type="time" /><el-input
        v-model="board.shiftChange.nightStart"
        type="time"
      /><p>白班开始 → 夜班开始 → 次日白班开始，连续衔接。生效时间须与原班次结束、新班次开始一致。</p
      ><el-radio-group v-model="shift"
        ><el-radio-button value="Day">白班目标</el-radio-button
        ><el-radio-button value="Night">夜班目标</el-radio-button></el-radio-group
      ></template
    >
    <el-form v-else label-width="130px" inline
      ><el-form-item label="班次开始"
        ><el-input v-model="board.startTime" type="time" /></el-form-item
      ><el-form-item label="班次结束"><el-input v-model="board.endTime" type="time" /></el-form-item
    ></el-form>
    <el-alert
      type="info"
      :closable="false"
      title="结束时间小于等于开始时间表示跨夜班；以开班日期作为生产日。目标留空或0均表示未设置目标。已有历史请新增生效版本。历史版本和目标保留，后续变更按指定时间生效。"
    />
    <div class="batch"
      ><el-input-number v-model="batchTarget" :min="0" :max="1000000000" /><el-button
        @click="applyTarget"
        >批量设置本线全部工序目标</el-button
      ><el-button @click="clearTargets">清空本线目标</el-button></div
    >
    <el-tabs v-model="lineIndex"
      ><el-tab-pane v-for="(line, i) in board.lines" :key="i" :label="line.name" :name="String(i)"
    /></el-tabs>
    <el-checkbox v-model="lineTargetEnabled"
      >独立配置本线小时汇总目标（关闭时沿用末工序目标）</el-checkbox
    >
    <el-table :data="targetRows" border
      ><el-table-column prop="name" label="工序" width="130" fixed /><el-table-column
        v-for="(label, i) in labels"
        :key="i"
        :label="label"
        width="145"
        ><template #default="{ row }"
          ><el-input-number
            v-model="row.targets[i]"
            :min="0"
            :max="1000000000"
            :controls="false"
            style="width: 110px" /></template></el-table-column
    ></el-table>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ElMessageBox } from 'element-plus'
  import { slotLabels, type HourlyBoard } from '@/api/hourly-production'
  const board = defineModel<HourlyBoard>({ required: true })
  const lineIndex = ref('0')
  const shift = ref('Day')
  async function cancelDraft() {
    await ElMessageBox.confirm('取消后将丢弃本次未保存的班次时间和目标。', '取消本次新增')
    board.value.shiftChange = null
  }
  async function cancelVersion(effectiveAt: string) {
    await ElMessageBox.confirm(
      `撤销 ${effectiveAt} 的待生效版本？保存后将沿用之前有效的配置。`,
      '撤销待生效版本'
    )
    board.value.cancelShiftEffectiveAt = effectiveAt
  }
  function newVersion() {
    const last = board.value.shiftHistory?.at(-1)
    board.value.shiftChange = {
      effectiveAt: '',
      dayStart: last?.dayStart || '08:00',
      nightStart: last?.nightStart || '20:00',
      dayTargets: JSON.parse(JSON.stringify(last?.dayTargets || {})),
      nightTargets: JSON.parse(JSON.stringify(last?.nightTargets || {}))
    }
  }
  const targetArray = (key: string, legacy: (number | null)[]) => {
    const plan = board.value.shiftChange
    if (!plan) return legacy
    const values = shift.value === 'Day' ? plan.dayTargets : plan.nightTargets
    return (values[key] ||= [])
  }
  const batchTarget = ref(100)
  const labels = computed(() => {
    const p = board.value.shiftChange
    return p
      ? slotLabels(
          shift.value === 'Day' ? p.dayStart : p.nightStart,
          shift.value === 'Day' ? p.nightStart : p.dayStart
        )
      : slotLabels(board.value.startTime, board.value.endTime)
  })
  const currentLine = computed(
    () => board.value.lines[Number(lineIndex.value)] || board.value.lines[0]
  )
  watch(
    () => board.value.lines.length,
    (count) => {
      if (Number(lineIndex.value) >= count) lineIndex.value = '0'
    }
  )
  const lineTargetEnabled = computed({
    get: () => targetArray(currentLine.value.code, currentLine.value.targets).length > 0,
    set: (enabled: boolean) => {
      const p = board.value.shiftChange
      if (p)
        (shift.value === 'Day' ? p.dayTargets : p.nightTargets)[currentLine.value.code] = enabled
          ? labels.value.map(() => null)
          : []
      else currentLine.value.targets = enabled ? labels.value.map(() => null) : []
    }
  })
  const targetRows = computed(() => [
    ...(lineTargetEnabled.value
      ? [
          {
            name: '线体汇总目标',
            targets: targetArray(currentLine.value.code, currentLine.value.targets)
          }
        ]
      : []),
    ...currentLine.value.processes.map((p) => ({
      name: p.name,
      targets: targetArray(currentLine.value.code + '/' + p.code, p.targets)
    }))
  ])

  function applyTarget() {
    for (const process of currentLine.value.processes) {
      const values = targetArray(currentLine.value.code + '/' + process.code, process.targets)
      values.splice(0, values.length, ...labels.value.map(() => batchTarget.value))
    }
  }

  function clearTargets() {
    for (const process of currentLine.value.processes) {
      const values = targetArray(currentLine.value.code + '/' + process.code, process.targets)
      values.splice(0, values.length, ...labels.value.map(() => null))
    }
  }
</script>

<style scoped>
  .batch {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 16px 0;
  }
</style>
