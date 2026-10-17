<template>
  <AgentExecutor
    agent-code="process-board"
    assistant-title="产线工艺看板助手"
    sidebar-description="工艺参数、流程与配置"
    panel-title="产线工艺看板 Agent"
    panel-description="可查询区域、线体、卡片、曲线及追溯，回复“确认”后调整公式、上下限、流程、布局及推送配置。删除请到人工配置页面完成。"
    empty-description="输入问题，让工艺看板助手查询数据或生成待确认配置。"
    composer-placeholder="例如：查看工艺参数超限情况，或把卡片改成每行显示两组参数"
    :confirm-by-reply-only="true"
    :suggestions="suggestions"
  />
</template>

<script setup lang="ts">
  import AgentExecutor from '@/views/agent/executor/index.vue'

  defineOptions({ name: 'ProcessBoardAgent' })

  const suggestions = [
    '查看各区域工艺线体和卡片数量',
    '查询某条工艺线体的当前参数和超限情况',
    '给参数卡片新增温度字段并配置上下限和追溯',
    '把温度显示公式改成 x/10 并试算',
    '查询最近一小时温度曲线和超限事件',
    '把卡片改成每行显示两组参数'
  ]
</script>
