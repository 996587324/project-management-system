<template>
  <div class="clawbot-admin art-full-height">
    <ElCard shadow="never">
      <template #header>
        <div class="clawbot-admin__header">
          <div>
            <div class="clawbot-admin__title">微信 ClawBot 管理与调试</div>
            <div class="clawbot-admin__subtitle"
              >调试发送与 MCP 推送共用同一投递服务和审计记录。</div
            >
          </div>
          <ElButton :loading="loading" @click="loadAccounts">刷新</ElButton>
        </div>
      </template>

      <div class="clawbot-admin__filters">
        <ElInput
          v-model.trim="keyword"
          clearable
          placeholder="按用户名筛选"
          class="clawbot-admin__keyword"
          @keyup.enter="search"
        />
        <ElButton type="primary" @click="search">查询</ElButton>
      </div>
      <ElTable :data="accounts.records" v-loading="loading">
        <ElTableColumn prop="userName" label="用户" min-width="150" />
        <ElTableColumn prop="userId" label="接收编码" min-width="170" show-overflow-tooltip />
        <ElTableColumn prop="status" label="绑定状态" width="110">
          <template #default="{ row }"
            ><ElTag :type="row.bound ? 'success' : 'info'">{{ row.status }}</ElTag></template
          >
        </ElTableColumn>
        <ElTableColumn label="Agent / MCP 推送" width="150"
          ><template #default="{ row }">{{
            row.mcpPushEnabled ? '允许' : '用户关闭'
          }}</template></ElTableColumn
        >
        <ElTableColumn prop="lastSendTime" label="最近发送" width="180" />
        <ElTableColumn prop="lastError" label="最近错误" min-width="220" show-overflow-tooltip />
        <ElTableColumn label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <ElButton
              link
              type="primary"
              :disabled="!row.bound || row.adminDisabled"
              @click="openDebug(row as WeChatClawBotAccount)"
              >调试发送</ElButton
            >
            <ElButton
              link
              :type="row.adminDisabled ? 'success' : 'danger'"
              @click="toggleDisabled(row as WeChatClawBotAccount)"
            >
              {{ row.adminDisabled ? '恢复推送' : '停用推送' }}
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <div class="clawbot-admin__pagination">
        <ElPagination
          v-model:current-page="accounts.current"
          v-model:page-size="accounts.size"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[10, 20, 50, 100]"
          :total="accounts.total"
          @current-change="loadAccounts"
          @size-change="loadAccounts"
        />
      </div>
    </ElCard>

    <ElCard shadow="never" class="clawbot-admin__deliveries">
      <template #header><div class="clawbot-admin__title">消息投递记录</div></template>
      <ElTable :data="deliveries.records" v-loading="deliveryLoading">
        <ElTableColumn prop="userName" label="接收用户" width="130" />
        <ElTableColumn prop="source" label="来源" width="110" />
        <ElTableColumn prop="content" label="内容" min-width="300" show-overflow-tooltip />
        <ElTableColumn prop="status" label="结果" width="100"
          ><template #default="{ row }"
            ><ElTag :type="row.status === 'Sent' ? 'success' : 'danger'">{{
              row.status
            }}</ElTag></template
          ></ElTableColumn
        >
        <ElTableColumn prop="durationMs" label="耗时" width="100"
          ><template #default="{ row }">{{ row.durationMs }} ms</template></ElTableColumn
        >
        <ElTableColumn prop="createTime" label="创建时间" width="180" />
        <ElTableColumn prop="errorMessage" label="失败原因" min-width="220" show-overflow-tooltip />
      </ElTable>
      <div class="clawbot-admin__pagination"
        ><ElPagination
          v-model:current-page="deliveries.current"
          v-model:page-size="deliveries.size"
          layout="total, prev, pager, next"
          :total="deliveries.total"
          @current-change="loadDeliveries"
      /></div>
    </ElCard>

    <ElDialog v-model="debugVisible" title="发送调试消息" width="520px" destroy-on-close>
      <ElAlert
        title="消息会使用正式的 ClawBot 投递通道发送，并写入正式投递记录。"
        type="warning"
        :closable="false"
        show-icon
      />
      <ElForm label-width="90px" class="clawbot-admin__debug-form">
        <ElFormItem label="接收用户"
          ><ElInput :model-value="debugUser?.userName" disabled
        /></ElFormItem>
        <ElFormItem label="接收编码"
          ><ElInput :model-value="debugUser?.userId" disabled
        /></ElFormItem>
        <ElFormItem label="测试内容"
          ><ElInput
            v-model="debugContent"
            type="textarea"
            :rows="5"
            maxlength="10000"
            show-word-limit
            placeholder="请输入需要发送的测试文本"
        /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="debugVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="sending" @click="sendDebug">发送</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchClawBotAccounts,
    fetchClawBotDeliveries,
    sendClawBotDebugMessage,
    setClawBotAdminDisabled,
    type WeChatClawBotAccount,
    type WeChatClawBotDelivery,
    type WeChatClawBotPage
  } from '@/api/wechat-clawbot'

  defineOptions({ name: 'WeChatClawBotManagement' })

  const keyword = ref('')
  const loading = ref(false)
  const deliveryLoading = ref(false)
  const sending = ref(false)
  const debugVisible = ref(false)
  const debugUser = ref<WeChatClawBotAccount>()
  const debugContent = ref('这是一条来自智能制造管理系统的 ClawBot 调试消息。')
  const accounts = reactive<WeChatClawBotPage<WeChatClawBotAccount>>({
    records: [],
    current: 1,
    size: 20,
    total: 0
  })
  const deliveries = reactive<WeChatClawBotPage<WeChatClawBotDelivery>>({
    records: [],
    current: 1,
    size: 10,
    total: 0
  })

  async function loadAccounts() {
    loading.value = true
    try {
      Object.assign(
        accounts,
        await fetchClawBotAccounts({
          userName: keyword.value || undefined,
          current: accounts.current,
          size: accounts.size
        })
      )
    } finally {
      loading.value = false
    }
  }

  async function loadDeliveries() {
    deliveryLoading.value = true
    try {
      Object.assign(
        deliveries,
        await fetchClawBotDeliveries({ current: deliveries.current, size: deliveries.size })
      )
    } finally {
      deliveryLoading.value = false
    }
  }

  async function search() {
    accounts.current = 1
    await loadAccounts()
  }

  function openDebug(row: WeChatClawBotAccount) {
    debugUser.value = row
    debugContent.value = '这是一条来自智能制造管理系统的 ClawBot 调试消息。'
    debugVisible.value = true
  }

  async function sendDebug() {
    if (!debugUser.value || !debugContent.value.trim()) {
      ElMessage.warning('请输入测试消息内容')
      return
    }
    sending.value = true
    try {
      const delivery = await sendClawBotDebugMessage({
        userId: debugUser.value.userId,
        content: debugContent.value.trim()
      })
      if (delivery.status === 'Sent') ElMessage.success(`发送成功，耗时 ${delivery.durationMs} ms`)
      else ElMessage.error(delivery.errorMessage || '发送失败，请查看投递记录')
      debugVisible.value = false
      await Promise.all([loadAccounts(), loadDeliveries()])
    } finally {
      sending.value = false
    }
  }

  async function toggleDisabled(row: WeChatClawBotAccount) {
    const disabled = !row.adminDisabled
    await ElMessageBox.confirm(
      disabled
        ? `确定停用 ${row.userName} 的 ClawBot 推送吗？`
        : `确定恢复 ${row.userName} 的 ClawBot 推送吗？`,
      '确认操作',
      { type: 'warning' }
    )
    await setClawBotAdminDisabled(row.userId, disabled)
    ElMessage.success(disabled ? '已停用推送' : '已恢复推送')
    await loadAccounts()
  }

  onMounted(async () => {
    await Promise.all([loadAccounts(), loadDeliveries()])
  })
</script>

<style scoped>
  .clawbot-admin {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .clawbot-admin__header {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  }

  .clawbot-admin__title {
    font-size: 18px;
    font-weight: 600;
  }

  .clawbot-admin__subtitle {
    margin-top: 5px;
    color: var(--art-gray-500);
  }

  .clawbot-admin__filters {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .clawbot-admin__keyword {
    width: 260px;
  }

  .clawbot-admin__pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .clawbot-admin__debug-form {
    margin-top: 20px;
  }
</style>
