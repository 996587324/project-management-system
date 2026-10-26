<template>
  <section>
    <el-form label-width="130px" inline
      ><el-form-item label="班次开始"
        ><el-input v-model="board.startTime" type="time" /></el-form-item
      ><el-form-item label="班次结束"><el-input v-model="board.endTime" type="time" /></el-form-item
    ></el-form>
    <el-alert
      type="info"
      :closable="false"
      title="结束时间小于等于开始时间表示跨夜班；以开班日期作为生产日。目标留空或0均表示未设置目标。已有过站记录后不可直接修改班次边界，请另建看板。"
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
  import { slotLabels, type HourlyBoard } from '@/api/hourly-production'
  const board = defineModel<HourlyBoard>({ required: true })
  const lineIndex = ref('0')
  const batchTarget = ref(100)
  const labels = computed(() => slotLabels(board.value.startTime, board.value.endTime))
  const currentLine = computed(() => board.value.lines[Number(lineIndex.value)])
  const lineTargetEnabled = computed({
    get: () => currentLine.value.targets.length > 0,
    set: (enabled: boolean) => {
      currentLine.value.targets = enabled ? labels.value.map(() => null) : []
    }
  })
  const targetRows = computed(() => [
    ...(lineTargetEnabled.value
      ? [{ name: '线体汇总目标', targets: currentLine.value.targets }]
      : []),
    ...currentLine.value.processes
  ])

  watch(
    () => labels.value.length,
    (count) => {
      for (const line of board.value.lines) {
        if (line.targets.length)
          line.targets = Array.from({ length: count }, (_, index) => line.targets[index] ?? null)
        for (const process of line.processes) {
          process.targets = Array.from(
            { length: count },
            (_, index) => process.targets[index] ?? null
          )
        }
      }
    }
  )

  function applyTarget() {
    for (const process of board.value.lines[Number(lineIndex.value)].processes) {
      process.targets = labels.value.map(() => batchTarget.value)
    }
  }

  function clearTargets() {
    for (const process of board.value.lines[Number(lineIndex.value)].processes) {
      process.targets = labels.value.map(() => null)
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
