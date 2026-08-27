<template>
  <div class="agent-executor-shell">
    <div class="agent-executor-page" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <aside class="agent-sidebar">
        <div class="sidebar-header">
          <div v-show="!sidebarCollapsed">
            <h3>{{ assistantTitle }}</h3>
            <p>{{ sidebarDescription }}</p>
          </div>
          <div class="sidebar-actions">
            <ElTooltip :content="sidebarCollapsed ? '展开会话栏' : '收起会话栏'" placement="right">
              <ElButton
                circle
                :icon="sidebarCollapsed ? ArrowRight : ArrowLeft"
                @click="toggleSidebar"
              />
            </ElTooltip>
            <ElButton v-show="!sidebarCollapsed" type="primary" plain @click="startConversation"
              >新建</ElButton
            >
          </div>
        </div>

        <ElSelect
          v-if="isProjectAgent"
          v-show="!sidebarCollapsed"
          v-model="scopeProjectName"
          clearable
          filterable
          placeholder="限定项目范围"
          class="scope-select"
        >
          <ElOption
            v-for="project in projects"
            :key="project.id"
            :label="project.projectName"
            :value="project.projectName"
          />
        </ElSelect>

        <div v-show="!sidebarCollapsed" v-loading="conversationLoading" class="conversation-list">
          <div
            v-for="item in conversations"
            :key="item.id"
            class="conversation-item"
            :class="{ active: item.id === activeConversationId }"
            @click="loadConversation(item.id)"
          >
            <button class="conversation-content" type="button">
              <span>{{ item.title }}</span>
              <small>{{ formatTime(item.updateTime || item.createTime) }}</small>
            </button>
            <ElTooltip content="删除会话" placement="top">
              <ElButton
                class="conversation-delete"
                circle
                :icon="Delete"
                size="small"
                @click.stop="removeConversation(item)"
              />
            </ElTooltip>
          </div>
          <ElEmpty v-if="!conversationLoading && !conversations.length" description="暂无会话" />
        </div>
      </aside>

      <main class="agent-main">
        <section class="chat-panel">
          <header class="panel-header">
            <div>
              <h2>{{ panelTitle }}</h2>
              <p>{{ panelDescription }}</p>
            </div>
            <div class="panel-header-actions">
              <ElButton v-if="enableEmail" :icon="Message" plain @click="openLatestReplyEmailDialog"
                >发送当前回复</ElButton
              >
              <ElTag type="primary" effect="plain">LLM 自主选工具</ElTag>
            </div>
          </header>

          <div class="quick-actions">
            <ElButton v-for="item in suggestions" :key="item" round @click="useSuggestion(item)">
              {{ item }}
            </ElButton>
          </div>

          <div ref="messageListRef" class="message-list">
            <article
              v-for="message in messages"
              :key="message.id || `${message.role}-${message.createTime}`"
              class="message"
              :class="message.role"
            >
              <div class="message-role">{{ message.role === 'user' ? '我' : 'Agent' }}</div>
              <div class="message-content">{{ message.content }}</div>
            </article>
            <article v-if="sending" class="message assistant typing-message">
              <div class="message-role">Agent</div>
              <div class="message-content typing-content">
                <template v-if="streamingReply">
                  {{ streamingReply }}
                </template>
                <template v-else>
                  <span class="typing-dot"></span>
                  <span class="typing-dot"></span>
                  <span class="typing-dot"></span>
                  <small>{{ sendingStatus }}</small>
                </template>
              </div>
            </article>
            <ElEmpty v-if="!messages.length && !sending" :description="emptyDescription" />
          </div>

          <div v-if="latestPlan.length" class="plan-panel">
            <div class="section-title">执行计划</div>
            <ElSteps :active="latestPlan.length" direction="vertical" finish-status="success">
              <ElStep
                v-for="step in latestPlan"
                :key="`${step.sort}-${step.toolName}`"
                :title="step.title"
                :description="`${step.description}${step.requiresConfirmation ? '（需要确认）' : ''}`"
              />
            </ElSteps>
          </div>

          <div class="composer">
            <div v-if="allowProjectCsv && selectedFile" class="selected-file">
              <div class="selected-file-info">
                <ElIcon><Upload /></ElIcon>
                <span :title="selectedFile.name">{{ selectedFile.name }}</span>
                <small>已加载，发送后分析</small>
              </div>
              <ElTooltip content="移除文件" placement="top">
                <ElButton text circle :icon="Close" @click="clearSelectedFile" />
              </ElTooltip>
            </div>
            <ElInput
              v-model="messageText"
              type="textarea"
              :rows="3"
              resize="none"
              :placeholder="composerPlaceholder"
              @keydown="handleComposerKeydown"
            />
            <div class="composer-actions">
              <span>Enter 发送，Shift + Enter 换行。写入操作需确认后执行。</span>
              <div class="composer-buttons">
                <ElButton
                  v-if="allowProjectCsv"
                  :icon="Upload"
                  :loading="fileLoading"
                  :disabled="sending"
                  @click="openFilePicker"
                >
                  导入文件
                </ElButton>
                <ElButton
                  type="primary"
                  :loading="sending"
                  :disabled="fileLoading"
                  @click="sendMessage"
                >
                  发送
                </ElButton>
              </div>
              <input
                v-if="allowProjectCsv"
                ref="fileInputRef"
                class="agent-file-input"
                type="file"
                accept=".csv,text/csv"
                @change="handleFileChange"
              />
            </div>
          </div>
        </section>

        <aside class="tool-panel">
          <section>
            <div class="section-title">工具目录</div>
            <ElScrollbar max-height="220px">
              <div v-for="tool in tools" :key="tool.name" class="tool-card">
                <div>
                  <strong>{{ tool.title }}</strong>
                  <ElTag v-if="tool.requiresConfirmation" size="small" type="warning">确认</ElTag>
                </div>
                <p>{{ tool.description }}</p>
              </div>
            </ElScrollbar>
          </section>

          <section>
            <div class="section-title">工具调用</div>
            <ElScrollbar max-height="calc(100vh - 420px)">
              <div v-for="call in toolCalls" :key="call.id" class="call-card">
                <div class="call-header">
                  <strong>{{ call.toolTitle }}</strong>
                  <ElTag :type="getCallStatusType(call)" size="small">
                    {{ call.status }}
                  </ElTag>
                </div>
                <pre>{{ formatJson(call.responseJson) }}</pre>
                <ElButton
                  v-if="
                    call.status === 'PendingConfirm' &&
                    call.requiresConfirmation &&
                    (!call.confirmed || call.agentCode === 'edge-gateway')
                  "
                  type="warning"
                  size="small"
                  @click="confirmTool(call)"
                >
                  {{ call.toolName === 'project.create' ? '确认新增' : '确认执行' }}
                </ElButton>
                <ElButton
                  v-if="enableEmail"
                  size="small"
                  plain
                  :icon="Message"
                  @click="openToolEmailDialog(call)"
                >
                  发送邮件
                </ElButton>
              </div>
              <ElEmpty v-if="!toolCalls.length" description="暂无工具调用" />
            </ElScrollbar>
          </section>
        </aside>
      </main>
    </div>

    <ElDialog v-model="emailDialogVisible" title="发送邮件" width="720px" destroy-on-close>
      <ElForm label-width="86px">
        <ElFormItem label="收件人" required>
          <ElSelect
            v-model="emailForm.toEmails"
            multiple
            filterable
            remote
            reserve-keyword
            allow-create
            default-first-option
            :remote-method="searchEmailUsers"
            :loading="emailUserLoading"
            placeholder="选择用户邮箱或输入邮箱"
            style="width: 100%"
            @focus="() => loadEmailUsers()"
          >
            <ElOption
              v-for="item in emailUserOptions"
              :key="getUserEmail(item)"
              :label="formatEmailUserLabel(item)"
              :value="getUserEmail(item)"
              :disabled="!getUserEmail(item)"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="抄送">
          <ElSelect
            v-model="emailForm.ccEmails"
            multiple
            filterable
            remote
            reserve-keyword
            allow-create
            default-first-option
            :remote-method="searchEmailUsers"
            :loading="emailUserLoading"
            placeholder="选择抄送人或输入邮箱"
            style="width: 100%"
            @focus="() => loadEmailUsers()"
          >
            <ElOption
              v-for="item in emailUserOptions"
              :key="`cc-${getUserEmail(item)}`"
              :label="formatEmailUserLabel(item)"
              :value="getUserEmail(item)"
              :disabled="!getUserEmail(item)"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="主题" required>
          <ElInput v-model="emailForm.subject" maxlength="160" show-word-limit />
        </ElFormItem>
        <ElFormItem label="正文" required>
          <ElInput v-model="emailForm.body" type="textarea" :rows="14" resize="vertical" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="emailDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="emailSending" @click="sendEmail">确认发送</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import {
    confirmAgentToolCall,
    createAgentEmailDraft,
    deleteAgentConversation,
    fetchAgentConversation,
    fetchAgentConversations,
    fetchAgentTools,
    readAgentProjectCsv,
    sendAgentEmail,
    streamAgentMessage
  } from '@/api/agent'
  import { fetchProjectList } from '@/api/project-manage'
  import { fetchGetUserList } from '@/api/system-manage'
  import { useUserStore } from '@/store/modules/user'
  import { ArrowLeft, ArrowRight, Close, Delete, Message, Upload } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'AgentExecutor' })

  interface AgentExecutorProps {
    agentCode?: string
    assistantTitle?: string
    sidebarDescription?: string
    panelTitle?: string
    panelDescription?: string
    emptyDescription?: string
    composerPlaceholder?: string
    allowProjectCsv?: boolean
    enableEmail?: boolean
    initialSuggestions?: string[]
  }

  const props = withDefaults(defineProps<AgentExecutorProps>(), {
    agentCode: 'project-management',
    assistantTitle: '项目管理助手',
    sidebarDescription: '项目管理智能助手',
    panelTitle: '项目 Agent',
    panelDescription: '可查询项目概况、任务风险、文件归档，并生成待确认执行计划。',
    emptyDescription: '输入一个问题，让项目管理助手帮你查看项目状态。',
    composerPlaceholder: '例如：帮我看一下当前项目风险，或者生成一份本周项目周报',
    allowProjectCsv: true,
    enableEmail: true,
    initialSuggestions: () => [
      '帮我看一下当前项目风险',
      '帮我新增一个项目',
      '批量导入项目文件',
      '生成一份本周项目周报',
      '统计项目文件归档情况'
    ]
  })

  const userStore = useUserStore()
  const isProjectAgent = computed(() => props.agentCode === 'project-management')
  const projects = ref<Api.ProjectManage.ProjectItem[]>([])
  const conversations = ref<Api.Agent.Conversation[]>([])
  const messages = ref<Api.Agent.Message[]>([])
  const tools = ref<Api.Agent.ToolDefinition[]>([])
  const toolCalls = ref<Api.Agent.ToolCall[]>([])
  const latestPlan = ref<Api.Agent.PlanStep[]>([])
  const suggestions = ref<string[]>([...props.initialSuggestions])
  const activeConversationId = ref<number>()
  const scopeProjectName = ref<string>()
  const sidebarCollapsed = ref(false)
  const messageText = ref('')
  const sending = ref(false)
  const sendingStatus = ref('正在连接 Agent')
  const streamingReply = ref('')
  const fileLoading = ref(false)
  const emailSending = ref(false)
  const emailDialogVisible = ref(false)
  const emailUserLoading = ref(false)
  const conversationLoading = ref(false)
  const messageListRef = ref<HTMLElement>()
  const fileInputRef = ref<HTMLInputElement>()
  const selectedFile = ref<{ name: string; content: string }>()
  const emailUserOptions = ref<Api.SystemManage.UserListItem[]>([])
  const emailForm = reactive<Api.Agent.EmailSendRequest>({
    conversationId: undefined,
    sourceToolCallId: undefined,
    userId: '',
    toEmails: [],
    ccEmails: [],
    subject: '',
    body: ''
  })
  const currentUserId = computed(() =>
    String(userStore.info?.userId || userStore.info?.userName || '')
  )

  const loadBaseData = async () => {
    const [projectList, toolList] = await Promise.all([
      isProjectAgent.value ? fetchProjectList() : Promise.resolve([]),
      fetchAgentTools(props.agentCode)
    ])
    projects.value = projectList
    tools.value = toolList
    await loadConversations()
  }

  const loadConversations = async () => {
    conversationLoading.value = true
    try {
      const data = await fetchAgentConversations({
        userId: currentUserId.value,
        current: 1,
        size: 20,
        agentCode: props.agentCode
      })
      conversations.value = data.records || []
    } finally {
      conversationLoading.value = false
    }
  }

  const loadConversation = async (id: number) => {
    const detail = await fetchAgentConversation(id)
    activeConversationId.value = detail.conversation.id
    scopeProjectName.value = detail.conversation.scopeProjectName
    messages.value = detail.messages
    toolCalls.value = detail.toolCalls
    latestPlan.value = []
    await nextTick(scrollAllMessagesToBottom)
  }

  const startConversation = () => {
    activeConversationId.value = undefined
    messages.value = []
    toolCalls.value = []
    latestPlan.value = []
    messageText.value = ''
    streamingReply.value = ''
    clearSelectedFile()
  }

  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  const removeConversation = async (item: Api.Agent.Conversation) => {
    await ElMessageBox.confirm(`确定删除会话“${item.title}”吗？`, '删除确认', {
      type: 'warning'
    })
    await deleteAgentConversation({
      id: item.id,
      userId: currentUserId.value
    })
    if (activeConversationId.value === item.id) {
      startConversation()
    }
    await loadConversations()
    ElMessage.success('删除成功')
  }

  const sendMessage = async () => {
    const file = selectedFile.value
    const text =
      messageText.value.trim() ||
      (file ? `请分析项目文件“${file.name}”，整理待写入项目并生成确认计划。` : '')
    const attachment: AgentMessageAttachment | undefined = file
      ? {
          attachmentType: 'project-csv',
          attachmentName: file.name,
          attachmentContent: file.content
        }
      : undefined
    await sendChatMessage(
      text,
      () => {
        messageText.value = ''
        clearSelectedFile()
      },
      attachment
    )
  }

  const handleComposerKeydown = (event: Event | KeyboardEvent) => {
    const keyboardEvent = event as KeyboardEvent
    if (keyboardEvent.key !== 'Enter' || keyboardEvent.shiftKey || keyboardEvent.isComposing) return
    keyboardEvent.preventDefault()
    void sendMessage()
  }

  type AgentMessageAttachment = Pick<
    Api.Agent.SendRequest,
    'attachmentType' | 'attachmentName' | 'attachmentContent'
  >

  const sendChatMessage = async (
    text: string,
    clearInput: () => void,
    attachment?: AgentMessageAttachment
  ) => {
    if (!text) {
      ElMessage.warning('请输入指令')
      return
    }
    if (sending.value) return

    sending.value = true
    sendingStatus.value = '正在连接 Agent'
    streamingReply.value = ''
    const tempUserMessage: Api.Agent.Message = {
      id: Date.now(),
      conversationId: activeConversationId.value || 0,
      role: 'user',
      content: text,
      createTime: new Date().toISOString()
    }
    messages.value.push(tempUserMessage)
    clearInput()
    await nextTick(scrollAllMessagesToBottom)

    try {
      const response = await streamAgentMessage(
        {
          conversationId: activeConversationId.value,
          agentCode: props.agentCode,
          message: text,
          userId: currentUserId.value,
          scopeProjectName: isProjectAgent.value ? scopeProjectName.value : undefined,
          mode: 'Online',
          ...attachment
        },
        {
          onAccepted: (progress) => {
            sendingStatus.value = progress.message
          },
          onProgress: (progress) => {
            sendingStatus.value = progress.message
            void nextTick(scrollAllMessagesToBottom)
          },
          onChunk: (chunk) => {
            streamingReply.value += chunk
            void nextTick(scrollAllMessagesToBottom)
          }
        }
      )
      activeConversationId.value = response.conversationId
      latestPlan.value = response.plan || []
      const incomingToolCalls = response.toolCalls || []
      const incomingToolCallIds = new Set(incomingToolCalls.map((item) => item.id))
      toolCalls.value = [
        ...incomingToolCalls,
        ...toolCalls.value.filter((item) => !incomingToolCallIds.has(item.id))
      ]
      suggestions.value = response.suggestions?.length ? response.suggestions : suggestions.value
      messages.value.push({
        id: Date.now() + 1,
        conversationId: response.conversationId,
        role: 'assistant',
        content: response.reply,
        createTime: new Date().toISOString()
      })
      if (
        incomingToolCalls.some(
          (item) =>
            item.toolName === 'project.create' &&
            ['Success', 'PartialSuccess'].includes(item.status)
        )
      ) {
        await refreshProjects()
      }
      await loadConversations()
      await nextTick(scrollAllMessagesToBottom)
    } catch (error) {
      ElMessage.error(
        error instanceof Error ? error.message : `${props.assistantTitle} 处理失败，请重试`
      )
    } finally {
      sending.value = false
      sendingStatus.value = `正在连接 ${props.assistantTitle}`
      streamingReply.value = ''
      await nextTick(scrollAllMessagesToBottom)
    }
  }

  const openFilePicker = () => {
    fileInputRef.value?.click()
  }

  const clearSelectedFile = () => {
    selectedFile.value = undefined
    if (fileInputRef.value) fileInputRef.value.value = ''
  }

  const handleFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (sending.value) {
      ElMessage.warning(`请等待当前${props.assistantTitle}请求完成`)
      return
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      ElMessage.warning('请选择 CSV 文件')
      return
    }

    fileLoading.value = true
    try {
      const csvContent = await readAgentProjectCsv(file)
      selectedFile.value = { name: file.name, content: csvContent }
      ElMessage.success(`文件“${file.name}”已加载`)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '文件加载失败')
    } finally {
      fileLoading.value = false
    }
  }

  const refreshProjects = async () => {
    if (isProjectAgent.value) projects.value = await fetchProjectList()
  }

  let emailSearchTimer: ReturnType<typeof setTimeout> | undefined

  const getUserEmail = (item: Api.SystemManage.UserListItem) =>
    String(item.email || item.userEmail || '')

  const formatEmailUserLabel = (item: Api.SystemManage.UserListItem) => {
    const email = getUserEmail(item)
    const name = item.nickName || item.userName || item.userId || item.id || email
    return email ? `${name} <${email}>` : String(name)
  }

  const loadEmailUsers = async (keyword = '') => {
    emailUserLoading.value = true
    try {
      const result = await fetchGetUserList({
        current: 1,
        size: 30,
        keyword,
        enabled: true
      })
      emailUserOptions.value = (result.records || []).filter((item) => Boolean(getUserEmail(item)))
    } finally {
      emailUserLoading.value = false
    }
  }

  const searchEmailUsers = (keyword: string) => {
    if (emailSearchTimer) clearTimeout(emailSearchTimer)
    emailSearchTimer = setTimeout(() => {
      loadEmailUsers(keyword.trim())
    }, 250)
  }

  const resetEmailForm = () => {
    Object.assign(emailForm, {
      conversationId: activeConversationId.value,
      sourceToolCallId: undefined,
      userId: currentUserId.value,
      toEmails: [],
      ccEmails: [],
      subject: '',
      body: ''
    })
  }

  const openToolEmailDialog = async (call: Api.Agent.ToolCall) => {
    resetEmailForm()
    const draft = await createAgentEmailDraft({
      conversationId: activeConversationId.value,
      sourceToolCallId: call.id,
      userId: currentUserId.value
    })
    emailForm.conversationId = draft.conversationId || activeConversationId.value
    emailForm.sourceToolCallId = draft.sourceToolCallId || call.id
    emailForm.subject = draft.subject
    emailForm.body = draft.body
    emailDialogVisible.value = true
    loadEmailUsers()
  }

  const openLatestReplyEmailDialog = async () => {
    if (!activeConversationId.value && !messages.value.some((item) => item.role === 'assistant')) {
      ElMessage.warning('暂无可发送的 Agent 回复')
      return
    }
    resetEmailForm()
    const latestAssistant = [...messages.value].reverse().find((item) => item.role === 'assistant')
    const draft = await createAgentEmailDraft({
      conversationId: activeConversationId.value,
      userId: currentUserId.value,
      content: latestAssistant?.content
    })
    emailForm.conversationId = draft.conversationId || activeConversationId.value
    emailForm.subject = draft.subject
    emailForm.body = draft.body
    emailDialogVisible.value = true
    loadEmailUsers()
  }

  const sendEmail = async () => {
    if (!emailForm.toEmails.length) {
      ElMessage.warning('请选择或输入收件人')
      return
    }
    if (!emailForm.subject.trim()) {
      ElMessage.warning('请输入邮件主题')
      return
    }
    if (!emailForm.body.trim()) {
      ElMessage.warning('请输入邮件正文')
      return
    }

    emailSending.value = true
    try {
      const result = await sendAgentEmail({
        ...emailForm,
        userId: currentUserId.value,
        toEmails: emailForm.toEmails.map((item) => item.trim()).filter(Boolean),
        ccEmails: emailForm.ccEmails.map((item) => item.trim()).filter(Boolean)
      })
      ElMessage.success(result.message || '邮件发送成功')
      emailDialogVisible.value = false
      await loadConversations()
    } finally {
      emailSending.value = false
    }
  }

  const confirmTool = async (call: Api.Agent.ToolCall) => {
    const updated = await confirmAgentToolCall(call.id, {
      toolCallId: call.id,
      userId: currentUserId.value,
      remark: '前端执行器确认'
    })
    const index = toolCalls.value.findIndex((item) => item.id === call.id)
    if (index >= 0) toolCalls.value[index] = updated
    if (
      [
        'project.create',
        'project.update',
        'project.status',
        'task.create',
        'task.update',
        'task.status'
      ].includes(call.toolName)
    ) {
      await refreshProjects()
      ElMessage.success(
        updated.status === 'Success' || updated.status === 'PartialSuccess'
          ? '已确认执行'
          : '执行失败'
      )
    } else {
      ElMessage.success('已记录确认')
    }
    if (activeConversationId.value) await loadConversation(activeConversationId.value)
  }

  const useSuggestion = (value: string) => {
    messageText.value = value
  }

  const formatTime = (value?: string) => {
    if (!value) return ''
    return value.replace('T', ' ').slice(0, 16)
  }

  const formatJson = (value: string) => {
    if (!value) return ''
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }

  const getCallStatusType = (call: Api.Agent.ToolCall) => {
    if (call.status === 'Success') return 'success'
    if (call.status === 'PendingConfirm' || call.status === 'PartialSuccess') return 'warning'
    if (['Failed', 'PermissionDenied', 'Invalid', 'Blocked'].includes(call.status)) return 'danger'
    return 'info'
  }

  const scrollToBottom = () => {
    if (!messageListRef.value) return
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }

  const scrollAllMessagesToBottom = () => {
    scrollToBottom()
  }

  onMounted(loadBaseData)
</script>

<style lang="scss" scoped>
  .agent-executor-shell {
    position: relative;
    min-height: calc(100vh - 112px);
  }

  .agent-executor-page {
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    gap: 12px;
    min-height: calc(100vh - 112px);
    transition: grid-template-columns 0.2s ease;

    &.sidebar-collapsed {
      grid-template-columns: 56px minmax(0, 1fr);
    }
  }

  .agent-sidebar,
  .chat-panel,
  .tool-panel {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .agent-sidebar {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 14px;
  }

  .sidebar-header,
  .panel-header,
  .composer-actions,
  .call-header {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .sidebar-actions {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
  }

  .panel-header-actions {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
  }

  .sidebar-header h3,
  .panel-header h2 {
    margin: 0;
  }

  .sidebar-header p,
  .panel-header p,
  .tool-card p {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .scope-select {
    width: 100%;
    margin: 14px 0;
  }

  .conversation-list {
    display: grid;
    gap: 8px;
    overflow: auto;
  }

  .conversation-item {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
    padding: 10px;
    cursor: pointer;
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;

    &.active {
      background: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary);
    }
  }

  .conversation-content {
    display: grid;
    flex: 1;
    gap: 4px;
    min-width: 0;
    padding: 0;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;

    span {
      overflow: hidden;
      color: var(--el-text-color-primary);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      color: var(--el-text-color-secondary);
    }
  }

  .conversation-delete {
    flex-shrink: 0;
    opacity: 0.72;

    &:hover {
      color: var(--el-color-danger);
      opacity: 1;
    }
  }

  .agent-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 12px;
    min-width: 0;
  }

  .chat-panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 16px;
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 14px 0;
  }

  .agent-file-input {
    display: none;
  }

  .message-list {
    flex: 1;
    min-height: 260px;
    max-height: calc(100vh - 470px);
    padding: 12px;
    overflow: auto;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
  }

  .message {
    display: grid;
    gap: 6px;
    max-width: 78%;
    margin-bottom: 12px;

    &.user {
      margin-left: auto;

      .message-content {
        color: #fff;
        background: var(--el-color-primary);
      }
    }
  }

  .message-role {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .message-content {
    padding: 10px 12px;
    white-space: pre-wrap;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .typing-content,
  .typing-content small {
    margin-left: 4px;
    color: var(--el-text-color-secondary);
  }

  .typing-dot {
    width: 6px;
    height: 6px;
    background: var(--el-color-primary);
    border-radius: 999px;
    animation: typingPulse 1.2s ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 0.16s;
    }

    &:nth-child(3) {
      animation-delay: 0.32s;
    }
  }

  @keyframes typingPulse {
    0%,
    80%,
    100% {
      opacity: 0.32;
      transform: translateY(0);
    }

    40% {
      opacity: 1;
      transform: translateY(-3px);
    }
  }

  .plan-panel {
    padding: 12px;
    margin-top: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .composer {
    margin-top: 12px;
  }

  .selected-file {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    margin-bottom: 8px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .selected-file-info {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;

    span {
      overflow: hidden;
      color: var(--el-text-color-primary);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      flex-shrink: 0;
      color: var(--el-text-color-secondary);
    }
  }

  .composer-actions {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .composer-buttons {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
  }

  .tool-panel {
    display: grid;
    gap: 14px;
    align-content: start;
    min-width: 0;
    padding: 14px;
  }

  .section-title {
    margin-bottom: 10px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .tool-card,
  .call-card {
    padding: 10px;
    margin-bottom: 8px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .tool-card > div {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }

  .call-card pre {
    max-height: 220px;
    padding: 10px;
    overflow: auto;
    font-size: 12px;
    white-space: pre-wrap;
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
  }

  @media (width <= 1180px) {
    .agent-executor-page,
    .agent-main {
      grid-template-columns: 1fr;
    }
  }
</style>
