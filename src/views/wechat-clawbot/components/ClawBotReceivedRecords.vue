<template>
  <ElCard shadow="never">
    <template #header>
      <div class="records-header">
        <span class="records-title">微信接收记录</span>
        <ElText type="info">{{ autoRefresh ? '自动刷新间隔 5 秒' : '自动刷新已暂停' }}</ElText>
      </div>
    </template>
    <ElTable
      :data="page.records"
      v-loading="loading"
      empty-text="尚未收到消息，请在微信向 ClawBot 发送文字"
    >
      <ElTableColumn label="类型" width="100">
        <template #default="{ row }">{{ messageTypeLabel(row.messageType) }}</template>
      </ElTableColumn>
      <ElTableColumn prop="content" label="内容" min-width="320" show-overflow-tooltip />
      <ElTableColumn prop="messageTime" label="微信发送时间" width="180" />
      <ElTableColumn prop="receivedTime" label="接收时间" width="180" />
    </ElTable>
    <div class="records-pagination">
      <ElPagination
        v-model:current-page="page.current"
        :page-size="page.size"
        layout="total, prev, pager, next"
        :total="page.total"
        @current-change="refresh"
      />
    </div>
  </ElCard>
</template>

<script setup lang="ts">
  import { fetchMyClawBotMessages } from '@/api/wechat-clawbot'
  import { useClawBotRecordPage } from '../composables/useClawBotRecordPage'

  defineProps<{ autoRefresh: boolean }>()
  const { page, loading, refresh } = useClawBotRecordPage(fetchMyClawBotMessages)

  function messageTypeLabel(type: string) {
    const labels: Record<string, string> = {
      Text: '文字',
      Image: '图片',
      Voice: '语音',
      File: '文件',
      Video: '视频',
      Mixed: '混合',
      Other: '其他'
    }
    return labels[type] || type
  }

  defineExpose({ refresh })
</script>

<style scoped>
  .records-header {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }
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
