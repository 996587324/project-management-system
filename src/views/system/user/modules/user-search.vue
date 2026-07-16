<template>
  <ArtSearchBar
    ref="searchBarRef"
    v-model="formData"
    :items="formItems"
    :rules="rules"
    @reset="handleReset"
    @search="handleSearch"
  />
</template>

<script setup lang="ts">
  interface Props {
    modelValue: Record<string, any>
  }

  interface Emits {
    (e: 'update:modelValue', value: Record<string, any>): void
    (e: 'search', params: Record<string, any>): void
    (e: 'reset'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const searchBarRef = ref()

  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const rules = {}

  const roleOptions = [
    { label: '管理员', value: 'R_ADMIN' },
    { label: '工程师', value: 'R_ENGINEER' },
    { label: '普通用户', value: 'R_USER' }
  ]

  const statusOptions = [
    { label: '启用', value: true },
    { label: '停用', value: false }
  ]

  const formItems = computed(() => [
    {
      label: '登录账号',
      key: 'userName',
      type: 'input',
      props: { placeholder: '请输入登录账号', clearable: true }
    },
    {
      label: '用户姓名',
      key: 'nickName',
      type: 'input',
      props: { placeholder: '请输入用户姓名', clearable: true }
    },
    {
      label: '角色',
      key: 'roleCode',
      type: 'select',
      props: { placeholder: '请选择角色', options: roleOptions, clearable: true }
    },
    {
      label: '状态',
      key: 'enabled',
      type: 'select',
      props: { placeholder: '请选择状态', options: statusOptions, clearable: true }
    }
  ])

  const handleReset = () => emit('reset')

  const handleSearch = async () => {
    await searchBarRef.value.validate()
    emit('search', formData.value)
  }
</script>
