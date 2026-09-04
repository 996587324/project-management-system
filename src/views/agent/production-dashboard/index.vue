<template>
  <AgentExecutor
    agent-code="production-dashboard"
    assistant-title="生产看板助手"
    sidebar-description="看板数据与场景配置"
    panel-title="生产看板 Agent"
    panel-description="可查询设备状态、统计和故障；计划生成后回复“确认”即可新增或调整线体、Three.js 场景、机械手绑定和图表配置。删除操作请在人工配置页面完成。"
    empty-description="输入一个问题，让生产看板助手查询数据或生成配置调整计划。"
    composer-placeholder="例如：查看 W1 今天的故障汇总，或把 W1-R-01 的工位名称改为自动上快装工位"
    :allow-project-csv="false"
    :enable-email="false"
    :confirm-by-reply-only="true"
    :initial-suggestions="suggestions"
  />
</template>

<script setup lang="ts">
  import AgentExecutor from '@/views/agent/executor/index.vue'

  defineOptions({ name: 'ProductionDashboardAgent' })

  const suggestions = [
    '查看各线体当前机械手运行状态',
    '查询今天故障次数最多的机械手',
    '查看 W1 线的场景和图表配置',
    '把 W1-R-01 的工位名称改为自动上快装工位',
    '在 W1 线新增一个设备组件',
    '把 W1-R-01 移动到坐标 4.5，-1',
    '把 W1 的设备 device-01 绑定到实时数据源'
  ]
</script>
