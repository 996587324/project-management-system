<template>
  <div>
    <el-alert
      title="WebSocket 接收记录"
      description="仅保留最近 7 天已成功进入中心端的数据；数据按接收日期分表保存，超期日表会自动清理。"
      type="info"
      show-icon
      :closable="false"
      class="connection-help-alert"
    />

    <div class="toolbar">
      <div class="filters">
        <el-input v-model="query.deviceCode" clearable placeholder="边缘设备编码" @keyup.enter="search" />
        <el-input v-model="query.sourceId" clearable placeholder="数据源标识" @keyup.enter="search" />
        <el-input
          v-model="query.sourceDeviceCode"
          clearable
          placeholder="来源业务设备"
          @keyup.enter="search"
        />
        <el-input v-model="query.dataType" clearable placeholder="数据类型" @keyup.enter="search" />
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="接收开始日期"
          end-placeholder="接收结束日期"
          range-separator="至"
          :clearable="false"
          :disabled-date="disableDate"
          class="date-range"
        />
        <el-button type="primary" @click="search">查询</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="records.records" height="520" stripe>
      <el-table-column prop="deviceCode" label="边缘设备" min-width="125" show-overflow-tooltip />
      <el-table-column prop="sourceId" label="数据源标识" min-width="135" show-overflow-tooltip />
      <el-table-column label="来源业务设备" min-width="155" show-overflow-tooltip>
        <template #default="{ row }">{{ row.sourceDeviceCode || '-' }}</template>
      </el-table-column>
      <el-table-column prop="dataType" label="数据类型" width="115" />
      <el-table-column prop="messageId" label="消息 ID" min-width="205" show-overflow-tooltip />
      <el-table-column label="接收报文" min-width="290" show-overflow-tooltip>
        <template #default="{ row }">{{ payloadPreview(row.rawPayload) }}</template>
      </el-table-column>
      <el-table-column label="业务时间" width="170">
        <template #default="{ row }">{{ formatTime(row.messageTime) }}</template>
      </el-table-column>
      <el-table-column label="中心接收时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="108" fixed="right">
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
    fetchWebSocketReceiveRecords,
    type EdgeWebSocketReceiveRecord
  } from '@/api/edge-gateway'
  import { emptyPage, formatTime, type JsonDialogPayload } from './shared'

  const emit = defineEmits<{
    'show-json': [payload: JsonDialogPayload]
  }>()

  const formatDate = (date: Date) => date.toISOString().slice(0, 10)
  const today = new Date()
  const sevenDayStart = new Date(today)
  sevenDayStart.setDate(today.getDate() - 6)

  const records = reactive(emptyPage<EdgeWebSocketReceiveRecord>())
  const query = reactive({
    current: 1,
    size: 20,
    deviceCode: '',
    sourceId: '',
    sourceDeviceCode: '',
    dataType: ''
  })
  const dateRange = ref<[string, string]>([formatDate(sevenDayStart), formatDate(today)])
  const loading = ref(false)

  const loadRecords = async () => {
    loading.value = true
    try {
      Object.assign(
        records,
        await fetchWebSocketReceiveRecords({
          ...query,
          startDate: dateRange.value[0],
          endDate: dateRange.value[1]
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

  const disableDate = (date: Date) => {
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const earliest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
    const latest = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return normalized < earliest || normalized > latest
  }

  const payloadPreview = (payload: string) => {
    const compact = payload.replace(/\s+/g, ' ').trim()
    return compact.length > 150 ? `${compact.slice(0, 150)}...` : compact
  }

  const showPayload = (row: EdgeWebSocketReceiveRecord) => {
    emit('show-json', {
      title: `WebSocket 接收报文 · ${row.messageId}`,
      content: row.rawPayload
    })
  }

  defineExpose({ refresh: loadRecords })
</script>

<style scoped>
  .date-range {
    width: 270px;
  }
</style>
