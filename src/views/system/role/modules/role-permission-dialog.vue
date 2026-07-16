<template>
  <ElDialog
    v-model="visible"
    :title="`维护权限 - ${roleData?.roleName || ''}`"
    width="620px"
    align-center
    class="el-dialog-border"
    @close="handleClose"
  >
    <ElScrollbar height="70vh">
      <ElTree
        ref="treeRef"
        v-loading="loading"
        :data="processedMenuList"
        show-checkbox
        node-key="key"
        :default-expand-all="isExpandAll"
        :props="defaultProps"
        @check="handleTreeCheck"
      />
    </ElScrollbar>

    <template #footer>
      <ElButton @click="toggleExpandAll">{{ isExpandAll ? '收起全部' : '展开全部' }}</ElButton>
      <ElButton @click="toggleSelectAll">{{ isSelectAll ? '取消全选' : '全选' }}</ElButton>
      <ElButton type="primary" :loading="saving" @click="savePermission">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { fetchGetMenuList, getRolePermission, saveRolePermission } from '@/api/system-manage'
  import { formatMenuTitle } from '@/utils/router'

  type RoleItem = Api.SystemManage.RoleListItem

  interface Props {
    modelValue: boolean
    roleData?: RoleItem
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    roleData: undefined
  })

  const emit = defineEmits<Emits>()
  const treeRef = ref()
  const isExpandAll = ref(true)
  const isSelectAll = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const menuList = ref<MenuNode[]>([])

  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  interface MenuNode {
    id?: string | number
    name?: string
    path?: string
    key?: string
    label?: string
    meta?: {
      title?: string
      authList?: Array<{ authMark: string; title: string }>
    }
    children?: MenuNode[]
    isAuth?: boolean
  }

  const processedMenuList = computed(() => {
    const processNode = (node: MenuNode): MenuNode => {
      const key = String(node.name || node.path || node.id || '')
      const authChildren = (node.meta?.authList || []).map((auth) => ({
        key: `${key}_${auth.authMark}`,
        label: auth.title,
        isAuth: true
      }))

      const children = [
        ...(node.children || []).map(processNode),
        ...authChildren
      ]

      return {
        ...node,
        key,
        label: formatMenuTitle(node.meta?.title || node.label || key),
        children
      }
    }

    return menuList.value.map(processNode)
  })

  const defaultProps = {
    children: 'children',
    label: 'label'
  }

  watch(
    () => props.modelValue,
    async (value) => {
      if (value) await initPermission()
    }
  )

  const readPermissionKeys = (role?: RoleItem) => {
    if (!role) return []
    if (role.permissionKeyList?.length) return role.permissionKeyList
    if (role.permissionKeys) return role.permissionKeys.split(',').filter(Boolean)
    return []
  }

  const initPermission = async () => {
    if (!props.roleData?.roleId) return

    try {
      loading.value = true
      const [menus, detail] = await Promise.all([
        fetchGetMenuList(),
        getRolePermission(props.roleData.roleId)
      ])
      menuList.value = menus as MenuNode[]
      await nextTick()
      const keys = readPermissionKeys(detail)
      treeRef.value?.setCheckedKeys(keys.includes('*') ? getAllNodeKeys(processedMenuList.value) : keys)
      handleTreeCheck()
    } finally {
      loading.value = false
    }
  }

  const handleClose = () => {
    visible.value = false
    treeRef.value?.setCheckedKeys([])
  }

  const savePermission = async () => {
    if (!props.roleData?.roleId) return

    saving.value = true
    try {
      const checkedKeys = treeRef.value?.getCheckedKeys() || []
      const halfCheckedKeys = treeRef.value?.getHalfCheckedKeys() || []
      const permissionKeys = [...new Set([...checkedKeys, ...halfCheckedKeys])]

      await saveRolePermission({
        roleId: props.roleData.roleId,
        roleCode: props.roleData.roleCode,
        permissionKeys
      })

      ElMessage.success('权限保存成功')
      emit('success')
      handleClose()
    } finally {
      saving.value = false
    }
  }

  const toggleExpandAll = () => {
    const tree = treeRef.value
    if (!tree) return
    Object.values(tree.store.nodesMap).forEach((node: any) => {
      node.expanded = !isExpandAll.value
    })
    isExpandAll.value = !isExpandAll.value
  }

  const toggleSelectAll = () => {
    const tree = treeRef.value
    if (!tree) return
    tree.setCheckedKeys(isSelectAll.value ? [] : getAllNodeKeys(processedMenuList.value))
    isSelectAll.value = !isSelectAll.value
  }

  const getAllNodeKeys = (nodes: MenuNode[]): string[] => {
    const keys: string[] = []
    const walk = (items: MenuNode[]) => {
      items.forEach((item) => {
        if (item.key) keys.push(item.key)
        if (item.children?.length) walk(item.children)
      })
    }
    walk(nodes)
    return keys
  }

  const handleTreeCheck = () => {
    const checkedKeys = treeRef.value?.getCheckedKeys() || []
    const allKeys = getAllNodeKeys(processedMenuList.value)
    isSelectAll.value = checkedKeys.length === allKeys.length && allKeys.length > 0
  }
</script>
