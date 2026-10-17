<template>
  <div class="binding-editor">
    <el-select v-if="!deviceOnly" v-model="mode" @change="changeMode" style="width: 110px">
      <el-option label="数据源" value="source" />
      <el-option label="固定数值" value="fixed" />
    </el-select>
    <el-input-number v-if="mode === 'fixed'" v-model="binding.fixedValue" :controls="false" />
    <template v-else>
      <el-select
        :model-value="sourceKey"
        filterable
        remote
        :remote-method="searchSources"
        :loading="searching"
        placeholder="搜索设备编码或模型"
        @change="selectSource"
      >
        <el-option
          v-for="source in sources"
          :key="keyOf(source)"
          :value="keyOf(source)"
          :label="`${source.displayName} · ${source.deviceMark} (${source.tenantMark})`"
        />
      </el-select>
      <el-select
        v-if="!deviceOnly"
        v-model="binding.sourcePath"
        filterable
        :loading="loading"
        placeholder="选择历史字段"
        @change="chooseField"
      >
        <el-option
          v-for="field in fields"
          :key="field.sourcePath"
          :value="field.sourcePath"
          :label="`${field.fieldName} · ${field.sourcePath}`"
        />
      </el-select>
      <el-button v-if="!deviceOnly" :disabled="!binding.deviceMark" @click="catalogOpen = true"
        >管理历史字段</el-button
      >
    </template>
    <FieldCatalogDialog
      v-model="catalogOpen"
      :initial-model="sources.find((source) => keyOf(source) === sourceKey)?.modelMark"
      @changed="loadFields"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import FieldCatalogDialog from '@/components/business/historical-field-catalog/FieldCatalogDialog.vue'
  import {
    processApi,
    type SourceBinding,
    type ProcessSource,
    type SourceField
  } from '@/api/process-board'

  const binding = defineModel<SourceBinding>({ required: true })
  const props = defineProps<{ deviceOnly?: boolean }>()
  const emit = defineEmits<{ field: [value: SourceField] }>()
  const mode = ref(binding.value.fixedValue != null ? 'fixed' : 'source')
  const sources = ref<ProcessSource[]>([])
  const fields = ref<SourceField[]>([])
  const searching = ref(false)
  const loading = ref(false)
  const catalogOpen = ref(false)
  let fieldRevision = 0
  let sourceRevision = 0

  function keyOf(source: Pick<SourceBinding, 'tenantMark' | 'deviceMark'>) {
    return JSON.stringify([source.tenantMark, source.deviceMark])
  }

  const sourceKey = computed(() => (binding.value.deviceMark ? keyOf(binding.value) : ''))

  async function searchSources(keyword = '') {
    const revision = ++sourceRevision
    searching.value = true
    try {
      const rows = await processApi.sources(keyword)
      if (revision !== sourceRevision) return
      if (binding.value.deviceMark && !rows.some((row) => keyOf(row) === sourceKey.value)) {
        rows.unshift({ ...binding.value, displayName: binding.value.deviceMark })
      }
      sources.value = rows
    } finally {
      if (revision === sourceRevision) searching.value = false
    }
  }

  function selectSource(key: string) {
    const [tenantMark, deviceMark] = JSON.parse(key) as string[]
    binding.value = { tenantMark, deviceMark, sourcePath: '' }
  }

  function changeMode() {
    if (mode.value === 'fixed')
      binding.value = { tenantMark: '', deviceMark: '', sourcePath: '', fixedValue: 0 }
    else binding.value = { tenantMark: '', deviceMark: '', sourcePath: '' }
  }

  function chooseField(path: string) {
    const field = fields.value.find((item) => item.sourcePath === path)
    if (field) emit('field', field)
  }

  async function loadFields() {
    const revision = ++fieldRevision
    fields.value = []
    if (!binding.value.deviceMark || props.deviceOnly) return
    loading.value = true
    try {
      const rows = await processApi.fields(binding.value)
      if (revision === fieldRevision) fields.value = rows
    } finally {
      if (revision === fieldRevision) loading.value = false
    }
  }

  watch(sourceKey, loadFields, { immediate: true })

  onMounted(() => searchSources())
</script>

<style scoped lang="scss">
  .binding-editor {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    > .el-select:not(:first-child) {
      flex: 1;
      min-width: 220px;
    }
  }
</style>
