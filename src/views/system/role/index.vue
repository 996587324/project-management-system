<template>
  <div class="art-full-height">
    <RoleSearch v-show="showSearchBar" v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <ElCard class="art-table-card" shadow="never" :style="{ 'margin-top': showSearchBar ? '12px' : '0' }">
      <ArtTableHeader
        v-model:columns="columnChecks"
        v-model:showSearchBar="showSearchBar"
        :loading="loading"
        @refresh="refreshData"
      >
        <template #left>
          <ElButton type="primary" @click="showDialog('add')" v-ripple>新增角色</ElButton>
        </template>
      </ArtTableHeader>

      <ArtTable
        :loading="loading"
        :data="filteredData"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <RoleEditDialog
      v-model="dialogVisible"
      :dialog-type="dialogType"
      :role-data="currentRoleData"
      @success="handleSaveSuccess"
    />

    <RolePermissionDialog
      v-model="permissionDialog"
      :role-data="currentRoleData"
      @success="refreshData"
    />
  </div>
</template>

<script setup lang="ts">
  import ArtButtonMore, { ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { deleteRole, fetchGetRoleList } from '@/api/system-manage'
  import RoleSearch from './modules/role-search.vue'
  import RoleEditDialog from './modules/role-edit-dialog.vue'
  import RolePermissionDialog from './modules/role-permission-dialog.vue'
  import { ElMessage, ElMessageBox, ElTag } from 'element-plus'

  defineOptions({ name: 'Role' })

  type RoleItem = Api.SystemManage.RoleListItem

  const searchForm = ref({
    roleName: undefined,
    roleCode: undefined
  })

  const showSearchBar = ref(false)
  const dialogVisible = ref(false)
  const permissionDialog = ref(false)
  const currentRoleData = ref<RoleItem | undefined>(undefined)
  const dialogType = ref<'add' | 'edit'>('add')

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
      apiFn: fetchGetRoleList,
      apiParams: {
        current: 1,
        size: 20
      },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        {
          prop: 'roleName',
          label: '角色名称',
          minWidth: 140
        },
        {
          prop: 'roleCode',
          label: '角色编码',
          minWidth: 160
        },
        {
          prop: 'description',
          label: '说明',
          minWidth: 260,
          showOverflowTooltip: true
        },
        {
          prop: 'permissionKeys',
          label: '权限范围',
          minWidth: 160,
          formatter: (row) => formatPermissionScope(row)
        },
        {
          prop: 'enabled',
          label: '状态',
          width: 100,
          formatter: (row) =>
            h(ElTag, { type: row.enabled ? 'success' : 'warning' }, () => (row.enabled ? '启用' : '停用'))
        },
        {
          prop: 'createTime',
          label: '创建时间',
          width: 180
        },
        {
          prop: 'operation',
          label: '操作',
          width: 90,
          fixed: 'right',
          formatter: (row) =>
            h(ArtButtonMore, {
              list: [
                { key: 'permission', label: '权限维护', icon: 'ri:shield-keyhole-line' },
                { key: 'edit', label: '编辑角色', icon: 'ri:edit-2-line' },
                {
                  key: 'delete',
                  label: '删除角色',
                  icon: 'ri:delete-bin-4-line',
                  color: '#f56c6c',
                  disabled: isDefaultRole(row)
                }
              ],
              onClick: (item: ButtonMoreItem) => buttonMoreClick(item, row)
            })
        }
      ]
    }
  })

  const filteredData = computed(() => {
    const roleName = String(searchForm.value.roleName || '').trim().toLowerCase()
    const roleCode = String(searchForm.value.roleCode || '').trim().toLowerCase()
    return data.value.filter((item) => {
      const nameMatched = !roleName || item.roleName.toLowerCase().includes(roleName)
      const codeMatched = !roleCode || item.roleCode.toLowerCase().includes(roleCode)
      return nameMatched && codeMatched
    })
  })

  const formatPermissionScope = (row: RoleItem) => {
    if (row.permissionKeys === '*') return '全部权限'
    const count = row.permissionKeyList?.length || row.permissionKeys?.split(',').filter(Boolean).length || 0
    return count ? `${count} 项权限` : '未配置'
  }

  const isDefaultRole = (row: RoleItem) => ['R_ADMIN', 'R_ENGINEER', 'R_USER'].includes(row.roleCode)

  const showDialog = (type: 'add' | 'edit', row?: RoleItem) => {
    dialogType.value = type
    currentRoleData.value = row
    dialogVisible.value = true
  }

  const handleSearch = (params: Record<string, any>) => {
    Object.assign(searchParams, params)
    getData()
  }

  const handleSaveSuccess = () => {
    if (dialogType.value === 'add') refreshCreate()
    else refreshUpdate()
  }

  const buttonMoreClick = (item: ButtonMoreItem, row: RoleItem) => {
    switch (item.key) {
      case 'permission':
        currentRoleData.value = row
        permissionDialog.value = true
        break
      case 'edit':
        showDialog('edit', row)
        break
      case 'delete':
        handleDelete(row)
        break
    }
  }

  const handleDelete = async (row: RoleItem) => {
    if (isDefaultRole(row)) {
      ElMessage.warning('默认角色不允许删除')
      return
    }

    try {
      await ElMessageBox.confirm(`确定要删除角色「${row.roleName}」吗？`, '删除角色', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await deleteRole(row.roleId)
      ElMessage.success('删除成功')
      refreshRemove()
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(error instanceof Error ? error.message : '删除角色失败')
      }
    }
  }
</script>
