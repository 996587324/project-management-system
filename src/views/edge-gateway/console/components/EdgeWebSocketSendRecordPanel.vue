<template>
  <div>
    <el-alert
      title="发送报文记录"
      description="记录边缘节点向上游 WebSocket 发送的订阅报文；每次首次连接和订阅更新都会留下成功或失败结果。"
      type="info"
      show-icon
      :closable="false"
      class="connection-help-alert"
    />

    <div class="toolbar">
      <div class="filters">
        <el-input v-model="query.deviceCode" clearable placeholder="边缘设备编码" @keyup.enter="search" />
        <el-input v-model="query.sourceId" clearable placeholder="数据源标识" @keyup.enter="search" />
        <el-select v-model="resultFilter" clearable placeholder="发送结果" class="result-select">
          <el-option label="发送成功" value="success" />
          <el-option label="发送失败" value="failed" />
        </el-select>
        <el-button type="primary" @click="search">查询</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="records.records" height="520" stripe>
      <el-table-column label="发送结果" width="104" fixed>
        <template #default="{ row }">
          <el-tag :type="row.success ? 'success' : 'danger'" effect="plain">
            {{ row.success ? '发送成功' : '发送失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="deviceCode" label="边缘设备" min-width="135" show-overflow-tooltip />
      <el-table-column prop="sourceId" label="数据源标识" min-width="140" show-overflow-tooltip />
      <el-table-column label="连接名称" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.sourceName || '-' }}</template>
      </el-table-column>
      <el-table-column label="发送类型" width="118">
        <template #default="{ row }">{{ sendTypeText(row.sendType) }}</template>
      </el-table-column>
      <el-table-column prop="endpoint" label="WebSocket 地址" min-width="250" show-overflow-tooltip />
      <el-table-column label="发送报文" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">{{ payloadPreview(row.payload) }}</template>
      </el-table-column>
      <el-table-column prop="errorMessage" label="失败原因" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">{{ row.errorMessage || '-' }}</template>
      </el-table-column>
      <el-table-column prop="durationMs" label="耗时(ms)" width="100" align="right" />
      <el-table-column label="发送时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="102" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="showPayload(row)">查看报文</el-button>
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
  </div>
</template>

<script setup lang="ts">
  import { reactive, ref } from 'vue'
  import {
    fetchWebSocketSendRecords,
    type EdgeWebSocketSendRecord
  } from '@/api/edge-gateway'
  import { emptyPage, formatTime, type JsonDialogPayload } from './shared'

  const emit = defineEmits<{
    'show-json': [payload: JsonDialogPayload]
  }>()

  const records = reactive(emptyPage<EdgeWebSocketSendRecord>())
  const query = reactive({ current: 1, size: 20, deviceCode: '', sourceId: '' })
  const resultFilter = ref<'success' | 'failed'>()
  const loading = ref(false)

  const loadRecords = async () => {
    loading.value = true
    try {
      Object.assign(
        records,
        await fetchWebSocketSendRecords({
          ...query,
          success:
            resultFilter.value === 'success'
              ? true
              : resultFilter.value === 'failed'
                ? false
                : undefined
        })
      )
    } finally {
      loading.value = false
    }
  }

  const search = async () => {
    query.current = 1
    await loadRecords()
  }

  const sendTypeText = (type: string) =>
    type === 'SubscriptionUpdate' ? '更新订阅' : '首次订阅'

  const payloadPreview = (payload: string) => {
    const compact = payload.replace(/\s+/g, ' ').trim()
    return compact.length > 140 ? `${compact.slice(0, 140)}...` : compact
  }

  const showPayload = (row: EdgeWebSocketSendRecord) => {
    emit('show-json', {
      title: `WebSocket 发送报文 · 记录 #${row.id}`,
      content: row.payload
    })
  }

  defineExpose({ refresh: loadRecords })
</script>

<style scoped>
  .result-select {
    width: 130px;
  }
</style>
