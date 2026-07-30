<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="760px"
    class="edge-gateway-dialog"
    @close="close"
  >
    <pre class="json-preview">{{ formattedContent }}</pre>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { formatJson } from './shared'

  const props = defineProps<{
    modelValue: boolean
    title: string
    content: string
  }>()

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
  }>()

  const formattedContent = computed(() => formatJson(props.content))
  const close = () => emit('update:modelValue', false)
</script>
