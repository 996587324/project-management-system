<template>
  <ElCard shadow="never">
    <template #header><div class="records-title">微信发送记录</div></template>
    <ElTable :data="page.records" v-loading="loading">
      <ElTableColumn prop="source" label="来源" width="110" />
      <ElTableColumn prop="content" label="内容" min-width="320" show-overflow-tooltip />
      <ElTableColumn prop="status" label="结果" width="100">
        <template #default="{ row }">
          <ElTag :type="row.status === 'Sent' ? 'success' : 'danger'">{{
            deliveryStatusLabel(row.status)
          }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="durationMs" label="耗时" width="100">
        <template #default="{ row }">{{ row.durationMs }} ms</template>
      </ElTableColumn>
      <ElTableColumn prop="createTime" label="创建时间" width="180" />
      <ElTableColumn prop="errorMessage" label="失败原因" min-width="220" show-overflow-tooltip />
    </ElTable>
    <div class="records-pagination">
      <ElPagination
        v-model:current-page="page.current"
        v-model:page-size="page.size"
        layout="total, prev, pager, next"
        :total="page.total"
        @current-change="refresh"
      />
    </div>
  </ElCard>
</template>

<script setup lang="ts">
  import { fetchMyClawBotDeliveries } from '@/api/wechat-clawbot'
  import { useClawBotRecordPage } from '../composables/useClawBotRecordPage'

  const { page, loading, refresh } = useClawBotRecordPage(fetchMyClawBotDeliveries)

  function deliveryStatusLabel(status: string) {
    const labels: Record<string, string> = {
      Sent: '发送成功',
      Failed: '发送失败',
      Sending: '发送中',
      Pending: '待发送'
    }
    return labels[status] || status
  }

  defineExpose({ refresh })
</script>

<style scoped>
  .records-title {
    font-size: 18px;
    font-weight: 600;
  }
  .records-pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
</style>
