<template>
  <div>
    <div class="toolbar">
      <div class="filters">
        <el-input v-model="query.deviceCode" clearable placeholder="设备编码" />
        <el-select v-model="query.level" clearable placeholder="日志级别">
          <el-option label="信息" value="Info" />
          <el-option label="警告" value="Warning" />
          <el-option label="错误" value="Error" />
          <el-option label="调试" value="Debug" />
        </el-select>
        <el-button @click="loadEvents">查询</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="events.records" height="520" stripe>
      <el-table-column label="级别" width="90">
        <template #default="{ row }">
          <el-tag :type="levelType(row.level)" effect="plain">{{ row.level }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="deviceCode" label="设备编码" min-width="150" />
      <el-table-column prop="eventType" label="事件类型" min-width="180" />
      <el-table-column prop="message" label="内容" min-width="320" show-overflow-tooltip />
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column label="详情" width="80">
        <template #default="{ row }">
          <el-button
            v-if="row.detailJson"
            link
            @click="emit('show-json', { content: row.detailJson, title: row.eventType })"
          >
            查看
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-row">
      <el-pagination
        v-model:current-page="query.current"
        v-model:page-size="query.size"
        layout="total, prev, pager, next"
        :total="events.total"
        @current-change="loadEvents"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { reactive, ref } from 'vue'
  import { fetchEdgeEvents, type EdgeEvent } from '@/api/edge-gateway'
  import { emptyPage, formatTime, type JsonDialogPayload } from './shared'

  const emit = defineEmits<{
    'show-json': [payload: JsonDialogPayload]
  }>()

  const events = reactive(emptyPage<EdgeEvent>())
  const query = reactive({ current: 1, size: 20, deviceCode: '', level: '' })
  const loading = ref(false)

  const loadEvents = async () => {
    loading.value = true
    try {
      Object.assign(events, await fetchEdgeEvents(query))
    } finally {
      loading.value = false
    }
  }

  const levelType = (level: string): 'success' | 'warning' | 'danger' | 'info' =>
    level === 'Error'
      ? 'danger'
      : level === 'Warning'
        ? 'warning'
        : level === 'Info'
          ? 'success'
          : 'info'

  defineExpose({ refresh: loadEvents })
</script>
