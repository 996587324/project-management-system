<template>
  <ElDialog
    v-model="visible"
    :title="dialogType === 'add' ? '新增角色' : '编辑角色'"
    width="520px"
    align-center
    @close="handleClose"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="96px">
      <ElFormItem label="角色名称" prop="roleName">
        <ElInput v-model="form.roleName" placeholder="请输入角色名称" />
      </ElFormItem>
      <ElFormItem label="角色编码" prop="roleCode">
        <ElInput v-model="form.roleCode" placeholder="如 R_ENGINEER" />
      </ElFormItem>
      <ElFormItem label="角色说明" prop="description">
        <ElInput v-model="form.description" type="textarea" :rows="3" placeholder="请输入角色说明" />
      </ElFormItem>
      <ElFormItem label="启用状态">
        <ElSwitch v-model="form.enabled" />
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { createRole, updateRole } from '@/api/system-manage'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'

  type RoleItem = Api.SystemManage.RoleListItem

  interface Props {
    modelValue: boolean
    dialogType: 'add' | 'edit'
    roleData?: RoleItem
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    dialogType: 'add',
    roleData: undefined
  })

  const emit = defineEmits<Emits>()
  const formRef = ref<FormInstance>()
  const submitting = ref(false)

  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  const form = reactive<Api.SystemManage.RoleSaveParams>({
    roleId: undefined,
    roleName: '',
    roleCode: '',
    description: '',
    permissionKeys: '',
    enabled: true
  })

  const rules: FormRules = {
    roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
    roleCode: [{ required: true, message: '请输入角色编码', trigger: 'blur' }]
  }

  const initForm = () => {
    Object.assign(form, {
      roleId: props.roleData?.roleId,
      roleName: props.roleData?.roleName || '',
      roleCode: props.roleData?.roleCode || '',
      description: props.roleData?.description || '',
      permissionKeys: props.roleData?.permissionKeys || '',
      enabled: props.roleData?.enabled ?? true
    })
  }

  watch(
    () => props.modelValue,
    (value) => {
      if (value) {
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
      if (props.dialogType === 'add') {
        await createRole(form)
      } else {
        await updateRole(form)
      }
      ElMessage.success('保存成功')
      emit('success')
      visible.value = false
    } finally {
      submitting.value = false
    }
  }
</script>
