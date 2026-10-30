<template>
  <WorkChoicePicker
    :model-value="modelValue || ''"
    :title="title"
    :placeholder="placeholder || (blocked ? '请先选择工作组和主责员工' : '请选择人员')"
    :load="load"
    :context-key="contextKey"
    :disabled="disabled || blocked"
    :clearable="clearable"
    :fallback-label="fallbackLabel"
    search-placeholder="搜索姓名或账号"
    empty-text="当前范围没有符合条件的人员，请检查工作组成员、应用准入和业务角色授权"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
<script setup lang="ts">
  import { computed } from 'vue'
  import WorkChoicePicker from '@/components/business/work-choice-picker/index.vue'
  import { workApi, type WorkCandidateContext } from '@/api/work-tasks'
  import type { WorkChoiceQuery } from '@/components/business/work-choice-picker/types'
  const props = defineProps<
    WorkCandidateContext & {
      modelValue?: string | null
      title: string
      placeholder?: string
      disabled?: boolean
      clearable?: boolean
      fallbackLabel?: string
    }
  >()
  const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
  const context = computed(() => ({
    purpose: props.purpose,
    groupId: props.groupId,
    assigneeId: props.assigneeId,
    taskId: props.taskId
  }))
  const contextKey = computed(() => JSON.stringify(context.value))
  const blocked = computed(
    () =>
      props.purpose !== 'admin-user' &&
      !props.taskId &&
      (!props.groupId || (props.purpose !== 'assignee' && !props.assigneeId))
  )
  const load = (query: WorkChoiceQuery) =>
    blocked.value
      ? Promise.resolve({ records: [], total: 0 })
      : workApi.candidates({ ...context.value, ...query })
</script>
