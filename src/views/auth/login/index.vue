<!-- 登录页面 -->
<template>
  <div class="auth-page">
    <LoginLeftView />

    <div class="auth-page__content">
      <AuthTopBar />

      <div class="auth-right-wrap">
        <div class="form">
          <h3 class="title">{{ $t('login.title') }}</h3>
          <p class="sub-title">{{ $t('login.subTitle') }}</p>
          <ElForm
            ref="formRef"
            :model="formData"
            :rules="rules"
            :key="formKey"
            @keyup.enter="handleSubmit"
            style="margin-top: 25px"
          >
            <ElFormItem prop="username">
              <ElInput
                class="custom-height"
                :placeholder="$t('login.placeholder.username')"
                v-model.trim="formData.username"
                autocomplete="username"
              />
            </ElFormItem>
            <ElFormItem prop="password">
              <ElInput
                class="custom-height"
                :placeholder="$t('login.placeholder.password')"
                v-model.trim="formData.password"
                type="password"
                autocomplete="current-password"
                show-password
              />
            </ElFormItem>

            <!-- 推拽验证 -->
            <div class="relative pb-5 mt-6">
              <div
                class="relative z-[2] overflow-hidden select-none rounded-lg border border-transparent tad-300"
                :class="{ '!border-[#FF4E4F]': !isPassing && isClickPass }"
              >
                <ArtDragVerify
                  ref="dragVerify"
                  v-model:value="isPassing"
                  :text="$t('login.sliderText')"
                  textColor="var(--art-gray-700)"
                  :successText="$t('login.sliderSuccessText')"
                  progressBarBg="var(--main-color)"
                  :background="isDark ? '#26272F' : '#F1F1F4'"
                  handlerBg="var(--default-box-color)"
                />
              </div>
              <p
                class="absolute top-0 z-[1] px-px mt-2 text-xs text-[#f56c6c] tad-300"
                :class="{ 'translate-y-10': !isPassing && isClickPass }"
              >
                {{ $t('login.placeholder.slider') }}
              </p>
            </div>

            <div class="flex-cb mt-2 text-sm">
              <ElCheckbox v-model="formData.rememberPassword">{{
                $t('login.rememberPwd')
              }}</ElCheckbox>
              <RouterLink class="text-theme" :to="{ name: 'ForgetPassword' }">{{
                $t('login.forgetPwd')
              }}</RouterLink>
            </div>

            <div style="margin-top: 30px">
              <ElButton
                class="w-full custom-height"
                type="primary"
                @click="handleSubmit"
                :loading="loading"
                v-ripple
              >
                {{ $t('login.btnText') }}
              </ElButton>
            </div>
          </ElForm>

          <div v-if="oauthStatus.enabled" class="oauth-login">
            <div class="oauth-login__divider"><span>或</span></div>
            <ElButton
              class="w-full custom-height"
              plain
              :loading="oauthLoading"
              @click="startOAuthLogin"
            >
              使用{{ oauthStatus.displayName }}登录
            </ElButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import {
    applicationDisplayName,
    loadApplicationEntryInformation
  } from '@/utils/system-applications/client'
  import { useUserStore } from '@/store/modules/user'
  import { useI18n } from 'vue-i18n'
  import { HttpError } from '@/utils/http/error'
  import {
    completeOAuth2Login,
    fetchLogin,
    fetchOAuth2Status,
    getOAuth2AuthorizeUrl
  } from '@/api/auth'
  import { ElMessage, ElNotification, type FormInstance, type FormRules } from 'element-plus'
  import { useSettingStore } from '@/store/modules/setting'

  defineOptions({ name: 'Login' })

  const settingStore = useSettingStore()
  const { isDark } = storeToRefs(settingStore)
  const { t, locale } = useI18n()
  const formKey = ref(0)
  const rememberKey = 'project-manage-login-remember'

  // 监听语言切换，重置表单
  watch(locale, () => {
    formKey.value++
  })

  const dragVerify = ref()

  const userStore = useUserStore()
  const router = useRouter()
  const route = useRoute()
  const isPassing = ref(false)
  const isClickPass = ref(false)
  const oauthLoading = ref(false)
  const oauthStatus = reactive<Api.Auth.OAuth2Status>({
    enabled: false,
    displayName: '统一身份认证'
  })

  const systemName = applicationDisplayName
  const formRef = ref<FormInstance>()

  const formData = reactive({
    username: '',
    password: '',
    rememberPassword: false
  })

  const rules = computed<FormRules>(() => ({
    username: [{ required: true, message: t('login.placeholder.username'), trigger: 'blur' }],
    password: [{ required: true, message: t('login.placeholder.password'), trigger: 'blur' }]
  }))

  const loading = ref(false)

  onMounted(async () => {
    restoreRememberedAccount()
    void loadApplicationEntryInformation().catch(() => undefined)
    await initializeOAuthLogin()
  })

  const initializeOAuthLogin = async () => {
    const oauthError = typeof route.query.oauthError === 'string' ? route.query.oauthError : ''
    if (oauthError) ElMessage.error(oauthError)

    const ticket = typeof route.query.oauthTicket === 'string' ? route.query.oauthTicket : ''
    if (ticket) {
      await handleOAuthCallback(ticket)
      return
    }

    try {
      Object.assign(oauthStatus, await fetchOAuth2Status())
    } catch {
      oauthStatus.enabled = false
    }
  }

  const completeLogin = async (token: string, refreshToken?: string, redirect?: string) => {
    if (!token) throw new Error('Login failed - no token received')
    userStore.setToken(token, refreshToken)
    sessionStorage.setItem('calmadmin:portal-token', token)
    userStore.setLoginStatus(true)
    showLoginSuccessNotice()
    await router.replace(redirect?.startsWith('/portal') ? redirect : '/portal')
  }

  const handleOAuthCallback = async (ticket: string) => {
    oauthLoading.value = true
    try {
      const { token, refreshToken } = await completeOAuth2Login({ ticket })
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
      await completeLogin(token, refreshToken, redirect)
    } catch (error) {
      if (!(error instanceof HttpError)) {
        ElMessage.error('统一认证登录失败，请重新尝试')
      }
    } finally {
      oauthLoading.value = false
    }
  }

  const startOAuthLogin = () => {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    window.location.assign(getOAuth2AuthorizeUrl(redirect))
  }

  // 设置账号
  const restoreRememberedAccount = () => {
    const remembered = localStorage.getItem(rememberKey)
    if (!remembered) return

    try {
      const account = JSON.parse(remembered) as { username?: string; password?: string }
      formData.username = account.username ?? ''
      formData.password = account.password ?? ''
      formData.rememberPassword = Boolean(formData.username || formData.password)
    } catch {
      localStorage.removeItem(rememberKey)
    }
  }

  const syncRememberedAccount = () => {
    if (!formData.rememberPassword) {
      localStorage.removeItem(rememberKey)
      return
    }

    localStorage.setItem(
      rememberKey,
      JSON.stringify({
        username: formData.username,
        password: formData.password
      })
    )
  }

  // 登录
  const handleSubmit = async () => {
    if (!formRef.value) return

    try {
      // 表单验证
      const valid = await formRef.value.validate()
      if (!valid) return

      // 拖拽验证
      if (!isPassing.value) {
        isClickPass.value = true
        return
      }

      loading.value = true

      // 登录请求
      const { username, password } = formData
      const { token, refreshToken } = await fetchLogin({
        userName: username,
        password
      })
      syncRememberedAccount()
      const redirect = route.query.redirect as string
      await completeLogin(token, refreshToken, redirect)
    } catch (error) {
      // 处理 HttpError
      if (error instanceof HttpError) {
        return
      } else {
        // 处理非 HttpError
        // ElMessage.error('登录失败，请稍后重试')
        console.error('[Login] Unexpected error:', error)
      }
    } finally {
      loading.value = false
      resetDragVerify()
    }
  }

  // 重置拖拽验证
  const resetDragVerify = () => {
    dragVerify.value?.reset()
  }

  // 登录成功提示
  const showLoginSuccessNotice = () => {
    setTimeout(() => {
      ElNotification({
        title: t('login.success.title'),
        type: 'success',
        duration: 2500,
        zIndex: 10000,
        message: `${t('login.success.message')}, ${systemName}!`
      })
    }, 1000)
  }
</script>

<style scoped>
  @import './style.css';
</style>
