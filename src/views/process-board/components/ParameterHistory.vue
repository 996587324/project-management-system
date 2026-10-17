<template>
  <el-dialog
    v-model="visible"
    :title="`${name} · 参数详细数据`"
    width="min(1180px, 96vw)"
    destroy-on-close
  >
    <div class="history-toolbar">
      <el-date-picker
        v-model="range"
        type="datetimerange"
        value-format="YYYY-MM-DD HH:mm:ss"
        start-placeholder="开始时间"
        end-placeholder="结束时间"
      />
      <el-radio-group v-model="events" @change="query"
        ><el-radio-button :value="false">采样明细</el-radio-button
        ><el-radio-button :value="true">变化 / 越界事件</el-radio-button></el-radio-group
      >
      <el-button @click="query">查询</el-button>
      <el-button :loading="exporting" @click="exportData">导出查询范围</el-button>
    </div>
    <el-table :data="records" v-loading="loading" border max-height="520">
      <el-table-column prop="createTime" label="采样时间" width="185" />
      <el-table-column label="数据时间" width="185"
        ><template #default="{ row }">{{
          runtimeOf(row).dataTime || '—'
        }}</template></el-table-column
      >
      <el-table-column label="原始值" min-width="130"
        ><template #default="{ row }">{{
          display(runtimeOf(row).rawJson)
        }}</template></el-table-column
      >
      <el-table-column label="展示值" min-width="130"
        ><template #default="{ row }">{{
          display(runtimeOf(row).valueJson)
        }}</template></el-table-column
      >
      <el-table-column prop="version" label="配置版本" width="100" />
      <el-table-column v-if="events" prop="eventType" label="事件" width="150" />
      <el-table-column label="计算异常" min-width="180"
        ><template #default="{ row }">{{ runtimeOf(row).error || '—' }}</template></el-table-column
      >
    </el-table>
    <el-pagination
      v-model:current-page="page"
      :page-size="50"
      :total="total"
      layout="total, prev, pager, next"
      @current-change="load"
    />
    <div v-for="job in exportJobs" :key="job.id" class="export-job">
      <span>导出 #{{ job.id }} · {{ job.status }} {{ job.error || '' }}</span>
      <el-button @click="refreshJob(job.id)">更新进度</el-button>
      <el-button v-if="job.status === 'Ready'" @click="download(job.id)">下载 CSV</el-button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import {
    processApi,
    parseValue,
    type FieldRuntime,
    type HistoryRecord
  } from '@/api/process-board'
  import { getApiUrl } from '@/utils/runtime-config'
  import { useUserStore } from '@/store/modules/user'
  import { downloadResponseStream } from '@/utils/file/stream-download'

  const visible = defineModel<boolean>({ required: true })
  const props = defineProps<{ cardId: number; fieldCode: string; name: string }>()
  const range = ref<[string, string]>(defaultRange())
  const events = ref(false)
  const records = ref<HistoryRecord[]>([])
  const page = ref(1)
  const total = ref(0)
  const loading = ref(false)
  const exporting = ref(false)
  let revision = 0

  function localTime(date: Date) {
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  function defaultRange(): [string, string] {
    return [localTime(new Date(Date.now() - 5 * 3600000)), localTime(new Date())]
  }

  function parameters() {
    return {
      cardId: props.cardId,
      fieldCode: props.fieldCode,
      start: range.value[0],
      end: range.value[1],
      events: events.value
    }
  }

  function runtimeOf(row: Record<string, unknown>) {
    // 后端保存的是原始 C# JSON；历史数据只在这里做大小写兼容，不重新执行公式。
    const value = JSON.parse(String(row.runtimeJson)) as Record<string, unknown>
    return {
      rawJson: String(value.RawJson ?? value.rawJson ?? 'null'),
      valueJson: String(value.ValueJson ?? value.valueJson ?? 'null'),
      dataTime: String(value.DataTime ?? value.dataTime ?? ''),
      error: String(value.Error ?? value.error ?? '')
    } as FieldRuntime
  }

  function display(json: string) {
    const value = parseValue(json)
    return value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  }

  async function load() {
    if (!range.value?.length) return
    const current = ++revision
    loading.value = true
    try {
      const result = await processApi.history({ ...parameters(), page: page.value, size: 50 })
      if (current !== revision) return
      records.value = result.records
      total.value = result.total
    } finally {
      if (current === revision) loading.value = false
    }
  }

  function query() {
    page.value = 1
    load()
  }

  async function exportData() {
    if (!range.value?.length) return
    exporting.value = true
    try {
      const job = await processApi.createExport(parameters())
      ElMessage.success('导出任务已创建，文件完成后可下载')
      exportJobs.value.push(job)
    } finally {
      exporting.value = false
    }
  }

  const exportJobs = ref<{ id: number; status: string; error?: string }[]>([])
  async function refreshJob(id: number) {
    const result = await processApi.exportStatus(id)
    exportJobs.value = exportJobs.value.map((job) => (job.id === id ? result : job))
  }

  async function download(id: number) {
    await downloadResponseStream({
      url: getApiUrl(`/api/process-board/exports/${id}/file`),
      fileName: `工艺参数明细-${id}.csv`,
      contentType: 'text/csv',
      accessToken: useUserStore().accessToken
    })
  }
  watch(visible, (open) => {
    if (open) {
      page.value = 1
      range.value = defaultRange()
      load()
    } else {
      revision++
    }
  })
</script>

<style scoped lang="scss">
  .history-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 18px;
  }
  .el-pagination {
    margin-top: 16px;
    justify-content: flex-end;
  }
  .export-job {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-top: 14px;
  }
</style>
