import request from '@/utils/http'
import { getApiUrl } from '@/utils/runtime-config'
import { ensureApplicationToken, getApplicationCode } from '@/utils/system-applications/client'
import { useUserStore } from '@/store/modules/user'
import { createWorkRequestKey } from '@/utils/work-request-key'
import type {
  WorkChoicePage,
  WorkChoiceQuery
} from '@/components/business/work-choice-picker/types'

export interface WorkCandidateContext {
  purpose: 'assignee' | 'reviewer' | 'leader' | 'dispatcher' | 'admin-user'
  groupId?: string
  assigneeId?: string
  taskId?: string
}

export interface WorkTask {
  id: string
  appCode: string
  title: string
  requirements: string
  acceptanceCriteria: string
  materialRule: string
  priority: string
  status: string
  groupId: string
  createdBy: string
  dispatcherId: string
  assigneeId: string
  reviewerId: string
  summaryLeaderId: string
  revisionId: string
  planId: string | null
  requestedDueAtUtc: string | null
  originalDueAtUtc: string | null
  committedDueAtUtc: string | null
  forecastDueAtUtc: string | null
  submittedAtUtc: string | null
  completedAtUtc: string | null
  requiresReview: boolean
  blocked: boolean
  progress: number
  version: number
  updatedAtUtc: string
}
export interface WorkGroup {
  id: string
  name: string
  parentId?: string | null
  leaderId?: string | null
  enabled: boolean
}
export interface WorkMember {
  id: string
  groupId: string
  userId: string
  enabled: boolean
}
export interface WorkGrant {
  id?: string
  userId: string
  role: string
  scope: string
  targetId?: string | null
  enabled: boolean
  expiresAtUtc?: string | null
}
export interface WorkRule {
  includedDates?: string
  excludedDates?: string
  id?: string
  enabled: boolean
  timeZone: string
  dailyTime: string
  weekDays: string
  employeeAudience: string
  channels: string
  catchUpMinutes: number
}
export interface WorkBootstrap {
  userId: string
  appCode: string
  canUse: boolean
  canWork?: boolean
  canDispatch: boolean
  canTeam: boolean
  canAdmin: boolean
  groups: WorkGroup[]
  targets: { groupId: string; userId: string; name: string; canAssign?: boolean }[]
}
export interface WorkOverview {
  groups: WorkGroup[]
  members: { groupId: string; userId: string; name: string }[]
  counts: {
    total: number
    pendingAssessment: number
    inProgress: number
    pendingReview: number
    completed: number
    blocked: number
    overdue: number
  }
  total: number
  records: WorkTask[]
}
export interface WorkPlan {
  id: string
  status: string
  explanation: string
  proposedBy: string
  dueAtUtc: string | null
  startAtUtc: string | null
  revisionId: string
  createdAtUtc: string
}
export interface WorkReport {
  id: string
  kind: string
  text: string
  nextStep: string
  progress: number
  blocked: boolean
  actorId: string
  source: string
  createdAtUtc: string
}
export interface WorkSubmission {
  id: string
  actorId: string
  text: string
  status: string
  version: number
  revisionId: string
  planId: string | null
  submittedAtUtc: string | null
  createdAtUtc: string
}
export interface WorkAttachment {
  id: string
  name: string
  size: number
  ownerId: string
}
export interface WorkDetail {
  task: WorkTask
  canWork: boolean
  canParticipate: boolean
  collaborators: string[]
  participantNames: { userId: string; name: string }[]
  canManage: boolean
  canReview: boolean
  plans: WorkPlan[]
  milestones: { id: string; planId: string; title: string; dueAtUtc: string }[]
  reports: WorkReport[]
  submissions: WorkSubmission[]
  attachments: WorkAttachment[]
  attachmentLinks: { recordId: string; attachmentId: string; kind: string }[]
  reviews: {
    id: string
    accepted: boolean
    opinion: string
    submissionId: string
    actorId: string
    createdAtUtc: string
  }[]
  revisions: { id: string; version: number; snapshotJson: string; createdAtUtc: string }[]
  audit: {
    id: string
    action: string
    actorId: string
    source: string
    summary: string
    createdAtUtc: string
  }[]
}
export interface WorkAdministration {
  handovers?: {
    taskId: string
    groupId: string
    assigneeId: string
    dispatcherId: string
    reviewerId: string
    summaryLeaderId: string
    version: number
    status: string
  }[]
  health?: {
    pendingEvents: number
    pendingDeliveries: number
    failedDeliveries: number
    unknownDeliveries: number
    oldestPendingAtUtc: string | null
    lastDigestAtUtc: string | null
    registeredFileBytes: number
  } | null
  groups: WorkGroup[]
  members: WorkMember[]
  grants: WorkGrant[]
  users: { userId: string; name: string }[]
  canConfigureGlobal: boolean
  rule: WorkRule | null
  deliveries: {
    id: string
    channel: string
    perspective: string
    status: string
    error: string | null
    createdAtUtc: string
  }[]
}
export interface WorkKey {
  id: string
  label: string
  scopes: string
  expiresAtUtc: string
  revokedAtUtc: string | null
  lastUsedAtUtc: string | null
}
export interface WorkInbox {
  id: string
  kind: string
  perspective: string
  readAtUtc: string | null
  createdAtUtc: string
  businessDate?: string
  cutoffUtc?: string
  tasks?: WorkTask[]
  task?: WorkTask
  action?: string
}
export type WorkCommand = Record<string, unknown> & { action: string }
export const workStatuses: Record<string, string> = {
  Draft: '草稿',
  PendingAssessment: '待评估',
  InProgress: '执行中',
  PendingReview: '待验收',
  Completed: '已完成',
  Cancelled: '已取消'
}
export const workActions: Record<string, string> = {
  save: '保存草稿',
  dispatch: '正式下派',
  assess: '评估排期',
  report: '进展汇报',
  comment: '任务讨论',
  'plan.approve': '排期通过',
  'plan.reject': '排期拒绝',
  'submission.save': '保存成果草稿',
  submit: '正式提交',
  'review.pass': '验收通过',
  'review.return': '验收退回',
  revise: '变更要求',
  reassign: '任务转派',
  cancel: '任务取消',
  'attachment.ready': '附件就绪',
  'attachment.download': '下载附件'
}
export const workDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
const pendingWrites = new Map<string, string>()
export const workApi = {
  candidates: (params: WorkCandidateContext & Partial<WorkChoiceQuery>) =>
    request.get<WorkChoicePage>({
      url: '/api/work-tasks/candidates',
      params,
      showErrorMessage: false
    }),
  overview: (params: {
    groupId?: string
    userId?: string
    status?: string
    keyword?: string
    page?: number
  }) => request.get<WorkOverview>({ url: '/api/work-tasks/overview', params }),
  bootstrap: () => request.get<WorkBootstrap>({ url: '/api/work-tasks/bootstrap' }),
  list: (params: Record<string, unknown>) =>
    request.get<{ total: number; records: WorkTask[] }>({ url: '/api/work-tasks', params }),
  detail: (id: string, quiet = false) =>
    request.get<WorkDetail>({ url: `/api/work-tasks/${id}`, showErrorMessage: !quiet }),
  async command(id: string | undefined, data: WorkCommand, quiet = false) {
    const user = useUserStore()
    const identity = `${getApplicationCode()}:${user.info.userId}:${id}:${JSON.stringify(data)}`
    const key = pendingWrites.get(identity) || createWorkRequestKey()
    pendingWrites.set(identity, key)
    const result = await request.post<{
      taskId: string
      version: number
      recordId: string
      operationId: string
    }>({
      url: id ? `/api/work-tasks/${id}/commands` : '/api/work-tasks/drafts',
      data: { ...data, idempotencyKey: key },
      showErrorMessage: !quiet
    })
    pendingWrites.delete(identity)
    return result
  },
  admin: () => request.get<WorkAdministration>({ url: '/api/work-task-admin' }),
  saveAdmin: (kind: string, data: unknown) =>
    request.post({ url: `/api/work-task-admin/${kind}`, data }),
  keys: () => request.get<WorkKey[]>({ url: '/api/work-task-keys' }),
  keyActivity: () =>
    request.get<{ id: string; createdAtUtc: string; summary: string }[]>({
      url: '/api/work-task-keys/activity'
    }),
  createKey: (data: unknown) =>
    request.post<{ id: string; secret: string }>({ url: '/api/work-task-keys', data }),
  revokeKey: (id: string) => request.post({ url: `/api/work-task-keys/${id}/revoke` }),
  inbox: () => request.get<WorkInbox[]>({ url: '/api/work-tasks/inbox' }),
  read: (id: string) => request.post({ url: `/api/work-tasks/inbox/${id}/read` }),
  handover: (data: unknown) => request.post({ url: '/api/work-task-admin/handover', data }),
  retryDelivery: (id: string) =>
    request.post({ url: `/api/work-task-admin/deliveries/${id}/retry` }),
  async upload(taskId: string, file: File, onProgress?: (value: number) => void) {
    const upload = await request.post<{ uploadId: string; ticket: string; uploadPath: string }>({
      url: '/api/work-task-uploads',
      data: { taskId, name: file.name, size: file.size }
    })
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', getApiUrl(upload.uploadPath))
      xhr.timeout = 120000
      xhr.setRequestHeader('X-Work-Upload-Ticket', upload.ticket)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
      xhr.onerror = () => reject(new Error('上传连接中断，请重试'))
      xhr.ontimeout = () => reject(new Error('上传超时，请重试'))
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else {
          let message = '上传失败'
          try {
            message = JSON.parse(xhr.responseText).msg || message
          } catch {
            /* 非JSON错误使用通用提示 */
          }
          reject(new Error(message))
        }
      }
      xhr.send(file)
    })
    return request.post<WorkAttachment>({
      url: `/api/work-task-uploads/${upload.uploadId}/complete`
    })
  },
  async download(file: WorkAttachment) {
    const token = await ensureApplicationToken(useUserStore().accessToken)
    const response = await fetch(getApiUrl(`/api/work-task-attachments/${file.id}/content`), {
      headers: { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` },
      cache: 'no-store'
    })
    if (!response.ok) {
      const result = await response.json().catch(() => null)
      throw new Error(result?.msg || '附件下载失败')
    }
    const url = URL.createObjectURL(await response.blob())
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }
}
