<template>
  <ElCard shadow="never" id="clawbot-message-test">
    <template #header><div class="test-title">消息收发测试</div></template>
    <ElAlert
      :title="
        account.hasConversationContext
          ? '会话已建立，测试消息将发送到当前登录用户绑定的微信 ClawBot。'
          : '绑定成功后，请先在微信向 ClawBot 发送一条消息。在「接收记录」看到消息后，即可在此测试网页发送。'
      "
      :type="account.hasConversationContext ? 'success' : 'info'"
      :closable="false"
      show-icon
    />
    <ElInput
      v-model="testContent"
      class="test-section"
      type="textarea"
      :rows="4"
      maxlength="10000"
      show-word-limit
      placeholder="输入要发送到微信的测试内容"
      :disabled="!account.bound || account.adminDisabled"
    />
    <div class="test-section">
      <ElButton type="primary" :loading="testSending" :disabled="!canSendTest" @click="sendTest"
        >发送测试消息</ElButton
      >
    </div>
    <ElAlert
      v-if="testResult"
      class="test-section"
      :title="
        testResult.status === 'Sent'
          ? '测试消息发送成功，请在微信查看。'
          : `发送失败：${testResult.errorMessage || '请查看发送记录'}`
      "
      :type="testResult.status === 'Sent' ? 'success' : 'error'"
      :closable="false"
      show-icon
    />
  </ElCard>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import {
    sendMyClawBotTest,
    type WeChatClawBotAccount,
    type WeChatClawBotDelivery
  } from '@/api/wechat-clawbot'

  const props = defineProps<{ account: WeChatClawBotAccount }>()
  const emit = defineEmits<{ sent: [] }>()
  const testContent = ref('这是一条来自智能制造管理系统的 ClawBot 测试消息。')
  const testSending = ref(false)
  const testResult = ref<WeChatClawBotDelivery>()
  const canSendTest = computed(
    () =>
      props.account.bound &&
      !props.account.adminDisabled &&
      props.account.hasConversationContext &&
      !!testContent.value.trim()
  )

  async function sendTest() {
    if (!canSendTest.value || testSending.value) return
    testSending.value = true
    testResult.value = undefined
    try {
      testResult.value = await sendMyClawBotTest(testContent.value.trim())
      if (testResult.value.status === 'Sent') ElMessage.success('测试消息发送成功')
      else ElMessage.error(testResult.value.errorMessage || '测试消息发送失败')
      emit('sent')
    } finally {
      testSending.value = false
    }
  }

  function resetResult() {
    testResult.value = undefined
  }

  defineExpose({ resetResult })
</script>

<style scoped>
  .test-title {
    font-size: 18px;
    font-weight: 600;
  }
  .test-section {
    margin-top: 16px;
  }
</style>
