<template>
  <div v-if="visibleOnPage" class="agent-floating-chat">
    <section v-if="panelVisible" class="agent-floating-panel" :style="panelStyle">
      <header class="floating-header" @pointerdown="startDrag">
        <div>
          <strong>项目 Agent</strong>
          <span>LLM 自主选工具</span>
        </div>
        <div class="floating-actions" @pointerdown.stop>
          <ElTooltip content="发送当前回复" placement="top">
            <ElButton
              circle
              :icon="Message"
              :disabled="!hasAssistantMessage"
              size="small"
              @click.stop="openEmailDialog"
            />
          </ElTooltip>
          <ElTooltip content="新建对话" placement="top">
            <ElButton circle :icon="Plus" size="small" @click.stop="startConversation" />
          </ElTooltip>
          <ElButton circle :icon="Close" size="small" @click.stop="panelVisible = false" />
        </div>
      </header>

      <div ref="messageListRef" class="floating-message-list">
        <article
          v-for="message in messages"
          :key="message.id || `${message.role}-${message.createTime}`"
          class="floating-message"
          :class="message.role"
        >
          <div>{{ message.content }}</div>
        </article>
        <article v-if="sending" class="floating-message assistant">
          <div class="typing-content">
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
        <ElEmpty
          v-if="!messages.length && !sending"
          description="输入问题，让 项目管理助手 帮你看项目状态。"
        />
      </div>

      <div v-if="pendingToolCalls.length" class="pending-tool-list">
        <div v-for="call in pendingToolCalls" :key="call.id" class="pending-tool-item">
          <span>{{ call.toolTitle }}待确认</span>
          <ElButton
            type="warning"
            size="small"
            :loading="confirmingToolId === call.id"
            @click="confirmTool(call)"
          >
            {{ call.toolName === 'project.create' ? '确认新增' : '确认执行' }}
          </ElButton>
        </div>
      </div>

      <div class="floating-composer">
        <div v-if="selectedFile" class="selected-file">
          <div class="selected-file-info">
            <ElIcon><Upload /></ElIcon>
            <span :title="selectedFile.name">{{ selectedFile.name }}</span>
            <small>已加载</small>
          </div>
          <ElTooltip content="移除文件" placement="top">
            <ElButton text circle :icon="Close" @click="clearSelectedFile" />
          </ElTooltip>
        </div>
        <div class="composer-row">
          <ElInput
            v-model="messageText"
            type="textarea"
            :rows="2"
            resize="none"
            placeholder="输入问题，Enter 发送"
            @keydown="handleComposerKeydown"
          />
          <div class="composer-buttons">
            <ElButton
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
        </div>
        <input
          ref="fileInputRef"
          class="agent-file-input"
          type="file"
          accept=".csv,text/csv"
          @change="handleFileChange"
        />
      </div>
    </section>

    <ElTooltip v-else content="打开智能助手" placement="left">
      <ElButton
        class="floating-button"
        type="primary"
        circle
        :icon="ChatDotRound"
        :style="buttonStyle"
        @pointerdown="startButtonDrag"
      />
    </ElTooltip>

    <ElDialog v-model="emailDialogVisible" title="发送邮件" width="680px" destroy-on-close>
      <ElForm label-width="76px">
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
            @focus="loadEmailUsers"
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
            @focus="loadEmailUsers"
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
          <ElInput v-model="emailForm.body" type="textarea" :rows="12" resize="vertical" />
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
    closeAgentSocket,
    confirmAgentToolCall,
    createAgentEmailDraft,
    readAgentProjectCsv,
    sendAgentEmail,
    streamAgentMessage
  } from '@/api/agent'
  import { fetchGetUserList } from '@/api/system-manage'
  import { useUserStore } from '@/store/modules/user'
  import { ChatDotRound, Close, Message, Plus, Upload } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'

  defineOptions({ name: 'AgentFloatingChat' })

  const route = useRoute()
  const userStore = useUserStore()

  const messages = ref<Api.Agent.Message[]>([])
  const toolCalls = ref<Api.Agent.ToolCall[]>([])
  const activeConversationId = ref<number>()
  const messageText = ref('')
  const sending = ref(false)
  const sendingStatus = ref('正在连接 Agent')
  const streamingReply = ref('')
  const fileLoading = ref(false)
  const confirmingToolId = ref<number>()
  const emailSending = ref(false)
  const emailDialogVisible = ref(false)
  const emailUserLoading = ref(false)
  const panelVisible = ref(false)
  const messageListRef = ref<HTMLElement>()
  const fileInputRef = ref<HTMLInputElement>()
  const selectedFile = ref<{ name: string; content: string }>()
  const emailUserOptions = ref<Api.SystemManage.UserListItem[]>([])
  const emailForm = reactive<Api.Agent.EmailSendRequest>({
    conversationId: undefined,
    userId: '',
    toEmails: [],
    ccEmails: [],
    subject: '',
    body: ''
  })
  const position = reactive({ x: 0, y: 0 })
  const dragState = reactive({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  })

  const visibleOnPage = computed(() => {
    return Boolean(userStore.accessToken) && !route.path.startsWith('/auth')
  })

  const currentUserId = computed(() =>
    String(userStore.info?.userId || userStore.info?.userName || '')
  )
  const hasAssistantMessage = computed(() =>
    messages.value.some((item) => item.role === 'assistant')
  )
  const pendingToolCalls = computed(() =>
    toolCalls.value.filter(
      (item) => item.status === 'PendingConfirm' && item.requiresConfirmation && !item.confirmed
    )
  )

  watch(
    () => userStore.accessToken,
    (token, previousToken) => {
      if (token !== previousToken) closeAgentSocket()
    }
  )

  const panelStyle = computed(() => ({
    left: `${position.x}px`,
    top: `${position.y}px`
  }))

  const buttonStyle = computed(() => ({
    left: `${position.x}px`,
    top: `${position.y}px`
  }))

  const startConversation = () => {
    activeConversationId.value = undefined
    messages.value = []
    toolCalls.value = []
    messageText.value = ''
    streamingReply.value = ''
    clearSelectedFile()
  }

  const sendMessage = async () => {
    const file = selectedFile.value
    const text =
      messageText.value.trim() ||
      (file ? `请分析项目文件“${file.name}”，整理待写入项目并生成确认计划。` : '')
    if (!text) {
      ElMessage.warning('请输入问题')
      return
    }
    if (sending.value) return
    const attachment: AgentMessageAttachment | undefined = file
      ? {
          attachmentType: 'project-csv',
          attachmentName: file.name,
          attachmentContent: file.content
        }
      : undefined
    messageText.value = ''
    clearSelectedFile()
    await sendChatMessage(text, attachment)
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

  const sendChatMessage = async (text: string, attachment?: AgentMessageAttachment) => {
    if (sending.value) return

    sending.value = true
    sendingStatus.value = '正在连接 Agent'
    streamingReply.value = ''
    messages.value.push({
      id: Date.now(),
      conversationId: activeConversationId.value || 0,
      role: 'user',
      content: text,
      createTime: new Date().toISOString()
    })
    await nextTick(scrollToBottom)

    try {
      const response = await streamAgentMessage(
        {
          conversationId: activeConversationId.value,
          message: text,
          userId: currentUserId.value,
          mode: 'Online',
          ...attachment
        },
        {
          onAccepted: (progress) => {
            sendingStatus.value = progress.message
          },
          onProgress: (progress) => {
            sendingStatus.value = progress.message
            void nextTick(scrollToBottom)
          },
          onChunk: (chunk) => {
            streamingReply.value += chunk
            void nextTick(scrollToBottom)
          }
        }
      )
      activeConversationId.value = response.conversationId
      const incomingToolCalls = response.toolCalls || []
      const incomingToolCallIds = new Set(incomingToolCalls.map((item) => item.id))
      toolCalls.value = [
        ...incomingToolCalls,
        ...toolCalls.value.filter((item) => !incomingToolCallIds.has(item.id))
      ]
      messages.value.push({
        id: Date.now() + 1,
        conversationId: response.conversationId,
        role: 'assistant',
        content: response.reply,
        createTime: new Date().toISOString()
      })
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : 'Agent 处理失败，请重试')
    } finally {
      sending.value = false
      sendingStatus.value = '正在连接 Agent'
      streamingReply.value = ''
      await nextTick(scrollToBottom)
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
      ElMessage.warning('请等待当前 Agent 请求完成')
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

  const confirmTool = async (call: Api.Agent.ToolCall) => {
    confirmingToolId.value = call.id
    try {
      const updated = await confirmAgentToolCall(call.id, {
        toolCallId: call.id,
        userId: currentUserId.value,
        remark: '悬浮 Agent 确认'
      })
      const index = toolCalls.value.findIndex((item) => item.id === call.id)
      if (index >= 0) toolCalls.value[index] = updated
      messages.value.push({
        id: Date.now(),
        conversationId: updated.conversationId,
        role: 'assistant',
        content: readToolResultMessage(updated.responseJson) || `“${updated.toolTitle}”执行完成。`,
        createTime: new Date().toISOString()
      })
      ElMessage.success(
        ['Success', 'PartialSuccess'].includes(updated.status) ? '已确认执行' : '执行未成功'
      )
      await nextTick(scrollToBottom)
    } finally {
      confirmingToolId.value = undefined
    }
  }

  const readToolResultMessage = (responseJson: string) => {
    try {
      const result = JSON.parse(responseJson) as { message?: string; Message?: string }
      return result.message || result.Message || ''
    } catch {
      return ''
    }
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

  const openEmailDialog = async () => {
    const latestAssistant = [...messages.value].reverse().find((item) => item.role === 'assistant')
    if (!latestAssistant) {
      ElMessage.warning('暂无可发送的 Agent 回复')
      return
    }

    const draft = await createAgentEmailDraft({
      conversationId: activeConversationId.value,
      userId: currentUserId.value,
      content: latestAssistant.content
    })
    Object.assign(emailForm, {
      conversationId: draft.conversationId || activeConversationId.value,
      userId: currentUserId.value,
      toEmails: [],
      ccEmails: [],
      subject: draft.subject,
      body: draft.body
    })
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
    } finally {
      emailSending.value = false
    }
  }

  const openPanel = async () => {
    panelVisible.value = true
    clampPosition(true)
    await nextTick(scrollToBottom)
  }

  const startButtonDrag = (event: PointerEvent) => {
    startDrag(event)
    const stop = () => {
      window.removeEventListener('pointerup', stop)
      if (!dragState.moved) openPanel()
    }
    window.addEventListener('pointerup', stop, { once: true })
  }

  const startDrag = (event: PointerEvent) => {
    event.preventDefault()
    dragState.dragging = true
    dragState.moved = false
    dragState.startX = event.clientX
    dragState.startY = event.clientY
    dragState.originX = position.x
    dragState.originY = position.y
    window.addEventListener('pointermove', onDrag)
    window.addEventListener('pointerup', stopDrag, { once: true })
  }

  const onDrag = (event: PointerEvent) => {
    if (!dragState.dragging) return
    const deltaX = event.clientX - dragState.startX
    const deltaY = event.clientY - dragState.startY
    dragState.moved = dragState.moved || Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3
    position.x = dragState.originX + deltaX
    position.y = dragState.originY + deltaY
    clampPosition(panelVisible.value)
  }

  const stopDrag = () => {
    dragState.dragging = false
    window.removeEventListener('pointermove', onDrag)
  }

  const clampPosition = (forPanel: boolean) => {
    const margin = 12
    const width = forPanel ? Math.min(420, window.innerWidth - 32) : 52
    const height = forPanel ? Math.min(620, window.innerHeight - 32) : 52
    position.x = Math.min(Math.max(position.x, margin), window.innerWidth - width - margin)
    position.y = Math.min(Math.max(position.y, margin), window.innerHeight - height - margin)
  }

  const resetPosition = () => {
    position.x = window.innerWidth - 80
    position.y = window.innerHeight - 88
    clampPosition(false)
  }

  const scrollToBottom = () => {
    if (!messageListRef.value) return
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }

  onMounted(() => {
    resetPosition()
    window.addEventListener('resize', handleResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
  })

  const handleResize = () => {
    clampPosition(panelVisible.value)
  }
</script>

<style lang="scss" scoped>
  .agent-floating-chat {
    position: fixed;
    inset: 0;
    z-index: 2800;
    pointer-events: none;
  }

  .floating-button,
  .agent-floating-panel {
    position: fixed;
    pointer-events: auto;
  }

  .floating-button {
    width: 52px;
    height: 52px;
    cursor: grab;
    box-shadow: var(--el-box-shadow-light);

    &:active {
      cursor: grabbing;
    }
  }

  .agent-floating-panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    width: min(420px, calc(100vw - 32px));
    height: min(620px, calc(100vh - 32px));
    overflow: hidden;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    box-shadow: var(--el-box-shadow);
  }

  .floating-header {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    cursor: move;
    border-bottom: 1px solid var(--el-border-color-lighter);

    > div:first-child {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .floating-actions {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
  }

  .floating-message-list {
    display: grid;
    gap: 10px;
    align-content: start;
    min-height: 0;
    padding: 12px;
    overflow: auto;
    background: var(--el-fill-color-lighter);
  }

  .floating-message {
    display: flex;

    div {
      max-width: 82%;
      padding: 9px 11px;
      white-space: pre-wrap;
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 8px;
    }

    &.user {
      justify-content: flex-end;

      div {
        color: #fff;
        background: var(--el-color-primary);
        border-color: var(--el-color-primary);
      }
    }
  }

  .typing-content {
    display: inline-flex;
    gap: 6px;
    align-items: center;
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

  .floating-composer {
    display: grid;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .pending-tool-list {
    display: grid;
    gap: 6px;
    padding: 8px 12px;
    background: var(--el-color-warning-light-9);
    border-top: 1px solid var(--el-color-warning-light-7);
  }

  .pending-tool-item {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: var(--el-text-color-primary);
  }

  .composer-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .composer-buttons {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .selected-file {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding: 7px 9px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .selected-file-info {
    display: flex;
    gap: 7px;
    align-items: center;
    min-width: 0;

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      flex-shrink: 0;
      color: var(--el-text-color-secondary);
    }
  }

  .agent-file-input {
    display: none;
  }
</style>
