<template>
  <el-dialog v-model="open" title="历史字段管理" width="94%" append-to-body destroy-on-close>
    <FieldCatalogManager v-if="open" :initial-model="initialModel" @changed="emit('changed')" />
  </el-dialog>
</template>

<script setup lang="ts">
  import FieldCatalogManager from './FieldCatalogManager.vue'
  const open = defineModel<boolean>({ required: true })
  defineProps<{ initialModel?: string }>()
  const emit = defineEmits<{ changed: [] }>()
</script>
