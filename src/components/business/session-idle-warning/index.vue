<template>
  <el-dialog
    :model-value="warning"
    title="登录即将超时"
    width="min(420px, 90vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    :z-index="10000"
    role="alertdialog"
  >
    <p>你已长时间未操作，将在 {{ seconds }} 秒后退出登录。</p>
    <p>点击“继续使用”或进行其他操作，即可保持登录。</p>
    <template #footer>
      <el-button @click="logout">退出登录</el-button>
      <el-button type="primary" @click="session?.activity()">继续使用</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, ref, watch } from 'vue'
  import { useUserStore } from '@/store/modules/user'
  import { router } from '@/router'
  import {
    applicationRequest,
    getTokenPurpose,
    getTokenSessionId,
    getTokenExpiresAt
  } from '@/utils/system-applications/client'
  import { IdleSession, type SavedActivity, type SessionActivity } from '@/utils/auth/idle-session'
  import { getApiUrl } from '@/utils/runtime-config'

  const user = useUserStore()
  const warning = ref(false)
  const seconds = ref(60)
  let session: IdleSession | undefined
  let storageKey = ''
  let sessionId = ''
  let timer: number | undefined

  function readSaved(): SavedActivity | undefined {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || 'null') || undefined
    } catch {
      return undefined
    }
  }

  function save(value: SavedActivity) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      /* 禁用本地存储时，仍通过服务器同步会话。 */
    }
  }

  function logout() {
    save({ lastActivity: Date.now(), expired: true })
    session?.stop()
    warning.value = false
    user.logOut()
  }

  // 仅按会话身份重新初始化；令牌轮换和 A 的 portal/app 切换不会重置空闲时间。
  watch(
    () =>
      user.isLogin && ['portal', 'app'].includes(getTokenPurpose(user.accessToken))
        ? getTokenSessionId(user.accessToken)
        : '',
    (id) => {
      session?.stop()
      session = undefined
      if (timer) window.clearInterval(timer)
      warning.value = false
      sessionId = id
      if (!id) return
      storageKey = `calmadmin:session-activity:${id}`
      session = new IdleSession(id, {
        initialDeadline: getTokenExpiresAt(user.accessToken),
        now: Date.now,
        load: readSaved,
        save,
        sync: (idleMilliseconds) =>
          applicationRequest<SessionActivity>(
            idleMilliseconds === undefined
              ? '/api/system-applications/session'
              : '/api/system-applications/activity',
            idleMilliseconds === undefined ? undefined : { idleMilliseconds },
            user.accessToken,
            { cache: 'no-store', signal: AbortSignal.timeout(10_000) }
          ),
        credentials: (value) => {
          if (id !== sessionId) return
          // 控制台切入应用期间，旧 portal 查询不能覆盖刚兑换的 app 令牌。
          if (value.token && getTokenPurpose(value.token) === getTokenPurpose(user.accessToken))
            user.setToken(value.token, user.refreshToken)
          if (value.portalToken) sessionStorage.setItem('calmadmin:portal-token', value.portalToken)
        },
        display: (remaining, visible) => {
          if (visible) seconds.value = remaining
          // 公开大屏不因后台保存了登录信息而显示管理端提示框。
          warning.value = visible && !router.currentRoute.value.meta.publicReadOnly
        },
        expire: (reason) => {
          user.logOut({ redirect: !router.currentRoute.value.meta.publicReadOnly })
          ElMessage.info(
            reason === 'idle' ? '连续 20 分钟未操作，已退出登录' : '登录已失效，请重新登录'
          )
        }
      })
      void session.start()
      timer = window.setInterval(() => void session?.tick(), 1000)
    },
    { immediate: true }
  )

  const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'input']
  const activity = (event: Event) => {
    if (event.isTrusted && !document.hidden && !router.currentRoute.value.meta.publicReadOnly)
      session?.activity()
  }
  const check = () => void session?.tick()
  const flushActivity = () => {
    const idleMilliseconds = session?.pendingIdleMilliseconds()
    if (idleMilliseconds === undefined) return
    void fetch(getApiUrl('/api/system-applications/activity'), {
      method: 'POST',
      keepalive: true,
      headers: {
        Authorization: `Bearer ${user.accessToken.replace(/^Bearer\s+/i, '')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ idleMilliseconds })
    }).catch(() => undefined)
  }
  const visibility = () => {
    if (document.hidden) flushActivity()
    else check()
  }
  const storage = (event: StorageEvent) => {
    if (event.key === storageKey) check()
  }
  activityEvents.forEach((name) =>
    window.addEventListener(name, activity, { capture: true, passive: true })
  )
  window.addEventListener('focus', check)
  window.addEventListener('pageshow', check)
  window.addEventListener('pagehide', flushActivity)
  window.addEventListener('storage', storage)
  document.addEventListener('visibilitychange', visibility)
  onBeforeUnmount(() => {
    session?.stop()
    if (timer) window.clearInterval(timer)
    activityEvents.forEach((name) => window.removeEventListener(name, activity, true))
    window.removeEventListener('focus', check)
    window.removeEventListener('pageshow', check)
    window.removeEventListener('pagehide', flushActivity)
    window.removeEventListener('storage', storage)
    document.removeEventListener('visibilitychange', visibility)
  })
</script>
