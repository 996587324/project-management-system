<template>
  <div v-if="visibleOnPage" class="agent-floating-chat">
    <section v-if="panelVisible" class="agent-floating-panel" :style="panelStyle">
      <header class="floating-header" @pointerdown="startDrag">
        <div>
          <strong>全局查询助手</strong>
          <span>仅查询项目、边缘计算和生产看板信息</span>
        </div>
        <div class="floating-actions" @pointerdown.stop>
          <ElTooltip :content="panelExpanded ? '还原窗口' : '放大窗口'" placement="top">
            <ElButton circle :icon="FullScreen" size="small" @click.stop="togglePanelSize" />
          </ElTooltip>
          <ElTooltip content="新建对话" placement="top">
            <ElButton circle :icon="Plus" size="small" @click.stop="startConversation" />
          </ElTooltip>
          <ElTooltip content="最小化" placement="top">
            <ElButton circle :icon="Minus" size="small" @click.stop="minimizePanel" />
          </ElTooltip>
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
        <ElEmpty v-if="!messages.length && !sending" description="可查询各板块的业务信息。" />
      </div>

      <div class="floating-composer">
        <div class="composer-row">
          <ElInput
            v-model="messageText"
            type="textarea"
            :rows="2"
            resize="none"
            placeholder="输入查询问题，Enter 发送"
            @keydown="handleComposerKeydown"
          />
          <div class="composer-buttons">
            <ElButton type="primary" :loading="sending" :disabled="sending" @click="sendMessage">
              发送
            </ElButton>
          </div>
        </div>
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
  </div>
</template>

<script setup lang="ts">
  import { closeAgentSocket, streamAgentMessage } from '@/api/agent'
  import { useUserStore } from '@/store/modules/user'
  import { ChatDotRound, FullScreen, Minus, Plus } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'

  defineOptions({ name: 'AgentFloatingChat' })

  const route = useRoute()
  const userStore = useUserStore()

  const messages = ref<Api.Agent.Message[]>([])
  const activeConversationId = ref<number>()
  const messageText = ref('')
  const sending = ref(false)
  const sendingStatus = ref('正在连接 Agent')
  const streamingReply = ref('')
  const panelVisible = ref(false)
  const panelExpanded = ref(false)
  const messageListRef = ref<HTMLElement>()
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
    // 公开看板是纯展示入口，不能在页面上保留任何可交互的业务入口。
    return (
      Boolean(userStore.accessToken) &&
      !route.path.startsWith('/auth') &&
      route.meta.publicReadOnly !== true
    )
  })

  const currentUserId = computed(() =>
    String(userStore.info?.userId || userStore.info?.userName || '')
  )

  watch(
    () => userStore.accessToken,
    (token, previousToken) => {
      if (token !== previousToken) closeAgentSocket()
    }
  )

  const panelStyle = computed(() => ({
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: panelExpanded.value ? 'calc(100vw - 32px)' : 'min(420px, calc(100vw - 32px))',
    height: panelExpanded.value ? 'calc(100vh - 32px)' : 'min(620px, calc(100vh - 32px))'
  }))

  const buttonStyle = computed(() => ({
    left: `${position.x}px`,
    top: `${position.y}px`
  }))

  const startConversation = () => {
    activeConversationId.value = undefined
    messages.value = []
    messageText.value = ''
    streamingReply.value = ''
  }

  const sendMessage = async () => {
    const text = messageText.value.trim()
    if (!text) {
      ElMessage.warning('请输入问题')
      return
    }
    if (sending.value) return
    messageText.value = ''
    await sendChatMessage(text)
  }

  const handleComposerKeydown = (event: Event | KeyboardEvent) => {
    const keyboardEvent = event as KeyboardEvent
    if (keyboardEvent.key !== 'Enter' || keyboardEvent.shiftKey || keyboardEvent.isComposing) return
    keyboardEvent.preventDefault()
    void sendMessage()
  }

  const sendChatMessage = async (text: string) => {
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
          agentCode: 'query-assistant',
          mode: 'Work'
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

  const openPanel = async () => {
    panelVisible.value = true
    clampPosition(true)
    await nextTick(scrollToBottom)
  }

  const minimizePanel = () => {
    panelExpanded.value = false
    panelVisible.value = false
    clampPosition(false)
  }

  const togglePanelSize = () => {
    panelExpanded.value = !panelExpanded.value
    if (panelExpanded.value) {
      position.x = 16
      position.y = 16
    } else {
      clampPosition(true)
    }
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
    if (panelExpanded.value) return
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
    const width = panelExpanded.value
      ? window.innerWidth - 32
      : forPanel
        ? Math.min(420, window.innerWidth - 32)
        : 52
    const height = panelExpanded.value
      ? window.innerHeight - 32
      : forPanel
        ? Math.min(620, window.innerHeight - 32)
        : 52
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
    if (panelExpanded.value) {
      position.x = 16
      position.y = 16
    }
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
