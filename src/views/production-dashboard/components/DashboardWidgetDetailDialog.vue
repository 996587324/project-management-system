<template>
  <el-dialog
    v-model="visible"
    :title="widget ? `${widget.title} · 明细数据` : '图表明细数据'"
    width="min(1180px, 96vw)"
    top="5vh"
    append-to-body
    destroy-on-close
  >
    <template v-if="widget">
      <div class="detail-toolbar">
        <div>
          <el-tag effect="plain">{{ sourceLabel }}</el-tag>
          <span>{{ widget.period === 'Day' ? '今日' : widget.period === 'Week' ? '近 7 日' : '近 30 日' }}</span>
        </div>
        <div class="detail-toolbar__actions">
          <el-date-picker
            v-if="widget.dataSourceType !== 'RealtimeRobot'"
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :clearable="false"
            @change="load"
          />
          <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
          <el-button type="primary" :icon="Download" :disabled="!rows.length" @click="exportCsv"
            >导出 CSV</el-button
          >
        </div>
      </div>

      <el-table v-loading="loading" :data="rows" border stripe max-height="560" empty-text="当前条件暂无数据">
        <el-table-column
          v-for="field in visibleFields"
          :key="field.fieldKey"
          :label="field.displayName"
          min-width="140"
          show-overflow-tooltip
        >
          <template #default="{ row }">{{ formatValue(row, field) }}</template>
        </el-table-column>
      </el-table>
      <div class="detail-footer">共 {{ rows.length }} 条数据，导出范围与当前明细一致。</div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { Download, Refresh } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import {
    DashboardWidget,
    DashboardWidgetField,
    fetchDashboardDailyStatistics,
    fetchDashboardFaultRecords,
    fetchDashboardFaultSummary,
    fetchDashboardRuntime
  } from '@/api/edge-dashboard'

  const props = withDefaults(
    defineProps<{
      modelValue: boolean
      widget?: DashboardWidget
      lineCode: string
      publicAccess?: boolean
    }>(),
    { publicAccess: false }
  )
  const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })
  const rows = ref<Record<string, unknown>[]>([])
  const loading = ref(false)
  const dateRange = ref<[string, string]>(['', ''])
  const visibleFields = computed(() =>
    (props.widget?.fields || []).filter((field) => field.visible).sort((a, b) => a.sort - b.sort)
  )
  const sourceLabel = computed(
    () =>
      ({
        RealtimeRobot: '机械手实时数据',
        DailyStatistics: '每日状态统计',
        FaultRecords: '故障记录',
        FaultSummary: '故障原因汇总'
      })[props.widget?.dataSourceType || 'DailyStatistics']
  )

  const defaultDateRange = () => {
    const end = new Date()
    const start = new Date(end)
    const period = props.widget?.period || 'Day'
    start.setDate(end.getDate() - ({ Day: 0, Week: 6, Month: 29 })[period])
    const format = (date: Date) =>
      `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`
    return [format(start), format(end)] as [string, string]
  }

  const load = async () => {
    const widget = props.widget
    if (!widget) return
    loading.value = true
    try {
      if (widget.dataSourceType === 'RealtimeRobot') {
        const runtime = await fetchDashboardRuntime(props.lineCode, props.publicAccess)
        rows.value = runtime.robots.map((robot) => ({
          bindingId: robot.bindingId,
          lineCode: robot.lineCode,
          robotCode: robot.robotCode,
          robotName: robot.robotName,
          deviceMark: robot.deviceMark,
          status: robot.status,
          dataOnline: robot.dataOnline,
          receiveTime: robot.receiveTime,
          ...Object.fromEntries(robot.fields.map((field) => [`field:${field.fieldCode}`, field.displayValue]))
        }))
        return
      }

      const [dateFrom, dateTo] = dateRange.value
      if (widget.dataSourceType === 'DailyStatistics') {
        const result = await fetchDashboardDailyStatistics(
          { current: 1, size: 500, lineCode: props.lineCode, dateFrom, dateTo },
          props.publicAccess
        )
        rows.value = result.records as unknown as Record<string, unknown>[]
        return
      }
      if (widget.dataSourceType === 'FaultRecords') {
        const result = await fetchDashboardFaultRecords(
          { current: 1, size: 1000, lineCode: props.lineCode, dateFrom, dateTo },
          props.publicAccess
        )
        rows.value = result.records as unknown as Record<string, unknown>[]
        return
      }
      rows.value = (await fetchDashboardFaultSummary(
        { lineCode: props.lineCode, topN: 500, dateFrom, dateTo },
        props.publicAccess
      )) as unknown as Record<string, unknown>[]
    } catch {
      rows.value = []
      ElMessage.error('明细数据加载失败，请稍后重试')
    } finally {
      loading.value = false
    }
  }

  const formatValue = (row: Record<string, unknown>, field: DashboardWidgetField) => {
    const value = row[field.fieldKey]
    if (value == null || value === '') return '-'
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return String(value)
    const decimals = field.decimals ?? (field.unit === '%' ? 1 : 0)
    const formatted = numeric.toLocaleString('zh-CN', { maximumFractionDigits: decimals })
    return field.unit ? `${formatted}${field.unit}` : formatted
  }

  const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const exportCsv = () => {
    const fields = visibleFields.value
    if (!fields.length || !rows.value.length) return
    const lines = [
      fields.map((field) => csvCell(field.displayName)).join(','),
      ...rows.value.map((row) => fields.map((field) => csvCell(formatValue(row, field))).join(','))
    ]
    const blob = new Blob([`\ufeff${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${props.widget?.title || '看板明细'}_${dateRange.value.join('_') || '实时数据'}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  watch(
    () => [props.modelValue, props.widget?.id, props.lineCode],
    ([open]) => {
      if (!open) return
      dateRange.value = defaultDateRange()
      load()
    }
  )
</script>

<style scoped>
  .detail-toolbar,
  .detail-toolbar > div,
  .detail-toolbar__actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .detail-toolbar {
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .detail-toolbar > div:first-child {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .detail-footer {
    padding-top: 12px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    text-align: right;
  }

  @media (max-width: 760px) {
    .detail-toolbar,
    .detail-toolbar__actions {
      flex-wrap: wrap;
    }

    .detail-toolbar {
      align-items: flex-start;
    }
  }
</style>
