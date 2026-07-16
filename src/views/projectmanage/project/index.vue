<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader
        v-model:columns="columnChecks"
        v-model:showSearchBar="showSearchBar"
        :loading="loading"
        @refresh="refreshData"
      >
        <template #left>
          <ElSpace wrap>
            <ElButton type="primary" @click="openDialog('add')">新增项目</ElButton>
            <ElInput
              v-model="filters.projectName"
              clearable
              placeholder="项目名称"
              @keyup.enter="handleSearch"
            />
            <ElInput
              v-model="filters.projectCode"
              clearable
              placeholder="项目编号"
              @keyup.enter="handleSearch"
            />
            <ElSelect
              v-model="filters.projectStatus"
              clearable
              placeholder="项目状态"
              style="width: 140px"
              @change="handleSearch"
            >
              <ElOption
                v-for="item in statusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
            <ElSelect
              v-model="filters.managerId"
              filterable
              remote
              reserve-keyword
              clearable
              :remote-method="searchManagers"
              :loading="managerLoading"
              placeholder="负责人"
              style="width: 180px"
              @change="handleSearch"
              @focus="loadManagerOptions"
            >
              <ElOption
                v-for="item in managerOptions"
                :key="item.userId || item.id"
                :label="formatManagerLabel(item)"
                :value="String(item.userId || item.id)"
              />
            </ElSelect>
            <ElButton @click="handleSearch">查询</ElButton>
            <ElButton @click="resetFilters">重置</ElButton>
          </ElSpace>
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
    </ElCard>

    <ElDialog
      v-model="dialogVisible"
      :title="dialogType === 'add' ? '新增项目' : '编辑项目'"
      width="760px"
      align-center
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="96px">
        <ElRow :gutter="16">
          <ElCol :span="12">
            <ElFormItem label="项目编号" prop="projectCode">
              <ElInput v-model="form.projectCode" placeholder="例如 PM-2026-001" />
            </ElFormItem>
          </ElCol>
          <ElCol :span="12">
            <ElFormItem label="项目名称" prop="projectName">
              <ElInput v-model="form.projectName" placeholder="请输入项目名称" />
            </ElFormItem>
          </ElCol>
        </ElRow>

        <ElRow :gutter="16">
          <ElCol :span="12">
            <ElFormItem label="项目类型" prop="projectType">
              <ElSelect v-model="form.projectType" style="width: 100%">
                <ElOption
                  v-for="item in projectTypeOptions"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </ElSelect>
            </ElFormItem>
          </ElCol>
          <ElCol :span="12">
            <ElFormItem label="负责人" prop="managerId">
              <ElSelect
                v-model="form.managerId"
                filterable
                remote
                reserve-keyword
                clearable
                :remote-method="searchManagers"
                :loading="managerLoading"
                placeholder="输入姓名或账号搜索"
                style="width: 100%"
                @change="handleManagerChange"
                @focus="loadManagerOptions"
              >
                <ElOption
                  v-for="item in managerOptions"
                  :key="item.userId || item.id"
                  :label="formatManagerLabel(item)"
                  :value="String(item.userId || item.id)"
                />
              </ElSelect>
            </ElFormItem>
          </ElCol>
        </ElRow>

        <ElRow :gutter="16">
          <ElCol :span="8">
            <ElFormItem label="优先级">
              <ElSelect v-model="form.priority" style="width: 100%">
                <ElOption label="高" :value="1" />
                <ElOption label="中" :value="2" />
                <ElOption label="低" :value="3" />
              </ElSelect>
            </ElFormItem>
          </ElCol>
          <ElCol :span="8">
            <ElFormItem label="阶段">
              <ElSelect v-model="form.projectStage" style="width: 100%">
                <ElOption
                  v-for="item in stageOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
            </ElFormItem>
          </ElCol>
          <ElCol :span="8">
            <ElFormItem label="状态">
              <ElSelect v-model="form.projectStatus" style="width: 100%">
                <ElOption
                  v-for="item in statusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
            </ElFormItem>
          </ElCol>
        </ElRow>

        <ElRow :gutter="16">
          <ElCol :span="12">
            <ElFormItem label="当前进度">
              <ElProgress :percentage="Number(form.progress || 0)" style="width: 100%" />
            </ElFormItem>
          </ElCol>
          <ElCol :span="12">
            <ElFormItem label="项目标签">
              <ElInput v-model="form.projectTag" placeholder="多个标签用逗号分隔" />
            </ElFormItem>
          </ElCol>
        </ElRow>

        <ElRow :gutter="16">
          <ElCol :span="12">
            <ElFormItem label="开始时间" prop="startTime">
              <ElDatePicker
                v-model="form.startTime"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </ElFormItem>
          </ElCol>
          <ElCol :span="12">
            <ElFormItem label="结束时间" prop="endTime">
              <ElDatePicker
                v-model="form.endTime"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </ElFormItem>
          </ElCol>
        </ElRow>

        <ElRow :gutter="16">
          <ElCol :span="12">
            <ElFormItem label="客户">
              <ElInput v-model="form.customerName" />
            </ElFormItem>
          </ElCol>
          <ElCol :span="12">
            <ElFormItem label="合同编号">
              <ElInput v-model="form.contractCode" />
            </ElFormItem>
          </ElCol>
        </ElRow>

        <ElFormItem label="备注">
          <ElInput v-model="form.remark" type="textarea" :rows="3" />
        </ElFormItem>
      </ElForm>

      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="submitProject">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { h, onMounted, reactive, ref } from 'vue'
  import {
    changeProjectStatus,
    createProject,
    deleteProject,
    fetchProjectPage,
    fetchProjectStages,
    updateProject
  } from '@/api/project-manage'
  import { fetchGetUserList } from '@/api/system-manage'
  import { useTable } from '@/hooks/core/useTable'
  import ArtButtonMore, { ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import {
    ElMessage,
    ElMessageBox,
    ElProgress,
    ElTag,
    type FormInstance,
    type FormRules
  } from 'element-plus'

  defineOptions({ name: 'ProjectLedger' })

  type ProjectItem = Api.ProjectManage.ProjectItem

  const showSearchBar = ref(false)
  const dialogVisible = ref(false)
  const saving = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const formRef = ref<FormInstance>()
  const managerLoading = ref(false)
  const managerOptions = ref<Api.SystemManage.UserListItem[]>([])

  const filters = reactive<Api.ProjectManage.ProjectQueryParams>({
    projectName: undefined,
    projectCode: undefined,
    projectStatus: undefined,
    managerId: undefined
  })

  const statusOptions = [
    { label: '待启动', value: 1, type: 'info' },
    { label: '进行中', value: 2, type: 'primary' },
    { label: '延期', value: 3, type: 'danger' },
    { label: '暂停', value: 4, type: 'warning' },
    { label: '已完成', value: 5, type: 'success' },
    { label: '已归档', value: 6, type: 'info' }
  ] as const

  const stageOptions = ref<Api.ProjectManage.ProjectStageOption[]>([])

  const projectTypeOptions = ['验收', '改善', '维护', '开发', '其他']

  const defaultForm: Api.ProjectManage.ProjectSaveParams = {
    id: 0,
    projectCode: '',
    projectName: '',
    projectType: '验收',
    projectTag: '',
    priority: 2,
    projectStage: 1,
    projectStatus: 1,
    progress: 0,
    startTime: '',
    endTime: '',
    managerId: '1',
    managerUserId: '1',
    managerName: '',
    customerName: '',
    contractCode: '',
    remark: ''
  }

  const form = reactive<Api.ProjectManage.ProjectSaveParams>({ ...defaultForm })

  const rules = reactive<FormRules>({
    projectCode: [{ required: true, message: '请输入项目编号', trigger: 'blur' }],
    projectName: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
    projectType: [{ required: true, message: '请选择项目类型', trigger: 'change' }],
    startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
    endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
    managerId: [{ required: true, message: '请选择负责人', trigger: 'change' }]
  })

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
      apiFn: fetchProjectPage,
      apiParams: { current: 1, size: 20 },
      columnsFactory: () => [
        { prop: 'projectCode', label: '项目编号', minWidth: 130, showOverflowTooltip: true },
        { prop: 'projectName', label: '项目名称', minWidth: 180, showOverflowTooltip: true },
        { prop: 'projectType', label: '类型', width: 100 },
        {
          prop: 'projectStatus',
          label: '状态',
          width: 100,
          formatter: (row: ProjectItem) => {
            const item = statusOptions.find((x) => x.value === row.projectStatus) || statusOptions[0]
            return h(ElTag, { type: item.type }, () => item.label)
          }
        },
        {
          prop: 'projectStage',
          label: '阶段',
          width: 100,
          formatter: (row: ProjectItem) =>
            stageOptions.value.find((x) => x.value === row.projectStage)?.label || '-'
        },
        {
          prop: 'priority',
          label: '优先级',
          width: 90,
          formatter: (row: ProjectItem) => ({ 1: '高', 2: '中', 3: '低' })[row.priority] || '-'
        },
        {
          prop: 'progress',
          label: '进度',
          width: 170,
          formatter: (row: ProjectItem) =>
            h(ElProgress, { percentage: Number(row.progress || 0), strokeWidth: 8 })
        },
        {
          prop: 'managerName',
          label: '负责人',
          minWidth: 120,
          showOverflowTooltip: true,
          formatter: (row: ProjectItem) => row.managerName || row.managerId || '-'
        },
        { prop: 'customerName', label: '客户', minWidth: 120, showOverflowTooltip: true },
        { prop: 'contractCode', label: '合同编号', minWidth: 130, showOverflowTooltip: true },
        { prop: 'projectTag', label: '项目标签', minWidth: 120, showOverflowTooltip: true },
        { prop: 'taskCount', label: '任务数', width: 90 },
        { prop: 'fileCount', label: '文件数', width: 90 },
        { prop: 'remark', label: '备注', minWidth: 180, showOverflowTooltip: true },
        { prop: 'startTime', label: '开始时间', width: 160 },
        { prop: 'endTime', label: '结束时间', width: 160 },
        {
          prop: 'operation',
          label: '操作',
          width: 90,
          fixed: 'right',
          formatter: (row: ProjectItem) =>
            h(ArtButtonMore, {
              list: [
                { key: 'edit', label: '编辑', icon: 'ri:edit-2-line' },
                { key: 'running', label: '设为进行中', icon: 'ri:play-circle-line' },
                { key: 'finished', label: '设为完成', icon: 'ri:checkbox-circle-line' },
                { key: 'delete', label: '删除', icon: 'ri:delete-bin-4-line', color: '#f56c6c' }
              ],
              onClick: (item: ButtonMoreItem) => handleAction(item, row)
            })
        }
      ]
    }
  })

  let managerSearchTimer: ReturnType<typeof setTimeout> | undefined

  const formatManagerLabel = (item: Api.SystemManage.UserListItem) => {
    const name = item.nickName || item.userName || item.userId || item.id || '-'
    return item.userName && item.userName !== name ? `${name} (${item.userName})` : String(name)
  }

  const ensureCurrentManagerOption = () => {
    if (!form.managerId) return
    const managerId = String(form.managerId)
    const exists = managerOptions.value.some((item) => String(item.userId || item.id) === managerId)
    if (exists) return

    managerOptions.value.unshift({
      id: managerId,
      userId: managerId,
      userName: form.managerName || managerId,
      nickName: form.managerName || managerId,
      enabled: true
    } as Api.SystemManage.UserListItem)
  }

  const loadManagerOptions = async (keyword = '') => {
    managerLoading.value = true
    try {
      const result = await fetchGetUserList({
        current: 1,
        size: 20,
        keyword,
        enabled: true
      })
      managerOptions.value = result.records || []
      ensureCurrentManagerOption()
    } finally {
      managerLoading.value = false
    }
  }

  const searchManagers = (keyword: string) => {
    if (managerSearchTimer) clearTimeout(managerSearchTimer)
    managerSearchTimer = setTimeout(() => {
      loadManagerOptions(keyword.trim())
    }, 250)
  }

  const handleManagerChange = (value: string) => {
    const selected = managerOptions.value.find((item) => String(item.userId || item.id) === String(value))
    form.managerUserId = value
    form.managerName = selected ? String(selected.nickName || selected.userName || '') : ''
  }

  const handleSearch = () => {
    Object.assign(searchParams, filters)
    getData()
  }

  const resetFilters = () => {
    Object.assign(filters, {
      projectName: undefined,
      projectCode: undefined,
      projectStatus: undefined,
      managerId: undefined,
      managerUserId: undefined
    })
    resetSearchParams()
  }

  const loadProjectStages = async () => {
    stageOptions.value = await fetchProjectStages()
  }

  const openDialog = (type: 'add' | 'edit', row?: ProjectItem) => {
    dialogType.value = type
    Object.assign(form, defaultForm, row || {})
    form.managerId = String(form.managerUserId || form.managerId || '')
    form.managerUserId = String(form.managerId || '')
    ensureCurrentManagerOption()
    loadManagerOptions()
    dialogVisible.value = true
  }

  const submitProject = async () => {
    if (!formRef.value) return
    await formRef.value.validate()
    saving.value = true
    try {
      form.managerId = String(form.managerId || '')
      form.managerUserId = String(form.managerId || '')
      handleManagerChange(String(form.managerId))

      if (dialogType.value === 'add') {
        await createProject(form)
        ElMessage.success('保存成功')
        dialogVisible.value = false
        await refreshCreate()
        return
      }

      await updateProject(form)
      ElMessage.success('保存成功')
      dialogVisible.value = false
      await refreshUpdate()
    } finally {
      saving.value = false
    }
  }

  onMounted(() => {
    loadProjectStages()
    loadManagerOptions()
  })

  const handleAction = async (item: ButtonMoreItem, row: ProjectItem) => {
    if (item.key === 'edit') {
      openDialog('edit', row)
      return
    }

    if (item.key === 'running' || item.key === 'finished') {
      await changeProjectStatus(row.id, item.key === 'running' ? 2 : 5)
      ElMessage.success('状态已更新')
      await refreshUpdate()
      return
    }

    if (item.key === 'delete') {
      await ElMessageBox.confirm(`确定删除项目“${row.projectName}”吗？`, '删除确认', {
        type: 'warning'
      })
      console.log('Deleting project with ID:', row.id) // Debugging line
      await deleteProject(row.id)
      ElMessage.success('删除成功')
      await refreshRemove()
    }
  }
</script>
