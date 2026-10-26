<template>
  <div class="binding-editor">
    <el-select v-if="!deviceOnly" v-model="mode" @change="changeMode" style="width: 110px">
      <el-option label="数据源" value="source" />
      <el-option label="固定数值" value="fixed" />
    </el-select>
    <el-input-number v-if="mode === 'fixed'" v-model="binding.fixedValue" :controls="false" />
    <template v-else>
      <SourceTreeSelect
        :model-value="{ sourceKey: binding.tenantMark, deviceKey: binding.deviceMark }"
        purpose="process"
        :process-line-id="processLineId"
        :disabled="scopeEmpty"
        @change="selectSource"
        @resolved="selectedModel = $event.modelMark"
      />
      <el-select
        v-if="!deviceOnly"
        v-model="binding.sourcePath"
        filterable
        :loading="loading"
        :disabled="outsideScope"
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
      <el-button
        v-if="!deviceOnly"
        :disabled="!binding.deviceMark || outsideScope"
        @click="catalogOpen = true"
        >管理历史字段</el-button
      >
    </template>
    <p v-if="mode !== 'fixed' && scopeEmpty" class="scope-message"
      >请先选择所属工艺线体，并在线体配置中关联设备。</p
    >
    <p v-else-if="mode !== 'fixed' && outsideScope" class="scope-message"
      >当前绑定不在线体设备范围内。历史绑定可保留原值；新增或改绑时请选择线体内设备。</p
    >
    <FieldCatalogDialog
      v-model="catalogOpen"
      :initial-model="selectedModel"
      @changed="loadFields"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import SourceTreeSelect from '@/components/business/source-tree-select/index.vue'
  import type { CatalogDevice } from '@/api/source-catalog'
  import FieldCatalogDialog from '@/components/business/historical-field-catalog/FieldCatalogDialog.vue'
  import { processApi, type SourceBinding, type SourceField } from '@/api/process-board'
  import { isLineDevice } from './device-scope'

  const binding = defineModel<SourceBinding>({ required: true })
  const props = defineProps<{
    deviceOnly?: boolean
    processLineId?: number
    allowedDevices?: SourceBinding[]
  }>()
  const scopeEmpty = computed(
    () =>
      props.allowedDevices !== undefined &&
      (!props.processLineId ||
        !props.allowedDevices.some(
          (source) => source.fixedValue == null && source.tenantMark && source.deviceMark
        ))
  )
  const outsideScope = computed(
    () =>
      props.allowedDevices !== undefined &&
      Boolean(binding.value.deviceMark) &&
      !isLineDevice(binding.value, props.allowedDevices)
  )
  const emit = defineEmits<{ field: [value: SourceField] }>()
  const mode = ref(binding.value.fixedValue != null ? 'fixed' : 'source')
  const selectedModel = ref('')
  const fields = ref<SourceField[]>([])
  const loading = ref(false)
  const catalogOpen = ref(false)
  let fieldRevision = 0

  function keyOf(source: Pick<SourceBinding, 'tenantMark' | 'deviceMark'>) {
    return JSON.stringify([source.tenantMark, source.deviceMark])
  }

  const sourceKey = computed(() => (binding.value.deviceMark ? keyOf(binding.value) : ''))

  function selectSource(source: CatalogDevice) {
    if (
      props.allowedDevices !== undefined &&
      !isLineDevice(
        { tenantMark: source.sourceKey, deviceMark: source.deviceKey, sourcePath: '' },
        props.allowedDevices
      )
    )
      return
    if (
      source.sourceKey === binding.value.tenantMark &&
      source.deviceKey === binding.value.deviceMark
    )
      return
    selectedModel.value = source.modelMark
    binding.value = { tenantMark: source.sourceKey, deviceMark: source.deviceKey, sourcePath: '' }
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
    loading.value = false
    if (!binding.value.deviceMark || props.deviceOnly || outsideScope.value) return
    loading.value = true
    try {
      const rows = await processApi.fields(binding.value)
      if (revision === fieldRevision) fields.value = rows
    } finally {
      if (revision === fieldRevision) loading.value = false
    }
  }

  watch([sourceKey, outsideScope], loadFields, { immediate: true })
</script>

<style scoped lang="scss">
  .scope-message {
    flex-basis: 100%;
    margin: 0;
    font-size: 12px;
    color: var(--el-color-warning);
  }

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
