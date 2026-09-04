import request from '@/utils/http'
import { getApiUrl } from '@/utils/runtime-config'

type RawProjectItem = Api.ProjectManage.ProjectItem & {
  Id?: number | string
  ProjectCode?: string
  ProjectName?: string
  ProjectType?: string
  ProjectTag?: string
  Priority?: number
  ProjectStage?: number
  ProjectStatus?: number
  Progress?: number
  StartTime?: string
  EndTime?: string
  ManagerId?: number | string
  ManagerUserId?: number | string
  ManagerName?: string
  CustomerName?: string
  ContractCode?: string
  Remark?: string
  CreateTime?: string
  UpdateTime?: string
  TaskCount?: number
  FileCount?: number
}

type RawTaskItem = Api.ProjectManage.TaskItem & {
  Id?: number
  ProjectId?: number | string
  ProjectName?: string
  ParentId?: number
  TaskName?: string
  TaskType?: string
  Priority?: number
  Progress?: number
  TaskStatus?: number
  ExecutorId?: number | string
  StartTime?: string
  EndTime?: string
  Sort?: number
  Remark?: string
  CreateTime?: string
  UpdateTime?: string
  Children?: RawTaskItem[]
}

type RawProjectStageOption = Api.ProjectManage.ProjectStageOption & {
  Value?: number
  Label?: string
  Sort?: number
}

type RawProjectImportRow = Api.ProjectManage.ProjectImportRow & {
  RowIndex?: number
  Success?: boolean
  ProjectId?: number
  ProjectCode?: string
  ProjectName?: string
  Message?: string
}

type RawProjectImportResult = Api.ProjectManage.ProjectImportResult & {
  Total?: number
  CreatedCount?: number
  FailedCount?: number
  Message?: string
  Rows?: RawProjectImportRow[]
}

type RawTaskParentOption = Api.ProjectManage.TaskParentOption & {
  Id?: number
  Label?: string
  Level?: number
  ProjectName?: string
}

type RawTaskTypeOption = Api.ProjectManage.TaskTypeOption & {
  Id?: number
  Label?: string
  Value?: string
  Sort?: number
}

type RawDashboardStats = Api.ProjectManage.DashboardStats & {
  TotalProjects?: number
  PendingProjects?: number
  RunningProjects?: number
  DelayedProjects?: number
  FinishedProjects?: number
  PausedProjects?: number
  ArchivedProjects?: number
  AverageProgress?: number
  PendingTasks?: number
  FinishedTasks?: number
  ProjectStatusDistribution?: RawProjectStatusStat[]
  ManagerProjectStatusStats?: RawManagerProjectStatusStat[]
  RecentProjects?: RawProjectItem[]
  TodoTasks?: RawTaskItem[]
}

type RawProjectStatusStat = Api.ProjectManage.ProjectStatusStat & {
  Status?: number
  Label?: string
  Value?: number
  Color?: string
}

type RawManagerProjectStatusStat = Api.ProjectManage.ManagerProjectStatusStat & {
  ManagerId?: number | string
  ManagerName?: string
  PendingProjects?: number
  RunningProjects?: number
  FinishedProjects?: number
  TotalProjects?: number
}

function normalizeProject(item: RawProjectItem): Api.ProjectManage.ProjectItem {
  return {
    id: Number(item.id ?? item.Id ?? 0),
    projectCode: item.projectCode ?? item.ProjectCode ?? '',
    projectName: item.projectName ?? item.ProjectName ?? '',
    projectType: item.projectType ?? item.ProjectType ?? '',
    projectTag: item.projectTag ?? item.ProjectTag,
    priority: Number(item.priority ?? item.Priority ?? 2),
    projectStage: Number(item.projectStage ?? item.ProjectStage ?? 1),
    projectStatus: Number(item.projectStatus ?? item.ProjectStatus ?? 1),
    progress: Number(item.progress ?? item.Progress ?? 0),
    startTime: item.startTime ?? item.StartTime ?? '',
    endTime: item.endTime ?? item.EndTime ?? '',
    managerId: item.managerId ?? item.ManagerId ?? '',
    managerUserId: item.managerUserId ?? item.ManagerUserId,
    managerName: item.managerName ?? item.ManagerName,
    customerName: item.customerName ?? item.CustomerName,
    contractCode: item.contractCode ?? item.ContractCode,
    remark: item.remark ?? item.Remark,
    createTime: item.createTime ?? item.CreateTime,
    updateTime: item.updateTime ?? item.UpdateTime,
    taskCount: item.taskCount ?? item.TaskCount,
    fileCount: item.fileCount ?? item.FileCount
  }
}

function normalizeTask(item: RawTaskItem): Api.ProjectManage.TaskItem {
  return {
    id: Number(item.id ?? item.Id ?? 0),
    projectId: item.projectId ?? item.ProjectId ?? '',
    projectName: item.projectName ?? item.ProjectName,
    parentId: Number(item.parentId ?? item.ParentId ?? 0),
    taskName: item.taskName ?? item.TaskName ?? '',
    taskType: item.taskType ?? item.TaskType,
    priority: Number(item.priority ?? item.Priority ?? 2),
    progress: Number(item.progress ?? item.Progress ?? 0),
    taskStatus: Number(item.taskStatus ?? item.TaskStatus ?? 1),
    executorId: item.executorId ?? item.ExecutorId ?? '',
    startTime: item.startTime ?? item.StartTime ?? '',
    endTime: item.endTime ?? item.EndTime ?? '',
    sort: Number(item.sort ?? item.Sort ?? 0),
    remark: item.remark ?? item.Remark,
    createTime: item.createTime ?? item.CreateTime,
    updateTime: item.updateTime ?? item.UpdateTime,
    children: (item.children ?? item.Children ?? []).map(normalizeTask)
  }
}

function normalizeProjectStage(item: RawProjectStageOption): Api.ProjectManage.ProjectStageOption {
  return {
    value: Number(item.value ?? item.Value ?? 0),
    label: item.label ?? item.Label ?? '',
    sort: Number(item.sort ?? item.Sort ?? 0)
  }
}

function normalizeProjectImportRow(item: RawProjectImportRow): Api.ProjectManage.ProjectImportRow {
  return {
    rowIndex: Number(item.rowIndex ?? item.RowIndex ?? 0),
    success: Boolean(item.success ?? item.Success ?? false),
    projectId: item.projectId ?? item.ProjectId,
    projectCode: item.projectCode ?? item.ProjectCode ?? '',
    projectName: item.projectName ?? item.ProjectName ?? '',
    message: item.message ?? item.Message ?? ''
  }
}

function normalizeProjectImportResult(
  data: RawProjectImportResult
): Api.ProjectManage.ProjectImportResult {
  return {
    total: Number(data.total ?? data.Total ?? 0),
    createdCount: Number(data.createdCount ?? data.CreatedCount ?? 0),
    failedCount: Number(data.failedCount ?? data.FailedCount ?? 0),
    message: data.message ?? data.Message ?? '',
    rows: (data.rows ?? data.Rows ?? []).map(normalizeProjectImportRow)
  }
}

function normalizeTaskParentOption(item: RawTaskParentOption): Api.ProjectManage.TaskParentOption {
  return {
    id: Number(item.id ?? item.Id ?? 0),
    label: item.label ?? item.Label ?? '',
    level: Number(item.level ?? item.Level ?? 1),
    projectName: item.projectName ?? item.ProjectName
  }
}

function normalizeTaskTypeOption(item: RawTaskTypeOption): Api.ProjectManage.TaskTypeOption {
  return {
    id: Number(item.id ?? item.Id ?? 0),
    label: item.label ?? item.Label ?? '',
    value: item.value ?? item.Value ?? '',
    sort: Number(item.sort ?? item.Sort ?? 0)
  }
}

function normalizeProjectStatusStat(
  item: RawProjectStatusStat
): Api.ProjectManage.ProjectStatusStat {
  return {
    status: Number(item.status ?? item.Status ?? 0),
    label: item.label ?? item.Label ?? '',
    value: Number(item.value ?? item.Value ?? 0),
    color: item.color ?? item.Color
  }
}

function normalizeManagerProjectStatusStat(
  item: RawManagerProjectStatusStat
): Api.ProjectManage.ManagerProjectStatusStat {
  return {
    managerId: item.managerId ?? item.ManagerId ?? '',
    managerName: item.managerName ?? item.ManagerName ?? '未分配',
    pendingProjects: Number(item.pendingProjects ?? item.PendingProjects ?? 0),
    runningProjects: Number(item.runningProjects ?? item.RunningProjects ?? 0),
    finishedProjects: Number(item.finishedProjects ?? item.FinishedProjects ?? 0),
    totalProjects: Number(item.totalProjects ?? item.TotalProjects ?? 0)
  }
}

function normalizeDashboardStats(item: RawDashboardStats): Api.ProjectManage.DashboardStats {
  return {
    totalProjects: Number(item.totalProjects ?? item.TotalProjects ?? 0),
    pendingProjects: Number(item.pendingProjects ?? item.PendingProjects ?? 0),
    runningProjects: Number(item.runningProjects ?? item.RunningProjects ?? 0),
    delayedProjects: Number(item.delayedProjects ?? item.DelayedProjects ?? 0),
    finishedProjects: Number(item.finishedProjects ?? item.FinishedProjects ?? 0),
    pausedProjects: Number(item.pausedProjects ?? item.PausedProjects ?? 0),
    archivedProjects: Number(item.archivedProjects ?? item.ArchivedProjects ?? 0),
    averageProgress: Number(item.averageProgress ?? item.AverageProgress ?? 0),
    pendingTasks: Number(item.pendingTasks ?? item.PendingTasks ?? 0),
    finishedTasks: Number(item.finishedTasks ?? item.FinishedTasks ?? 0),
    projectStatusDistribution: (
      item.projectStatusDistribution ??
      item.ProjectStatusDistribution ??
      []
    ).map(normalizeProjectStatusStat),
    managerProjectStatusStats: (
      item.managerProjectStatusStats ??
      item.ManagerProjectStatusStats ??
      []
    ).map(normalizeManagerProjectStatusStat),
    recentProjects: (item.recentProjects ?? item.RecentProjects ?? []).map(normalizeProject),
    todoTasks: (item.todoTasks ?? item.TodoTasks ?? []).map(normalizeTask)
  }
}

export function fetchProjectPage(params: Api.ProjectManage.ProjectQueryParams) {
  return request.get<Api.ProjectManage.ProjectList>({
    url: '/api/ProjectManage/projects',
    params
  })
}

export async function fetchProjectStages() {
  const list = await request.get<RawProjectStageOption[]>({
    url: '/api/ProjectManage/projects/stages'
  })
  return list.map(normalizeProjectStage)
}

export async function fetchProjectList() {
  const list = await request.get<RawProjectItem[]>({
    url: '/api/ProjectManage/projects/all'
  })
  return list.map(normalizeProject)
}

export function createProject(params: Api.ProjectManage.ProjectSaveParams) {
  return request.post({
    url: '/api/ProjectManage/projects',
    params
  })
}

export async function importProjects(formData: FormData) {
  const data = await request.request<RawProjectImportResult>({
    url: '/api/ProjectManage/projects/import',
    method: 'POST',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return normalizeProjectImportResult(data)
}

export function getProjectImportTemplateUrl() {
  return getApiUrl('/api/ProjectManage/projects/import-template')
}

export function updateProject(params: Api.ProjectManage.ProjectSaveParams) {
  return request.post({
    url: `/api/ProjectManage/projects/${params.id}`,
    params
  })
}

export function changeProjectStatus(id: number | string, status: number) {
  return request.post({
    url: `/api/ProjectManage/projects/${id}/status`,
    params: { status }
  })
}

export function deleteProject(id: number | string) {
  return request.post({
    url: '/api/ProjectManage/projects/delete',
    params: { id }
  })
}

export function fetchTaskPage(params: Api.ProjectManage.TaskQueryParams) {
  return request.get<Api.ProjectManage.TaskList>({
    url: '/api/ProjectManage/tasks',
    params
  })
}

export async function fetchTaskTree(params?: {
  projectId?: number | string
  executorId?: number | string
}) {
  const list = await request.get<RawTaskItem[]>({
    url: '/api/ProjectManage/tasks/tree',
    params
  })
  return list.map(normalizeTask)
}

export async function fetchTaskParentOptions(params?: {
  projectId?: number | string
  currentId?: number | string
}) {
  const list = await request.get<RawTaskParentOption[]>({
    url: '/api/ProjectManage/tasks/parent-options',
    params
  })
  return list.map(normalizeTaskParentOption)
}

export async function fetchTaskTypeOptions() {
  const list = await request.get<RawTaskTypeOption[]>({
    url: '/api/ProjectManage/tasks/types'
  })
  return list.map(normalizeTaskTypeOption)
}

export function createTask(params: Api.ProjectManage.TaskSaveParams) {
  return request.post({
    url: '/api/ProjectManage/tasks',
    params
  })
}

export function updateTask(params: Api.ProjectManage.TaskSaveParams) {
  return request.post({
    url: `/api/ProjectManage/tasks/${params.id}`,
    params
  })
}

export function changeTaskStatus(id: number | string, status: number) {
  return request.post({
    url: `/api/ProjectManage/tasks/${id}/status`,
    params: { status }
  })
}

export function deleteTask(id: number | string) {
  return request.post({
    url: '/api/ProjectManage/tasks/delete',
    params: { id }
  })
}

export function fetchFilePage(params: Api.ProjectManage.FileQueryParams) {
  return request.get<Api.ProjectManage.FileList>({
    url: '/api/ProjectManage/files',
    params
  })
}

export function fetchProjectFileCounts(projectNames: string[]) {
  return request.post<Record<string, number>>({
    url: '/api/ProjectManage/files/project-counts',
    data: { projectNames }
  })
}

export function uploadProjectFile(formData: FormData) {
  return request.request({
    url: '/api/ProjectManage/files',
    method: 'POST',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function deleteProjectFile(id: number | string) {
  return request.post({
    url: '/api/ProjectManage/files/delete',
    data: { id }
  })
}

export async function fetchProjectDashboard(params?: { userId?: number | string }) {
  const data = await request.get<RawDashboardStats>({
    url: '/api/ProjectManage/dashboard',
    params
  })
  return normalizeDashboardStats(data)
}

export function getProjectFileDownloadUrl(id: number | string) {
  return getApiUrl(`/api/ProjectManage/files/${id}/download`)
}

export function getProjectFilePreviewUrl(id: number | string) {
  return getApiUrl(`/api/ProjectManage/files/${id}/preview`)
}
