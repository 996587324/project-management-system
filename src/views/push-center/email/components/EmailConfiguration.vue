<template>
  <div v-loading="loading" class="configuration">
    <ElAlert
      title="只有管理员角色可维护统一发件账户。授权码加密保存，不回显；留空保持原值，更换登录账户须重新填写。"
      type="warning"
      :closable="false"
    />
    <ElButton text @click="load">重新加载配置</ElButton>
    <ElForm v-if="loaded" label-width="140px" class="configuration-form" @submit.prevent>
      <ElFormItem label="启用邮件服务"><ElSwitch v-model="form.enabled" /></ElFormItem>
      <ElFormItem label="SMTP 地址" required
        ><ElInput
          v-model.trim="form.host"
          maxlength="256"
          placeholder="例如 smtp.example.com，不包含协议或端口"
      /></ElFormItem>
      <ElFormItem label="连接加密" required>
        <ElSelect v-model="form.security">
          <ElOption label="STARTTLS（通常587）" value="StartTls" />
          <ElOption label="SSL/TLS（通常465）" value="SslOnConnect" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="端口" required
        ><ElInputNumber v-model="form.port" :min="1" :max="65535"
      /></ElFormItem>
      <ElFormItem label="登录账户" required
        ><ElInput v-model.trim="form.userName" maxlength="256" autocomplete="off"
      /></ElFormItem>
      <ElFormItem label="密码／授权码">
        <ElInput
          v-model="form.password"
          type="password"
          show-password
          autocomplete="new-password"
          maxlength="512"
          :placeholder="hasPassword ? '已配置，留空不修改' : '请输入邮箱授权码或SMTP密码'"
        />
      </ElFormItem>
      <ElFormItem label="发件邮箱" required
        ><ElInput v-model.trim="form.fromAddress" maxlength="256"
      /></ElFormItem>
      <ElFormItem label="发件人名称"
        ><ElInput v-model.trim="form.fromName" maxlength="128"
      /></ElFormItem>
      <ElFormItem label="连接超时（秒）"
        ><ElInputNumber v-model="form.timeoutSeconds" :min="5" :max="120"
      /></ElFormItem>
      <ElFormItem label="发送间隔（秒）"
        ><ElInputNumber v-model="form.intervalSeconds" :min="1" :max="86400"
      /></ElFormItem>
      <ElFormItem label="最大尝试次数"
        ><ElInputNumber v-model="form.maxAttempts" :min="1" :max="5"
      /></ElFormItem>
      <ElFormItem>
        <div class="actions">
          <ElButton type="primary" :loading="saving" :disabled="testing" @click="save"
            >保存配置</ElButton
          >
          <ElButton :loading="testing" :disabled="saving || dirty" @click="test"
            >测试已保存连接</ElButton
          >
          <ElButton
            :loading="testSending"
            :disabled="saving || dirty || !form.enabled"
            @click="sendTest"
            >发送测试邮件到本人</ElButton
          >
        </div>
      </ElFormItem>
      <p
        >修改后请先保存再测试；本人测试使用用户资料中的邮箱。服务停用后，待发送任务暂停，不会清空。</p
      >
      <p v-if="updatedAt">最近配置时间：{{ updatedAt }}</p>
    </ElForm>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    createEmailRequestKey,
    fetchEmailSetting,
    saveEmailSetting,
    testEmailConnection,
    sendEmailTest,
    type EmailSettingSave
  } from '@/api/email-push'

  const form = reactive<EmailSettingSave>({
    enabled: false,
    host: '',
    port: 587,
    security: 'StartTls',
    userName: '',
    password: '',
    fromAddress: '',
    fromName: '',
    timeoutSeconds: 30,
    intervalSeconds: 5,
    maxAttempts: 3,
    version: 0
  })
  const loading = ref(false)
  const loaded = ref(false)
  const saving = ref(false)
  const testing = ref(false)
  const testSending = ref(false)
  const hasPassword = ref(false)
  const updatedAt = ref('')
  const savedPayload = ref('')
  const dirty = computed(() => JSON.stringify(form) !== savedPayload.value)
  let testRequestKey = createEmailRequestKey()

  function applySetting(setting: Awaited<ReturnType<typeof fetchEmailSetting>>) {
    const { hasPassword: configured, updateTime, ...fields } = setting
    Object.assign(form, fields, { password: '' })
    hasPassword.value = configured
    updatedAt.value = updateTime || ''
    savedPayload.value = JSON.stringify(form)
    loaded.value = true
  }

  async function load() {
    loading.value = true
    try {
      applySetting(await fetchEmailSetting())
    } finally {
      loading.value = false
    }
  }

  async function save() {
    saving.value = true
    try {
      applySetting(await saveEmailSetting({ ...form }))
      ElMessage.success('邮件配置已保存')
    } finally {
      saving.value = false
    }
  }

  async function test() {
    testing.value = true
    try {
      await testEmailConnection()
      ElMessage.success('SMTP 连接及认证成功，未发送邮件')
    } finally {
      testing.value = false
    }
  }

  async function sendTest() {
    try {
      await ElMessageBox.confirm('向当前账号资料中的邮箱发送一封测试邮件？', '测试邮件')
    } catch {
      return
    }
    testSending.value = true
    try {
      const result = await sendEmailTest(testRequestKey)
      ElMessage.success(`${result.message}，任务编号：${result.taskId}`)
      testRequestKey = createEmailRequestKey()
    } finally {
      testSending.value = false
    }
  }

  onMounted(() => {
    void load().catch(() => {})
  })
  onBeforeUnmount(() => {
    form.password = ''
  })
  onDeactivated(() => {
    form.password = ''
  })
</script>

<style scoped>
  .configuration-form {
    max-width: 850px;
    margin-top: 12px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  p {
    color: var(--el-text-color-secondary);
  }

  @media (width <= 600px) {
    .configuration-form :deep(.el-form-item) {
      display: block;
    }

    .configuration-form :deep(.el-form-item__content) {
      margin-left: 0 !important;
    }
  }
</style>
