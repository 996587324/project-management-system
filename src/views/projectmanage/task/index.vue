<template>
  <div class="task-page">
    <ElCard shadow="never">
      <div class="toolbar">
        <ElSpace wrap>
          <ElSelect
            v-model="selectedProjectName"
            clearable
            filterable
            placeholder="选择项目"
            style="width: 260px"
            @change="handleSelectedProjectChange"
          >
            <ElOption
              v-for="item in projectOptions"
              :key="String(item.id)"
              :label="formatProjectLabel(item)"
              :value="item.projectName"
            />
          </ElSelect>
          <ElSelect
            v-model="selectedManagerName"
            clearable
            filterable
            remote
            reserve-keyword
            :remote-method="searchExecutors"
            :loading="executorLoading"
            placeholder="项目负责人"
            style="width: 180px"
            @change="handleSelectedManagerChange"
            @visible-change="(visible: boolean) => visible && loadExecutorOptions()"
          >
            <ElOption
              v-for="item in executorOptions"
              :key="getManagerFilterValue(item)"
              :label="formatExecutorLabel(item)"
              :value="getManagerFilterValue(item)"
            />
          </ElSelect>
          <ElButton
            v-auth="'Create'"
            type="primary"
            :disabled="!projects.length"
            @click="openDialog('add')"
            >新增任务</ElButton
          >
          <ElButton :loading="loading" @click="refreshData">刷新</ElButton>
        </ElSpace>
        <ElSegmented v-model="viewMode" :options="viewOptions" />
      </div>

      <ElEmpty v-if="!projects.length || !visibleProjects.length" :description="emptyDescription" />

      <template v-else>
        <div v-if="viewMode === 'board'" class="board">
          <section
            v-for="column in boardColumns"
            :key="column.status"
            class="board-column"
            @dragover.prevent
            @drop="handleDrop(column.status)"
          >
            <header>
              <span>{{ column.title }}</span>
              <ElTag round size="small" :type="column.type">{{
                groupedTasks[column.status]?.length || 0
              }}</ElTag>
            </header>
            <div class="task-list">
              <article
                v-for="task in groupedTasks[column.status]"
                :key="task.id"
                draggable="true"
                class="task-card"
                @dragstart="draggingTask = task"
                @click="openDialog('edit', task)"
              >
                <div class="task-title">{{ task.taskName }}</div>
                <div class="task-meta">
                  <ElTag size="small" effect="plain">{{ priorityText(task.priority) }}</ElTag>
                  <span>{{ formatDate(task.startTime) }} 至 {{ formatDate(task.endTime) }}</span>
                </div>
                <ElProgress :percentage="Number(task.progress || 0)" :stroke-width="6" />
              </article>
            </div>
          </section>
        </div>

        <div v-else class="gantt">
          <div class="gantt-header">
            <span>节点名称</span>
            <span>开始时间</span>
            <span>结束时间</span>
            <span>时间轴</span>
          </div>
          <div
            v-for="row in ganttRows"
            :key="row.rowKey"
            class="gantt-row"
            :class="{ 'is-project': row.type === 'project' }"
          >
            <div
              class="gantt-name"
              :style="{ paddingLeft: `${12 + (row.level - 1) * 18}px` }"
              @click="
                row.type === 'task' && row.task
                  ? openDialog('edit', row.task)
                  : selectProjectNode(row.projectName)
              "
            >
              <button
                v-if="row.type === 'project'"
                class="gantt-toggle"
                type="button"
                @click.stop="toggleProject(row.projectName)"
              >
                {{ collapsedProjectNames.has(row.projectName) ? '+' : '-' }}
              </button>
              <span>{{ row.name }}</span>
            </div>
            <div class="gantt-date">{{ formatDate(row.startTime) }}</div>
            <div class="gantt-date">{{ formatDate(row.endTime) }}</div>
            <div class="gantt-track">
              <div class="gantt-bar" :class="barClass(row)" :style="barStyle(row)">
                <span>{{ Number(row.progress || 0) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </ElCard>

    <ElDialog
      v-model="dialogVisible"
      :title="dialogType === 'add' ? '新增任务' : '编辑任务'"
      width="680px"
      align-center
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="92px">
        <ElFormItem label="所属项目" prop="projectId">
          <ElSelect
            v-model="form.projectId"
            filterable
            style="width: 100%"
            @change="handleFormProjectChange"
          >
            <ElOption
              v-for="item in projects"
              :key="String(item.id)"
              :label="formatProjectLabel(item)"
              :value="item.projectName"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="任务名称" prop="taskName">
          <ElInput v-model="form.taskName" />
        </ElFormItem>
        <ElRow :gutter="16">
          <ElCol :span="12">
            <ElFormItem label="任务类型" prop="taskType">
              <ElSelect v-model="form.taskType" filterable style="width: 100%">
                <ElOption
                  v-for="item in taskTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
            </ElFormItem>
          </ElCol>
          <ElCol :span="12">
            <ElFormItem label="执行人" prop="executorId">
              <ElSelect
                v-model="form.executorId"
                filterable
                remote
                reserve-keyword
                :remote-method="searchExecutors"
                :loading="executorLoading"
                placeholder="请选择执行人"
                style="width: 100%"
                @change="handleExecutorChange"
                @visible-change="(visible: boolean) => visible && loadExecutorOptions()"
              >
                <ElOption
                  v-for="item in executorOptions"
                  :key="getExecutorValue(item)"
                  :label="formatExecutorLabel(item)"
                  :value="getExecutorValue(item)"
                />
              </ElSelect>
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
            <ElFormItem label="进度">
              <ElInputNumber v-model="form.progress" :min="0" :max="100" style="width: 100%" />
            </ElFormItem>
          </ElCol>
          <ElCol :span="8">
            <ElFormItem label="排序">
              <ElInputNumber v-model="form.sort" :min="0" style="width: 100%" />
            </ElFormItem>
          </ElCol>
        </ElRow>
        <ElFormItem label="备注">
          <ElInput v-model="form.remark" type="textarea" :rows="3" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton
          v-if="dialogType === 'edit'"
          v-auth="'Delete'"
          type="danger"
          plain
          @click="removeTask"
          >删除</ElButton
        >
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton
          v-auth="dialogType === 'add' ? 'Create' : 'Update'"
          type="primary"
          :loading="saving"
          @click="submitTask"
          >保存</ElButton
        >
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import {
    changeTaskStatus,
    createTask,
    deleteTask,
    fetchProjectList,
    fetchTaskTypeOptions,
    fetchTaskTree,
    updateTask
  } from '@/api/project-manage'
  import { fetchGetUserList } from '@/api/system-manage'
  import { useUserStore } from '@/store/modules/user'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'

  defineOptions({ name: 'TaskBoard' })

  type TaskItem = Api.ProjectManage.TaskItem & { level?: number }
  type GanttRow = {
    rowKey: string
    type: 'project' | 'task'
    name: string
    projectName: string
    startTime: string
    endTime: string
    progress: number
    level: number
    taskStatus?: number
    task?: TaskItem
  }

  const projects = ref<Api.ProjectManage.ProjectItem[]>([])
  const tasks = ref<TaskItem[]>([])
  const taskTypeOptions = ref<Api.ProjectManage.TaskTypeOption[]>([])
  const selectedProjectName = ref<string>()
  const selectedManagerName = ref<string>()
  const collapsedProjectNames = ref<Set<string>>(new Set())
  const viewMode = ref<'board' | 'gantt'>('board')
  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const loading = ref(false)
  const saving = ref(false)
  const draggingTask = ref<TaskItem>()
  const formRef = ref<FormInstance>()
  const userStore = useUserStore()
  const executorLoading = ref(false)
  const executorOptions = ref<Api.SystemManage.UserListItem[]>([])

  const viewOptions = [
    { label: '看板', value: 'board' },
    { label: '甘特图', value: 'gantt' }
  ]

  const boardColumns = [
    { title: '待办', status: 1, type: 'info' },
    { title: '进行中', status: 2, type: 'primary' },
    { title: '已完成', status: 3, type: 'success' },
    { title: '延期', status: 4, type: 'danger' }
  ] as const

  const defaultForm: Api.ProjectManage.TaskSaveParams = {
    id: 0,
    projectId: '',
    parentId: 0,
    taskName: '',
    taskType: '',
    priority: 2,
    progress: 0,
    taskStatus: 1,
    executorId: '',
    startTime: '',
    endTime: '',
    sort: 0,
    remark: ''
  }

  const form = reactive<Api.ProjectManage.TaskSaveParams>({ ...defaultForm })

  const rules = reactive<FormRules>({
    projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
    taskName: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
    taskType: [{ required: true, message: '请选择任务类型', trigger: 'change' }],
    executorId: [{ required: true, message: '请选择执行人', trigger: 'change' }],
    startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
    endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
  })

  const flatTasks = computed(() => flattenTasks(tasks.value))

  const visibleProjectNames = computed(
    () => new Set(visibleProjects.value.map((project) => project.projectName))
  )

  const displayedTasks = computed(() =>
    flatTasks.value.filter((task) =>
      visibleProjectNames.value.has(String(task.projectName || task.projectId || ''))
    )
  )

  const groupedTasks = computed(() => {
    const groups: Record<number, TaskItem[]> = { 1: [], 2: [], 3: [], 4: [] }
    displayedTasks.value.forEach((task) => {
      const status = task.taskStatus || 1
      if (!groups[status]) groups[status] = []
      groups[status].push(task)
    })
    return groups
  })

  const tasksByProject = computed(() => {
    const groups: Record<string, TaskItem[]> = {}
    flatTasks.value.forEach((task) => {
      const projectName = String(task.projectName || task.projectId || '')
      if (!projectName) return
      if (!groups[projectName]) groups[projectName] = []
      groups[projectName].push(task)
    })
    return groups
  })

  const projectOptions = computed(() => {
    if (!selectedManagerName.value) return projects.value
    const managerName = normalizeName(selectedManagerName.value)
    return projects.value.filter(
      (project) => normalizeName(project.managerName || '') === managerName
    )
  })

  const visibleProjects = computed(() =>
    selectedProjectName.value
      ? projectOptions.value.filter((project) => project.projectName === selectedProjectName.value)
      : projectOptions.value
  )

  const emptyDescription = computed(() => {
    if (!projects.value.length) return '暂无可用项目，请先在项目管理中新增项目'
    if (selectedManagerName.value && !projectOptions.value.length) return '该负责人暂无相关项目'
    return '暂无可用项目'
  })

  const ganttRows = computed<GanttRow[]>(() =>
    visibleProjects.value.flatMap((project) => {
      const projectName = project.projectName
      const rows: GanttRow[] = [
        {
          rowKey: `project-${projectName}`,
          type: 'project',
          name: projectName,
          projectName,
          startTime: project.startTime,
          endTime: project.endTime,
          progress: Number(project.progress || 0),
          level: 1
        }
      ]

      if (!collapsedProjectNames.value.has(projectName)) {
        rows.push(
          ...(tasksByProject.value[projectName] || []).map((task) => ({
            rowKey: `task-${task.id}`,
            type: 'task' as const,
            name: task.taskName,
            projectName,
            startTime: task.startTime,
            endTime: task.endTime,
            progress: Number(task.progress || 0),
            taskStatus: task.taskStatus,
            level: (task.level || 1) + 1,
            task
          }))
        )
      }

      return rows
    })
  )

  const refreshData = async () => {
    loading.value = true
    try {
      await loadTaskTypeOptions()
      await loadProjects()
      await loadTasks()
    } finally {
      loading.value = false
    }
  }

  const loadProjects = async () => {
    projects.value = await fetchProjectList()
    const projectNames = projects.value.map((item) => item.projectName).filter(Boolean)
    if (selectedProjectName.value && !projectNames.includes(selectedProjectName.value)) {
      selectedProjectName.value = undefined
    }
    if (!projects.value.length) {
      selectedProjectName.value = undefined
      tasks.value = []
    }
    ensureSelectedProjectVisible()
  }

  const loadTasks = async (projectName = selectedProjectName.value) => {
    tasks.value = (await fetchTaskTree({
      projectId: projectName || undefined
    })) as TaskItem[]
  }

  const loadTaskTypeOptions = async () => {
    taskTypeOptions.value = await fetchTaskTypeOptions()
  }

  let executorSearchTimer: ReturnType<typeof setTimeout> | undefined

  const currentUserExecutorId = computed(() =>
    String(userStore.info?.userName || userStore.info?.userId || '')
  )

  const getExecutorValue = (item: Api.SystemManage.UserListItem) =>
    String(item.userName || item.userId || item.id || '')

  const getManagerFilterValue = (item: Api.SystemManage.UserListItem) =>
    String(item.nickName || item.userName || item.userId || item.id || '')

  const formatExecutorLabel = (item: Api.SystemManage.UserListItem) => {
    const name = item.nickName || item.userName || item.userId || item.id || '-'
    return item.userName && item.userName !== name ? `${name} (${item.userName})` : String(name)
  }

  const ensureCurrentExecutorOption = () => {
    if (!form.executorId) return
    const executorId = String(form.executorId)
    const exists = executorOptions.value.some((item) => getExecutorValue(item) === executorId)
    if (exists) return

    const currentUserName = userStore.info?.userName || executorId
    executorOptions.value.unshift({
      id: executorId,
      userId: executorId,
      userName: String(currentUserName),
      nickName: String(currentUserName),
      enabled: true
    } as Api.SystemManage.UserListItem)
  }

  const loadExecutorOptions = async (keyword = '') => {
    executorLoading.value = true
    try {
      const result = await fetchGetUserList({
        current: 1,
        size: 20,
        keyword,
        enabled: true
      })
      executorOptions.value = result.records || []
      ensureCurrentExecutorOption()
    } finally {
      executorLoading.value = false
    }
  }

  const searchExecutors = (keyword: string) => {
    if (executorSearchTimer) clearTimeout(executorSearchTimer)
    executorSearchTimer = setTimeout(() => {
      loadExecutorOptions(keyword.trim())
    }, 250)
  }

  const handleExecutorChange = (value: string) => {
    form.executorId = value
  }

  const handleSelectedProjectChange = async (value?: string) => {
    selectedProjectName.value = value || undefined
    await loadTasks()
  }

  const handleSelectedManagerChange = async (value?: string) => {
    selectedManagerName.value = value || undefined
    ensureSelectedProjectVisible()
    await loadTasks()
  }

  const ensureSelectedProjectVisible = () => {
    if (
      selectedProjectName.value &&
      !projectOptions.value.some((project) => project.projectName === selectedProjectName.value)
    ) {
      selectedProjectName.value = undefined
    }
  }

  const normalizeName = (value: string) => value.trim().toLowerCase()

  const handleFormProjectChange = async (value?: string) => {
    form.parentId = 0
    selectedProjectName.value = value || undefined
    await loadTasks(value)
  }

  const flattenTasks = (items: TaskItem[], level = 1): TaskItem[] =>
    items.flatMap((item) => [
      { ...item, level },
      ...flattenTasks((item.children || []) as TaskItem[], level + 1)
    ])

  const openDialog = async (type: 'add' | 'edit', row?: TaskItem) => {
    if (!projects.value.length) {
      ElMessage.warning('请先新增项目')
      return
    }
    if (!taskTypeOptions.value.length) {
      await loadTaskTypeOptions()
    }
    dialogType.value = type
    Object.assign(
      form,
      defaultForm,
      {
        projectId: selectedProjectName.value || projects.value[0]?.projectName || '',
        parentId: 0,
        executorId: currentUserExecutorId.value
      },
      row
        ? { ...row, projectId: String(row.projectId), executorId: String(row.executorId || '') }
        : {}
    )
    if (!form.taskType && taskTypeOptions.value.length) {
      form.taskType = taskTypeOptions.value[0].value
    }
    ensureCurrentExecutorOption()
    loadExecutorOptions()
    dialogVisible.value = true
  }

  const submitTask = async () => {
    if (!formRef.value) return
    await formRef.value.validate()
    saving.value = true
    try {
      const params = {
        ...form,
        projectId: String(form.projectId),
        executorId: String(form.executorId)
      }
      if (dialogType.value === 'add') {
        await createTask(params)
      } else {
        await updateTask(params)
      }
      ElMessage.success('保存成功')
      dialogVisible.value = false
      selectedProjectName.value = String(form.projectId)
      await loadTasks()
    } finally {
      saving.value = false
    }
  }

  const removeTask = async () => {
    await ElMessageBox.confirm(`确定删除任务“${form.taskName}”及其子任务吗？`, '删除确认', {
      type: 'warning'
    })
    await deleteTask(form.id!)
    ElMessage.success('删除成功')
    dialogVisible.value = false
    await loadTasks()
  }

  const handleDrop = async (status: number) => {
    if (!draggingTask.value || draggingTask.value.taskStatus === status) return
    await changeTaskStatus(draggingTask.value.id, status)
    draggingTask.value.taskStatus = status
    draggingTask.value = undefined
    await loadTasks()
  }

  const selectProjectNode = async (projectName: string) => {
    selectedProjectName.value = projectName
    await loadTasks(projectName)
  }

  const toggleProject = (projectName: string) => {
    const next = new Set(collapsedProjectNames.value)
    if (next.has(projectName)) {
      next.delete(projectName)
    } else {
      next.add(projectName)
    }
    collapsedProjectNames.value = next
  }

  const formatProjectLabel = (project: Api.ProjectManage.ProjectItem) =>
    project.projectCode ? `${project.projectName}（${project.projectCode}）` : project.projectName

  const priorityText = (priority: number) =>
    ({ 1: '高优先级', 2: '中优先级', 3: '低优先级' })[priority] || '中优先级'
  const formatDate = (value?: string) => (value ? value.slice(0, 10) : '-')

  const timeRange = computed(() => {
    const dates = ganttRows.value
      .flatMap((item) => [new Date(item.startTime).getTime(), new Date(item.endTime).getTime()])
      .filter(Boolean)
    const min = dates.length ? Math.min(...dates) : Date.now()
    const max = dates.length ? Math.max(...dates) : Date.now() + 86400000
    return { min, max: max === min ? min + 86400000 : max }
  })

  const barStyle = (row: GanttRow) => {
    const start = new Date(row.startTime).getTime()
    const end = new Date(row.endTime).getTime()
    const total = timeRange.value.max - timeRange.value.min
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(total) || total <= 0) {
      return { left: '0%', width: '8%' }
    }
    const left = Math.max(0, ((start - timeRange.value.min) / total) * 100)
    const width = Math.max(8, ((end - start) / total) * 100)
    return { left: `${left}%`, width: `${width}%` }
  }

  const barClass = (row: GanttRow) => ({
    'is-project': row.type === 'project',
    'is-finished': row.taskStatus === 3,
    'is-delayed': row.taskStatus === 4
  })

  onMounted(refreshData)
</script>

<style lang="scss" scoped>
  .task-page {
    .toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .board {
      display: grid;
      grid-template-columns: repeat(4, minmax(220px, 1fr));
      gap: 12px;
      min-height: calc(100vh - 240px);
    }

    .board-column {
      padding: 12px;
      background: var(--el-fill-color-lighter);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 8px;

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        font-weight: 600;
      }
    }

    .task-list {
      display: grid;
      gap: 10px;
    }

    .task-card {
      padding: 12px;
      cursor: grab;
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color-light);
      border-radius: 8px;
    }

    .task-title {
      margin-bottom: 10px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .task-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .gantt {
      min-height: calc(100vh - 240px);
      overflow: auto;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 8px;
    }

    .gantt-header,
    .gantt-row {
      display: grid;
      grid-template-columns: 260px 120px 120px minmax(520px, 1fr);
    }

    .gantt-header {
      position: sticky;
      top: 0;
      z-index: 1;
      font-weight: 600;
      background: var(--el-fill-color-lighter);
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    .gantt-header span,
    .gantt-name,
    .gantt-date {
      padding: 10px 12px;
      border-right: 1px solid var(--el-border-color-lighter);
    }

    .gantt-name {
      display: flex;
      gap: 8px;
      align-items: center;
      cursor: pointer;
    }

    .gantt-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      padding: 0;
      font-weight: 600;
      color: var(--el-text-color-primary);
      cursor: pointer;
      background: transparent;
      border: 0;
    }

    .gantt-date {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .gantt-row {
      min-height: 44px;
      border-bottom: 1px solid var(--el-border-color-lighter);

      &.is-project {
        font-weight: 600;
        background: var(--el-fill-color-extra-light);
      }
    }

    .gantt-track {
      position: relative;
      margin: 10px 12px;
      background: var(--el-fill-color-light);
      border-radius: 8px;
    }

    .gantt-bar {
      position: absolute;
      top: 4px;
      bottom: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 64px;
      color: #fff;
      background: var(--el-color-primary);
      border-radius: 6px;

      &.is-project {
        background: #1f2937;
      }

      &.is-finished {
        background: var(--el-color-success);
      }

      &.is-delayed {
        background: var(--el-color-warning);
      }
    }
  }
</style>
