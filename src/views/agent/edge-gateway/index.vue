<template>
  <AgentExecutor
    agent-code="edge-gateway"
    assistant-title="边缘计算助手"
    sidebar-description="边缘运行与转发诊断"
    panel-title="边缘计算中心 Agent"
    panel-description="可查询设备、连接、实时数据、队列、上传与事件，并生成需要确认的重连或转发计划。"
    empty-description="输入一个问题，让边缘计算助手检查运行状态。"
    composer-placeholder="例如：哪些连接最近没有收到数据，或者查询最近失败的转发记录"
    :allow-project-csv="false"
    :enable-email="false"
    :initial-suggestions="suggestions"
  />
</template>

<script setup lang="ts">
  import AgentExecutor from '@/views/agent/executor/index.vue'

  defineOptions({ name: 'EdgeGatewayAgent' })

  const suggestions = [
    '查看边缘计算中心运行概况',
    '哪些连接最近没有收到数据',
    '查询最近失败的转发记录',
    '查看最近的错误事件'
  ]
</script>
