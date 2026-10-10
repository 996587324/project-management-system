<template>
  <div class="trace-detail-page">
    <header class="page-header">
      <div
        ><h2>设备参数详情</h2
        ><span>查看原始采样点；大数据导出由后台任务生成，不占用浏览器内存。</span></div
      >
      <div class="actions"
        ><el-button @click="router.back()">返回趋势</el-button
        ><el-button type="primary" :icon="Download" :loading="exporting" @click="createExport"
          >导出当前数据</el-button
        ></div
      >
    </header>
    <section class="filters">
      <el-date-picker
        v-model="range"
        type="datetimerange"
        value-format="YYYY-MM-DD HH:mm:ss"
        range-separator="至"
        @change="refresh"
      />
      <el-button :icon="Refresh" :loading="loading" @click="refresh">刷新</el-button>
      <span>已选择 {{ fieldIds.length }} 个参数</span>
    </section>
    <el-row :gutter="12" class="summary-row">
      <el-col v-for="item in summaries" :key="item.traceFieldId" :xs="24" :sm="12" :lg="6"
        ><el-card shadow="never"
          ><template #header>参数 #{{ item.traceFieldId }}</template
          ><p>最新值：{{ item.latestValue ?? '-' }}</p
          ><p>最小 / 最大：{{ item.minValue ?? '-' }} / {{ item.maxValue ?? '-' }}</p
          ><p>平均值：{{ item.averageValue ?? '-' }}</p
          ><p>数据点：{{ item.pointCount }}</p></el-card
        ></el-col
      >
    </el-row>
    <el-table v-loading="loading" :data="records" border height="560">
      <el-table-column prop="messageTime" label="业务时间" width="175" />
      <el-table-column prop="createTime" label="中心接收时间" width="175" />
      <el-table-column prop="displayName" label="参数" min-width="135" />
      <el-table-column label="参数值" min-width="115"
        ><template #default="{ row }"
          >{{ row.numericValue ?? row.textValue ?? '-'
          }}{{ row.unit ? ` ${row.unit}` : '' }}</template
        ></el-table-column
      >
      <el-table-column prop="sourceDeviceCode" label="来源业务设备" min-width="140" />
      <el-table-column prop="messageId" label="消息 ID" min-width="190" show-overflow-tooltip />
    </el-table>
    <div class="load-more"
      ><el-button v-if="hasMore" :loading="loadingMore" @click="loadMore">加载更多</el-button
      ><span v-else>没有更多数据</span></div
    >
    <el-alert
      v-if="exportTask"
      :title="exportTitle"
      :type="
        exportTask.status === 'Failed'
          ? 'error'
          : exportTask.status === 'Completed'
            ? 'success'
            : 'info'
      "
      :closable="false"
      show-icon
    >
      <template #default
        ><el-button
          v-if="exportTask.status === 'Completed'"
          link
          type="primary"
          @click="downloadExport"
          >下载 {{ exportTask.fileName }}</el-button
        ><span v-else
          >{{ exportTask.processedCount }} / {{ exportTask.totalCount ?? '-' }} 条</span
        ></template
      >
    </el-alert>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { Download, Refresh } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import { useUserStore } from '@/store/modules/user'
  import { downloadResponseStream } from '@/utils/file/stream-download'
  import {
    createDataTraceExport,
    fetchDataTraceDetail,
    fetchDataTraceExportTask,
    fetchDataTraceSummaries,
    getDataTraceExportFileUrl,
    type EdgeDataTraceExportTask,
    type EdgeDataTracePoint,
    type EdgeDataTraceSummary
  } from '@/api/edge-gateway'

  defineOptions({ name: 'EdgeDataTraceDetail' })
  const route = useRoute()
  const router = useRouter()
  const userStore = useUserStore()
  const parse = (value: unknown) =>
    String(value || '')
      .split(',')
      .map(Number)
      .filter(Boolean)
  const fieldIds = parse(route.query.fields)
  /** 后端和追溯库以服务器本地时间保存，不能使用会转换为 UTC 的 toISOString。 */
  const formatLocalDateTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }
  const now = () => formatLocalDateTime(new Date())
  const hourAgo = () => formatLocalDateTime(new Date(Date.now() - 3600000))
  const range = ref<[string, string]>([
    String(route.query.start || hourAgo()),
    String(route.query.end || now())
  ])
  const records = ref<EdgeDataTracePoint[]>([])
  const summaries = ref<EdgeDataTraceSummary[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasMore = ref(false)
  const cursorTime = ref<string>()
  const cursorId = ref<number>()
  const exporting = ref(false)
  const exportTask = ref<EdgeDataTraceExportTask>()
  let pollTimer: number | undefined
  const exportTitle = computed(() =>
    exportTask.value?.status === 'Completed'
      ? '导出文件已生成'
      : exportTask.value?.status === 'Failed'
        ? `导出失败：${exportTask.value.errorMessage || '-'}`
        : '正在后台生成导出文件'
  )
  const baseRequest = () => ({
    traceFieldIds: fieldIds,
    startTime: range.value[0],
    endTime: range.value[1]
  })
  const refresh = async () => {
    cursorTime.value = undefined
    cursorId.value = undefined
    loading.value = true
    try {
      const [page, stats] = await Promise.all([
        fetchDataTraceDetail({ ...baseRequest(), size: 100 }),
        fetchDataTraceSummaries(baseRequest())
      ])
      records.value = page.records
      hasMore.value = page.hasMore
      cursorTime.value = page.nextCursorTime
      cursorId.value = page.nextCursorId
      summaries.value = stats
    } finally {
      loading.value = false
    }
  }
  const loadMore = async () => {
    if (!hasMore.value) return
    loadingMore.value = true
    try {
      const page = await fetchDataTraceDetail({
        ...baseRequest(),
        size: 100,
        cursorTime: cursorTime.value,
        cursorId: cursorId.value
      })
      records.value.push(...page.records)
      hasMore.value = page.hasMore
      cursorTime.value = page.nextCursorTime
      cursorId.value = page.nextCursorId
    } finally {
      loadingMore.value = false
    }
  }
  const pollTask = () => {
    window.clearInterval(pollTimer)
    pollTimer = window.setInterval(async () => {
      if (!exportTask.value) return
      exportTask.value = await fetchDataTraceExportTask(exportTask.value.id)
      if (['Completed', 'Failed'].includes(exportTask.value.status)) window.clearInterval(pollTimer)
    }, 3000)
  }
  const createExport = async () => {
    exporting.value = true
    try {
      exportTask.value = await createDataTraceExport(baseRequest())
      ElMessage.success('导出任务已创建')
      pollTask()
    } finally {
      exporting.value = false
    }
  }
  const downloadExport = async () => {
    if (!exportTask.value) return
    const result = await downloadResponseStream({
      url: getDataTraceExportFileUrl(exportTask.value.id),
      fileName: exportTask.value.fileName || '数据追溯.csv',
      contentType: exportTask.value.fileName?.endsWith('.zip') ? 'application/zip' : 'text/csv',
      accessToken: userStore.accessToken,
      withCredentials: import.meta.env.VITE_WITH_CREDENTIALS === 'true'
    })
    if (result !== 'cancelled') ElMessage.success('文件下载已开始')
  }
  onMounted(() => {
    if (!fieldIds.length) {
      ElMessage.warning('未选择追溯参数')
      router.back()
      return
    }
    void refresh()
  })
  onBeforeUnmount(() => window.clearInterval(pollTimer))
</script>

<style scoped>
  .trace-detail-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .page-header,
  .actions,
  .filters,
  .load-more {
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
  .filters span {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .summary-row p {
    margin: 6px 0;
    font-size: 13px;
  }

  .load-more {
    justify-content: center;
    color: var(--el-text-color-secondary);
  }
</style>
