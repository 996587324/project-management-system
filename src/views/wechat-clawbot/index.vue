<template>
  <div class="clawbot-page art-full-height">
    <div class="clawbot-page__toolbar">
      <div>
        <div class="clawbot-page__title">我的微信推送</div>
        <div class="clawbot-page__subtitle">按需切换绑定、AI 配置、消息测试和收发记录。</div>
      </div>
      <div class="clawbot-page__toolbar-actions">
        <ElTag :type="account.bound && !account.adminDisabled ? 'success' : 'info'">{{
          accountStatusLabel
        }}</ElTag>
        <ElSwitch v-model="autoRefresh" active-text="自动刷新（5 秒）" />
        <ElButton :loading="recordsLoading" @click="refreshRecords">刷新状态</ElButton>
      </div>
    </div>
    <ElAlert v-if="recordsError" :title="recordsError" type="warning" :closable="false" show-icon />
    <ElTabs v-model="activeTab" class="clawbot-page__tabs">
      <ElTabPane label="微信绑定" name="binding">
        <ClawBotBindingTab
          :account="account"
          :status-label="accountStatusLabel"
          @changed="refreshRecords"
          @unbound="handleUnbound"
          @start-test="activeTab = 'test'"
        />
      </ElTabPane>
      <ElTabPane label="AI 连接配置" name="ai" lazy>
        <ClawBotAiConnection ref="aiConnection" />
      </ElTabPane>
      <ElTabPane label="收发测试" name="test">
        <ClawBotMessageTest ref="messageTest" :account="account" @sent="refreshRecords" />
      </ElTabPane>
      <ElTabPane label="接收记录" name="received">
        <ClawBotReceivedRecords ref="receivedRecords" :auto-refresh="autoRefresh" />
      </ElTabPane>
      <ElTabPane label="发送记录" name="sent">
        <ClawBotDeliveryRecords ref="deliveryRecords" />
      </ElTabPane>
    </ElTabs>
  </div>
</template>

<script setup lang="ts">
  import { fetchMyClawBotAccount, type WeChatClawBotAccount } from '@/api/wechat-clawbot'
  import ClawBotAiConnection from './components/ClawBotAiConnection.vue'
  import ClawBotBindingTab from './components/ClawBotBindingTab.vue'
  import ClawBotMessageTest from './components/ClawBotMessageTest.vue'
  import ClawBotReceivedRecords from './components/ClawBotReceivedRecords.vue'
  import ClawBotDeliveryRecords from './components/ClawBotDeliveryRecords.vue'

  defineOptions({ name: 'WeChatClawBot' })

  const activeTab = ref('binding')
  const autoRefresh = ref(true)
  const recordsLoading = ref(false)
  const recordsError = ref('')
  const aiConnection = ref<InstanceType<typeof ClawBotAiConnection>>()
  const messageTest = ref<InstanceType<typeof ClawBotMessageTest>>()
  const receivedRecords = ref<InstanceType<typeof ClawBotReceivedRecords>>()
  const deliveryRecords = ref<InstanceType<typeof ClawBotDeliveryRecords>>()
  const account = reactive<WeChatClawBotAccount>({
    userId: '',
    userName: '',
    status: 'Unbound',
    bound: false,
    mcpPushEnabled: true,
    adminDisabled: false,
    hasConversationContext: false
  })
  const accountStatusLabel = computed(() => {
    const labels: Record<string, string> = {
      Unbound: '未绑定',
      Bound: '已绑定',
      Disabled: '已停用'
    }
    return labels[account.status] || account.status
  })

  let recordsTimer: ReturnType<typeof setTimeout> | undefined
  let pageGeneration = 0
  let pageActive = false

  async function refreshRecords() {
    if (recordsLoading.value) return
    recordsLoading.value = true
    try {
      await Promise.all([
        fetchMyClawBotAccount().then((result) => Object.assign(account, result)),
        aiConnection.value?.refresh(false),
        receivedRecords.value?.refresh(),
        deliveryRecords.value?.refresh()
      ])
      recordsError.value = ''
    } catch {
      recordsError.value = '收发状态刷新失败，请检查服务连接或点击刷新重试。'
    } finally {
      recordsLoading.value = false
    }
  }

  async function handleUnbound() {
    messageTest.value?.resetResult()
    await refreshRecords()
  }

  function scheduleRecordsRefresh(generation: number) {
    if (!pageActive || generation !== pageGeneration) return
    recordsTimer = setTimeout(async () => {
      if (autoRefresh.value) await refreshRecords()
      scheduleRecordsRefresh(generation)
    }, 5000)
  }

  async function activatePage() {
    if (pageActive) return
    pageActive = true
    const generation = pageGeneration
    await refreshRecords()
    scheduleRecordsRefresh(generation)
  }

  function deactivatePage() {
    pageActive = false
    pageGeneration += 1
    if (recordsTimer) clearTimeout(recordsTimer)
    recordsTimer = undefined
  }

  onMounted(activatePage)
  onActivated(activatePage)
  onDeactivated(deactivatePage)
  onUnmounted(deactivatePage)
</script>

<style scoped>
  .clawbot-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
  }
  .clawbot-page__toolbar {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: var(--el-border-radius-base);
  }
  .clawbot-page__toolbar-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }
  .clawbot-page__title {
    font-size: 18px;
    font-weight: 600;
  }
  .clawbot-page__subtitle {
    margin-top: 5px;
    color: var(--art-gray-500);
  }
  .clawbot-page__tabs {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }
  .clawbot-page__tabs :deep(.el-tabs__header) {
    flex-shrink: 0;
    margin: 0 0 16px;
    padding: 0 16px;
    background: var(--el-bg-color);
    border-radius: var(--el-border-radius-base);
  }
  .clawbot-page__tabs :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .clawbot-page__tabs :deep(.el-tab-pane) {
    padding-bottom: 12px;
  }
</style>
