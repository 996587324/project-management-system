<!-- 个人中心页面 -->
<template>
  <div class="w-full h-full p-0 bg-transparent border-none shadow-none">
    <div class="relative flex-b mt-2.5 max-md:block max-md:mt-1">
      <div class="w-112 mr-5 max-md:w-full max-md:mr-0">
        <div class="art-card-sm relative p-9 pb-6 overflow-hidden text-center">
          <img class="absolute top-0 left-0 w-full h-50 object-cover" src="@imgs/user/bg.webp" />
          <img
            class="relative z-10 w-20 h-20 mt-30 mx-auto object-cover border-2 border-white rounded-full"
            :src="avatarSrc"
            alt="当前用户头像"
            @error="avatarLoadError"
          />
          <div class="relative z-10 mt-3 flex justify-center gap-2">
            <ElButton size="small" type="primary" @click="avatarEditorVisible = true"
              >更换头像</ElButton
            >
            <ElButton
              size="small"
              :disabled="!userInfo.avatarVersion"
              :loading="resettingAvatar"
              @click="resetAvatar"
              >恢复默认</ElButton
            >
          </div>
          <h2 class="mt-5 text-xl font-normal">{{ displayName }}</h2>
          <p class="mt-5 text-sm">{{ $t('systemPages.userCenter.profileSubtitle') }}</p>

          <div class="w-75 mx-auto mt-7.5 text-left">
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:mail-line" class="text-g-700" />
              <span class="ml-2 text-sm">{{ userInfo.email || form.email }}</span>
            </div>
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:user-3-line" class="text-g-700" />
              <span class="ml-2 text-sm">{{ $t('systemPages.userCenter.expert') }}</span>
            </div>
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:map-pin-line" class="text-g-700" />
              <span class="ml-2 text-sm">{{ $t('systemPages.userCenter.region') }}</span>
            </div>
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:dribbble-fill" class="text-g-700" />
              <span class="ml-2 text-sm">{{ $t('systemPages.userCenter.strength') }}</span>
            </div>
          </div>

          <div class="mt-10">
            <h3 class="text-sm font-medium">{{ $t('systemPages.userCenter.tags') }}</h3>
            <div class="flex flex-wrap justify-center mt-3.5">
              <div
                v-for="item in lableList"
                :key="item"
                class="py-1 px-1.5 mr-2.5 mb-2.5 text-xs border border-g-300 rounded"
              >
                {{ item }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="flex-1 overflow-hidden max-md:w-full max-md:mt-3.5">
        <div class="art-card-sm">
          <h1 class="p-4 text-xl font-normal border-b border-g-300">{{
            $t('systemPages.userCenter.accountInfo')
          }}</h1>

          <ElForm
            :model="form"
            class="box-border p-5 [&>.el-row_.el-form-item]:w-[calc(50%-10px)] [&>.el-row_.el-input]:w-full [&>.el-row_.el-select]:w-full"
            ref="ruleFormRef"
            :rules="rules"
            label-width="86px"
            label-position="top"
          >
            <ElRow>
              <ElFormItem :label="$t('systemPages.userCenter.name')" prop="realName">
                <ElInput v-model="form.realName" disabled />
              </ElFormItem>
              <ElFormItem :label="$t('systemPages.userCenter.gender')" prop="sex" class="ml-5">
                <ElSelect
                  v-model="form.sex"
                  :placeholder="$t('systemPages.userCenter.select')"
                  disabled
                >
                  <ElOption
                    v-for="item in options"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </ElSelect>
              </ElFormItem>
            </ElRow>

            <ElRow>
              <ElFormItem :label="$t('systemPages.userCenter.nickname')" prop="nikeName">
                <ElInput v-model="form.nikeName" disabled />
              </ElFormItem>
              <ElFormItem :label="$t('systemPages.userCenter.email')" prop="email" class="ml-5">
                <ElInput v-model="form.email" disabled />
              </ElFormItem>
            </ElRow>

            <ElRow>
              <ElFormItem :label="$t('systemPages.userCenter.phone')" prop="mobile">
                <ElInput v-model="form.mobile" disabled />
              </ElFormItem>
              <ElFormItem :label="$t('systemPages.userCenter.address')" prop="address" class="ml-5">
                <ElInput v-model="form.address" disabled />
              </ElFormItem>
            </ElRow>

            <ElFormItem :label="$t('systemPages.userCenter.bio')" prop="des" class="h-32">
              <ElInput type="textarea" :rows="4" v-model="form.des" disabled />
            </ElFormItem>
          </ElForm>
        </div>

        <div class="art-card-sm my-5">
          <h1 class="p-4 text-xl font-normal border-b border-g-300">{{
            $t('systemPages.userCenter.changePassword')
          }}</h1>

          <ElForm
            ref="pwdFormRef"
            :model="pwdForm"
            :rules="pwdRules"
            class="box-border p-5"
            label-width="86px"
            label-position="top"
          >
            <ElFormItem :label="$t('systemPages.userCenter.currentPassword')" prop="oldPassword">
              <ElInput
                v-model="pwdForm.oldPassword"
                type="password"
                :disabled="!isEditPwd"
                show-password
              />
            </ElFormItem>

            <ElFormItem :label="$t('systemPages.userCenter.newPassword')" prop="newPassword">
              <ElInput
                v-model="pwdForm.newPassword"
                type="password"
                :disabled="!isEditPwd"
                show-password
              />
            </ElFormItem>

            <ElFormItem
              :label="$t('systemPages.userCenter.confirmNewPassword')"
              prop="confirmPassword"
            >
              <ElInput
                v-model="pwdForm.confirmPassword"
                type="password"
                :disabled="!isEditPwd"
                show-password
              />
            </ElFormItem>

            <div class="flex-c justify-end [&_.el-button]:!w-27.5">
              <ElButton
                type="primary"
                class="w-22.5"
                :loading="savingPwd"
                v-ripple
                @click="editPwd"
              >
                {{
                  isEditPwd ? $t('systemPages.userCenter.save') : $t('systemPages.userCenter.edit')
                }}
              </ElButton>
            </div>
          </ElForm>
        </div>
      </div>
    </div>
    <UserAvatarEditor v-model="avatarEditorVisible" />
  </div>
</template>

<script setup lang="ts">
  import { changeCurrentUserPassword } from '@/api/auth'
  import { useUserStore } from '@/store/modules/user'
  import type { FormInstance, FormRules } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import UserAvatarEditor from '@/components/core/media/user-avatar-editor/index.vue'
  import { avatarSrc, avatarLoadError } from '@/utils/user-avatar/resource'
  import { requestAvatarMetadata } from '@/api/user-profile'

  defineOptions({ name: 'UserCenter' })

  const userStore = useUserStore()
  const userInfo = computed(() => userStore.getUserInfo)
  const avatarEditorVisible = ref(false)
  const resettingAvatar = ref(false)

  async function resetAvatar() {
    const token = userStore.accessToken
    const userId = userStore.info.userId
    try {
      await ElMessageBox.confirm('恢复项目默认头像？', '恢复默认', { type: 'warning' })
    } catch {
      return
    }
    if (userStore.accessToken !== token || userStore.info.userId !== userId) return
    resettingAvatar.value = true
    try {
      const metadata = await requestAvatarMetadata(token, 'reset')
      if (userStore.accessToken !== token || userStore.info.userId !== userId || !userStore.isLogin)
        return
      userStore.setAvatar(metadata)
      ElMessage.success('已恢复默认头像')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '恢复默认失败')
    } finally {
      resettingAvatar.value = false
    }
  }
  const { t } = useI18n()
  const displayName = computed(
    () =>
      userInfo.value.userName ||
      userInfo.value.accountKey ||
      t('systemPages.userCenter.accountInfo')
  )

  const isEditPwd = ref(false)
  const savingPwd = ref(false)
  const date = ref('')
  const ruleFormRef = ref<FormInstance>()
  const pwdFormRef = ref<FormInstance>()

  /**
   * 用户信息表单
   */
  const form = reactive({
    realName: '',
    nikeName: '',
    email: '',
    mobile: '',
    address: '',
    sex: '',
    des: ''
  })

  /**
   * 密码修改表单
   */
  const pwdForm = reactive({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  /**
   * 表单验证规则
   */
  const rules = reactive<FormRules>({
    realName: [
      { required: true, message: t('systemPages.userCenter.name'), trigger: 'blur' },
      { min: 2, max: 50, message: t('systemPages.userCenter.lengthLimit'), trigger: 'blur' }
    ],
    nikeName: [
      { required: true, message: t('systemPages.userCenter.nickname'), trigger: 'blur' },
      { min: 2, max: 50, message: t('systemPages.userCenter.lengthLimit'), trigger: 'blur' }
    ],
    email: [{ required: true, message: t('systemPages.userCenter.email'), trigger: 'blur' }],
    mobile: [{ required: true, message: t('systemPages.userCenter.phone'), trigger: 'blur' }],
    address: [{ required: true, message: t('systemPages.userCenter.address'), trigger: 'blur' }],
    sex: [{ required: true, message: t('systemPages.userCenter.gender'), trigger: 'blur' }]
  })

  const validateConfirmPassword = (
    _rule: any,
    value: string,
    callback: (error?: Error) => void
  ) => {
    if (value !== pwdForm.newPassword) {
      callback(new Error(t('systemPages.userCenter.passwordMismatch')))
      return
    }
    callback()
  }

  const pwdRules = reactive<FormRules>({
    oldPassword: [
      { required: true, message: t('systemPages.userCenter.inputCurrentPassword'), trigger: 'blur' }
    ],
    newPassword: [
      { required: true, message: t('systemPages.userCenter.inputNewPassword'), trigger: 'blur' },
      { min: 6, message: t('systemPages.userCenter.passwordMin'), trigger: 'blur' }
    ],
    confirmPassword: [
      { required: true, message: t('systemPages.userCenter.confirmPassword'), trigger: 'blur' },
      { validator: validateConfirmPassword, trigger: 'blur' }
    ]
  })

  /**
   * 性别选项
   */
  const options = computed(() => [
    { value: '1', label: t('systemPages.userCenter.male') },
    { value: '2', label: t('systemPages.userCenter.female') }
  ])

  /**
   * 用户标签列表
   */
  const lableList = computed(() => [
    t('systemPages.userCenter.tagSecurity'),
    t('systemPages.userCenter.tagAccount'),
    t('systemPages.userCenter.tagPermission'),
    t('systemPages.userCenter.tagProfile'),
    t('systemPages.userCenter.tagPassword')
  ])

  watch(
    userInfo,
    (info) => {
      const profile = info as Partial<Api.Auth.UserInfo> & Record<string, any>
      Object.assign(form, {
        realName: profile.realName || profile.userName || '',
        nikeName: profile.nickName || profile.userName || '',
        email: profile.email || profile.userEmail || '',
        mobile: profile.mobile || profile.phone || profile.userPhone || '',
        address: profile.address || '',
        sex: profile.sex || profile.gender || '',
        des: profile.bio || profile.description || ''
      })
    },
    { immediate: true, deep: true }
  )

  onMounted(() => {
    getDate()
  })

  /**
   * 根据当前时间获取问候语
   */
  const getDate = () => {
    const h = new Date().getHours()

    if (h >= 6 && h < 9) date.value = t('systemPages.userCenter.goodEarlyMorning')
    else if (h >= 9 && h < 11) date.value = t('systemPages.userCenter.goodMorning')
    else if (h >= 11 && h < 13) date.value = t('systemPages.userCenter.goodNoon')
    else if (h >= 13 && h < 18) date.value = t('systemPages.userCenter.goodAfternoon')
    else if (h >= 18 && h < 24) date.value = t('systemPages.userCenter.goodEvening')
    else date.value = t('systemPages.userCenter.goodNight')
  }

  const resetPwdForm = () => {
    Object.assign(pwdForm, {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
    pwdFormRef.value?.clearValidate()
  }

  const editPwd = async () => {
    if (!isEditPwd.value) {
      isEditPwd.value = true
      return
    }

    if (!pwdFormRef.value) return
    try {
      await pwdFormRef.value.validate()
      savingPwd.value = true
      await changeCurrentUserPassword({
        oldPassword: pwdForm.oldPassword,
        newPassword: pwdForm.newPassword,
        confirmPassword: pwdForm.confirmPassword
      })
      ElMessage.success(t('systemPages.userCenter.changeSuccess'))
      isEditPwd.value = false
      resetPwdForm()
    } catch (error) {
      ElMessage.error(t('systemPages.userCenter.changeFailed'))
    } finally {
      savingPwd.value = false
    }
  }
</script>
