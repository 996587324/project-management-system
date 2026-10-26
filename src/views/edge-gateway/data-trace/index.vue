<template>
  <div class="data-trace-page">
    <header class="page-header">
      <div>
        <h2>数据追溯</h2>
        <span>当前保存最近 {{ setting.retentionHours }} 小时的已配置参数数据</span>
      </div>
      <div class="page-header-actions">
        <el-button :icon="Setting" @click="settingVisible = true">追溯设置</el-button>
        <el-button type="primary" :icon="Plus" @click="openRuleDialog()">追溯规则管理</el-button>
        <el-button :icon="Refresh" :loading="loading" @click="reload">刷新</el-button>
      </div>
    </header>

    <el-alert
      v-if="!setting.enabled"
      title="数据追溯当前已停用"
      description="新的参数点不会保存；已有数据会在保留时长到期后自动清理。"
      type="warning"
      :closable="false"
      show-icon
    />

    <section class="trace-workspace">
      <aside class="trace-tree-card">
        <div class="panel-title"
          ><strong>设备参数</strong><span>勾选参数绘制曲线，双击进入详情</span></div
        >
        <el-tree
          ref="treeRef"
          v-loading="treeLoading"
          :data="tree"
          node-key="key"
          show-checkbox
          :props="treeProps"
          :check-strictly="false"
          default-expand-all
          @check="handleTreeCheck"
          @node-dblclick="openNodeDetail"
        >
          <template #default="{ data }">
            <span class="trace-node">
              <span>{{ data.label }}</span>
              <small v-if="data.nodeType === 'Field'">
                {{ data.latestValue ?? '-' }}{{ data.unit ? ` ${data.unit}` : '' }}
              </small>
            </span>
          </template>
        </el-tree>
      </aside>

      <main class="trace-chart-card">
        <div class="chart-toolbar">
          <el-radio-group v-model="quickRange" size="small" @change="applyQuickRange">
            <el-radio-button label="15m">15 分钟</el-radio-button>
            <el-radio-button label="1h">1 小时</el-radio-button>
            <el-radio-button label="3h">3 小时</el-radio-button>
            <el-radio-button label="all">全部</el-radio-button>
          </el-radio-group>
          <el-date-picker
            v-model="range"
            class="range-picker"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            range-separator="至"
            :disabled-date="disableOutOfRetention"
            @change="loadTrend"
          />
          <el-button
            :disabled="selectedFieldIds.length === 0"
            @click="openDetail(selectedFieldIds)"
          >
            查看详情
          </el-button>
        </div>
        <el-empty v-if="selectedFieldIds.length === 0" description="请从左侧勾选一个或多个参数" />
        <div v-else v-loading="chartLoading" class="trace-chart-list">
          <section v-for="group in chartGroups" :key="group.key" class="trace-unit-chart">
            <div class="chart-unit-title">{{ group.label }}</div>
            <div :ref="(element) => setChartRef(group.key, element)" class="trace-chart" />
          </section>
        </div>
      </main>
    </section>

    <el-dialog v-model="settingVisible" title="追溯设置" width="460px" append-to-body>
      <el-form label-width="115px">
        <el-form-item label="启用数据追溯"
          ><el-switch v-model="settingDraft.enabled"
        /></el-form-item>
        <el-form-item label="保留时长">
          <el-input-number v-model="settingDraft.retentionHours" :min="1" :max="168" />
          <span class="form-suffix">小时（超期数据每 5 分钟清理）</span>
        </el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="settingVisible = false">取消</el-button
        ><el-button type="primary" @click="saveSetting">保存</el-button></template
      >
    </el-dialog>

    <el-dialog v-model="ruleVisible" title="追溯规则管理" width="980px" append-to-body>
      <div class="rule-toolbar"
        ><el-button type="primary" :icon="Plus" @click="createRule">新增规则</el-button></div
      >
      <el-table :data="rules" border>
        <el-table-column prop="ruleName" label="规则名称" min-width="150" />
        <el-table-column prop="edgeDeviceName" label="边缘设备" min-width="120" />
        <el-table-column prop="sourceId" label="数据源" min-width="120" />
        <el-table-column label="来源业务设备" min-width="170"
          ><template #default="{ row }">{{
            row.sourceDeviceName || row.sourceDeviceCode
          }}</template></el-table-column
        >
        <el-table-column label="参数" min-width="230"
          ><template #default="{ row }">{{
            row.fields.map((field: EdgeDataTraceField) => field.displayName).join('、')
          }}</template></el-table-column
        >
        <el-table-column label="状态" width="85"
          ><template #default="{ row }"
            ><el-tag :type="row.enabled ? 'success' : 'info'">{{
              row.enabled ? '启用' : '停用'
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="操作" width="150" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="editRule(row as EdgeDataTraceRule)"
              >编辑</el-button
            ><el-button link type="danger" @click="removeRule(row as EdgeDataTraceRule)"
              >删除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
    </el-dialog>

    <el-dialog
      v-model="ruleEditorVisible"
      :title="ruleDraft.id ? '编辑追溯规则' : '新增追溯规则'"
      width="720px"
      append-to-body
    >
      <el-form label-width="115px">
        <el-form-item label="规则名称"><el-input v-model.trim="ruleDraft.ruleName" /></el-form-item>
        <el-form-item label="模型 / 来源设备">
          <SourceTreeSelect
            :model-value="{
              sourceKey: ruleDraft.sourceId,
              deviceKey: ruleGatewayCode,
              sourceDeviceCode: ruleDraft.sourceDeviceCode
            }"
            kind="Edge"
            purpose="trace"
            @change="selectTraceDevice"
            @resolved="loadTraceParameters"
          />
        </el-form-item>
        <el-form-item label="追溯参数">
          <el-select
            v-model="fieldCodes"
            multiple
            filterable
            class="wide-select"
            @change="syncFields"
          >
            <el-option
              v-for="item in availableParameters"
              :key="item.parameterName"
              :label="item.parameterNameCn || item.parameterName"
              :value="item.parameterName"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="启用状态"><el-switch v-model="ruleDraft.enabled" /></el-form-item>
        <el-form-item label="备注"
          ><el-input v-model.trim="ruleDraft.remark" type="textarea"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="ruleEditorVisible = false">取消</el-button
        ><el-button type="primary" @click="saveRule">保存</el-button></template
      >
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
    type ComponentPublicInstance
  } from 'vue'
  import SourceTreeSelect from '@/components/business/source-tree-select/index.vue'
  import type { CatalogDevice } from '@/api/source-catalog'
  import { useRouter } from 'vue-router'
  import { Plus, Refresh, Setting } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox, type ElTree } from 'element-plus'
  import { echarts, type EChartsOption } from '@/plugins/echarts'
  import { useBusinessChartTheme } from '@/hooks/core/useBusinessChartTheme'
  import {
    deleteDataTraceRule,
    fetchDataTraceRules,
    fetchDataTraceSetting,
    fetchDataTraceTree,
    fetchDataTraceTrend,
    fetchWebSocketSubscriptions,
    saveDataTraceRule,
    saveDataTraceSetting,
    type EdgeDataTraceField,
    type EdgeDataTraceRule,
    type EdgeDataTraceTreeNode,
    type EdgeDataTraceTrendSeries,
    type EdgeWebSocketSubscriptionDevice
  } from '@/api/edge-gateway'

  defineOptions({ name: 'EdgeDataTrace' })

  const router = useRouter()
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const chartRefs = new Map<string, HTMLElement>()
  const charts = new Map<string, echarts.ECharts>()
  const { applyTheme } = useBusinessChartTheme()
  const tree = ref<EdgeDataTraceTreeNode[]>([])
  const rules = ref<EdgeDataTraceRule[]>([])
  const ruleGatewayCode = ref('')
  let parameterRevision = 0
  const subscriptionDevices = ref<EdgeWebSocketSubscriptionDevice[]>([])
  const treeLoading = ref(false)
  const chartLoading = ref(false)
  const loading = ref(false)
  const selectedFieldIds = ref<number[]>([])
  const trendSeries = ref<EdgeDataTraceTrendSeries[]>([])
  const quickRange = ref('1h')
  const settingVisible = ref(false)
  const ruleVisible = ref(false)
  const ruleEditorVisible = ref(false)
  const setting = reactive({ retentionHours: 5, enabled: true })
  const settingDraft = reactive({ retentionHours: 5, enabled: true })
  /** 后端和追溯库以服务器本地时间保存，不能使用会转换为 UTC 的 toISOString。 */
  const formatLocalDateTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }
  const nowText = () => formatLocalDateTime(new Date())
  const beforeText = (hours: number) => formatLocalDateTime(new Date(Date.now() - hours * 3600000))
  const range = ref<[string, string]>([beforeText(1), nowText()])
  const treeProps = { label: 'label', children: 'children' }
  const ruleDraft = reactive<
    Omit<EdgeDataTraceRule, 'edgeDeviceCode' | 'edgeDeviceName'> & { sourceDeviceName?: string }
  >({
    id: 0,
    ruleName: '',
    sourceType: 'WebSocket',
    edgeDeviceId: 0,
    sourceId: '',
    sourceDeviceCode: '',
    sourceDeviceName: '',
    enabled: true,
    remark: '',
    fields: []
  })
  const fieldCodes = ref<string[]>([])
  const selectedBusinessDevice = computed(() =>
    subscriptionDevices.value.find((item) => item.deviceCode === ruleDraft.sourceDeviceCode)
  )
  const availableParameters = computed(() => selectedBusinessDevice.value?.parameters || [])
  const chartGroups = computed(() => {
    const groups = new Map<string, EdgeDataTraceTrendSeries[]>()
    for (const item of trendSeries.value) {
      const unit = item.unit?.trim() || '无单位'
      const values = groups.get(unit) || []
      values.push(item)
      groups.set(unit, values)
    }
    return [...groups.entries()].map(([unit, series]) => ({
      key: unit,
      label: `单位：${unit}`,
      series
    }))
  })

  const disableOutOfRetention = (date: Date) =>
    date.getTime() < Date.now() - setting.retentionHours * 3600000 || date.getTime() > Date.now()

  const reload = async () => {
    loading.value = true
    try {
      const [settingData, rulesData, treeData] = await Promise.all([
        fetchDataTraceSetting(),
        fetchDataTraceRules(),
        fetchDataTraceTree()
      ])
      Object.assign(setting, settingData)
      Object.assign(settingDraft, settingData)
      rules.value = rulesData
      tree.value = treeData
      await nextTick()
      if (selectedFieldIds.value.length) await loadTrend()
    } finally {
      loading.value = false
    }
  }

  const handleTreeCheck = () => {
    const ids = (treeRef.value?.getCheckedNodes(false, true) || [])
      .map((item) => Number((item as EdgeDataTraceTreeNode).traceFieldId))
      .filter(Boolean)
    selectedFieldIds.value = ids.slice(0, 10)
    if (ids.length > 10) {
      ElMessage.warning('一次最多展示 10 个参数')
      treeRef.value?.setCheckedKeys(selectedFieldIds.value.map((id) => `field:${id}`))
    }
  }

  const applyQuickRange = (value: string | number | boolean | undefined) => {
    const hour =
      value === '15m' ? 0.25 : value === '1h' ? 1 : value === '3h' ? 3 : setting.retentionHours
    range.value = [beforeText(hour), nowText()]
    void loadTrend()
  }

  const loadTrend = async () => {
    if (!selectedFieldIds.value.length || !range.value?.[0] || !range.value?.[1]) return
    chartLoading.value = true
    try {
      const series = await fetchDataTraceTrend({
        traceFieldIds: selectedFieldIds.value,
        startTime: range.value[0],
        endTime: range.value[1],
        maxPointsPerSeries: 1000
      })
      trendSeries.value = series
      await nextTick()
      renderCharts()
    } finally {
      chartLoading.value = false
    }
  }

  const setChartRef = (key: string, element: Element | ComponentPublicInstance | null) => {
    if (element instanceof HTMLElement) chartRefs.set(key, element)
    else chartRefs.delete(key)
  }
  const renderCharts = () => {
    const activeKeys = new Set(chartGroups.value.map((group) => group.key))
    for (const [key, chart] of charts) {
      if (!activeKeys.has(key)) {
        chart.dispose()
        charts.delete(key)
      }
    }
    for (const group of chartGroups.value) {
      const element = chartRefs.get(group.key)
      if (!element) continue
      const chart = charts.get(group.key) || echarts.init(element)
      charts.set(group.key, chart)
      chart.off('dblclick')
      const option: EChartsOption = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { type: 'scroll', top: 4 },
        grid: { top: 52, left: 52, right: 28, bottom: 72 },
        toolbox: { right: 14, feature: { dataZoom: { yAxisIndex: 'none' }, restore: {} } },
        xAxis: { type: 'time' },
        yAxis: { type: 'value', name: group.key === '无单位' ? undefined : group.key, scale: true },
        dataZoom: [
          { type: 'inside', zoomOnMouseWheel: true, moveOnMouseMove: true },
          { type: 'slider', bottom: 16 }
        ],
        series: group.series.map((item) => ({
          id: String(item.traceFieldId),
          name: item.name,
          type: 'line',
          showSymbol: false,
          smooth: false,
          connectNulls: false,
          data: item.points.map((point) => [point.time, point.numericValue ?? point.textValue])
        }))
      }
      chart.setOption(option, true)
      applyTheme(chart)
      chart.on('dblclick', (params: { seriesId?: string }) => {
        const id = Number(params.seriesId)
        if (id) openDetail([id])
      })
    }
  }

  const collectFieldIds = (node: EdgeDataTraceTreeNode): number[] =>
    node.nodeType === 'Field' && node.traceFieldId
      ? [node.traceFieldId]
      : node.children.flatMap(collectFieldIds)
  const openNodeDetail = (data: EdgeDataTraceTreeNode) => openDetail(collectFieldIds(data))
  const openDetail = (ids: number[]) => {
    if (!ids.length) return
    router.push({
      name: 'EdgeDataTraceDetail',
      query: { fields: ids.join(','), start: range.value[0], end: range.value[1] }
    })
  }

  const loadTraceParameters = async (source: CatalogDevice) => {
    const current = ++parameterRevision
    subscriptionDevices.value = []
    const records = await fetchWebSocketSubscriptions(source.connectionId)
    if (current === parameterRevision) subscriptionDevices.value = records
  }

  const selectTraceDevice = async (source: CatalogDevice) => {
    if (
      ruleGatewayCode.value === source.deviceKey &&
      ruleDraft.sourceId === source.sourceKey &&
      ruleDraft.sourceDeviceCode === source.sourceDeviceCode
    )
      return
    ruleGatewayCode.value = source.deviceKey
    ruleDraft.edgeDeviceId = source.gatewayId
    ruleDraft.sourceId = source.sourceKey
    ruleDraft.sourceDeviceCode = source.sourceDeviceCode || ''
    ruleDraft.sourceDeviceName = source.deviceName
    fieldCodes.value = []
    ruleDraft.fields = []
    await loadTraceParameters(source)
  }

  const syncFields = () => {
    ruleDraft.fields = fieldCodes.value.map((code, index) => {
      const parameter = availableParameters.value.find((item) => item.parameterName === code)
      const existing = ruleDraft.fields.find((item) => item.fieldCode === code)
      return {
        id: existing?.id || 0,
        fieldCode: code,
        displayName: parameter?.parameterNameCn || code,
        valueType: parameter?.dataType || 'Number',
        unit: existing?.unit,
        decimalPlaces: existing?.decimalPlaces ?? 2,
        stateMappingJson: existing?.stateMappingJson,
        enabled: true,
        sort: index
      }
    })
  }
  const createRule = () => {
    Object.assign(ruleDraft, {
      id: 0,
      ruleName: '',
      sourceType: 'WebSocket',
      edgeDeviceId: 0,
      sourceId: '',
      sourceDeviceCode: '',
      sourceDeviceName: '',
      enabled: true,
      remark: '',
      fields: []
    })
    ruleGatewayCode.value = ''
    subscriptionDevices.value = []
    parameterRevision++
    fieldCodes.value = []
    ruleEditorVisible.value = true
  }
  const openRuleDialog = async () => {
    ruleVisible.value = true
    rules.value = await fetchDataTraceRules()
  }
  const editRule = async (row: EdgeDataTraceRule) => {
    Object.assign(ruleDraft, JSON.parse(JSON.stringify(row)))
    ruleGatewayCode.value = row.edgeDeviceCode
    subscriptionDevices.value = []
    parameterRevision++
    fieldCodes.value = row.fields.map((field) => field.fieldCode)
    ruleDraft.fields = JSON.parse(JSON.stringify(row.fields))
    ruleEditorVisible.value = true
  }
  const saveRule = async () => {
    syncFields()
    await saveDataTraceRule(ruleDraft)
    ElMessage.success('追溯规则已保存')
    ruleEditorVisible.value = false
    rules.value = await fetchDataTraceRules()
    tree.value = await fetchDataTraceTree()
  }
  const removeRule = async (row: EdgeDataTraceRule) => {
    await ElMessageBox.confirm(`确定删除追溯规则“${row.ruleName}”吗？`, '删除确认', {
      type: 'warning'
    })
    await deleteDataTraceRule(row.id)
    ElMessage.success('规则已删除')
    rules.value = await fetchDataTraceRules()
    tree.value = await fetchDataTraceTree()
  }
  const saveSetting = async () => {
    const result = await saveDataTraceSetting(settingDraft)
    Object.assign(setting, result)
    settingVisible.value = false
    ElMessage.success('追溯设置已保存')
  }
  const resizeCharts = () => charts.forEach((chart) => chart.resize())
  watch(selectedFieldIds, () => void loadTrend())
  onMounted(() => {
    void reload()
    window.addEventListener('resize', resizeCharts)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', resizeCharts)
    charts.forEach((chart) => chart.dispose())
    charts.clear()
  })
</script>

<style scoped>
  .data-trace-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
  }

  .page-header,
  .page-header-actions,
  .chart-toolbar,
  .rule-toolbar {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .page-header {
    justify-content: space-between;
  }

  .page-header h2 {
    margin: 0 0 4px;
  }

  .page-header span,
  .panel-title span {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .trace-workspace {
    display: grid;
    grid-template-columns: minmax(270px, 320px) minmax(0, 1fr);
    gap: 16px;
    min-height: 650px;
  }

  .trace-tree-card,
  .trace-chart-card {
    padding: 16px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--business-radius);
    box-shadow: var(--business-card-shadow);
  }

  .panel-title {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .trace-node {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    width: 100%;
    overflow: hidden;
  }

  .trace-node small {
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  .trace-chart-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .chart-toolbar {
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .range-picker {
    width: 380px;
  }

  .trace-chart-list {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 16px;
    min-height: 560px;
  }

  .trace-unit-chart {
    min-height: 360px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .chart-unit-title {
    padding: 10px 14px 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .trace-chart {
    height: 330px;
  }

  .form-suffix {
    margin-left: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .wide-select {
    width: 100%;
  }

  .rule-toolbar {
    justify-content: flex-end;
    margin-bottom: 12px;
  }

  @media (width <= 960px) {
    .trace-workspace {
      grid-template-columns: 1fr;
    }

    .range-picker {
      width: 100%;
    }
  }
</style>
