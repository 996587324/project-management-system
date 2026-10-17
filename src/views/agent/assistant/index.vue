<template>
  <AgentExecutor
    :show-mode-selector="true"
    :initial-mode="initialMode"
    :initial-work-agent-code="initialWorkAgentCode"
    :allow-project-csv="true"
    :enable-email="true"
  />
</template>

<script setup lang="ts">
  import { useRoute } from 'vue-router'
  import AgentExecutor from '@/views/agent/executor/index.vue'

  defineOptions({ name: 'AgentAssistant' })

  const route = useRoute()
  const requestedMode = String(route.query.mode || '').toLowerCase()
  const requestedDomain = String(route.query.domain || '')
  const enabledDomains = [
    'project-management',
    'edge-gateway',
    'production-dashboard',
    'process-board'
  ]
  const initialMode = requestedMode === 'chat' ? 'Chat' : 'Work'
  const initialWorkAgentCode = enabledDomains.includes(requestedDomain)
    ? requestedDomain
    : 'project-management'
</script>
