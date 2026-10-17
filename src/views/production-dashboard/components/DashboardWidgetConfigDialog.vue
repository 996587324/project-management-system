<template>
  <el-dialog
    v-model="visible"
    title="看板表格与图表配置"
    width="min(1120px, 96vw)"
    destroy-on-close
    append-to-body
  >
    <div v-loading="loading" class="widget-config">
      <aside class="widget-config__list">
        <el-button type="primary" :icon="Plus" class="w-full" @click="createWidget"
          >新增部件</el-button
        >
        <div class="widget-config__chart-layout">
          <b>图表每行数量</b>
          <el-segmented v-model="chartPerRow" :options="chartPerRowOptions" block />
          <el-button plain class="w-full" :loading="applyingChartLayout" @click="applyChartLayout"
            >应用到全部图表</el-button
          >
          <small>仅调整饼图、柱状图；表格保持原宽度。</small>
        </div>
        <button
          v-for="widget in widgets"
          :key="widget.id"
          :class="['widget-config__list-item', { active: form.id === widget.id }]"
          type="button"
          @click="editWidget(widget)"
        >
          <ArtSvgIcon :icon="widgetIcon(widget.widgetType)" />
          <span
            ><b>{{ widget.title }}</b
            ><small>{{ dataSourceLabel(widget.dataSourceType) }}</small></span
          >
        </button>
      </aside>

      <el-form label-position="top" class="widget-config__form">
        <div class="widget-config__grid">
          <el-form-item label="部件标题" required>
            <el-input v-model.trim="form.title" />
          </el-form-item>
          <el-form-item label="部件编码" required>
            <el-input v-model.trim="form.widgetCode" :disabled="Boolean(form.id)" />
          </el-form-item>
          <el-form-item label="展示方式">
            <el-segmented
              v-model="form.widgetType"
              :options="widgetTypeOptions"
              block
              @change="handleWidgetTypeChange"
            />
          </el-form-item>
          <el-form-item label="数据来源">
            <el-select
              v-model="form.dataSourceType"
              class="w-full"
              @change="handleDataSourceChange"
            >
              <el-option label="机械手实时数据" value="RealtimeRobot" />
              <el-option label="每日状态统计" value="DailyStatistics" />
              <el-option label="故障记录" value="FaultRecords" />
              <el-option label="故障原因汇总" value="FaultSummary" />
            </el-select>
          </el-form-item>
          <el-form-item label="统计周期">
            <el-segmented v-model="form.period" :options="periodOptions" block />
          </el-form-item>
          <el-form-item label="刷新间隔">
            <el-input-number
              v-model="form.refreshSeconds"
              :min="3"
              :max="3600"
              controls-position="right"
            />
            <span class="widget-config__suffix">秒</span>
          </el-form-item>
          <el-form-item
            v-if="form.widgetType !== 'Table' || !displayConfig.autoScroll"
            label="最多显示"
          >
            <el-input-number v-model="form.topN" :min="1" :max="100" controls-position="right" />
            <span class="widget-config__suffix">项</span>
          </el-form-item>
          <el-form-item label="单个部件宽度占比">
            <el-select v-model="displayConfig.columnSpan" class="w-full">
              <el-option label="1/4 行" :value="3" />
              <el-option label="1/3 行" :value="4" />
              <el-option label="1/2 行" :value="6" />
              <el-option label="2/3 行" :value="8" />
              <el-option label="3/4 行" :value="9" />
              <el-option label="整行" :value="12" />
            </el-select>
          </el-form-item>
          <el-form-item label="部件高度占比">
            <el-segmented v-model="displayConfig.rowSpan" :options="rowSpanOptions" block />
          </el-form-item>
          <el-form-item v-if="form.widgetType === 'Table'" label="表格行高">
            <el-input-number
              v-model="displayConfig.tableRowHeight"
              :min="32"
              :max="72"
              controls-position="right"
            />
            <span class="widget-config__suffix">px</span>
          </el-form-item>
          <el-form-item v-if="form.widgetType === 'Table'" label="自动滚动">
            <el-switch v-model="displayConfig.autoScroll" />
          </el-form-item>
          <el-form-item
            v-if="form.widgetType === 'Table' && displayConfig.autoScroll"
            label="滚动间隔"
          >
            <el-input-number
              v-model="displayConfig.scrollIntervalSeconds"
              :min="1"
              :max="30"
              controls-position="right"
            />
            <span class="widget-config__suffix">秒</span>
          </el-form-item>
          <el-form-item v-if="form.widgetType === 'Bar'" label="柱状图方向">
            <el-radio-group v-model="form.orientation">
              <el-radio-button value="Vertical">纵向</el-radio-button>
              <el-radio-button value="Horizontal">横向</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>

        <div class="widget-config__field-header">
          <div><b>展示字段</b><span>字段只能从受控列表选择，保存时后端会再次校验。</span></div>
          <div class="widget-config__field-actions">
            <template v-if="form.widgetType === 'Table' && form.fields.length">
              <span :class="{ invalid: columnWidthTotal !== 100 }"
                >列宽 {{ columnWidthTotal }}%</span
              >
              <el-button plain @click="redistributeColumnWidths">均分列宽</el-button>
            </template>
            <el-select
              v-model="pendingFieldKey"
              filterable
              placeholder="选择字段后添加"
              @change="addField"
            >
              <el-option
                v-for="field in availableFields"
                :key="field.fieldKey"
                :label="field.displayName"
                :value="field.fieldKey"
              >
                <span>{{ field.displayName }}</span
                ><small>{{ field.fieldKey }}</small>
              </el-option>
            </el-select>
          </div>
        </div>

        <el-table :data="form.fields" max-height="300" border>
          <el-table-column label="字段" min-width="190">
            <template #default="{ row }">
              <div class="widget-config__field-name"
                ><b>{{ row.displayName }}</b
                ><small>{{ row.fieldKey }}</small></div
              >
            </template>
          </el-table-column>
          <el-table-column label="显示名称" min-width="150">
            <template #default="{ row }"><el-input v-model.trim="row.displayName" /></template>
          </el-table-column>
          <el-table-column v-if="form.widgetType !== 'Table'" label="图表角色" width="130">
            <template #default="{ row }">
              <el-select v-model="row.role">
                <el-option label="分类轴" value="Category" />
                <el-option label="数值" value="Value" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="聚合" width="120">
            <template #default="{ row }">
              <el-select v-model="row.aggregate">
                <el-option label="不聚合" value="None" />
                <el-option label="求和" value="Sum" />
                <el-option label="平均" value="Average" />
                <el-option label="计数" value="Count" />
                <el-option label="最大值" value="Max" />
                <el-option label="最小值" value="Min" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="单位" width="90">
            <template #default="{ row }">
              <el-select v-model="row.unit" allow-create clearable filterable placeholder="单位">
                <el-option label="秒（s）" value="s" />
                <el-option label="分钟（m）" value="m" />
                <el-option label="小时（h）" value="h" />
                <el-option label="百分比（%）" value="%" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column v-if="form.widgetType === 'Table'" label="列宽占比" width="118">
            <template #default="{ row }">
              <el-input-number v-model="row.width" :min="1" :max="100" controls-position="right" />
            </template>
          </el-table-column>
          <el-table-column v-if="form.widgetType !== 'Table'" label="颜色" width="84">
            <template #default="{ row }"><el-color-picker v-model="row.color" /></template>
          </el-table-column>
          <el-table-column label="显示" width="70">
            <template #default="{ row }">
              <el-switch v-model="row.visible" @change="handleFieldVisibilityChange" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="62" fixed="right">
            <template #default="{ $index }">
              <el-button
                :icon="Delete"
                text
                type="danger"
                title="删除字段"
                @click="removeField($index)"
              />
            </template>
          </el-table-column>
        </el-table>
      </el-form>
    </div>

    <template #footer>
      <el-button v-if="form.id" type="danger" plain :loading="deleting" @click="removeWidget"
        >删除部件</el-button
      >
      <span class="widget-config__footer-spacer" />
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :loading="saving" @click="submit">校验并保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { Delete, Plus } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    DashboardFieldCatalog,
    DashboardWidget,
    DashboardWidgetField,
    deleteDashboardWidget,
    fetchDashboardBindings,
    fetchDashboardWidgetFieldCatalog,
    fetchDashboardWidgets,
    saveDashboardWidget
  } from '@/api/edge-dashboard'
  import {
    DashboardWidgetDisplayConfig,
    mergeDashboardWidgetDisplayConfig,
    parseDashboardWidgetDisplayConfig
  } from './dashboardWidgetConfig'

  const props = defineProps<{
    modelValue: boolean
    dashboardCode: string
    lineCode: string
  }>()
  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    changed: []
  }>()

  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })
  const loading = ref(false)
  const saving = ref(false)
  const deleting = ref(false)
  const applyingChartLayout = ref(false)
  const widgets = ref<DashboardWidget[]>([])
  const catalog = ref<DashboardFieldCatalog[]>([])
  const pendingFieldKey = ref('')
  const palette = ['#20e5a3', '#38bdf8', '#ff4d67', '#f6b852', '#8b9cff', '#67d8d0']
  const displayConfig = ref<DashboardWidgetDisplayConfig>(parseDashboardWidgetDisplayConfig('{}'))
  const chartPerRow = ref(3)

  const emptyWidget = (): DashboardWidget => ({
    id: 0,
    dashboardCode: props.dashboardCode,
    lineCode: props.lineCode,
    widgetCode: `${props.lineCode.toLowerCase()}-widget-${Date.now().toString().slice(-6)}`,
    title: '新建看板部件',
    widgetType: 'Table',
    dataSourceType: 'DailyStatistics',
    period: 'Day',
    refreshSeconds: 30,
    topN: 10,
    stacked: true,
    orientation: 'Vertical',
    configJson: '{}',
    sort: (widgets.value.length + 1) * 10,
    enabled: true,
    fields: []
  })
  const form = ref<DashboardWidget>(emptyWidget())
  const widgetTypeOptions = [
    { label: '表格', value: 'Table' },
    { label: '饼图', value: 'Pie' },
    { label: '柱状图', value: 'Bar' }
  ]
  const rowSpanOptions = [
    { label: '1 行', value: 1 },
    { label: '2 行', value: 2 },
    { label: '3 行', value: 3 }
  ]
  const chartPerRowOptions = [
    { label: '1 个', value: 1 },
    { label: '2 个', value: 2 },
    { label: '3 个', value: 3 },
    { label: '4 个', value: 4 }
  ]
  const periodOptions = [
    { label: '日', value: 'Day' },
    { label: '周', value: 'Week' },
    { label: '月', value: 'Month' }
  ]

  // 列表项会被 Vue 转成响应式 Proxy，不能直接交给 structuredClone。
  const cloneWidget = (widget: DashboardWidget): DashboardWidget => ({
    ...widget,
    fields: widget.fields.map((field) => ({ ...field }))
  })

  const recommendedColumnSpan = () => {
    const count = Math.min(Math.max(widgets.value.length, 1), 3)
    return Math.floor(12 / count)
  }

  const selectWidget = (widget: DashboardWidget) => {
    form.value = cloneWidget(widget)
    displayConfig.value = parseDashboardWidgetDisplayConfig(widget.configJson)
    displayConfig.value.columnSpan ||= recommendedColumnSpan()
    if (form.value.widgetType === 'Table') ensureColumnWidths()
    pendingFieldKey.value = ''
  }

  const visibleTableFields = computed(() => form.value.fields.filter((field) => field.visible))
  const columnWidthTotal = computed(() =>
    visibleTableFields.value.reduce((total, field) => total + Number(field.width || 0), 0)
  )

  const redistributeColumnWidths = () => {
    const visibleFields = visibleTableFields.value
    if (!visibleFields.length) return
    const baseWidth = Math.floor(100 / visibleFields.length)
    let remainder = 100 - baseWidth * visibleFields.length
    for (const field of form.value.fields) {
      if (!field.visible) {
        field.width = undefined
        continue
      }
      field.width = baseWidth + (remainder > 0 ? 1 : 0)
      if (remainder > 0) remainder--
    }
  }

  function ensureColumnWidths() {
    const valid =
      visibleTableFields.value.length > 0 &&
      visibleTableFields.value.every(
        (field) => field.width != null && field.width >= 1 && field.width <= 100
      ) &&
      columnWidthTotal.value === 100
    if (!valid) redistributeColumnWidths()
  }

  const availableFields = computed(() =>
    catalog.value.filter(
      (item) =>
        item.dataSourceTypes.includes(form.value.dataSourceType) &&
        !form.value.fields.some((field) => field.fieldKey === item.fieldKey)
    )
  )

  const load = async () => {
    loading.value = true
    try {
      const [widgetRows, fieldCatalog, bindings] = await Promise.all([
        fetchDashboardWidgets(props.dashboardCode, props.lineCode),
        fetchDashboardWidgetFieldCatalog(),
        fetchDashboardBindings(props.lineCode)
      ])
      widgets.value = widgetRows
      const firstChart = widgetRows.find((item) => item.widgetType !== 'Table')
      if (firstChart) {
        const columnSpan = parseDashboardWidgetDisplayConfig(firstChart.configJson).columnSpan || 4
        chartPerRow.value = ([1, 2, 3, 4].includes(12 / columnSpan) ? 12 / columnSpan : 3) as number
      }
      const configuredFields: DashboardFieldCatalog[] = bindings.flatMap((binding) =>
        binding.fields.map((field) => ({
          fieldKey: `field:${field.fieldCode}`,
          displayName: `${field.displayName}（实时字段）`,
          valueType: field.valueType,
          dataSourceTypes: ['RealtimeRobot']
        }))
      )
      catalog.value = [
        ...fieldCatalog,
        ...configuredFields.filter(
          (field, index, all) => all.findIndex((item) => item.fieldKey === field.fieldKey) === index
        )
      ]
      selectWidget(widgetRows[0] || emptyWidget())
    } finally {
      loading.value = false
    }
  }

  const createWidget = () => {
    selectWidget(emptyWidget())
  }

  const editWidget = (widget: DashboardWidget) => {
    selectWidget(widget)
  }

  const handleDataSourceChange = () => {
    form.value.fields = []
    pendingFieldKey.value = ''
  }

  const handleWidgetTypeChange = () => {
    if (form.value.widgetType === 'Table') {
      form.value.fields.forEach((field) => (field.role = 'Column'))
      ensureColumnWidths()
    } else if (!form.value.id) {
      displayConfig.value.columnSpan = Math.floor(12 / chartPerRow.value)
    }
  }

  const applyChartLayout = async () => {
    const chartWidgets = widgets.value.filter((item) => item.widgetType !== 'Table')
    if (!chartWidgets.length) return ElMessage.warning('当前没有可调整布局的饼图或柱状图')
    const span = Math.floor(12 / chartPerRow.value)
    await ElMessageBox.confirm(
      `确定将全部 ${chartWidgets.length} 个图表设置为每行 ${chartPerRow.value} 个吗？`,
      '应用图表布局',
      { type: 'info', confirmButtonText: '应用', cancelButtonText: '取消' }
    )
    applyingChartLayout.value = true
    try {
      const savedWidgets: DashboardWidget[] = []
      for (const widget of chartWidgets) {
        const widgetDisplay = parseDashboardWidgetDisplayConfig(widget.configJson)
        savedWidgets.push(
          await saveDashboardWidget({
            ...widget,
            configJson: mergeDashboardWidgetDisplayConfig(widget.configJson, {
              ...widgetDisplay,
              columnSpan: span
            })
          })
        )
      }
      const savedMap = new Map(savedWidgets.map((item) => [item.id, item]))
      widgets.value = widgets.value.map((item) => savedMap.get(item.id) || item)
      const active = widgets.value.find((item) => item.id === form.value.id)
      if (active) selectWidget(active)
      emit('changed')
      ElMessage.success(`已将全部图表设置为每行 ${chartPerRow.value} 个`)
    } finally {
      applyingChartLayout.value = false
    }
  }

  const handleFieldVisibilityChange = () => {
    if (form.value.widgetType === 'Table') redistributeColumnWidths()
  }

  const addField = (fieldKey: string) => {
    const selected = catalog.value.find((item) => item.fieldKey === fieldKey)
    if (!selected) return
    const isNumeric = ['Number', 'Duration', 'Integer'].includes(selected.valueType)
    const field: DashboardWidgetField = {
      id: 0,
      fieldKey: selected.fieldKey,
      displayName: selected.displayName.replace('（实时字段）', ''),
      role: form.value.widgetType === 'Table' ? 'Column' : isNumeric ? 'Value' : 'Category',
      aggregate: isNumeric && form.value.widgetType !== 'Table' ? 'Sum' : 'None',
      unit: selected.valueType === 'Duration' ? 'h' : undefined,
      color: palette[form.value.fields.length % palette.length],
      sort: form.value.fields.length * 10,
      visible: true
    }
    form.value.fields.push(field)
    if (form.value.widgetType === 'Table') redistributeColumnWidths()
    pendingFieldKey.value = ''
  }

  const removeField = (index: number) => {
    form.value.fields.splice(index, 1)
    if (form.value.widgetType === 'Table') redistributeColumnWidths()
  }

  const validate = () => {
    if (!form.value.title || !form.value.widgetCode) return '部件标题和编码不能为空'
    if (!form.value.fields.length) return '至少添加一个展示字段'
    if (form.value.widgetType === 'Table' && !form.value.fields.some((item) => item.visible))
      return '表格至少需要一个可见字段'
    if (form.value.widgetType === 'Table' && columnWidthTotal.value !== 100)
      return '表格可见列的宽度占比合计必须为 100%'
    if (
      form.value.widgetType !== 'Table' &&
      !form.value.fields.some((item) => item.role === 'Value')
    )
      return '图表至少需要一个数值字段'
    if (
      form.value.widgetType === 'Bar' &&
      !form.value.fields.some((item) => item.role === 'Category')
    )
      return '柱状图至少需要一个分类字段'
    return ''
  }

  const submit = async () => {
    const error = validate()
    if (error) return ElMessage.warning(error)
    saving.value = true
    try {
      form.value.configJson = mergeDashboardWidgetDisplayConfig(
        form.value.configJson,
        displayConfig.value
      )
      const saved = await saveDashboardWidget(form.value)
      const index = widgets.value.findIndex((item) => item.id === saved.id)
      if (index >= 0) widgets.value[index] = saved
      else widgets.value.push(saved)
      selectWidget(saved)
      emit('changed')
      ElMessage.success('看板部件配置已保存')
    } finally {
      saving.value = false
    }
  }

  const removeWidget = async () => {
    await ElMessageBox.confirm('确定删除这个看板部件吗？', '删除部件', { type: 'warning' })
    deleting.value = true
    try {
      await deleteDashboardWidget(form.value.id)
      widgets.value = widgets.value.filter((item) => item.id !== form.value.id)
      selectWidget(widgets.value[0] || emptyWidget())
      emit('changed')
      ElMessage.success('看板部件已删除')
    } finally {
      deleting.value = false
    }
  }

  const widgetIcon = (type: DashboardWidget['widgetType']) =>
    ({ Table: 'ri:table-line', Pie: 'ri:pie-chart-line', Bar: 'ri:bar-chart-box-line' })[type]

  const dataSourceLabel = (type: DashboardWidget['dataSourceType']) =>
    ({
      RealtimeRobot: '机械手实时数据',
      DailyStatistics: '每日状态统计',
      FaultRecords: '故障记录',
      FaultSummary: '故障原因汇总'
    })[type]

  watch(
    () => props.modelValue,
    (open) => open && load()
  )
</script>

<style scoped lang="scss">
  .widget-config {
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr);
    gap: 18px;
    min-height: 510px;
  }

  .widget-config__list {
    padding-right: 12px;
    border-right: 1px solid var(--el-border-color-lighter);
  }

  .widget-config__chart-layout {
    display: grid;
    gap: 8px;
    padding: 14px 0;
    margin: 14px 0 6px;
    border-top: 1px solid var(--el-border-color-lighter);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .widget-config__chart-layout > b {
    font-size: 13px;
  }

  .widget-config__chart-layout > small {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.5;
  }

  .widget-config__list-item {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 8px;
    align-items: center;
    width: 100%;
    min-height: 58px;
    padding: 8px;
    margin-top: 8px;
    color: var(--el-text-color-regular);
    text-align: left;
    background: transparent;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
  }

  .widget-config__list-item.active {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
    box-shadow: inset 3px 0 0 var(--el-color-primary);
  }

  .widget-config__list-item svg {
    width: 20px;
    height: 20px;
  }

  .widget-config__list-item span,
  .widget-config__field-name {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .widget-config__list-item small,
  .widget-config__field-name small,
  .widget-config__field-header span {
    overflow: hidden;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .widget-config__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0 12px;
  }

  .widget-config__field-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 6px 0 10px;
  }

  .widget-config__field-header div {
    display: flex;
    flex-direction: column;
  }

  .widget-config__field-actions {
    display: flex !important;
    flex-direction: row !important;
    gap: 8px;
    align-items: center;
  }

  .widget-config__field-actions > span {
    flex: 0 0 auto;
    color: var(--el-color-success);
  }

  .widget-config__field-actions > span.invalid {
    color: var(--el-color-danger);
  }

  .widget-config__field-actions .el-select {
    width: 260px;
  }

  .widget-config__suffix {
    margin-left: 6px;
    color: var(--el-text-color-secondary);
  }

  .widget-config__footer-spacer {
    display: inline-block;
    width: calc(100% - 290px);
  }

  @media (width <= 900px) {
    .widget-config {
      grid-template-columns: 1fr;
    }

    .widget-config__list {
      display: none;
    }

    .widget-config__grid {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
