<template>
  <el-card shadow="never" class="binding-card">
    <template #header
      ><div class="binding-header"
        ><strong>数据绑定 {{ index + 1 }}</strong
        ><el-button type="danger" text :disabled="disabled" @click="emit('remove')"
          >移除绑定</el-button
        ></div
      ></template
    >
    <el-form label-width="115px" :disabled="disabled">
      <el-form-item label="数据接入"
        ><el-radio-group v-model="binding.kind" @change="changeKind"
          ><el-radio-button value="Realtime">实时数据源</el-radio-button
          ><el-radio-button value="Edge">中转连接</el-radio-button></el-radio-group
        ></el-form-item
      >
      <el-form-item label="设备 / 数据源"
        ><SourceTreeSelect
          v-if="!disabled"
          :model-value="binding"
          :kind="binding.kind"
          purpose="hourly"
          :disabled="disabled"
          @change="selectSource"
        />
        <el-input v-else :model-value="`${binding.sourceKey} / ${binding.deviceKey}`" disabled />
      </el-form-item>
      <div class="binding-grid">
        <el-form-item v-if="binding.kind === 'Edge'" label="订阅设备编码">
          <el-input
            v-model.trim="binding.sourceDeviceCode"
            placeholder="SourceDeviceCode，建议明确选择实际设备"
          />
        </el-form-item>
        <el-form-item label="源编码"
          ><el-input v-model.trim="binding.sourceKey" placeholder="租户标识 / SourceId"
        /></el-form-item>
        <el-form-item label="设备编码"
          ><el-input v-model.trim="binding.deviceKey" placeholder="DeviceMark / 网关DeviceCode"
        /></el-form-item>
        <el-form-item v-for="field in fieldInputs" :key="field.key" :label="field.label"
          ><el-select
            v-model="binding[field.key]"
            filterable
            allow-create
            default-first-option
            clearable
            :placeholder="field.placeholder"
            style="width: 100%"
            ><el-option
              v-for="option in fields"
              :key="option.sourcePath"
              :label="`${option.fieldName || option.sourcePath} (${option.sourcePath})`"
              :value="option.sourcePath" /></el-select
        ></el-form-item>
        <el-form-item label="条件匹配值"
          ><el-input v-model="binding.filterValue" placeholder="精确匹配；不填条件字段则不过滤"
        /></el-form-item>
        <el-form-item label="返工匹配值"
          ><el-input v-model="binding.reworkValue" placeholder="例如 1 / true / REWORK"
        /></el-form-item>
      </div>
      <el-alert type="info" :closable="false"
        >按本次实际报文提取字段，不使用最新值补齐。时间字段留空使用报文时间；明确配置后缺失或格式错误会记录异常，不伪造时间。中转字段支持手输
        JSON 路径，可用条件字段区分设备/工序。</el-alert
      >
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import SourceTreeSelect from '@/components/business/source-tree-select/index.vue'
  import type { CatalogDevice } from '@/api/source-catalog'
  import { hourlyApi, type HourlyBinding } from '@/api/hourly-production'
  const binding = defineModel<HourlyBinding>({ required: true })
  defineProps<{ index: number; disabled?: boolean }>()
  const emit = defineEmits<{ remove: [] }>()
  const fields = ref<{ sourcePath: string; fieldName: string }[]>([])
  let fieldRevision = 0
  const fieldInputs: {
    key: 'snPath' | 'timePath' | 'quantityPath' | 'filterPath' | 'reworkPath'
    label: string
    placeholder: string
  }[] = [
    { key: 'snPath', label: 'SN字段', placeholder: '例如 SN；去重计数必填' },
    { key: 'timePath', label: '过站时间字段', placeholder: '留空使用报文时间' },
    { key: 'quantityPath', label: '求和字段', placeholder: '数值求和时必填' },
    { key: 'filterPath', label: '条件字段', placeholder: '例如 result / processCode' },
    { key: 'reworkPath', label: '返工标识字段', placeholder: '可选，优先使用明确返工标识' }
  ]

  function changeKind() {
    binding.value.sourceKey = ''
    binding.value.deviceKey = ''
    binding.value.sourceDeviceCode = ''
    for (const field of fieldInputs) binding.value[field.key] = ''
    fields.value = []
  }

  function selectSource(value: CatalogDevice) {
    if (
      value.sourceKey === binding.value.sourceKey &&
      value.deviceKey === binding.value.deviceKey &&
      (value.sourceDeviceCode || '') === (binding.value.sourceDeviceCode || '')
    )
      return
    binding.value.sourceKey = value.sourceKey
    binding.value.deviceKey = value.deviceKey
    binding.value.sourceDeviceCode = value.sourceDeviceCode || ''
    for (const field of fieldInputs) binding.value[field.key] = ''
  }

  async function loadFields() {
    const revision = ++fieldRevision
    fields.value = []
    if (binding.value.kind !== 'Realtime' || !binding.value.deviceKey) return
    const result = await hourlyApi.fields(binding.value.sourceKey, binding.value.deviceKey)
    if (revision === fieldRevision) fields.value = result
  }

  watch(() => [binding.value.kind, binding.value.sourceKey, binding.value.deviceKey], loadFields, {
    immediate: true
  })
</script>

<style scoped>
  .binding-card {
    margin: 14px 0;
  }

  .binding-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .binding-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 16px;
  }

  @media (width <= 900px) {
    .binding-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
