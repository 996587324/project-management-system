<template>
  <ElDialog
    v-model="dialogVisible"
    :title="type === 'add' ? '新增登录账户' : '编辑登录账户'"
    width="520px"
    align-center
    @close="handleClose"
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElFormItem label="登录账号" prop="userName">
        <ElInput v-model="formData.userName" placeholder="请输入登录账号" />
      </ElFormItem>
      <ElFormItem label="登录密码" prop="password">
        <ElInput
          v-model="formData.password"
          type="password"
          show-password
          :placeholder="type === 'add' ? '请输入初始密码' : '留空则不修改密码'"
        />
      </ElFormItem>
      <ElFormItem label="用户姓名" prop="nickName">
        <ElInput v-model="formData.nickName" placeholder="请输入用户姓名" />
      </ElFormItem>
      <ElFormItem label="邮箱" prop="email">
        <ElInput v-model="formData.email" placeholder="请输入邮箱" />
      </ElFormItem>
      <ElFormItem label="角色权限" prop="roles">
        <ElSelect v-model="formData.roles" multiple style="width: 100%" placeholder="请选择角色">
          <ElOption
            v-for="role in roleOptions"
            :key="role.roleCode"
            :label="role.roleName"
            :value="role.roleCode"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="启用状态">
        <ElSwitch v-model="formData.enabled" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { createAccountPermission, fetchGetRoleList, updateAccountPermission } from '@/api/system-manage'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { DialogType } from '@/types'

  type UserItem = Api.SystemManage.UserListItem
  type RoleItem = Api.SystemManage.RoleListItem

  interface Props {
    visible: boolean
    type: DialogType
    userData?: Partial<UserItem>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const roleOptions = ref<RoleItem[]>([])

  const formData = reactive({
    id: undefined as number | string | undefined,
    userId: undefined as number | string | undefined,
    userName: '',
    password: '',
    nickName: '',
    email: '',
    roles: [] as string[],
    enabled: true
  })

  const validatePassword = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
    if (props.type === 'add' && !value) {
      callback(new Error('请输入初始密码'))
      return
    }
    callback()
  }

  const rules: FormRules = {
    userName: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
    password: [{ validator: validatePassword, trigger: 'blur' }],
    nickName: [{ required: true, message: '请输入用户姓名', trigger: 'blur' }],
    roles: [{ required: true, message: '请选择角色', trigger: 'change' }]
  }

  const loadRoles = async () => {
    const res = await fetchGetRoleList({ current: 1, size: 100 })
    roleOptions.value = res.records.filter((role) => role.enabled)
  }

  const initForm = () => {
    const row = props.userData || {}
    Object.assign(formData, {
      id: row.id,
      userId: row.userId ?? row.id,
      userName: row.userName || '',
      password: '',
      nickName: row.nickName || '',
      email: row.email || row.userEmail || '',
      roles: row.roles || row.userRoles || [],
      enabled: row.enabled ?? row.status !== false
    })
  }

  watch(
    () => props.visible,
    async (visible) => {
      if (visible) {
        await loadRoles()
        initForm()
        nextTick(() => formRef.value?.clearValidate())
      }
    }
  )

  const handleClose = () => {
    formRef.value?.resetFields()
  }

  const handleSubmit = async () => {
    if (!formRef.value) return
    await formRef.value.validate()
    submitting.value = true
    try {
      const params = {
        ...formData,
        userEmail: formData.email,
        roleCodes: formData.roles
      }

      if (props.type === 'add') {
        await createAccountPermission(params)
      } else {
        await updateAccountPermission(params)
      }

      ElMessage.success(props.type === 'add' ? '新增成功' : '保存成功')
      dialogVisible.value = false
      emit('submit')
    } finally {
      submitting.value = false
    }
  }
</script>
