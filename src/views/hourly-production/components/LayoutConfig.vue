<template>
  <section>
    <el-alert
      title="布局决定展示哪些线体，所有线体仍正常采集、统计。使用相同对齐行编码匹配对比工序。"
      type="info"
      :closable="false"
    />
    <el-button v-if="!board.layout" @click="enable">配置展示布局</el-button>
    <template v-else>
      <el-form label-width="120px">
        <el-form-item label="展示模式"
          ><el-select v-model="board.layout.mode" @change="changeMode"
            ><el-option label="单线展示" value="Single" /><el-option
              label="双线对比"
              value="Compare" /><el-option label="多组对比轮播" value="Rotate" /></el-select
        ></el-form-item>
        <el-form-item v-if="board.layout.mode === 'Rotate'" label="轮播间隔（秒）"
          ><el-input-number v-model="board.layout.rotationSeconds" :min="5" :max="300"
        /></el-form-item>
      </el-form>
      <div v-for="(group, index) in board.layout.groups" :key="index" class="group">
        <span>第 {{ index + 1 }} 组</span>
        <el-select v-model="group[0]" placeholder="左侧线体" filterable
          ><el-option
            v-for="line in board.lines"
            :key="line.code"
            :label="line.name"
            :value="line.code"
        /></el-select>
        <el-select
          v-if="board.layout.mode !== 'Single'"
          v-model="group[1]"
          placeholder="右侧线体"
          filterable
          ><el-option
            v-for="line in board.lines"
            :key="line.code"
            :label="line.name"
            :value="line.code"
            :disabled="line.code === group[0]"
        /></el-select>
        <el-button
          v-if="board.layout.groups.length > 1"
          type="danger"
          text
          @click="board.layout.groups.splice(index, 1)"
          >移除本组</el-button
        >
      </div>
      <el-button
        v-if="board.layout.mode === 'Rotate'"
        :disabled="board.layout.groups.length >= 20"
        @click="board.layout.groups.push(['', ''])"
        >新增对比组</el-button
      >
      <el-button @click="board.layout = null">恢复默认布局</el-button>
    </template>
  </section>
</template>
<script setup lang="ts">
  import type { HourlyBoard } from '@/api/hourly-production'
  const board = defineModel<HourlyBoard>({ required: true })
  function enable() {
    board.value.layout = {
      mode: board.value.lines.length > 1 ? 'Compare' : 'Single',
      rotationSeconds: 15,
      groups: [board.value.lines.slice(0, 2).map((x) => x.code)]
    }
  }
  function changeMode() {
    const layout = board.value.layout
    if (!layout) return
    if (layout.mode !== 'Rotate') layout.groups = layout.groups.slice(0, 1)
    layout.groups = layout.groups.map((g) =>
      layout.mode === 'Single' ? [g[0] || ''] : [g[0] || '', g[1] || '']
    )
  }
</script>
<style scoped>
  .group {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin: 16px 0;
  }

  .group .el-select {
    width: 220px;
  }
</style>
