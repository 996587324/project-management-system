<template>
  <div class="user-page art-full-height">
    <UserSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton type="primary" @click="showDialog('add')" v-ripple>新增账户</ElButton>
        </template>
      </ArtTableHeader>

      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />

      <UserDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :user-data="currentUserData"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { deleteAccountPermission, fetchGetUserList } from '@/api/system-manage'
  import UserSearch from './modules/user-search.vue'
  import UserDialog from './modules/user-dialog.vue'
  import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'User' })

  type UserListItem = Api.SystemManage.UserListItem

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentUserData = ref<Partial<UserListItem>>({})

  const searchForm = ref({
    userName: undefined,
    nickName: undefined,
    roleCode: undefined,
    enabled: undefined
  })

  const roleNameMap: Record<string, string> = {
    R_ADMIN: '管理员',
    R_ENGINEER: '工程师',
    R_USER: '普通用户'
  }

  const formatRoles = (row: UserListItem) => {
    if (row.roleNames) return row.roleNames
    const roles = row.roles || row.userRoles || []
    return roles.length ? roles.map((role) => roleNameMap[role] || role).join('、') : '-'
  }

  const getEnabled = (row: UserListItem) => {
    if (typeof row.enabled === 'boolean') return row.enabled
    if (typeof row.status === 'boolean') return row.status
    return !['0', 'false', 'disabled'].includes(String(row.status ?? '').toLowerCase())
  }

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    searchParams,
    resetSearchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData,
    refreshCreate,
    refreshUpdate,
    refreshRemove
  } = useTable({
    core: {
      apiFn: fetchGetUserList,
      apiParams: {
        current: 1,
        size: 20
      },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        {
          prop: 'userName',
          label: '登录账号',
          minWidth: 150
        },
        {
          prop: 'nickName',
          label: '用户姓名',
          minWidth: 140,
          formatter: (row) => row.nickName || '-'
        },
        {
          prop: 'email',
          label: '邮箱',
          minWidth: 180,
          formatter: (row) => row.email || row.userEmail || '-'
        },
        {
          prop: 'roles',
          label: '角色权限',
          minWidth: 180,
          formatter: (row) => formatRoles(row)
        },
        {
          prop: 'enabled',
          label: '状态',
          width: 100,
          formatter: (row) => {
            const enabled = getEnabled(row)
            return h(ElTag, { type: enabled ? 'success' : 'warning' }, () =>
              enabled ? '启用' : '停用'
            )
          }
        },
        {
          prop: 'createTime',
          label: '创建时间',
          width: 180,
          sortable: true
        },
        {
          prop: 'operation',
          label: '操作',
          width: 120,
          fixed: 'right',
          formatter: (row) =>
            h('div', [
              h(ArtButtonTable, {
                type: 'edit',
                onClick: () => showDialog('edit', row)
              }),
              h(ArtButtonTable, {
                type: 'delete',
                onClick: () => deleteUser(row)
              })
            ])
        }
      ]
    }
  })

  const handleSearch = (params: Record<string, any>) => {
    Object.assign(searchParams, params)
    getData()
  }

  const showDialog = (type: DialogType, row?: UserListItem): void => {
    dialogType.value = type
    currentUserData.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const deleteUser = async (row: UserListItem): Promise<void> => {
    const userId = row.userId ?? row.id
    if (!userId) {
      ElMessage.error('未获取到账户ID')
      return
    }

    try {
      await ElMessageBox.confirm(`确定要删除账户「${row.userName}」吗？`, '删除账户', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await deleteAccountPermission(userId)
      ElMessage.success('删除成功')
      refreshRemove()
    } catch (error) {
      if (error !== 'cancel') ElMessage.error('删除账户失败')
    }
  }

  const handleDialogSubmit = async () => {
    dialogVisible.value = false
    currentUserData.value = {}
    if (dialogType.value === 'add') {
      refreshCreate()
    } else {
      refreshUpdate()
    }
  }
</script>
