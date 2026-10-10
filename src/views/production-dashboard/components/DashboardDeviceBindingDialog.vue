<template>
  <el-dialog
    v-model="visible"
    title="设备数据绑定"
    width="min(860px, 96vw)"
    destroy-on-close
    append-to-body
  >
    <div v-loading="loading" class="device-binding-dialog">
      <el-alert
        title="设备会纳入当前线体状态分布。启用日统计后，系统按状态映射、模型报警和在线超时累计设备运行时长。"
        type="info"
        :closable="false"
        class="mb-4"
      />
      <el-form label-position="top">
        <div class="device-binding-dialog__grid">
          <el-form-item label="布局设备"
            ><el-input :model-value="deviceName" disabled
          /></el-form-item>
          <el-form-item label="设备模型" required>
            <el-select
              v-model="modelMark"
              class="w-full"
              filterable
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
                ><small>{{ item.modelMark }}</small>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="实时数据设备" required>
            <el-select
              v-model="sourceKey"
              class="w-full"
              filterable
              remote
              reserve-keyword
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
          <el-form-item label="在线超时"
            ><el-input-number
              v-model="form.onlineTimeoutSeconds"
              :min="6"
              :max="3600"
              controls-position="right"
            /><span class="device-binding-dialog__suffix">秒</span></el-form-item
          >
          <el-form-item label="启用"
            ><el-switch v-model="form.enabled" active-text="已启用" inactive-text="已停用"
          /></el-form-item>
          <el-form-item label="设备日统计"
            ><el-switch
              v-model="form.statisticsEnabled"
              active-text="参与统计"
              inactive-text="不统计"
          /></el-form-item>
        </div>

        <template v-if="form.statisticsEnabled">
          <div class="device-binding-dialog__grid">
            <el-form-item label="业务日开始">
              <el-input-number
                v-model="form.businessDayStartHour"
                :min="0"
                :max="23"
                controls-position="right"
              />
              <span class="device-binding-dialog__suffix">时</span>
            </el-form-item>
            <el-form-item label="状态来源字段">
              <el-select
                v-model="form.statusSourcePath"
                class="w-full"
                clearable
                filterable
                placeholder="留空：在线且无报警时按运行中"
              >
                <el-option
                  v-for="field in sourceFields"
                  :key="field.sourcePath"
                  :label="`${field.fieldName} · ${field.sourcePath}`"
                  :value="field.sourcePath"
                />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="状态值映射（JSON）">
            <el-input
              v-model.trim="form.statusMappingJson"
              type="textarea"
              :rows="2"
              :disabled="!form.statusSourcePath"
              placeholder='例如 {"1":"RUNNING","0":"IDLE","2":"STOPPED"}'
            />
            <div class="device-binding-dialog__hint">
              支持
              RUNNING、IDLE、STOPPED、FAULT、OFFLINE、UNKNOWN。报警与状态映射冲突时按模型状态优先级裁决。
            </div>
          </el-form-item>
        </template>

        <el-form-item label="展示字段">
          <el-checkbox-group
            v-model="selectedPaths"
            class="device-binding-dialog__fields"
            :disabled="!form.sourceDeviceMark"
          >
            <el-checkbox
              v-for="field in sourceFields"
              :key="field.sourcePath"
              :value="field.sourcePath"
            >
              <b>{{ field.fieldName }}</b
              ><span>{{ field.sourcePath }}</span
              ><small>{{ formatValue(field.currentValue) }}</small>
            </el-checkbox>
          </el-checkbox-group>
          <div
            v-if="form.sourceDeviceMark && !sourceFields.length"
            class="device-binding-dialog__empty"
            >该数据源暂未发现可展示字段。</div
          >
          <div v-else class="device-binding-dialog__hint">
            字段名称、格式、单位和值映射请在“模型字段展示映射”中统一维护。
          </div>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存设备绑定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import {
    type DashboardDataSourceModelOption,
    type DashboardDataSourceOption,
    type DashboardDeviceBinding,
    type DashboardSourceFieldOption,
    fetchDashboardDataSourceModels,
    fetchDashboardDataSources,
    fetchDashboardDataSourcesByModel,
    fetchDashboardDeviceBindings,
    fetchDashboardSourceFields,
    saveDashboardDeviceBinding
  } from '@/api/edge-dashboard'

  const props = defineProps<{
    modelValue: boolean
    lineCode: string
    deviceCode: string
    deviceName: string
  }>()
  const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>()
  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })
  const loading = ref(false)
  const saving = ref(false)
  const sourceLoading = ref(false)
  const models = ref<DashboardDataSourceModelOption[]>([])
  const sources = ref<DashboardDataSourceOption[]>([])
  const sourceFields = ref<DashboardSourceFieldOption[]>([])
  const modelMark = ref('')
  const sourceKey = ref('')
  const selectedPaths = ref<string[]>([])
  let sourceSearchTimer = 0
  let sourceRequestVersion = 0

  const emptyForm = (): DashboardDeviceBinding => ({
    id: 0,
    dashboardCode: 'production-dashboard',
    lineCode: props.lineCode,
    deviceCode: props.deviceCode,
    deviceName: props.deviceName,
    tenantMark: '',
    sourceDeviceMark: '',
    onlineTimeoutSeconds: 15,
    statisticsEnabled: false,
    businessDayStartHour: 0,
    statusSourcePath: undefined,
    statusMappingJson: undefined,
    enabled: true,
    fields: []
  })
  const form = ref<DashboardDeviceBinding>(emptyForm())
  const sourceKeyOf = (item: Pick<DashboardDataSourceOption, 'tenantMark' | 'deviceMark'>) =>
    `${item.tenantMark}\u001f${item.deviceMark}`

  const loadSources = async (keyword?: string) => {
    if (!modelMark.value) return (sources.value = [])
    const version = ++sourceRequestVersion
    sourceLoading.value = true
    try {
      const result = await fetchDashboardDataSourcesByModel(modelMark.value, keyword?.trim())
      if (version === sourceRequestVersion) sources.value = result
    } finally {
      if (version === sourceRequestVersion) sourceLoading.value = false
    }
  }
  const loadFields = async () => {
    if (!form.value.tenantMark || !form.value.sourceDeviceMark) return (sourceFields.value = [])
    sourceFields.value = await fetchDashboardSourceFields(
      form.value.tenantMark,
      form.value.sourceDeviceMark
    )
  }
  const load = async () => {
    loading.value = true
    modelMark.value = ''
    sourceKey.value = ''
    selectedPaths.value = []
    sources.value = []
    sourceFields.value = []
    try {
      const [sourceModels, bindings] = await Promise.all([
        fetchDashboardDataSourceModels(),
        fetchDashboardDeviceBindings(props.lineCode)
      ])
      models.value = sourceModels
      const existing = bindings.find((item) => item.deviceCode === props.deviceCode)
      form.value = existing ? structuredClone(existing) : emptyForm()
      selectedPaths.value = form.value.fields
        .filter((item) => item.enabled)
        .map((item) => item.sourcePath)
      if (!form.value.sourceDeviceMark) return
      const matches = await fetchDashboardDataSources(form.value.sourceDeviceMark)
      const source = matches.find(
        (item) =>
          item.tenantMark === form.value.tenantMark &&
          item.deviceMark === form.value.sourceDeviceMark
      )
      if (!source) return
      modelMark.value = source.modelMark || '__UNCLASSIFIED__'
      if (!models.value.some((item) => item.modelMark === modelMark.value))
        models.value.unshift({
          modelMark: modelMark.value,
          displayName: source.modelMark || '未分类',
          deviceCount: 1,
          latestReceiveTime: source.receiveTime
        })
      await loadSources(form.value.sourceDeviceMark)
      sourceKey.value = `${form.value.tenantMark}\u001f${form.value.sourceDeviceMark}`
      await loadFields()
    } finally {
      loading.value = false
    }
  }
  const handleModelChange = async () => {
    sourceKey.value = ''
    form.value.tenantMark = ''
    form.value.sourceDeviceMark = ''
    selectedPaths.value = []
    sourceFields.value = []
    await loadSources()
  }
  const handleSourceChange = async (key: string) => {
    const [tenantMark, deviceMark] = key.split('\u001f')
    form.value.tenantMark = tenantMark || ''
    form.value.sourceDeviceMark = deviceMark || ''
    form.value.statusSourcePath = undefined
    form.value.statusMappingJson = undefined
    selectedPaths.value = []
    form.value.fields = []
    await loadFields()
  }
  const queueSourceSearch = (keyword: string) => {
    window.clearTimeout(sourceSearchTimer)
    sourceSearchTimer = window.setTimeout(() => loadSources(keyword), 250)
  }
  const formatValue = (value: unknown) =>
    (typeof value === 'string' ? value : JSON.stringify(value) || 'null').slice(0, 72)
  const submit = async () => {
    if (!form.value.tenantMark || !form.value.sourceDeviceMark)
      return ElMessage.warning('请选择实时数据设备')
    if (!selectedPaths.value.length) return ElMessage.warning('请至少选择一个展示字段')
    if (
      form.value.statisticsEnabled &&
      form.value.statusSourcePath &&
      !form.value.statusMappingJson
    )
      return ElMessage.warning('选择状态来源字段后请填写状态值映射 JSON')
    const previous = new Map(form.value.fields.map((item) => [item.sourcePath, item]))
    form.value.fields = selectedPaths.value.map((path, index) => {
      const source = sourceFields.value.find((item) => item.sourcePath === path)
      const old = previous.get(path)
      return {
        id: old?.id || 0,
        fieldCode: old?.fieldCode || `field-${index + 1}`,
        sourcePath: path,
        displayName: old?.displayName || source?.fieldName || path,
        purpose: 'DisplayValue',
        valueType: old?.valueType || source?.valueType || 'String',
        formatType: old?.formatType || 'Direct',
        unit: old?.unit,
        decimals: old?.decimals,
        mappingJson: old?.mappingJson,
        sort: index,
        enabled: true
      }
    })
    saving.value = true
    try {
      form.value = await saveDashboardDeviceBinding(form.value)
      ElMessage.success('设备数据绑定已保存')
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
  .device-binding-dialog__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 16px;
  }

  .device-binding-dialog__suffix {
    margin-left: 8px;
    color: var(--el-text-color-secondary);
  }

  .device-binding-dialog__fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    max-height: 330px;
    padding: 10px;
    overflow: auto;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
  }

  .device-binding-dialog__fields :deep(.el-checkbox) {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    height: auto;
    min-height: 46px;
    padding: 7px 4px;
    margin-right: 10px;
  }

  .device-binding-dialog__fields b,
  .device-binding-dialog__fields span,
  .device-binding-dialog__fields small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-binding-dialog__fields span {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .device-binding-dialog__fields small {
    font-size: 11px;
    color: var(--el-color-primary);
  }

  .device-binding-dialog__empty {
    color: var(--el-text-color-secondary);
  }

  .device-binding-dialog__hint {
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
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
    .device-binding-dialog__grid,
    .device-binding-dialog__fields {
      grid-template-columns: 1fr;
    }
  }
</style>
