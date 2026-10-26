<template>
  <ElCard shadow="never" v-loading="loading">
    <template #header>Agent 微信发送队列</template>
    <ElAlert
      title="仅显示本人在当前系统发起的推送。消息逐条间隔发送；待核实表示可能已发送，不会自动重发。已有卡片推送和 MCP 投递仍可在发送记录中查询。"
      type="info"
      :closable="false"
      show-icon
    />
    <div class="queue-toolbar">
      <span>队列发送间隔（秒）</span>
      <ElInputNumber v-model="intervalSeconds" :min="1" :max="3600" :disabled="!canConfigure" />
      <ElButton v-if="canConfigure" :loading="saving" @click="save">保存间隔</ElButton>
      <ElInputNumber v-model="taskId" :min="1" :precision="0" placeholder="任务编号" />
      <ElButton type="primary" @click="search">查询</ElButton>
      <ElButton @click="initialize">刷新</ElButton>
    </div>
    <ElAlert v-if="error" :title="error" type="error" :closable="false" />
    <ElTable :data="records" border>
      <ElTableColumn prop="id" label="任务编号" width="100" />
      <ElTableColumn prop="recipientUserId" label="接收用户编码" width="140" />
      <ElTableColumn label="状态" width="120">
        <template #default="{ row }">{{ statusLabels[row.status] || row.status }}</template>
      </ElTableColumn>
      <ElTableColumn prop="content" label="消息内容" min-width="240" show-overflow-tooltip />
      <ElTableColumn prop="error" label="说明" min-width="220" show-overflow-tooltip />
      <ElTableColumn prop="attempt" label="尝试次数" width="100" />
      <ElTableColumn prop="deliveryId" label="投递记录" width="110" />
      <ElTableColumn prop="createTime" label="提交时间" width="180" />
      <ElTableColumn prop="sentTime" label="通道接受时间" width="180" />
    </ElTable>
    <ElPagination
      class="queue-pagination"
      v-model:current-page="page"
      :page-size="20"
      :total="total"
      layout="total, prev, pager, next"
      @current-change="refresh"
    />
  </ElCard>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import {
    fetchWeChatPushQueue,
    fetchWeChatPushQueueSetting,
    saveWeChatPushQueueSetting,
    type WeChatPushQueueRecord
  } from '@/api/wechat-push-queue'

  const loading = ref(false)
  const saving = ref(false)
  const canConfigure = ref(false)
  const intervalSeconds = ref(5)
  const taskId = ref<number>()
  const page = ref(1)
  const total = ref(0)
  const records = ref<WeChatPushQueueRecord[]>([])
  const error = ref('')
  const statusLabels: Record<string, string> = {
    Pending: '待发送',
    Sending: '发送中',
    Sent: '通道已接受',
    Failed: '明确失败',
    Unknown: '结果待核实',
    Cancelled: '已取消'
  }

  async function refresh() {
    if (loading.value) return
    loading.value = true
    try {
      const result = await fetchWeChatPushQueue(page.value, 20, taskId.value)
      records.value = result.records
      total.value = result.total
      error.value = ''
    } catch {
      records.value = []
      total.value = 0
      error.value = '队列查询失败，请检查权限或稍后刷新。'
    } finally {
      loading.value = false
    }
  }

  async function search() {
    page.value = 1
    await refresh()
  }

  async function save() {
    saving.value = true
    try {
      await saveWeChatPushQueueSetting(intervalSeconds.value)
      ElMessage.success('队列发送间隔已保存')
    } finally {
      saving.value = false
    }
  }

  async function initialize() {
    try {
      const setting = await fetchWeChatPushQueueSetting()
      intervalSeconds.value = setting.intervalSeconds
      canConfigure.value = setting.canConfigure
      await refresh()
    } catch {
      canConfigure.value = false
      records.value = []
      error.value = '发送队列尚未就绪或没有访问权限，请稍后重试。'
    }
  }

  onMounted(initialize)
  defineExpose({ refresh })
</script>

<style scoped>
  .queue-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin: 16px 0;
  }

  .queue-pagination {
    justify-content: flex-end;
    margin-top: 16px;
  }
</style>
