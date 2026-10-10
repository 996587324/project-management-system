<template>
  <el-dialog
    v-model="visible"
    title="线体产量绑定"
    width="min(760px, 96vw)"
    destroy-on-close
    append-to-body
  >
    <div v-loading="loading" class="line-output-binding-dialog">
      <el-alert
        title="选择设备报文中的数值字段作为产量来源。累计计数会按当天首次读数为基准累计，设备计数器归零后会自动继续累计。"
        type="info"
        :closable="false"
        class="mb-4"
      />
      <el-form label-position="top">
        <div class="line-output-binding-dialog__grid">
          <el-form-item label="线体">
            <el-input :model-value="lineCode" disabled />
          </el-form-item>
          <el-form-item label="设备模型" required>
            <el-select
              v-model="modelMark"
              filterable
              class="w-full"
              placeholder="选择模型"
              @change="handleModelChange"
            >
              <el-option
                v-for="item in models"
                :key="item.modelMark"
                :label="item.displayName"
                :value="item.modelMark"
              >
                <span>{{ item.displayName }}</span
                ><small>{{ item.deviceCount }} 台</small>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="产量来源设备" required>
            <el-select
              v-model="sourceKey"
              filterable
              remote
              reserve-keyword
              class="w-full"
              :disabled="!modelMark"
              :loading="sourceLoading"
              placeholder="选择或搜索设备"
              :remote-method="queueSourceSearch"
              @change="handleSourceChange"
            >
              <el-option
                v-for="item in sources"
                :key="sourceKeyOf(item)"
                :label="item.deviceMark"
                :value="sourceKeyOf(item)"
              >
                <span>{{ item.deviceMark }}</span
                ><small :class="{ online: item.dataOnline }"
                  >{{ item.dataOnline ? '接收中' : '已中断' }} · {{ item.tenantMark }}</small
                >
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="产量字段" required>
            <el-select
              v-model="form.sourcePath"
              filterable
              class="w-full"
              :disabled="!form.deviceMark"
              placeholder="选择数值字段"
              @change="applyField"
            >
              <el-option
                v-for="item in sourceFields"
                :key="item.sourcePath"
                :label="`${item.sourcePath} = ${formatValue(item.currentValue)}`"
                :value="item.sourcePath"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="显示名称" required>
            <el-input v-model.trim="form.fieldName" placeholder="例如：累计产量" />
          </el-form-item>
          <el-form-item label="计数方式">
            <el-select v-model="form.counterMode" class="w-full">
              <el-option label="累计计数（推荐）" value="Cumulative" />
              <el-option label="当前值直接展示" value="CurrentValue" />
            </el-select>
          </el-form-item>
          <el-form-item label="单位">
            <el-input v-model.trim="form.unit" placeholder="件 / 台 / 个" />
          </el-form-item>
          <el-form-item label="保留小数">
            <el-input-number v-model="form.decimals" :min="0" :max="3" controls-position="right" />
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="form.enabled" active-text="已启用" inactive-text="已停用" />
          </el-form-item>
        </div>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存产量绑定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import {
    type DashboardDataSourceModelOption,
    type DashboardDataSourceOption,
    type DashboardLineOutputBinding,
    type DashboardSourceFieldOption,
    fetchDashboardDataSourceModels,
    fetchDashboardDataSources,
    fetchDashboardDataSourcesByModel,
    fetchDashboardLineOutputBinding,
    fetchDashboardSourceFields,
    saveDashboardLineOutputBinding
  } from '@/api/edge-dashboard'

  const props = defineProps<{ modelValue: boolean; lineCode: string }>()
  const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>()
  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })
  const loading = ref(false)
  const saving = ref(false)
  const models = ref<DashboardDataSourceModelOption[]>([])
  const sources = ref<DashboardDataSourceOption[]>([])
  const sourceFields = ref<DashboardSourceFieldOption[]>([])
  const modelMark = ref('')
  const sourceKey = ref('')
  const sourceLoading = ref(false)
  let sourceSearchTimer = 0
  let requestVersion = 0

  const emptyForm = (): DashboardLineOutputBinding => ({
    id: 0,
    dashboardCode: 'production-dashboard',
    lineCode: props.lineCode,
    tenantMark: '',
    deviceMark: '',
    sourcePath: '',
    fieldName: '累计产量',
    counterMode: 'Cumulative',
    unit: '件',
    decimals: 0,
    enabled: true
  })
  const form = ref<DashboardLineOutputBinding>(emptyForm())
  const sourceKeyOf = (item: Pick<DashboardDataSourceOption, 'tenantMark' | 'deviceMark'>) =>
    `${item.tenantMark}\u001f${item.deviceMark}`

  const loadSources = async (keyword?: string) => {
    if (!modelMark.value) return (sources.value = [])
    const version = ++requestVersion
    sourceLoading.value = true
    try {
      const result = await fetchDashboardDataSourcesByModel(modelMark.value, keyword?.trim())
      if (version === requestVersion) sources.value = result
    } finally {
      if (version === requestVersion) sourceLoading.value = false
    }
  }

  const loadFields = async () => {
    if (!form.value.tenantMark || !form.value.deviceMark) return (sourceFields.value = [])
    sourceFields.value = await fetchDashboardSourceFields(
      form.value.tenantMark,
      form.value.deviceMark
    )
  }

  const load = async () => {
    loading.value = true
    modelMark.value = ''
    sourceKey.value = ''
    sources.value = []
    sourceFields.value = []
    try {
      const [sourceModels, existing] = await Promise.all([
        fetchDashboardDataSourceModels(),
        fetchDashboardLineOutputBinding(props.lineCode)
      ])
      models.value = sourceModels
      form.value = existing ? structuredClone(existing) : emptyForm()
      if (!form.value.deviceMark) return
      const matches = await fetchDashboardDataSources(form.value.deviceMark)
      const source = matches.find(
        (item) =>
          item.tenantMark === form.value.tenantMark && item.deviceMark === form.value.deviceMark
      )
      if (!source) return
      modelMark.value = source.modelMark || '__UNCLASSIFIED__'
      if (!models.value.some((item) => item.modelMark === modelMark.value)) {
        models.value.unshift({
          modelMark: modelMark.value,
          displayName: source.modelMark || '未分类',
          deviceCount: 1,
          latestReceiveTime: source.receiveTime
        })
      }
      await loadSources(form.value.deviceMark)
      sourceKey.value = sourceKeyOf(form.value)
      await loadFields()
    } finally {
      loading.value = false
    }
  }

  const handleModelChange = async () => {
    sourceKey.value = ''
    form.value.tenantMark = ''
    form.value.deviceMark = ''
    form.value.sourcePath = ''
    sourceFields.value = []
    await loadSources()
  }
  const handleSourceChange = async (key: string) => {
    const [tenantMark, deviceMark] = key.split('\u001f')
    form.value.tenantMark = tenantMark || ''
    form.value.deviceMark = deviceMark || ''
    form.value.sourcePath = ''
    await loadFields()
  }
  const queueSourceSearch = (keyword: string) => {
    window.clearTimeout(sourceSearchTimer)
    sourceSearchTimer = window.setTimeout(() => loadSources(keyword), 250)
  }
  const applyField = () => {
    const selected = sourceFields.value.find((item) => item.sourcePath === form.value.sourcePath)
    if (selected && (!form.value.fieldName || form.value.fieldName === '累计产量'))
      form.value.fieldName = selected.fieldName
  }
  const formatValue = (value: unknown) =>
    (typeof value === 'string' ? value : JSON.stringify(value) || 'null').slice(0, 56)
  const submit = async () => {
    if (
      !form.value.tenantMark ||
      !form.value.deviceMark ||
      !form.value.sourcePath ||
      !form.value.fieldName
    )
      return ElMessage.warning('请完整选择产量来源设备和字段')
    saving.value = true
    try {
      form.value = await saveDashboardLineOutputBinding(form.value)
      ElMessage.success('线体产量绑定已保存')
      emit('saved')
      visible.value = false
    } finally {
      saving.value = false
    }
  }
  watch(
    () => props.modelValue,
    (open) => open && load()
  )
</script>

<style scoped lang="scss">
  .line-output-binding-dialog__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 16px;
  }

  :deep(.el-select-dropdown__item small) {
    float: right;
    margin-left: 16px;
    color: var(--el-color-danger);
  }

  :deep(.el-select-dropdown__item small.online) {
    color: var(--el-color-success);
  }

  @media (width <= 680px) {
    .line-output-binding-dialog__grid {
      grid-template-columns: 1fr;
    }
  }
</style>
