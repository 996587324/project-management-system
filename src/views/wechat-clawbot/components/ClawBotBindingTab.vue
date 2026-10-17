<template>
  <ElCard shadow="never">
    <template #header>
      <div class="binding-header">
        <div>
          <div class="binding-title">微信 ClawBot</div>
          <div class="binding-subtitle"
            >绑定后可接收系统及外部 MCP 推送；微信凭证不会显示在页面中。</div
          >
        </div>
        <ElTag :type="account.bound ? 'success' : 'info'">{{
          account.bound ? '已绑定' : '未绑定'
        }}</ElTag>
      </div>
    </template>
    <ElDescriptions :column="2" border>
      <ElDescriptionsItem label="当前状态">{{ statusLabel }}</ElDescriptionsItem>
      <ElDescriptionsItem label="最近发送">{{ account.lastSendTime || '-' }}</ElDescriptionsItem>
      <ElDescriptionsItem label="MCP 外部推送">
        <ElSwitch
          v-model="pushEnabled"
          :disabled="!account.bound || account.adminDisabled || pushSaving"
          @change="updatePushEnabled"
        />
        <span class="binding-switch-label">{{ pushEnabled ? '允许' : '已关闭' }}</span>
      </ElDescriptionsItem>
      <ElDescriptionsItem label="管理员状态">{{
        account.adminDisabled ? '已被管理员停用' : '正常'
      }}</ElDescriptionsItem>
      <ElDescriptionsItem label="消息会话">{{
        account.hasConversationContext ? '已建立，可测试发送' : '请先在微信发送一条消息'
      }}</ElDescriptionsItem>
      <ElDescriptionsItem label="最近接收">{{ account.lastInboundTime || '-' }}</ElDescriptionsItem>
      <ElDescriptionsItem v-if="account.lastError" :span="2" label="最近错误">
        <ElText type="danger">{{ account.lastError }}</ElText>
      </ElDescriptionsItem>
    </ElDescriptions>
    <div class="binding-actions">
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
  <ClawBotBindingDialog
    ref="bindingDialog"
    @confirmed="emit('changed')"
    @start-test="emit('start-test')"
  />
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import {
    setMyClawBotMcpPushEnabled,
    unbindClawBot,
    type WeChatClawBotAccount
  } from '@/api/wechat-clawbot'
  import ClawBotBindingDialog from './ClawBotBindingDialog.vue'

  const props = defineProps<{ account: WeChatClawBotAccount; statusLabel: string }>()
  const emit = defineEmits<{ changed: []; unbound: []; 'start-test': [] }>()
  const bindingDialog = ref<InstanceType<typeof ClawBotBindingDialog>>()
  const bindingLoading = ref(false)
  const pushEnabled = ref(props.account.mcpPushEnabled)
  const pushSaving = ref(false)

  watch(
    () => props.account.mcpPushEnabled,
    (enabled) => {
      pushEnabled.value = enabled
    }
  )

  async function openBinding() {
    if (bindingLoading.value) return
    bindingLoading.value = true
    try {
      await bindingDialog.value?.open()
    } finally {
      bindingLoading.value = false
    }
  }

  async function updatePushEnabled(enabled: boolean | string | number) {
    pushSaving.value = true
    try {
      await setMyClawBotMcpPushEnabled(Boolean(enabled))
      ElMessage.success('推送授权已更新')
    } catch {
      pushEnabled.value = props.account.mcpPushEnabled
    } finally {
      pushSaving.value = false
      emit('changed')
    }
  }

  async function unbind() {
    bindingDialog.value?.close()
    await unbindClawBot()
    emit('unbound')
    ElMessage.success('已解绑')
  }
</script>

<style scoped>
  .binding-header {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  }
  .binding-title {
    font-size: 18px;
    font-weight: 600;
  }
  .binding-subtitle {
    margin-top: 5px;
    color: var(--art-gray-500);
  }
  .binding-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 18px;
  }
  .binding-switch-label {
    margin-left: 8px;
    color: var(--art-gray-600);
  }
</style>
