<template>
  <ElDialog
    v-model="visible"
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
      sub-title="请先在微信发送一条消息，然后切换「收发测试」进行测试。"
    />
    <div v-else class="binding-qr">
      <!-- 微信返回的是扫码链接，需要编码成二维码，不能当作远程图片地址。 -->
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
      <ElText v-if="binding.qrcode" class="binding-qr-code" type="info"
        >二维码标识：{{ binding.qrcode }}</ElText
      >
      <ElTag
        :type="['Expired', 'Failed', 'Blocked'].includes(binding.status) ? 'danger' : 'warning'"
        >{{ statusLabel }}</ElTag
      >
      <ElText v-if="binding.expireTime" type="info">有效期至：{{ binding.expireTime }}</ElText>
      <ElText v-if="binding.message">{{ binding.message }}</ElText>
      <ElForm
        v-if="binding.status === 'NeedVerifyCode'"
        class="binding-verify"
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
      <ElButton @click="finishBinding">{{
        binding.status === 'Confirmed' ? '开始消息测试' : '关闭'
      }}</ElButton>
      <ElButton
        v-if="['Expired', 'Failed', 'Blocked'].includes(binding.status)"
        type="primary"
        :loading="loading"
        @click="open"
        >重新生成</ElButton
      >
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import QrcodeVue from 'qrcode.vue'
  import {
    createClawBotBinding,
    fetchClawBotBindingStatus,
    verifyClawBotBinding,
    type WeChatClawBotBinding
  } from '@/api/wechat-clawbot'

  const emit = defineEmits<{ confirmed: []; 'start-test': [] }>()
  const visible = ref(false)
  const loading = ref(false)
  const verifyCode = ref('')
  const verifySubmitting = ref(false)
  const binding = reactive<WeChatClawBotBinding>({ sessionId: 0, status: 'Waiting' })
  let pollingTimer: ReturnType<typeof setTimeout> | undefined
  let pollController: AbortController | undefined
  let pollingGeneration = 0

  const statusLabel = computed(() => {
    const labels: Record<string, string> = {
      Waiting: '等待扫码',
      Scanned: '已扫码，等待手机确认',
      NeedVerifyCode: '需要验证码',
      Confirmed: '绑定成功',
      Expired: '二维码已过期',
      Blocked: '验证受限',
      Failed: '绑定失败'
    }
    return labels[binding.status] || binding.status
  })

  async function open() {
    if (loading.value) return
    stopPolling()
    const generation = pollingGeneration
    loading.value = true
    try {
      const result = await createClawBotBinding()
      if (generation !== pollingGeneration) return
      if (!result.sessionId) throw new Error('后端未返回有效二维码会话，请更新后端后重试。')
      Object.assign(binding, result)
      verifyCode.value = ''
      visible.value = true
      void pollBindingStatus(generation)
    } catch (error) {
      if (generation === pollingGeneration)
        ElMessage.error(error instanceof Error ? error.message : '无法创建二维码，请稍后重试。')
    } finally {
      loading.value = false
    }
  }

  async function pollBindingStatus(generation: number, code?: string) {
    if (!binding.sessionId || !visible.value || generation !== pollingGeneration) return
    const controller = new AbortController()
    pollController = controller
    try {
      const previousStatus = binding.status
      const result = code
        ? await verifyClawBotBinding(binding.sessionId, code, controller.signal)
        : await fetchClawBotBindingStatus(binding.sessionId, controller.signal)
      if (controller.signal.aborted || generation !== pollingGeneration) return
      Object.assign(binding, result)
      if (binding.status === 'Scanned' && previousStatus !== 'Scanned')
        ElMessage.info('已扫码，请在手机微信中确认。')
      if (binding.status === 'Confirmed') {
        stopPolling()
        ElMessage.success('微信 ClawBot 绑定成功')
        emit('confirmed')
      } else if (['Expired', 'Failed', 'Blocked'].includes(binding.status)) {
        stopPolling()
        ElMessage.warning(binding.message || statusLabel.value)
      }
    } catch (error) {
      if (!controller.signal.aborted && generation === pollingGeneration)
        binding.message = error instanceof Error ? error.message : '状态查询失败，正在重试。'
    } finally {
      if (pollController === controller) pollController = undefined
      verifySubmitting.value = false
      if (generation === pollingGeneration && visible.value && binding.status !== 'NeedVerifyCode')
        pollingTimer = setTimeout(() => void pollBindingStatus(generation), 1500)
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

  function close() {
    visible.value = false
    stopPolling()
  }

  function finishBinding() {
    close()
    if (binding.status === 'Confirmed') emit('start-test')
  }

  defineExpose({ open, close })
  onDeactivated(close)
  onUnmounted(close)
</script>

<style scoped>
  .binding-qr {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    margin-top: 20px;
    text-align: center;
  }
  .binding-qr-code {
    max-width: 100%;
    word-break: break-all;
  }
  .binding-verify {
    width: 100%;
  }
</style>
