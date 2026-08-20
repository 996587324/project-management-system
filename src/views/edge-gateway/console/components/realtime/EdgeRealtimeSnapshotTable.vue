<template>
  <section class="realtime-snapshot-section">
    <header class="section-heading">
      <div class="heading-main">
        <h3>接收信息</h3>
        <el-tag type="success" effect="plain">{{ page.total }} 台设备</el-tag>
        <el-tag effect="plain">本页接收中 {{ receivingCount }}</el-tag>
        <el-tag v-if="interruptedCount" type="danger" effect="plain">
          本页中断 {{ interruptedCount }}
        </el-tag>
      </div>
      <div class="refresh-controls">
        <span>刷新于 {{ lastRefreshTime || '-' }}</span>
        <el-switch v-model="autoRefreshEnabled" active-text="5 秒自动刷新" />
        <el-tooltip content="立即刷新" placement="top">
          <el-button circle :icon="Refresh" :loading="loading" @click="refresh" />
        </el-tooltip>
      </div>
    </header>

    <div class="snapshot-filters">
      <el-select
        v-model="filters.tenantMark"
        clearable
        filterable
        allow-create
        default-first-option
        placeholder="全部租户"
        @change="applyFilters"
      >
        <el-option v-for="tenant in observedTenantMarks" :key="tenant" :value="tenant" />
      </el-select>
      <el-select
        v-model="filters.modelMark"
        clearable
        filterable
        allow-create
        default-first-option
        placeholder="全部设备型号"
        @change="applyFilters"
      >
        <el-option v-for="model in observedModelMarks" :key="model" :value="model" />
      </el-select>
      <el-select
        v-model="filters.deviceCode"
        clearable
        filterable
        allow-create
        default-first-option
        placeholder="全部设备标识"
        @change="applyFilters"
      >
        <el-option
          v-for="deviceCode in observedDeviceCodes"
          :key="deviceCode"
          :value="deviceCode"
        />
      </el-select>
      <el-select v-model="statusFilter" @change="applyFilters">
        <el-option label="全部状态" value="all" />
        <el-option label="正常接收" value="online" />
        <el-option label="数据中断" value="offline" />
      </el-select>
      <el-button :icon="Delete" @click="clearFilters">清空筛选</el-button>
    </div>

    <el-table v-loading="loading" :data="page.records" height="470" stripe>
      <el-table-column label="状态" width="104" fixed>
        <template #default="{ row }">
          <el-tag :type="row.dataOnline ? 'success' : 'danger'" effect="plain">
            {{ row.dataOnline ? '正常接收' : '数据中断' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="模型 / 租户" min-width="150">
        <template #default="{ row }">
          <div class="device-cell">
            <span>{{ row.modelMark || '-' }}</span>
            <small>{{ row.tenantMark || '-' }} / 类型 {{ row.dataType ?? '-' }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="设备标识" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.deviceMark || row.deviceCode }}
        </template>
      </el-table-column>
      <el-table-column label="动态参数" min-width="220">
        <template #default="{ row }">
          <div class="parameter-cell">
            <el-tag
              v-for="name in parameterNames(row).slice(0, 3)"
              :key="name"
              size="small"
              effect="plain"
            >
              {{ name }}
            </el-tag>
            <span v-if="parameterNames(row).length > 3">
              +{{ parameterNames(row).length - 3 }}
            </span>
            <span v-if="!parameterNames(row).length">-</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="数据时间" width="170">
        <template #default="{ row }">{{ formatTime(row.dataTime) }}</template>
      </el-table-column>
      <el-table-column label="中心接收时间" width="170">
        <template #default="{ row }">{{ formatTime(row.receiveTime) }}</template>
      </el-table-column>
      <el-table-column prop="messageId" label="请求编号" min-width="190" show-overflow-tooltip />
      <el-table-column label="操作" width="78" fixed="right" align="center">
        <template #default="{ row }">
          <el-tooltip content="查看接收 JSON" placement="top">
            <el-button circle :icon="View" @click="showSnapshotJson(row)" />
          </el-tooltip>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无设备实时数据" :image-size="72" />
      </template>
    </el-table>

    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="filters.current"
        v-model:page-size="filters.size"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50, 100]"
        :total="page.total"
        @current-change="handleCurrentChange"
        @size-change="handleSizeChange"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
  import { Delete, Refresh, View } from '@element-plus/icons-vue'
  import {
    fetchEdgeRealtimeSnapshots,
    type EdgeRealtimeSnapshot,
    type EdgeRealtimeSnapshotQuery
  } from '@/api/edge-gateway'
  import { emptyPage, formatTime, type JsonDialogPayload } from '../shared'

  const AUTO_REFRESH_INTERVAL_MS = 5_000
  const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true })
  const emit = defineEmits<{
    'show-json': [payload: JsonDialogPayload]
  }>()

  const page = reactive(emptyPage<EdgeRealtimeSnapshot>())
  const filters = reactive<EdgeRealtimeSnapshotQuery>({ current: 1, size: 20 })
  const statusFilter = ref<'all' | 'online' | 'offline'>('all')
  const observedTenantMarks = ref<string[]>([])
  const observedModelMarks = ref<string[]>([])
  const observedDeviceCodes = ref<string[]>([])
  const autoRefreshEnabled = ref(true)
  const loading = ref(false)
  const lastRefreshTime = ref('')
  let activeRequest: Promise<void> | null = null
  let autoRefreshTimer: number | undefined

  const receivingCount = computed(() => page.records.filter((item) => item.dataOnline).length)
  const interruptedCount = computed(() => page.records.length - receivingCount.value)

  const mergeObservedOptions = (records: EdgeRealtimeSnapshot[]) => {
    observedTenantMarks.value = Array.from(
      new Set([
        ...observedTenantMarks.value,
        ...records.map((item) => item.tenantMark).filter((item): item is string => Boolean(item))
      ])
    ).sort()
    observedModelMarks.value = Array.from(
      new Set([
        ...observedModelMarks.value,
        ...records.map((item) => item.modelMark).filter((item): item is string => Boolean(item))
      ])
    ).sort()
    observedDeviceCodes.value = Array.from(
      new Set([
        ...observedDeviceCodes.value,
        ...records.map((item) => item.deviceCode).filter(Boolean)
      ])
    ).sort()
  }

  const loadSnapshots = (silent = false): Promise<void> => {
    if (activeRequest) return activeRequest

    activeRequest = (async () => {
      if (!silent) loading.value = true
      try {
        const result = await fetchEdgeRealtimeSnapshots(
          {
            ...filters,
            tenantMark: filters.tenantMark || undefined,
            modelMark: filters.modelMark || undefined,
            deviceCode: filters.deviceCode || undefined,
            dataOnline: statusFilter.value === 'all' ? undefined : statusFilter.value === 'online'
          },
          !silent
        )
        Object.assign(page, result)
        mergeObservedOptions(result.records)
        lastRefreshTime.value = new Date().toLocaleTimeString()
      } finally {
        if (!silent) loading.value = false
        activeRequest = null
      }
    })()
    return activeRequest
  }

  const refresh = async () => {
    await loadSnapshots()
  }

  const applyFilters = async () => {
    filters.current = 1
    await loadSnapshots()
  }

  const clearFilters = async () => {
    filters.tenantMark = undefined
    filters.modelMark = undefined
    filters.deviceCode = undefined
    statusFilter.value = 'all'
    await applyFilters()
  }

  const handleSizeChange = async () => {
    filters.current = 1
    await loadSnapshots()
  }

  const handleCurrentChange = async () => {
    await loadSnapshots()
  }

  const parameterNames = (snapshot: EdgeRealtimeSnapshot) => Object.keys(snapshot.data)

  const showSnapshotJson = (snapshot: EdgeRealtimeSnapshot) => {
    const payload: JsonDialogPayload = {
      title: `${snapshot.deviceMark || snapshot.deviceCode} 最新接收数据`,
      content: JSON.stringify(
        {
          modelMark: snapshot.modelMark,
          data: snapshot.data,
          dataType: snapshot.dataType,
          tenantMark: snapshot.tenantMark,
          messageId: snapshot.messageId,
          time: snapshot.time,
          deviceMark: snapshot.deviceMark
        },
        null,
        2
      )
    }
    emit('show-json', payload)
  }

  onMounted(() => {
    void refresh().catch(() => undefined)
    autoRefreshTimer = window.setInterval(() => {
      if (props.active && autoRefreshEnabled.value) {
        void loadSnapshots(true).catch(() => undefined)
      }
    }, AUTO_REFRESH_INTERVAL_MS)
  })

  onBeforeUnmount(() => {
    if (autoRefreshTimer !== undefined) window.clearInterval(autoRefreshTimer)
  })

  defineExpose({ refresh })
</script>

<style scoped lang="scss">
  .section-heading,
  .heading-main,
  .refresh-controls,
  .snapshot-filters,
  .parameter-cell,
  .pagination-wrap {
    display: flex;
    align-items: center;
  }

  .section-heading {
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .heading-main,
  .refresh-controls,
  .parameter-cell {
    gap: 8px;
  }

  .refresh-controls {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .snapshot-filters {
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 14px;
  }

  .snapshot-filters .el-select {
    width: 210px;
  }

  .device-cell {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .device-cell span,
  .device-cell small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-cell small {
    color: var(--el-text-color-secondary);
  }

  .parameter-cell {
    overflow: hidden;
    white-space: nowrap;
  }

  .pagination-wrap {
    justify-content: flex-end;
    padding-top: 16px;
  }

  @media (width <= 900px) {
    .section-heading {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }

    .snapshot-filters .el-select {
      width: calc(50% - 5px);
    }
  }

  @media (width <= 640px) {
    .heading-main,
    .refresh-controls {
      flex-wrap: wrap;
    }

    .snapshot-filters .el-select,
    .snapshot-filters .el-button {
      width: 100%;
    }

    .pagination-wrap {
      justify-content: flex-start;
      overflow-x: auto;
    }
  }
</style>
