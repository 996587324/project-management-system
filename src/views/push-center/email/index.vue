<template>
  <div class="art-full-height email-page">
    <ElCard shadow="never">
      <template #header>
        <h2>邮件推送</h2>
        <p>统一发件账户，按系统用户选择收件人；提交后台队列，不等待邮件服务器响应。</p>
      </template>
      <ElAlert v-if="error" :title="error" type="warning" :closable="false">
        <ElButton text @click="loadCapabilities">重新加载权限</ElButton>
      </ElAlert>
      <ElTabs v-if="ready" v-model="activeTab">
        <ElTabPane label="发送邮件" name="compose" lazy>
          <EmailCompose @submitted="handleSubmitted" />
        </ElTabPane>
        <ElTabPane label="发送记录" name="records" lazy>
          <EmailRecords ref="records" :administrator="canConfigure" />
        </ElTabPane>
        <ElTabPane v-if="canConfigure" label="发件账户配置" name="setting" lazy>
          <EmailConfiguration />
        </ElTabPane>
      </ElTabs>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { fetchEmailCapabilities } from '@/api/email-push'
  import EmailCompose from './components/EmailCompose.vue'
  import EmailRecords from './components/EmailRecords.vue'
  import EmailConfiguration from './components/EmailConfiguration.vue'

  defineOptions({ name: 'EmailPush' })
  const activeTab = ref('compose')
  const canConfigure = ref(false)
  const ready = ref(false)
  const error = ref('')
  const records = ref<InstanceType<typeof EmailRecords>>()

  async function loadCapabilities() {
    error.value = ''
    try {
      const result = await fetchEmailCapabilities()
      canConfigure.value = result.canConfigure
      ready.value = true
    } catch {
      ready.value = false
      canConfigure.value = false
      error.value = '邮件权限加载失败，请检查登录状态或稍后重试。'
    }
  }

  async function handleSubmitted() {
    activeTab.value = 'records'
    await nextTick()
    await records.value?.reload()
  }

  onMounted(loadCapabilities)
  onActivated(() => {
    if (ready.value) void loadCapabilities()
  })
</script>

<style scoped>
  .email-page {
    overflow: auto;
  }

  h2 {
    margin-bottom: 8px;
    font-size: 20px;
  }

  p {
    color: var(--el-text-color-secondary);
  }
</style>
