<template>
  <section>
    <el-radio-group v-model="kind" @change="reset"
      ><el-radio-button value="reports">冻结报表</el-radio-button
      ><el-radio-button value="dispatches">推送入队记录</el-radio-button
      ><el-radio-button value="diagnostics">接收异常</el-radio-button></el-radio-group
    >
    <el-button class="refresh" :loading="loading" @click="load">刷新</el-button>
    <el-table v-if="kind === 'reports'" v-loading="loading" :data="reports"
      ><el-table-column prop="id" label="报表编号" width="100" /><el-table-column
        prop="slotStart"
        label="小时时段起点"
        min-width="180"
      /><el-table-column prop="configVersion" label="配置版本" width="100" /><el-table-column
        prop="createdAt"
        label="生成时间"
        min-width="180"
      /><el-table-column label="操作" width="100"
        ><template #default="{ row }"
          ><el-button text @click="showReport(row)">查看</el-button></template
        ></el-table-column
      ></el-table
    >
    <el-button
      v-if="kind === 'dispatches' && dispatches.some((row) => row.status === 'Failed')"
      @click="retryFailed"
      >重试本页入队失败任务</el-button
    >
    <el-table v-else-if="kind === 'dispatches'" v-loading="loading" :data="dispatches"
      ><el-table-column prop="id" label="任务编号" width="100" /><el-table-column
        prop="reportId"
        label="报表编号"
        width="100"
      /><el-table-column prop="channel" label="渠道" width="100" /><el-table-column
        prop="recipientId"
        label="接收人编码"
        min-width="160"
      /><el-table-column prop="status" label="状态" width="110" /><el-table-column
        prop="attempts"
        label="入队尝试"
        width="100"
      /><el-table-column prop="error" label="原因" min-width="200" /><el-table-column
        label="队列关联"
        width="110"
        ><template #default="{ row }"
          ><el-button text @click="queueResult = row.queueResultJson || '尚未入队'"
            >查看</el-button
          ></template
        ></el-table-column
      ></el-table
    >
    <el-table v-else v-loading="loading" :data="diagnostics">
      <el-table-column prop="receivedAt" label="接收时间" min-width="180" />
      <el-table-column prop="sourceKey" label="数据源" min-width="120" />
      <el-table-column prop="deviceKey" label="设备" min-width="160" />
      <el-table-column prop="error" label="统计字段异常" min-width="280" />
    </el-table>
    <div v-if="kind !== 'diagnostics'" class="pagination"
      ><el-button :disabled="page <= 1" @click="changePage(-1)">上一页</el-button
      ><span>第 {{ page }} 页</span
      ><el-button :disabled="count < 20" @click="changePage(1)">下一页</el-button></div
    >
    <el-alert
      type="info"
      :closable="false"
      title="Queued表示已入队，不代表发送成功。通过队列关联编号到推送中心查询实际投递；读取报表不会修改发送标记。"
    />
    <el-dialog
      :model-value="!!preview"
      title="小时报表快照"
      width="80%"
      @close="preview = undefined"
      ><template v-if="preview"
        ><div v-for="line in preview.lines" :key="line.code"
          ><h3>{{ line.name }}</h3
          ><el-table
            :data="
              line.processes.map((p) => ({
                name: p.name,
                ...p.points.find((point) => point.start === previewSlot)
              }))
            "
            ><el-table-column prop="name" label="工序" /><el-table-column
              prop="output"
              label="产出" /><el-table-column prop="rework" label="返工" /><el-table-column
              prop="target"
              label="目标" /><el-table-column
              prop="achievement"
              label="达成率（%）" /></el-table></div></template
    ></el-dialog>
    <el-dialog :model-value="!!queueResult" title="发送队列关联结果" @close="queueResult = ''">
      <pre>{{ queueResult }}</pre>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ElMessageBox } from 'element-plus'
  import {
    hourlyApi,
    type HourlyReport,
    type HourlyDispatch,
    type HourlyDiagnostic,
    type HourlyRuntime
  } from '@/api/hourly-production'
  const props = defineProps<{ code: string }>()
  const kind = ref('reports')
  const page = ref(1)
  const loading = ref(false)
  const reports = ref<HourlyReport[]>([])
  const dispatches = ref<HourlyDispatch[]>([])
  const diagnostics = ref<HourlyDiagnostic[]>([])
  const preview = ref<HourlyRuntime>()
  const previewSlot = ref('')
  const queueResult = ref('')
  const count = computed(() =>
    kind.value === 'reports' ? reports.value.length : dispatches.value.length
  )
  let revision = 0

  async function load() {
    const current = ++revision
    loading.value = true
    try {
      if (kind.value === 'reports') {
        const result = await hourlyApi.reports(props.code, page.value)
        if (current === revision) reports.value = result
      } else if (kind.value === 'dispatches') {
        const result = await hourlyApi.dispatches(props.code, page.value)
        if (current === revision) dispatches.value = result
      } else {
        const result = await hourlyApi.diagnostics()
        if (current === revision) diagnostics.value = result
      }
    } finally {
      if (current === revision) loading.value = false
    }
  }

  function reset() {
    page.value = 1
    load()
  }

  async function retryFailed() {
    await ElMessageBox.confirm(
      '仅重试明确入队失败的任务，不重发已入队或发送结果未知的消息。',
      '确认重试'
    )
    for (const job of dispatches.value.filter((row) => row.status === 'Failed')) {
      await hourlyApi.retryDispatch(job.id)
    }
    await load()
  }

  function changePage(offset: number) {
    page.value += offset
    load()
  }

  function showReport(report: Record<string, unknown>) {
    function camel(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(camel)
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value).map(([key, item]) => [
            key[0].toLowerCase() + key.slice(1),
            camel(item)
          ])
        )
      }
      return value
    }
    if (typeof report.snapshotJson !== 'string') return
    preview.value = camel(JSON.parse(report.snapshotJson)) as HourlyRuntime
    previewSlot.value = String(report.slotStart ?? '')
  }

  watch(() => props.code, reset, { immediate: true })
</script>

<style scoped>
  .refresh {
    margin-left: 12px;
  }

  .pagination {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: flex-end;
    margin: 16px 0;
  }

  pre {
    word-break: break-all;
    white-space: pre-wrap;
  }
</style>
