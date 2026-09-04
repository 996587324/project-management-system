<template>
  <div class="pda-page art-full-height">
    <ElCard shadow="never" class="pda-card">
      <template #header>
        <div class="page-header">
          <div>
            <div class="section-title">扫码记录</div>
            <div class="section-subtitle">查询 PDA 产品条码扫码结果，成功和失败都会留痕。</div>
          </div>
          <ElButton :icon="Refresh" :loading="loading" @click="loadPage">刷新</ElButton>
        </div>
      </template>

      <div class="toolbar">
        <ElInput v-model="query.barcode" clearable :prefix-icon="Search" placeholder="产品条码" @keyup.enter="search" @clear="search" />
        <ElInput v-model="query.deviceCode" clearable placeholder="设备编号" @keyup.enter="search" @clear="search" />
        <ElInput v-model="query.userId" clearable placeholder="用户ID" @keyup.enter="search" @clear="search" />
        <ElSelect v-model="query.success" placeholder="全部结果" clearable @change="search">
          <ElOption label="成功" :value="true" />
          <ElOption label="失败" :value="false" />
        </ElSelect>
        <ElButton type="primary" :icon="Search" @click="search">查询</ElButton>
      </div>

      <ElTable v-loading="loading" :data="page.records" :row-key="scanLogRowKey" height="100%">
        <ElTableColumn prop="barcode" label="产品条码" min-width="180" show-overflow-tooltip />
        <ElTableColumn prop="deviceCode" label="设备编号" min-width="130" />
        <ElTableColumn prop="userName" label="用户" min-width="120">
          <template #default="{ row }">{{ row.userName || row.userId }}</template>
        </ElTableColumn>
        <ElTableColumn label="结果" width="90">
          <template #default="{ row }">
            <ElTag :type="row.success ? 'success' : 'danger'">
              {{ row.success ? '成功' : '失败' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="resultCode" label="结果码" min-width="150" show-overflow-tooltip />
        <ElTableColumn prop="message" label="说明" min-width="220" show-overflow-tooltip />
        <ElTableColumn prop="durationMs" label="耗时" width="90">
          <template #default="{ row }">{{ row.durationMs }} ms</template>
        </ElTableColumn>
        <ElTableColumn prop="scanTime" label="扫码时间" min-width="170" />
        <ElTableColumn label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" :icon="View" @click="openDetail(asScanLog(row))">详情</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <div class="pagination-row">
        <ElPagination
          v-model:current-page="page.current"
          v-model:page-size="page.size"
          :total="page.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadPage"
          @current-change="loadPage"
        />
      </div>
    </ElCard>

    <ElDrawer v-model="detailVisible" title="扫码详情" size="520px">
      <ElDescriptions v-if="detail" :column="1" border>
        <ElDescriptionsItem label="产品条码">{{ detail.barcode }}</ElDescriptionsItem>
        <ElDescriptionsItem label="设备编号">{{ detail.deviceCode }}</ElDescriptionsItem>
        <ElDescriptionsItem label="用户">{{ detail.userName || detail.userId }}</ElDescriptionsItem>
        <ElDescriptionsItem label="结果">{{ detail.success ? '成功' : '失败' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="结果码">{{ detail.resultCode }}</ElDescriptionsItem>
        <ElDescriptionsItem label="说明">{{ detail.message }}</ElDescriptionsItem>
        <ElDescriptionsItem label="TraceId">{{ detail.traceId }}</ElDescriptionsItem>
        <ElDescriptionsItem label="扫码时间">{{ detail.scanTime }}</ElDescriptionsItem>
      </ElDescriptions>
      <ElDivider />
      <ElInput :model-value="formatJson(detail?.resultData)" type="textarea" :rows="14" readonly />
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { Refresh, Search, View } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import {
    fetchPdaScanLog,
    fetchPdaScanLogPage,
    type PdaPage,
    type PdaScanLog
  } from '@/api/pda'

  defineOptions({ name: 'PdaScanLog' })

  const loading = ref(false)
  const detailVisible = ref(false)
  const detail = ref<PdaScanLog>()
  const query = reactive<{
    barcode: string
    deviceCode: string
    userId: string
    success?: boolean
  }>({ barcode: '', deviceCode: '', userId: '', success: undefined })
  const page = reactive<PdaPage<PdaScanLog>>({ records: [], current: 1, size: 20, total: 0 })

  const loadPage = async () => {
    loading.value = true
    try {
      Object.assign(
        page,
        await fetchPdaScanLogPage({
          current: page.current,
          size: page.size,
          barcode: query.barcode.trim() || undefined,
          deviceCode: query.deviceCode.trim() || undefined,
          userId: query.userId.trim() || undefined,
          success: query.success
        })
      )
    } finally {
      loading.value = false
    }
  }

  const search = () => {
    page.current = 1
    loadPage()
  }

  const asScanLog = (row: unknown) => row as PdaScanLog
  const scanLogRowKey = (row: PdaScanLog) =>
    row.id === null ? `scan-${row.deviceCode}-${row.scanId}` : String(row.id)

  const openDetail = async (row: PdaScanLog) => {
    if (row.id === null) {
      ElMessage.error('扫码记录 ID 缺失，无法查看详情，请刷新页面后重试')
      return
    }
    detail.value = await fetchPdaScanLog(row.id)
    detailVisible.value = true
  }

  const formatJson = (value?: string) => {
    if (!value) return ''
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }

  onMounted(loadPage)
</script>

<style scoped>
  .pda-page {
    display: flex;
    min-height: 0;
  }

  .pda-card {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 420px;
  }

  :deep(.pda-card > .el-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .page-header,
  .toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .section-title {
    color: var(--art-text-gray-900);
    font-size: 16px;
    font-weight: 600;
  }

  .section-subtitle {
    margin-top: 4px;
    color: var(--art-text-gray-600);
    font-size: 13px;
  }

  .toolbar {
    flex-wrap: wrap;
    justify-content: flex-start;
    margin-bottom: 14px;
  }

  .toolbar .el-input {
    width: 220px;
  }

  .toolbar .el-select {
    width: 130px;
  }

  .pagination-row {
    display: flex;
    justify-content: flex-end;
    padding-top: 14px;
  }
</style>
