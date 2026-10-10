<template>
  <div class="clawbot-page art-full-height">
    <ElCard shadow="never">
      <template #header>
        <div class="clawbot-page__header">
          <div>
            <div class="clawbot-page__title">微信 ClawBot</div>
            <div class="clawbot-page__subtitle"
              >绑定后可接收系统及外部 MCP 推送；微信凭证不会显示在页面中。</div
            >
          </div>
          <ElTag :type="account.bound ? 'success' : 'info'">{{
            account.bound ? '已绑定' : '未绑定'
          }}</ElTag>
        </div>
      </template>

      <ElDescriptions :column="2" border>
        <ElDescriptionsItem label="当前状态">{{ accountStatusLabel }}</ElDescriptionsItem>
        <ElDescriptionsItem label="最近发送">{{ account.lastSendTime || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="MCP 外部推送">
          <ElSwitch
            v-model="account.mcpPushEnabled"
            :disabled="!account.bound || account.adminDisabled"
            @change="updatePushEnabled"
          />
          <span class="clawbot-page__switch-label">{{
            account.mcpPushEnabled ? '允许' : '已关闭'
          }}</span>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="管理员状态">
          {{ account.adminDisabled ? '已被管理员停用' : '正常' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="消息会话">
          {{ account.hasConversationContext ? '已建立，可测试发送' : '请先在微信发送一条消息' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="最近接收">{{
          account.lastInboundTime || '-'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem v-if="account.lastError" :span="2" label="最近错误">
          <ElText type="danger">{{ account.lastError }}</ElText>
        </ElDescriptionsItem>
      </ElDescriptions>

      <div class="clawbot-page__actions">
        <ElButton type="primary" :loading="bindingLoading" @click="openBinding">{{
          account.bound ? '重新绑定' : '扫码绑定'
        }}</ElButton>
        <ElPopconfirm
          v-if="account.bound"
          title="解绑后将停止所有微信推送，确定继续吗？"
          @confirm="unbind"
        >
          <template #reference><ElButton type="danger" plain>解绑</ElButton></template>
        </ElPopconfirm>
      </div>
    </ElCard>

    <ElCard shadow="never" id="clawbot-message-test">
      <template #header><div class="clawbot-page__title">消息收发测试</div></template>
      <ElAlert
        :title="
          account.hasConversationContext
            ? '会话已建立，测试消息将发送到当前登录用户绑定的微信 ClawBot。'
            : '绑定成功后，请先在微信向 ClawBot 发送一条消息。下方收到消息后，即可测试网页发送。'
        "
        :type="account.hasConversationContext ? 'success' : 'info'"
        :closable="false"
        show-icon
      />
      <ElInput
        v-model="testContent"
        class="clawbot-page__test-input"
        type="textarea"
        :rows="4"
        maxlength="10000"
        show-word-limit
        placeholder="输入要发送到微信的测试内容"
        :disabled="!account.bound || account.adminDisabled"
      />
      <div class="clawbot-page__actions">
        <ElButton type="primary" :loading="testSending" :disabled="!canSendTest" @click="sendTest">
          发送测试消息
        </ElButton>
        <ElButton :loading="recordsLoading" @click="refreshRecords">刷新收发状态</ElButton>
        <ElSwitch v-model="autoRefresh" active-text="自动刷新" />
      </div>
      <ElAlert
        v-if="testResult"
        class="clawbot-page__test-result"
        :title="
          testResult.status === 'Sent'
            ? '测试消息发送成功，请在微信查看。'
            : `发送失败：${testResult.errorMessage || '请查看发送记录'}`
        "
        :type="testResult.status === 'Sent' ? 'success' : 'error'"
        :closable="false"
        show-icon
      />
      <ElAlert
        v-if="recordsError"
        class="clawbot-page__test-result"
        :title="recordsError"
        type="warning"
        :closable="false"
        show-icon
      />
    </ElCard>

    <ElCard shadow="never" class="clawbot-page__history">
      <template #header>
        <div class="clawbot-page__header">
          <div class="clawbot-page__title">微信接收记录</div>
          <ElText type="info">自动刷新间隔 5 秒</ElText>
        </div>
      </template>
      <ElTable
        :data="messages.records"
        v-loading="recordsLoading"
        empty-text="尚未收到消息，请在微信向 ClawBot 发送文字"
      >
        <ElTableColumn label="类型" width="100">
          <template #default="{ row }">{{ messageTypeLabel(row.messageType) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="content" label="内容" min-width="320" show-overflow-tooltip />
        <ElTableColumn prop="messageTime" label="微信发送时间" width="180" />
        <ElTableColumn prop="receivedTime" label="接收时间" width="180" />
      </ElTable>
      <div class="clawbot-page__pagination">
        <ElPagination
          v-model:current-page="messages.current"
          :page-size="messages.size"
          layout="total, prev, pager, next"
          :total="messages.total"
          @current-change="refreshRecords"
        />
      </div>
    </ElCard>

    <ElCard shadow="never" class="clawbot-page__history">
      <template #header><div class="clawbot-page__title">微信发送记录</div></template>
      <ElTable :data="deliveries.records" v-loading="deliveryLoading">
        <ElTableColumn prop="source" label="来源" width="110" />
        <ElTableColumn prop="content" label="内容" min-width="320" show-overflow-tooltip />
        <ElTableColumn prop="status" label="结果" width="100">
          <template #default="{ row }"
            ><ElTag :type="row.status === 'Sent' ? 'success' : 'danger'">{{
              deliveryStatusLabel(row.status)
            }}</ElTag></template
          >
        </ElTableColumn>
        <ElTableColumn prop="durationMs" label="耗时" width="100"
          ><template #default="{ row }">{{ row.durationMs }} ms</template></ElTableColumn
        >
        <ElTableColumn prop="createTime" label="创建时间" width="180" />
        <ElTableColumn prop="errorMessage" label="失败原因" min-width="220" show-overflow-tooltip />
      </ElTable>
      <div class="clawbot-page__pagination">
        <ElPagination
          v-model:current-page="deliveries.current"
          v-model:page-size="deliveries.size"
          layout="total, prev, pager, next"
          :total="deliveries.total"
          @current-change="refreshRecords"
        />
      </div>
    </ElCard>

    <ElDialog
      v-model="bindingVisible"
      title="扫码绑定微信 ClawBot"
      width="min(460px, 94vw)"
      destroy-on-close
      @close="stopPolling"
    >
      <ElAlert
        title="请使用已开通 ClawBot 的微信扫码确认。二维码仅用于当前登录用户，过期后请重新生成。"
        type="info"
        :closable="false"
        show-icon
      />
      <ElResult
        v-if="binding.status === 'Confirmed'"
        icon="success"
        title="微信 ClawBot 绑定成功"
        sub-title="请先在微信发送一条消息，然后到下方消息收发测试区域进行测试。"
      />
      <div v-else class="clawbot-page__qr">
        <!-- 微信返回的是扫码链接，需要编码成二维码，不能作为远程图片地址加载。 -->
        <QrcodeVue
          v-if="binding.qrcodeUrl"
          :value="binding.qrcodeUrl"
          :size="260"
          :margin="4"
          level="M"
          render-as="svg"
          background="#ffffff"
          foreground="#000000"
          role="img"
          aria-label="微信 ClawBot 绑定二维码"
        />
        <ElEmpty v-else description="暂无可用二维码，请重新生成" />
        <ElText v-if="binding.qrcode" class="clawbot-page__qr-code" type="info"
          >二维码标识：{{ binding.qrcode }}</ElText
        >
        <ElTag
          :type="
            binding.status === 'Confirmed'
              ? 'success'
              : ['Expired', 'Failed', 'Blocked'].includes(binding.status)
                ? 'danger'
                : 'warning'
          "
          >{{ bindingStatusLabel }}</ElTag
        >
        <ElText v-if="binding.expireTime" type="info">有效期至：{{ binding.expireTime }}</ElText>
        <ElText v-if="binding.message">{{ binding.message }}</ElText>
        <ElForm
          v-if="binding.status === 'NeedVerifyCode'"
          class="clawbot-page__verify"
          @submit.prevent="submitVerifyCode"
        >
          <ElFormItem label="微信验证码">
            <ElInput
              v-model.trim="verifyCode"
              inputmode="numeric"
              maxlength="16"
              placeholder="输入手机微信显示的数字"
              :disabled="verifySubmitting"
            />
          </ElFormItem>
          <ElButton type="primary" native-type="submit" :loading="verifySubmitting"
            >提交验证码</ElButton
          >
        </ElForm>
      </div>
      <template #footer>
        <ElButton @click="bindingVisible = false">{{
          binding.status === 'Confirmed' ? '开始消息测试' : '关闭'
        }}</ElButton>
        <ElButton
          v-if="['Expired', 'Failed', 'Blocked'].includes(binding.status)"
          type="primary"
          :loading="bindingLoading"
          @click="openBinding"
          >重新生成</ElButton
        >
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import QrcodeVue from 'qrcode.vue'
  import {
    createClawBotBinding,
    fetchClawBotBindingStatus,
    fetchMyClawBotAccount,
    fetchMyClawBotDeliveries,
    fetchMyClawBotMessages,
    sendMyClawBotTest,
    verifyClawBotBinding,
    setMyClawBotMcpPushEnabled,
    unbindClawBot,
    type WeChatClawBotAccount,
    type WeChatClawBotBinding,
    type WeChatClawBotPage,
    type WeChatClawBotDelivery,
    type WeChatClawBotInboundMessage
  } from '@/api/wechat-clawbot'

  defineOptions({ name: 'WeChatClawBot' })

  const account = reactive<WeChatClawBotAccount>({
    userId: '',
    userName: '',
    status: 'Unbound',
    bound: false,
    mcpPushEnabled: true,
    adminDisabled: false,
    hasConversationContext: false
  })
  const binding = reactive<WeChatClawBotBinding>({ sessionId: 0, status: 'Waiting' })
  const deliveries = reactive<WeChatClawBotPage<WeChatClawBotDelivery>>({
    records: [],
    current: 1,
    size: 10,
    total: 0
  })
  const bindingVisible = ref(false)
  const bindingLoading = ref(false)
  const deliveryLoading = ref(false)
  const recordsLoading = ref(false)
  const recordsError = ref('')
  const autoRefresh = ref(true)
  const verifyCode = ref('')
  const verifySubmitting = ref(false)
  const testContent = ref('这是一条来自智能制造管理系统的 ClawBot 测试消息。')
  const testSending = ref(false)
  const testResult = ref<WeChatClawBotDelivery>()
  const messages = reactive<WeChatClawBotPage<WeChatClawBotInboundMessage>>({
    records: [],
    current: 1,
    size: 10,
    total: 0
  })
  let pollingTimer: ReturnType<typeof setTimeout> | undefined
  let recordsTimer: ReturnType<typeof setTimeout> | undefined
  let pollController: AbortController | undefined
  let pollingGeneration = 0
  let pageGeneration = 0
  let pageActive = false

  const accountStatusLabel = computed(
    () =>
      ({
        Unbound: '未绑定',
        Bound: '已绑定',
        Disabled: '已停用'
      })[account.status] || account.status
  )
  const bindingStatusLabel = computed(
    () =>
      ({
        Waiting: '等待扫码',
        Scanned: '已扫码，等待手机确认',
        NeedVerifyCode: '需要验证码',
        Confirmed: '绑定成功',
        Expired: '二维码已过期',
        Blocked: '验证受限',
        Failed: '绑定失败'
      })[binding.status] || binding.status
  )
  const canSendTest = computed(
    () =>
      account.bound &&
      !account.adminDisabled &&
      account.hasConversationContext &&
      !!testContent.value.trim()
  )

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

  function deliveryStatusLabel(status: string) {
    const labels: Record<string, string> = {
      Sent: '发送成功',
      Failed: '发送失败',
      Sending: '发送中',
      Pending: '待发送'
    }
    return labels[status] || status
  }

  async function loadAccount() {
    Object.assign(account, await fetchMyClawBotAccount())
  }

  async function loadDeliveries() {
    deliveryLoading.value = true
    try {
      Object.assign(
        deliveries,
        await fetchMyClawBotDeliveries({ current: deliveries.current, size: deliveries.size })
      )
    } finally {
      deliveryLoading.value = false
    }
  }

  async function openBinding() {
    stopPolling()
    const generation = pollingGeneration
    bindingLoading.value = true
    try {
      const result = await createClawBotBinding()
      if (generation !== pollingGeneration) return
      if (!result.sessionId) throw new Error('后端未返回有效二维码会话，请更新后端后重试。')
      Object.assign(binding, result)
      verifyCode.value = ''
      bindingVisible.value = true
      void pollBindingStatus(generation)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '无法创建二维码，请稍后重试。')
    } finally {
      bindingLoading.value = false
    }
  }

  async function pollBindingStatus(generation: number, code?: string) {
    if (!binding.sessionId || !bindingVisible.value || generation !== pollingGeneration) return
    const controller = new AbortController()
    pollController = controller
    try {
      const previousStatus = binding.status
      const result = code
        ? await verifyClawBotBinding(binding.sessionId, code, controller.signal)
        : await fetchClawBotBindingStatus(binding.sessionId, controller.signal)
      if (controller.signal.aborted || generation !== pollingGeneration) return
      Object.assign(binding, result)
      if (binding.status === 'Scanned' && previousStatus !== 'Scanned') {
        ElMessage.info('已扫码，请在手机微信中确认。')
      }
      if (binding.status === 'Confirmed') {
        stopPolling()
        ElMessage.success('微信 ClawBot 绑定成功')
        await refreshRecords()
      } else if (['Expired', 'Failed', 'Blocked'].includes(binding.status)) {
        stopPolling()
        ElMessage.warning(binding.message || bindingStatusLabel.value)
      }
    } catch (error) {
      if (!controller.signal.aborted && generation === pollingGeneration) {
        binding.message = error instanceof Error ? error.message : '状态查询失败，正在重试。'
      }
    } finally {
      if (pollController === controller) pollController = undefined
      verifySubmitting.value = false
      if (
        generation === pollingGeneration &&
        bindingVisible.value &&
        binding.status !== 'NeedVerifyCode'
      ) {
        pollingTimer = setTimeout(() => void pollBindingStatus(generation), 1500)
      }
    }
  }

  async function submitVerifyCode() {
    if (verifySubmitting.value || pollController) return
    if (!/^\d{1,16}$/.test(verifyCode.value)) {
      ElMessage.warning('请输入手机微信显示的数字验证码。')
      return
    }
    verifySubmitting.value = true
    await pollBindingStatus(pollingGeneration, verifyCode.value)
  }

  function stopPolling() {
    pollingGeneration += 1
    if (pollingTimer) clearTimeout(pollingTimer)
    pollingTimer = undefined
    pollController?.abort()
    pollController = undefined
  }

  async function refreshRecords() {
    if (recordsLoading.value) return
    recordsLoading.value = true
    try {
      await Promise.all([
        loadAccount(),
        loadDeliveries(),
        fetchMyClawBotMessages({ current: messages.current, size: messages.size }).then((result) =>
          Object.assign(messages, result)
        )
      ])
      recordsError.value = ''
    } catch {
      recordsError.value = '收发状态刷新失败，请检查服务连接或点击刷新重试。'
    } finally {
      recordsLoading.value = false
    }
  }

  function scheduleRecordsRefresh(generation: number) {
    if (!pageActive || generation !== pageGeneration) return
    recordsTimer = setTimeout(async () => {
      if (autoRefresh.value) await refreshRecords()
      scheduleRecordsRefresh(generation)
    }, 5000)
  }

  async function sendTest() {
    if (!canSendTest.value || testSending.value) return
    testSending.value = true
    testResult.value = undefined
    try {
      testResult.value = await sendMyClawBotTest(testContent.value.trim())
      if (testResult.value.status === 'Sent') ElMessage.success('测试消息发送成功')
      else ElMessage.error(testResult.value.errorMessage || '测试消息发送失败')
      await refreshRecords()
    } finally {
      testSending.value = false
    }
  }

  async function updatePushEnabled(enabled: boolean | string | number) {
    try {
      await setMyClawBotMcpPushEnabled(Boolean(enabled))
      ElMessage.success('推送授权已更新')
    } catch {
      await loadAccount()
    }
  }

  async function unbind() {
    stopPolling()
    await unbindClawBot()
    testResult.value = undefined
    await refreshRecords()
    ElMessage.success('已解绑')
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
    bindingVisible.value = false
    stopPolling()
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
  }

  .clawbot-page__header {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  }

  .clawbot-page__title {
    font-size: 18px;
    font-weight: 600;
  }

  .clawbot-page__subtitle {
    margin-top: 5px;
    color: var(--art-text-gray-500);
  }

  .clawbot-page__actions {
    display: flex;
    gap: 12px;
    margin-top: 18px;
  }

  .clawbot-page__switch-label {
    margin-left: 8px;
    color: var(--art-text-gray-600);
  }

  .clawbot-page__history {
    min-height: 0;
  }

  .clawbot-page__pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .clawbot-page__qr {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    margin-top: 20px;
    text-align: center;
  }

  .clawbot-page__qr-code {
    max-width: 100%;
    word-break: break-all;
  }

  .clawbot-page__test-input,
  .clawbot-page__test-result {
    margin-top: 16px;
  }

  .clawbot-page__verify {
    width: 100%;
  }
</style>
