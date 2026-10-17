<template>
  <main class="application-portal" v-loading="loading">
    <header>
      <div><h1>系统控制台</h1><p>选择已授权的系统。各系统共用数据源，菜单和操作权限独立。</p></div>
      <el-button @click="userStore.logOut({ sso: true })">退出登录 / 换号</el-button>
    </header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-empty
      v-if="!loading && !applications.length"
      description="当前账号尚未分配系统，请联系平台管理员"
    />
    <section class="application-list">
      <el-card v-for="application in applications" :key="application.appCode">
        <h2>{{ application.displayName }}</h2>
        <p>系统编码：{{ application.appCode }}</p>
        <el-button
          type="primary"
          :loading="entering === application.appCode"
          @click="enter(application)"
          >进入系统</el-button
        >
      </el-card>
    </section>
    <el-button v-if="platformAdministrator" @click="openAdministration"
      >配置系统入口与授权</el-button
    >
  </main>
</template>

<script setup lang="ts">
  import { useUserStore } from '@/store/modules/user'
  import { useWorktabStore } from '@/store/modules/worktab'
  import { resetRouterState } from '@/router/guards/beforeEach'
  import {
    applicationRequest,
    createEntryProof,
    takeEntryProof,
    withHashQuery,
    setApplicationName,
    cancelApplicationRequests,
    type ApplicationInfo
  } from '@/utils/system-applications/client'

  const router = useRouter()
  const route = useRoute()
  const userStore = useUserStore()
  const applications = ref<ApplicationInfo[]>([])
  const platformAdministrator = ref(false)
  const loading = ref(true)
  const entering = ref('')
  const error = ref('')
  const portalToken = () =>
    sessionStorage.getItem('calmadmin:portal-token') || userStore.accessToken

  onMounted(async () => {
    try {
      applications.value = await applicationRequest<ApplicationInfo[]>(
        '/api/system-applications',
        undefined,
        portalToken()
      )
      const context = await applicationRequest<{ platformAdministrator: boolean }>(
        '/api/system-applications/context',
        undefined,
        portalToken()
      )
      platformAdministrator.value = context.platformAdministrator
      // 从 B 固定入口返回控制台的验证握手，登录后直接进入已选择的 B，不再重复选择一次。
      if (route.query.app === 'B' && route.query.state && route.query.challenge) {
        const target = applications.value.find((item) => item.appCode === 'B')
        if (!target) throw new Error('当前账号没有 B 系统授权')
        await enter(target)
      }
    } catch (reason) {
      error.value = (reason as Error).message
    } finally {
      loading.value = false
    }
  })

  async function enter(application: ApplicationInfo, homeOverride?: string) {
    entering.value = application.appCode
    error.value = ''
    try {
      if (application.appCode === 'B' && route.query.app !== 'B') {
        if (!application.entryUrl)
          throw new Error('请先登记 B 前端的固定入口地址，例如站点的 #/auth/entry')
        location.assign(withHashQuery(application.entryUrl, { begin: '1' }))
        return
      }
      const proof =
        application.appCode === 'A'
          ? createEntryProof('A')
          : {
              state: String(route.query.state || ''),
              challenge: String(route.query.challenge || '')
            }
      const ticket = await applicationRequest<{ ticket: string; entryUrl: string }>(
        '/api/system-applications/ticket',
        { appCode: application.appCode, codeChallenge: proof.challenge, state: proof.state },
        portalToken()
      )
      if (application.appCode === 'B') {
        if (!ticket.entryUrl) throw new Error('B 入口未登记')
        location.assign(
          withHashQuery(ticket.entryUrl, { ticket: ticket.ticket, state: proof.state })
        )
        return
      }
      const result = await applicationRequest<{
        token: string
        displayName: string
        homePath: string
      }>('/api/system-applications/redeem', {
        appCode: 'A',
        ticket: ticket.ticket,
        state: proof.state,
        codeVerifier: takeEntryProof('A', proof.state)
      })
      cancelApplicationRequests()
      resetRouterState(0)
      useWorktabStore().clearAll()
      userStore.setUserInfo({} as Api.Auth.UserInfo)
      userStore.setToken(result.token, '')
      setApplicationName(result.displayName)
      await router.replace(homeOverride || result.homePath || '/')
    } catch (reason) {
      error.value = (reason as Error).message
    } finally {
      entering.value = ''
    }
  }

  function openAdministration() {
    const application = applications.value.find((item) => item.appCode === 'A')
    if (application) void enter(application, '/system-applications')
  }
</script>

<style scoped>
  .application-portal {
    max-width: 1100px;
    padding: 48px 24px;
    margin: auto;
  }
  header {
    display: flex;
    gap: 24px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
  }
  h1 {
    font-size: 30px;
    margin-bottom: 12px;
  }
  p {
    margin: 12px 0 24px;
    color: var(--el-text-color-secondary);
  }
  .application-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 24px;
    margin: 24px 0;
  }
  h2 {
    font-size: 22px;
  }
</style>
