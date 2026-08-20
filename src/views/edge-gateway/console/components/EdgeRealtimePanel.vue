<template>
  <div class="edge-realtime-panel">
    <EdgeRealtimeTestForm ref="testForm" @sent="handleSent" />
    <EdgeRealtimeSnapshotTable
      ref="snapshotTable"
      :active="active"
      @show-json="emit('show-json', $event)"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import type { JsonDialogPayload, RefreshablePanel } from './shared'
  import EdgeRealtimeSnapshotTable from './realtime/EdgeRealtimeSnapshotTable.vue'
  import EdgeRealtimeTestForm from './realtime/EdgeRealtimeTestForm.vue'

  defineProps<{ active: boolean }>()

  const emit = defineEmits<{
    'show-json': [payload: JsonDialogPayload]
  }>()

  const testForm = ref<RefreshablePanel>()
  const snapshotTable = ref<RefreshablePanel>()

  const handleSent = async () => {
    await snapshotTable.value?.refresh()
  }

  const refresh = async () => {
    await Promise.all([testForm.value?.refresh(), snapshotTable.value?.refresh()])
  }

  defineExpose({ refresh })
</script>

<style scoped lang="scss">
  .edge-realtime-panel {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
</style>
