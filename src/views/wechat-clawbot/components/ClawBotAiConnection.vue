<template>
  <ElCard v-loading="loading" shadow="never" class="ai-connection">
    <template #header>
      <div class="ai-connection__header">
        <span>微信 AI 连接配置</span>
        <ElTag :type="state?.state === 'Authorized' ? 'success' : 'info'">
          {{ stateLabel }}
        </ElTag>
      </div>
    </template>
    <ElAlert v-if="loadError" :title="loadError" type="error" :closable="false" />
    <ElAlert
      title="首次使用请保存配置并生成专属密钥，然后在微信发送：连接 专属密钥。保存配置、清空会话或重置密钥后均需重新验证。"
      type="info"
      :closable="false"
      show-icon
    />
    <ElDescriptions v-if="state" :column="2" border class="ai-connection__section">
      <ElDescriptionsItem label="今日已用 / 每日额度">
        {{ state.used }} / {{ state.configuration.dailyLimit }}（北京时间）
      </ElDescriptionsItem>
      <ElDescriptionsItem label="今日剩余">{{ state.remaining }}</ElDescriptionsItem>
      <ElDescriptionsItem label="今日应答状态">
        {{ state.dailyLimited ? '已达上限，当天静默' : '未触发超限静默' }}
      </ElDescriptionsItem>
      <ElDescriptionsItem label="连接有效至">{{
        formatUtc(state.authorizedUntilUtc)
      }}</ElDescriptionsItem>
      <ElDescriptionsItem label="锁定至">{{ formatUtc(state.lockedUntilUtc) }}</ElDescriptionsItem>
      <ElDescriptionsItem label="专属密钥">{{
        state.hasSecret ? '已设置，不可回读' : '尚未生成'
      }}</ElDescriptionsItem>
      <ElDescriptionsItem label="Agent 会话">{{ state.conversationId || '-' }}</ElDescriptionsItem>
      <ElDescriptionsItem label="当前 Agent">{{ state.activeAgentCode || '-' }}</ElDescriptionsItem>
    </ElDescriptions>
    <ElAlert
      class="ai-connection__section"
      title="推送用法：在工作模式勾选微信推送助手、邮件推送助手。可发送 @wechat-push 给某人发送内容，或 @email-push 给某人发邮件。核对预览后回复“确认”。转发上一轮结果仅支持同用户、同系统、30分钟内且授权未变更的业务回答。"
      type="info"
      :closable="false"
      show-icon
    />
    <ElForm
      :model="form"
      label-width="140px"
      class="ai-connection__section"
      :disabled="saving || !state"
    >
      <ElRow :gutter="20">
        <ElCol :xs="24" :md="12">
          <ElFormItem label="AI 自动回复"><ElSwitch v-model="form.enabled" /></ElFormItem>
          <ElFormItem label="所属系统">
            <ElSelect
              v-model="form.appCode"
              class="ai-connection__input"
              @change="onApplicationChange"
            >
              <ElOption
                v-for="app in options"
                :key="app.appCode"
                :label="app.displayName"
                :value="app.appCode"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="对话模式">
            <ElRadioGroup v-model="form.mode" @change="onModeChange">
              <ElRadioButton value="Chat">聊天</ElRadioButton>
              <ElRadioButton value="Work">工作</ElRadioButton>
            </ElRadioGroup>
          </ElFormItem>
          <ElFormItem v-if="form.mode === 'Work'" label="允许的 Agent">
            <ElSelect
              v-model="form.agentCodes"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              class="ai-connection__input"
              placeholder="可多选允许的 Agent"
              @change="onAgentSelectionChange"
            >
              <ElOption
                v-for="agent in workAgents"
                :key="agent.agentCode"
                :label="agent.name"
                :value="agent.agentCode"
              />
            </ElSelect>
            <ElText type="info">
              仅在勾选的 Agent 中按问题选择执行；可发送 @Agent编码
              问题明确指定。回复“确认”会锁定上一轮计划。
            </ElText>
          </ElFormItem>
          <ElFormItem label="验证有效期 / 小时">
            <ElInputNumber v-model="form.validHours" :min="1" :max="720" :precision="0" />
          </ElFormItem>
          <ElFormItem label="处理超时 / 秒">
            <ElInputNumber v-model="form.timeoutSeconds" :min="10" :max="300" :precision="0" />
          </ElFormItem>
        </ElCol>
        <ElCol :xs="24" :md="12">
          <ElFormItem label="每日对话次数">
            <ElInputNumber v-model="form.dailyLimit" :min="1" :max="10000" :precision="0" />
          </ElFormItem>
          <ElFormItem label="机器人每日总预算">
            <ElInputNumber v-model="form.botDailyLimit" :min="0" :max="100000" :precision="0" />
          </ElFormItem>
          <ElFormItem label="发送间隔 / 秒">
            <ElInputNumber v-model="form.sendIntervalSeconds" :min="1" :max="3600" :precision="0" />
          </ElFormItem>
          <ElFormItem label="超限提示">
            <ElInput
              v-model="form.limitMessage"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
            />
          </ElFormItem>
        </ElCol>
      </ElRow>
      <ElAlert
        v-if="selectedApplication && !selectedApplication.allResources && form.mode === 'Work'"
        title="当前账号的数据范围受限；尚未适配资源过滤的旧业务工具会拒绝执行，不会返回越权数据。"
        type="warning"
        :closable="false"
      />
      <ElText type="info">
        每日额度耗尽后仅提示一次，当天不再回复；次日北京时间 00:00 恢复。机器人总预算为 0
        时不启用本地总预算；启用后各发送来源共享预算并预留一次限额提示。平台自身限制仍然有效。
      </ElText>
      <div class="ai-connection__actions">
        <ElButton type="primary" :loading="saving" @click="save">保存配置</ElButton>
        <ElButton :disabled="!state" @click="resetSecret">生成 / 重置密钥</ElButton>
        <ElButton :disabled="!state" @click="disconnect">断开授权</ElButton>
        <ElButton :disabled="!state" @click="clearContext">清空 AI 会话</ElButton>
        <ElButton @click="refresh(false)">刷新状态</ElButton>
      </div>
    </ElForm>
    <ElDivider />
    <div class="ai-connection__header"
      ><span>AI 处理记录</span
      ><ElText type="info">仅显示当前用户，不自动重试不确定的业务操作</ElText></div
    >
    <ElTable :data="jobs" class="ai-connection__section">
      <ElTableColumn prop="id" label="任务" width="80" />
      <ElTableColumn label="状态" width="115"
        ><template #default="{ row }">{{ jobStatusLabel(row.status) }}</template></ElTableColumn
      >
      <ElTableColumn label="类型" width="100"
        ><template #default="{ row }">{{ kindLabel(row.kind) }}</template></ElTableColumn
      >
      <ElTableColumn prop="agentCode" label="执行 Agent" min-width="150" show-overflow-tooltip />
      <ElTableColumn prop="reply" label="回复" min-width="220" show-overflow-tooltip />
      <ElTableColumn prop="error" label="处理说明" min-width="220" show-overflow-tooltip />
      <ElTableColumn prop="conversationId" label="会话" width="85" />
      <ElTableColumn prop="deliveryId" label="投递记录" width="100" />
      <ElTableColumn label="创建时间" width="185"
        ><template #default="{ row }">{{ formatUtc(row.createTimeUtc) }}</template></ElTableColumn
      >
    </ElTable>
    <div class="ai-connection__actions">
      <ElButton :disabled="page <= 1" @click="changePage(-1)">上一页</ElButton>
      <span>第 {{ page }} 页</span>
      <ElButton :disabled="jobs.length < 20" @click="changePage(1)">下一页</ElButton>
    </div>
    <ElDialog
      v-model="secretVisible"
      title="专属连接密钥（仅展示本次）"
      width="min(620px, 94vw)"
      @closed="secret = ''"
    >
      <ElAlert
        title="请妥善保存，不要放入日志或发给其他人。关闭后不能再次查看，只能重新生成。"
        type="warning"
        :closable="false"
      />
      <ElInput
        :model-value="`连接 ${secret}`"
        readonly
        type="textarea"
        :rows="3"
        class="ai-connection__section"
      />
      <template #footer
        ><ElButton type="primary" @click="secretVisible = false">已保存，关闭</ElButton></template
      >
    </ElDialog>
  </ElCard>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchClawBotAiState,
    fetchClawBotAiOptions,
    fetchClawBotAiJobs,
    saveClawBotAiConfiguration,
    resetClawBotAiSecret,
    disconnectClawBotAi,
    resetClawBotAiContext,
    type ClawBotAiConfiguration,
    type ClawBotAiState,
    type ClawBotAiOption,
    type ClawBotAiJob
  } from '@/api/wechat-clawbot-ai'

  const state = ref<ClawBotAiState>()
  const options = ref<ClawBotAiOption[]>([])
  const jobs = ref<ClawBotAiJob[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const loadError = ref('')
  const page = ref(1)
  const secret = ref('')
  const secretVisible = ref(false)
  const form = reactive<ClawBotAiConfiguration>({
    enabled: false,
    appCode: 'A',
    mode: 'Chat',
    agentCode: 'chat',
    agentCodes: [],
    validHours: 24,
    dailyLimit: 50,
    botDailyLimit: 0,
    sendIntervalSeconds: 5,
    timeoutSeconds: 120,
    limitMessage: '今日 AI 对话次数已用完，请明日再试。'
  })
  const selectedApplication = computed(() =>
    options.value.find((app) => app.appCode === form.appCode)
  )
  const workAgents = computed(
    () => selectedApplication.value?.agents.filter((agent) => agent.agentCode !== 'chat') || []
  )
  const stateLabel = computed(
    () =>
      (
        ({
          Disabled: '已关闭',
          Unbound: '未绑定 / 已停用',
          Unverified: '未验证',
          Authorized: '已验证',
          Expired: '已过期',
          Locked: '验证锁定'
        }) as Record<string, string>
      )[state.value?.state || ''] || '加载中'
  )

  function formatUtc(value?: string) {
    if (!value) return '-'
    const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`)
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false })
  }

  function jobStatusLabel(status: string) {
    const labels: Record<string, string> = {
      Pending: '排队中',
      Running: '执行中',
      ReplyPending: '等待回复',
      Sending: '发送中',
      Sent: '已回复',
      Failed: '失败',
      Unknown: '结果待核对',
      Cancelled: '已取消'
    }
    return labels[status] || status
  }

  function kindLabel(kind: string) {
    return (
      (
        {
          Agent: 'AI 对话',
          Control: '连接提示',
          Limit: '额度提示',
          Error: '异常提示',
          ExecutionUnknown: '操作核对提示'
        } as Record<string, string>
      )[kind] || kind
    )
  }

  function onApplicationChange() {
    if (form.mode === 'Work') {
      form.agentCodes = []
      form.agentCode = ''
    }
  }

  function onModeChange() {
    form.agentCodes =
      form.mode === 'Chat' ? [] : workAgents.value.slice(0, 1).map((agent) => agent.agentCode)
    form.agentCode = form.mode === 'Chat' ? 'chat' : form.agentCodes[0] || ''
  }

  function onAgentSelectionChange() {
    form.agentCode = form.agentCodes[0] || ''
  }

  async function refresh(updateForm = false) {
    if (loading.value) return
    loading.value = true
    try {
      const [current, choices, records] = await Promise.all([
        fetchClawBotAiState(),
        updateForm || options.value.length === 0
          ? fetchClawBotAiOptions()
          : Promise.resolve(options.value),
        fetchClawBotAiJobs(page.value)
      ])
      state.value = current
      options.value = choices
      jobs.value = records
      if (updateForm) {
        Object.assign(form, current.configuration, {
          agentCodes: [
            ...(current.configuration.agentCodes ??
              (current.configuration.mode === 'Work' ? [current.configuration.agentCode] : []))
          ]
        })
      }
      loadError.value = ''
    } catch {
      loadError.value = 'AI 连接配置加载失败，请检查权限、后端版本后重新刷新。'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (saving.value || !state.value) return
    if (
      !options.value.some((app) => app.appCode === form.appCode) ||
      (form.mode === 'Work' &&
        (form.agentCodes.length === 0 ||
          form.agentCodes.some(
            (code) => !workAgents.value.some((agent) => agent.agentCode === code)
          )))
    ) {
      ElMessage.warning('请选择有权使用的系统及 Agent')
      return
    }
    saving.value = true
    try {
      const codes = form.mode === 'Work' ? [...new Set(form.agentCodes)] : []
      await saveClawBotAiConfiguration({
        ...form,
        agentCodes: codes,
        agentCode: form.mode === 'Chat' ? 'chat' : codes[0]
      })
      ElMessage.success('配置已保存，请在微信重新验证密钥')
      await refresh(true)
    } finally {
      saving.value = false
    }
  }

  async function confirmAction(message: string, action: () => Promise<unknown>) {
    try {
      await ElMessageBox.confirm(message, '操作确认', { type: 'warning' })
    } catch {
      return
    }
    await action()
    await refresh(false)
  }

  async function resetSecret() {
    await confirmAction('重置后旧密钥及连接授权立即失效，是否继续？', async () => {
      const result = await resetClawBotAiSecret()
      secret.value = result.secret
      secretVisible.value = true
    })
  }

  async function disconnect() {
    await confirmAction('断开后停止未执行任务，并需重新验证密钥，是否继续？', disconnectClawBotAi)
  }

  async function clearContext() {
    await confirmAction(
      '清空会话关联和待确认计划入口，并需重新验证密钥，是否继续？',
      resetClawBotAiContext
    )
  }

  async function changePage(delta: number) {
    page.value += delta
    await refresh(false)
  }

  defineExpose({ refresh })
  onMounted(() => refresh(true))
  onDeactivated(() => {
    secretVisible.value = false
    secret.value = ''
  })
</script>

<style scoped>
  .ai-connection__header,
  .ai-connection__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }

  .ai-connection__header {
    justify-content: space-between;
  }

  .ai-connection__section,
  .ai-connection__actions {
    margin-top: 20px;
  }

  .ai-connection__input {
    width: 100%;
  }
</style>
