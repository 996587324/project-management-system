<template>
  <el-form label-width="165px" class="push-config">
    <el-form-item label="定点小时推送"><el-switch v-model="board.push.enabled" /></el-form-item>
    <el-form-item label="结束后缓冲（分钟）"
      ><el-input-number v-model="board.push.delayMinutes" :min="0" :max="60"
    /></el-form-item>
    <el-form-item label="重启补发窗口（小时）"
      ><el-input-number v-model="board.push.catchUpHours" :min="1" :max="24"
    /></el-form-item>
    <el-form-item label="推送线体"
      ><el-select
        v-model="board.push.lineCodes"
        multiple
        style="width: 100%"
        placeholder="留空推送全部线体"
        ><el-option
          v-for="line in board.lines"
          :key="line.code"
          :label="line.name"
          :value="line.code" /></el-select
    ></el-form-item>
    <el-form-item label="微信接收人"
      ><el-select
        v-model="board.push.weChatUserIds"
        multiple
        filterable
        remote
        :remote-method="searchWeChat"
        :loading="loading"
        collapse-tags
        collapse-tags-tooltip
        style="width: 100%"
        placeholder="搜索已绑定并允许推送的用户"
        @visible-change="openWeChat"
        ><el-option
          v-for="user in recipients"
          :key="user.recipientCode"
          :value="user.recipientCode"
          :label="user.userName" /></el-select
    ></el-form-item>
    <el-form-item label="配置邮件渠道"
      ><el-switch v-model="emailEnabled" @change="toggleEmail"
    /></el-form-item>
    <el-form-item v-if="emailEnabled" label="邮件接收人"
      ><EmailRecipientSelect v-model="board.push.emailUserIds"
    /></el-form-item>
    <el-alert type="info" :closable="false"
      >仅为完整小时生成报表。到点提交已有微信/邮件队列，不直接发送；入队不等于送达。模型失败不影响推送。已生成报表冻结，不因补传自动反复推送。外部任务也可经
      MCP 读取后调用推送工具。</el-alert
    >
  </el-form>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import request from '@/utils/http'
  import { normalizeClawBotAi } from '@/api/wechat-clawbot-ai'
  import type { HourlyBoard } from '@/api/hourly-production'
  import EmailRecipientSelect from '@/components/business/email-recipient-select/index.vue'
  const board = defineModel<HourlyBoard>({ required: true })
  const recipients = ref<{ recipientCode: string; userName: string }[]>([])
  const loading = ref(false)
  const emailEnabled = ref(board.value.push.emailUserIds.length > 0)
  watch(
    () => board.value,
    (value) => {
      emailEnabled.value = value.push.emailUserIds.length > 0
    }
  )

  function toggleEmail(value: boolean | string | number) {
    if (!value) board.value.push.emailUserIds = []
  }
  let revision = 0

  async function searchWeChat(keyword = '') {
    const current = ++revision
    loading.value = true
    try {
      const result = normalizeClawBotAi<{ records: typeof recipients.value }>(
        await request.get({
          url: '/api/hourly-production/wechat-recipients',
          params: { keyword }
        })
      )
      if (current === revision) recipients.value = result.records
    } finally {
      if (current === revision) loading.value = false
    }
  }

  function openWeChat(open: boolean) {
    if (open) searchWeChat()
  }
</script>

<style scoped>
  .push-config {
    max-width: 950px;
  }
</style>
