<template>
  <el-dialog
    v-model="visible"
    title="看板日报导出"
    width="min(920px, 94vw)"
    destroy-on-close
    append-to-body
  >
    <div v-loading="loading" class="dashboard-export-dialog">
      <el-form label-position="top" class="dashboard-export-dialog__form">
        <el-form-item label="每日定时导出">
          <el-switch v-model="setting.enabled" />
        </el-form-item>
        <el-form-item label="执行时间">
          <el-time-picker
            v-model="setting.exportTime"
            format="HH:mm"
            value-format="HH:mm"
            :disabled="!setting.enabled"
            class="w-full"
          />
        </el-form-item>
        <el-form-item label="统计日期">
          <el-segmented
            v-model="setting.exportDayOffset"
            :options="dayOffsetOptions"
            :disabled="!setting.enabled"
            block
          />
        </el-form-item>
        <el-form-item label="下次执行">
          <el-input :model-value="nextRunText" disabled />
        </el-form-item>
      </el-form>

      <div class="dashboard-export-dialog__history-header">
        <b>定时导出记录</b>
        <el-button :icon="Refresh" text title="刷新记录" @click="loadRecords()" />
      </div>
      <el-table :data="records" border max-height="330" empty-text="暂无定时导出记录">
        <el-table-column prop="lineName" label="线体" min-width="130">
          <template #default="{ row }">
            <b>{{ row.lineName || row.lineCode }}</b>
            <small>{{ row.lineCode }}</small>
          </template>
        </el-table-column>
        <el-table-column label="统计日期" width="120">
          <template #default="{ row }">{{ formatDate(row.reportDate) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="96" align="center">
          <template #default="{ row }">
            <el-tooltip :content="row.errorMessage || statusLabel(row.status)" placement="top">
              <el-tag :type="statusType(row.status)" effect="plain">
                {{ statusLabel(row.status) }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="文件大小" width="105" align="right">
          <template #default="{ row }">{{ formatBytes(row.fileSize) }}</template>
        </el-table-column>
        <el-table-column label="完成时间" min-width="168">
          <template #default="{ row }">{{ formatDateTime(row.completeTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="70" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              :icon="Download"
              text
              type="primary"
              title="下载日报"
              :disabled="row.status !== 'Success'"
              :loading="downloadingId === row.id"
              @click="downloadRecord(row)"
            />
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-if="total > pageSize"
        v-model:current-page="currentPage"
        class="dashboard-export-dialog__pagination"
        background
        layout="prev, pager, next"
        :page-size="pageSize"
        :total="total"
        @current-change="loadRecords"
      />
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :loading="saving" @click="saveSetting">保存配置</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { Download, Refresh } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import {
    DashboardExportRecord,
    DashboardExportSetting,
    fetchDashboardExportRecords,
    fetchDashboardExportSetting,
    getDashboardExportRecordFileUrl,
    saveDashboardExportSetting
  } from '@/api/edge-dashboard'
  import { useUserStore } from '@/store/modules/user'
  import { downloadResponseStream } from '@/utils/file/stream-download'

  const props = defineProps<{
    modelValue: boolean
    dashboardCode: string
  }>()
  const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
  const userStore = useUserStore()
  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })
  const createSetting = (): DashboardExportSetting => ({
    id: 0,
    dashboardCode: props.dashboardCode,
    enabled: false,
    exportTime: '00:10',
    exportDayOffset: 1
  })
  const setting = ref<DashboardExportSetting>(createSetting())
  const records = ref<DashboardExportRecord[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const downloadingId = ref<number | null>(null)
  const currentPage = ref(1)
  const pageSize = 20
  const total = ref(0)
  const dayOffsetOptions = [
    { label: '前一天', value: 1 },
    { label: '当天', value: 0 }
  ]
  const nextRunText = computed(() =>
    setting.value.enabled
      ? formatDateTime(setting.value.nextScheduledRunTime) || '保存后计算'
      : '未启用'
  )

  const loadRecords = async (page = currentPage.value) => {
    currentPage.value = page
    const result = await fetchDashboardExportRecords({
      current: page,
      size: pageSize,
      dashboardCode: props.dashboardCode
    })
    records.value = result.records
    total.value = result.total
  }

  const load = async () => {
    loading.value = true
    try {
      const [settingResult] = await Promise.all([
        fetchDashboardExportSetting(props.dashboardCode),
        loadRecords(1)
      ])
      setting.value = settingResult
    } finally {
      loading.value = false
    }
  }

  const saveSetting = async () => {
    saving.value = true
    try {
      setting.value = await saveDashboardExportSetting({
        dashboardCode: props.dashboardCode,
        enabled: setting.value.enabled,
        exportTime: setting.value.exportTime,
        exportDayOffset: setting.value.exportDayOffset,
        updatedBy: userStore.info.userName
      })
      await loadRecords(1)
    } finally {
      saving.value = false
    }
  }

  const downloadRecord = async (tableRow: object) => {
    const record = tableRow as DashboardExportRecord
    if (record.status !== 'Success' || downloadingId.value) return
    downloadingId.value = record.id
    try {
      const result = await downloadResponseStream({
        url: getDashboardExportRecordFileUrl(record.id),
        fileName: record.fileName,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        accessToken: userStore.accessToken,
        withCredentials: import.meta.env.VITE_WITH_CREDENTIALS === 'true'
      })
      if (result === 'completed') ElMessage.success('日报下载完成')
      if (result === 'started') ElMessage.success('日报已开始下载')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '日报下载失败')
    } finally {
      downloadingId.value = null
    }
  }

  const statusLabel = (status: DashboardExportRecord['status']) =>
    ({ Pending: '生成中', Success: '成功', Failed: '失败' })[status] || status
  const statusType = (status: DashboardExportRecord['status']) =>
    status === 'Success' ? 'success' : status === 'Failed' ? 'danger' : 'warning'
  const formatDate = (value?: string) => (value ? value.slice(0, 10) : '-')
  const formatDateTime = (value?: string) =>
    value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : ''
  const formatBytes = (value: number) => {
    if (!value) return '-'
    if (value < 1024) return `${value} B`
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
    return `${(value / 1024 / 1024).toFixed(1)} MB`
  }

  watch(visible, (opened) => opened && load())
</script>

<style scoped lang="scss">
  .dashboard-export-dialog {
    display: grid;
    gap: 16px;

    &__form {
      display: grid;
      grid-template-columns: 110px minmax(150px, 0.8fr) minmax(220px, 1fr) minmax(210px, 1fr);
      gap: 14px;
      align-items: end;
    }

    &__form :deep(.el-form-item) {
      margin-bottom: 0;
    }

    &__history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 4px;
      border-top: 1px solid var(--el-border-color-lighter);
    }

    &__pagination {
      justify-content: flex-end;
    }

    :deep(.el-table small) {
      display: block;
      margin-top: 2px;
      color: var(--el-text-color-secondary);
    }
  }

  @media (width <= 760px) {
    .dashboard-export-dialog__form {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
