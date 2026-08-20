<template>
  <div>
    <div class="toolbar">
      <div class="filters">
        <el-input v-model="query.deviceCode" clearable placeholder="设备编码" />
        <el-select v-model="query.status" clearable placeholder="队列状态">
          <el-option label="待处理" value="Pending" />
          <el-option label="失败" value="Failed" />
          <el-option label="已上传" value="Uploaded" />
        </el-select>
        <el-button @click="loadQueue">查询</el-button>
      </div>
      <div class="actions">
        <el-button :disabled="selectedQueue.length === 0" :loading="actionLoading" @click="retry">
          <el-icon><RefreshLeft /></el-icon>
          重试
        </el-button>
        <el-button
          type="primary"
          :disabled="selectedQueue.length === 0"
          :loading="actionLoading"
          @click="forward"
        >
          <el-icon><Promotion /></el-icon>
          转发至 B 系统
        </el-button>
        <el-button
          type="danger"
          :disabled="selectedQueue.length === 0"
          :loading="actionLoading"
          @click="removeQueue(selectedQueue)"
        >
          <el-icon><Delete /></el-icon>
          批量删除
        </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="queue.records"
      height="520"
      stripe
      @selection-change="selectedQueue = $event"
    >
      <el-table-column type="selection" width="46" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" effect="plain">{{
            statusText(row.status)
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="messageId" label="消息 ID" min-width="220" show-overflow-tooltip />
      <el-table-column prop="deviceCode" label="设备编码" min-width="140" />
      <el-table-column prop="sourceId" label="数据源" min-width="120" />
      <el-table-column
        prop="sourceDeviceCode"
        label="来源业务设备"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column prop="dataType" label="数据类型" width="110" />
      <el-table-column label="采集值" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">{{ getValuePreview(row.standardPayloadJson) }}</template>
      </el-table-column>
      <el-table-column prop="retryCount" label="重试" width="76" align="right" />
      <el-table-column prop="lastError" label="最近错误" min-width="220" show-overflow-tooltip />
      <el-table-column label="消息时间" width="170">
        <template #default="{ row }">{{ formatTime(row.messageTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button
            link
            @click="emit('show-json', { content: row.standardPayloadJson, title: row.messageId })"
          >
            消息 JSON
          </el-button>
          <el-button link type="primary" @click="openUploadRecords(row)"> 上传记录 </el-button>
          <el-button link type="danger" @click="removeQueue([row])">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-row">
      <el-pagination
        v-model:current-page="query.current"
        v-model:page-size="query.size"
        layout="total, prev, pager, next"
        :total="queue.total"
        @current-change="loadQueue"
      />
    </div>

    <EdgeUploadRecordDialog
      v-model="uploadRecordVisible"
      :queue="activeQueue"
      @show-response="emit('show-json', $event)"
    />
  </div>
</template>

<script setup lang="ts">
  import { reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Delete, Promotion, RefreshLeft } from '@element-plus/icons-vue'
  import {
    deleteEdgeQueue,
    fetchEdgeQueue,
    forwardEdgeQueue,
    retryEdgeQueue,
    type EdgeQueueMessage
  } from '@/api/edge-gateway'
  import EdgeUploadRecordDialog from './EdgeUploadRecordDialog.vue'
  import { emptyPage, formatTime, getObjectValue, isObject, type JsonDialogPayload } from './shared'

  const emit = defineEmits<{
    'overview-changed': []
    'show-json': [payload: JsonDialogPayload]
  }>()

  const queue = reactive(emptyPage<EdgeQueueMessage>())
  const query = reactive({ current: 1, size: 20, deviceCode: '', status: '' })
  const selectedQueue = ref<EdgeQueueMessage[]>([])
  const loading = ref(false)
  const actionLoading = ref(false)
  const uploadRecordVisible = ref(false)
  const activeQueue = ref<EdgeQueueMessage>()

  const loadQueue = async () => {
    loading.value = true
    try {
      Object.assign(queue, await fetchEdgeQueue(query))
    } finally {
      loading.value = false
    }
  }

  const getValuePreview = (payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as unknown
      if (!isObject(payload)) return '-'
      const values = getObjectValue(payload, 'values')
      if (!isObject(values)) return '-'
      const entries = Object.entries(values)
      const preview = entries
        .slice(0, 4)
        .map(([key, value]) => `${key}=${isObject(value) ? JSON.stringify(value) : String(value)}`)
        .join(', ')
      return entries.length > 4 ? `${preview} ...` : preview || '-'
    } catch {
      return '-'
    }
  }

  const showForDevice = async (deviceCode: string) => {
    query.current = 1
    query.deviceCode = deviceCode
    query.status = ''
    await loadQueue()
  }

  const openUploadRecords = (row: EdgeQueueMessage) => {
    activeQueue.value = row
    uploadRecordVisible.value = true
  }

  const retry = async () => {
    actionLoading.value = true
    try {
      const count = await retryEdgeQueue(selectedQueue.value.map((item) => item.id))
      ElMessage.success(`已重置 ${count} 条消息`)
      await loadQueue()
      emit('overview-changed')
    } finally {
      actionLoading.value = false
    }
  }

  const forward = async () => {
    actionLoading.value = true
    try {
      const result = await forwardEdgeQueue(selectedQueue.value.map((item) => item.id))
      const successCount = Number(result.successCount ?? result.SuccessCount ?? 0)
      const failedCount = Number(result.failedCount ?? result.FailedCount ?? 0)
      if (failedCount > 0) {
        ElMessage.warning(`转发完成：成功 ${successCount}，失败 ${failedCount}`)
      } else {
        ElMessage.success(`已成功转发 ${successCount} 条消息`)
      }
      await loadQueue()
      emit('overview-changed')
    } finally {
      actionLoading.value = false
    }
  }

  const removeQueue = async (rows: EdgeQueueMessage[]) => {
    if (rows.length === 0) return
    const countText = rows.length === 1 ? `消息 ${rows[0].messageId}` : `${rows.length} 条消息`
    try {
      await ElMessageBox.confirm(
        `确定删除${countText}吗？对应的 B 系统上传记录也会一并删除。`,
        '删除消息队列数据',
        {
          type: 'warning',
          confirmButtonText: '删除',
          cancelButtonText: '取消'
        }
      )
    } catch {
      return
    }

    actionLoading.value = true
    try {
      const count = await deleteEdgeQueue(rows.map((item) => item.id))
      ElMessage.success(`已删除 ${count} 条消息`)
      selectedQueue.value = []
      if (queue.records.length === rows.length && query.current > 1) query.current--
      await loadQueue()
      emit('overview-changed')
    } finally {
      actionLoading.value = false
    }
  }

  const statusText = (status: string) =>
    ({ Pending: '待处理', Failed: '失败', Uploaded: '已上传' })[status] || status

  const statusType = (status: string): 'success' | 'warning' | 'danger' | 'info' =>
    status === 'Uploaded'
      ? 'success'
      : status === 'Failed'
        ? 'danger'
        : status === 'Pending'
          ? 'warning'
          : 'info'

  defineExpose({ refresh: loadQueue, showForDevice })
</script>
