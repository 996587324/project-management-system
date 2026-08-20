<template>
  <el-dialog
    :model-value="modelValue"
    :title="`B 系统上传记录 · ${queue?.messageId || '-'}`"
    width="min(1080px, 94vw)"
    class="edge-gateway-dialog"
    @close="close"
  >
    <el-table v-loading="loading" :data="records.records" height="460" stripe>
      <el-table-column label="结果" width="82">
        <template #default="{ row }">
          <el-tag :type="row.success ? 'success' : 'danger'" effect="plain">
            {{ row.success ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="mappingName" label="命中映射" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.mappingName || '-' }}</template>
      </el-table-column>
      <el-table-column label="来源订阅设备" min-width="190" show-overflow-tooltip>
        <template #default="{ row }">{{ sourceRoute(row) }}</template>
      </el-table-column>
      <el-table-column prop="targetUrl" label="目标地址" min-width="210" show-overflow-tooltip />
      <el-table-column prop="statusCode" label="响应码" width="88" align="right">
        <template #default="{ row }">{{ row.statusCode ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="B 系统返回内容" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ responsePreview(row.responseContent) }}</span>
          <el-tag
            v-if="row.responseContentTruncated"
            type="warning"
            effect="plain"
            size="small"
            class="truncated-tag"
          >
            已截断
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="errorMessage" label="失败原因" min-width="180" show-overflow-tooltip />
      <el-table-column prop="durationMs" label="耗时(ms)" width="92" align="right" />
      <el-table-column label="上传时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="92" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.responseContent" link type="primary" @click="showResponse(row)">
            查看返回
          </el-button>
          <span v-else>-</span>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-row">
      <el-pagination
        v-model:current-page="query.current"
        v-model:page-size="query.size"
        layout="total, prev, pager, next"
        :total="records.total"
        @current-change="loadRecords"
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
  import { reactive, ref, watch } from 'vue'
  import {
    fetchEdgeUploadRecords,
    type EdgeQueueMessage,
    type EdgeUploadRecord
  } from '@/api/edge-gateway'
  import { emptyPage, formatTime, type JsonDialogPayload } from './shared'

  const props = defineProps<{
    modelValue: boolean
    queue?: EdgeQueueMessage
  }>()

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    'show-response': [payload: JsonDialogPayload]
  }>()

  const records = reactive(emptyPage<EdgeUploadRecord>())
  const query = reactive({ current: 1, size: 20 })
  const loading = ref(false)

  const loadRecords = async () => {
    if (!props.queue?.id) return
    loading.value = true
    try {
      Object.assign(
        records,
        await fetchEdgeUploadRecords({
          queueId: props.queue.id,
          current: query.current,
          size: query.size
        })
      )
    } finally {
      loading.value = false
    }
  }

  const responsePreview = (content?: string) => {
    if (!content) return '-'
    const compact = content.replace(/\s+/g, ' ').trim()
    return compact.length > 120 ? `${compact.slice(0, 120)}...` : compact
  }

  const sourceRoute = (record: EdgeUploadRecord) => {
    if (!record.sourceDeviceCode) return record.sourceId || '-'
    return `${record.sourceId || '-'} / ${record.sourceDeviceCode}`
  }

  const showResponse = (row: EdgeUploadRecord) => {
    emit('show-response', {
      title: `B 系统返回内容 · 上传记录 #${row.id}`,
      content: row.responseContent || ''
    })
  }

  const close = () => emit('update:modelValue', false)

  watch(
    () => props.modelValue,
    async (visible) => {
      if (!visible) return
      query.current = 1
      await loadRecords()
    }
  )
</script>

<style scoped>
  .truncated-tag {
    margin-left: 8px;
  }
</style>
