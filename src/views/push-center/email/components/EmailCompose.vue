<template>
  <ElAlert
    title="邮件将通过管理员统一配置的发件账户发送。已加入队列不代表对方已收到或阅读。"
    type="info"
    :closable="false"
  />
  <ElForm label-position="top" class="compose-form">
    <ElFormItem label="收件人" required>
      <EmailRecipientSelect v-model="form.recipientUserIds" />
    </ElFormItem>
    <ElFormItem label="抄送">
      <EmailRecipientSelect v-model="form.ccUserIds" />
    </ElFormItem>
    <ElFormItem label="主题" required>
      <ElInput v-model="form.subject" maxlength="160" show-word-limit />
    </ElFormItem>
    <ElFormItem label="正文（纯文本）" required>
      <ElInput v-model="form.body" type="textarea" :rows="10" maxlength="100000" show-word-limit />
    </ElFormItem>
    <ElButton type="primary" :loading="submitting" @click="submit">确认并加入发送队列</ElButton>
  </ElForm>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import EmailRecipientSelect from '@/components/business/email-recipient-select/index.vue'
  import { createEmailRequestKey, enqueueEmail } from '@/api/email-push'

  const emit = defineEmits<{ submitted: [] }>()
  const submitting = ref(false)
  const form = reactive({
    recipientUserIds: [] as string[],
    ccUserIds: [] as string[],
    subject: '',
    body: ''
  })
  const requestKey = ref(createEmailRequestKey())
  let lastPayload = ''

  async function submit() {
    if (submitting.value) return
    if (!form.recipientUserIds.length || !form.subject.trim() || !form.body.trim()) {
      ElMessage.warning('请选择收件用户并填写主题、正文')
      return
    }
    if (new Set([...form.recipientUserIds, ...form.ccUserIds]).size > 100) {
      ElMessage.warning('收件及抄送用户合计最多100人')
      return
    }
    try {
      await ElMessageBox.confirm('确认使用系统统一发件账户向所选用户发送邮件？', '确认邮件推送', {
        type: 'warning'
      })
    } catch {
      return
    }
    const payload = JSON.stringify(form)
    if (lastPayload && lastPayload !== payload) requestKey.value = createEmailRequestKey()
    lastPayload = payload
    submitting.value = true
    try {
      const result = await enqueueEmail({
        ...form,
        idempotencyKey: requestKey.value,
        confirm: true
      })
      ElMessage.success(`${result.message}，任务编号：${result.taskId}`)
      Object.assign(form, { recipientUserIds: [], ccUserIds: [], subject: '', body: '' })
      requestKey.value = createEmailRequestKey()
      lastPayload = ''
      emit('submitted')
    } finally {
      submitting.value = false
    }
  }
</script>

<style scoped>
  .compose-form {
    max-width: 1000px;
    margin-top: 20px;
  }
</style>
