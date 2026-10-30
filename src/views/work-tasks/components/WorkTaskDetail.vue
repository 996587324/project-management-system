<template>
  <el-drawer
    v-model="visible"
    :title="data?.task.title || '任务详情'"
    size="min(1000px,100vw)"
    @closed="reset"
  >
    <div v-loading="busy" v-if="data">
      <div class="actions"
        ><el-tag>{{ workStatuses[data.task.status] }}</el-tag
        ><el-tag v-if="data.task.blocked" type="danger">阻塞</el-tag
        ><span>版本 {{ data.task.version }}</span>
        <el-button text @click="copyId">复制任务编号</el-button>
        <el-button
          v-if="
            data.canManage &&
            ['PendingAssessment', 'InProgress', 'PendingReview'].includes(data.task.status)
          "
          @click="act('participants.change')"
          >调整协作人</el-button
        >
        <el-button
          v-if="
            data.canManage &&
            ['PendingAssessment', 'InProgress', 'PendingReview'].includes(data.task.status)
          "
          @click="management?.open(data.task)"
          >调整管理负责人</el-button
        >
        <el-button
          v-if="
            data.canManage &&
            ['Draft', 'InProgress', 'PendingAssessment'].includes(data.task.status)
          "
          @click="emit('edit', data.task)"
          >{{ data.task.status === 'Draft' ? '编辑草稿' : '变更要求' }}</el-button
        >
        <el-button
          v-if="
            data.canManage &&
            ['PendingAssessment', 'InProgress', 'PendingReview'].includes(data.task.status)
          "
          @click="act('reassign')"
          >转派</el-button
        >
        <el-button
          v-if="data.canManage && !['Completed', 'Cancelled'].includes(data.task.status)"
          type="danger"
          plain
          @click="act('cancel')"
          >取消任务</el-button
        >
      </div>
      <el-descriptions :column="2" border
        ><el-descriptions-item label="主责人">{{
          person(data.task.assigneeId)
        }}</el-descriptions-item
        ><el-descriptions-item label="验收">{{
          data.task.requiresReview ? person(data.task.reviewerId) : '提交即完成'
        }}</el-descriptions-item
        ><el-descriptions-item label="协作人">{{
          data.collaborators.map(person).join('、') || '无'
        }}</el-descriptions-item
        ><el-descriptions-item label="要求时间">{{
          workDate(data.task.requestedDueAtUtc)
        }}</el-descriptions-item
        ><el-descriptions-item label="首次承诺">{{
          workDate(data.task.originalDueAtUtc)
        }}</el-descriptions-item
        ><el-descriptions-item label="当前承诺">{{
          workDate(data.task.committedDueAtUtc)
        }}</el-descriptions-item
        ><el-descriptions-item label="最新预计">{{
          workDate(data.task.forecastDueAtUtc)
        }}</el-descriptions-item
        ><el-descriptions-item label="正式提交">{{
          workDate(data.task.submittedAtUtc)
        }}</el-descriptions-item
        ><el-descriptions-item label="验收完成">{{
          workDate(data.task.completedAtUtc)
        }}</el-descriptions-item></el-descriptions
      >
      <h3>任务要求</h3><p class="text">{{ data.task.requirements }}</p
      ><h3>交付标准</h3><p class="text">{{ data.task.acceptanceCriteria }}</p
      ><p
        >{{
          data.task.materialRule === 'FileRequired' ? '必须提供附件' : '可使用文字或附件说明成果'
        }}；进度达到100%仍需正式提交。</p
      >
      <el-tabs v-model="activeTab">
        <el-tab-pane label="评估与节点">
          <el-button
            v-if="data.canWork && ['PendingAssessment', 'InProgress'].includes(data.task.status)"
            type="primary"
            @click="act('assess')"
            >回复评估 / 调整排期</el-button
          >
          <el-card v-for="plan in data.plans" :key="plan.id" class="record"
            ><strong>{{ planLabels[plan.status] || plan.status }}</strong> ·
            {{ workDate(plan.dueAtUtc) }}<p class="text">{{ plan.explanation }}</p>
            <ul
              ><li
                v-for="node in data.milestones.filter((x) => x.planId === plan.id)"
                :key="node.id"
                >{{ node.title }}：{{ workDate(node.dueAtUtc) }}</li
              ></ul
            >
            <template v-if="plan.status === 'Pending' && data.canManage"
              ><el-button @click="decide('plan.approve', plan.id)">同意排期</el-button
              ><el-button type="danger" plain @click="decide('plan.reject', plan.id)"
                >拒绝并说明</el-button
              ></template
            > </el-card
          ><el-empty
            v-if="!data.plans.length"
            description="等待员工评估；没有记录不代表没有开展工作"
          />
        </el-tab-pane>
        <el-tab-pane label="进展与讨论" name="discussion"
          ><div class="actions"
            ><el-button
              v-if="
                data.canParticipate &&
                ['PendingAssessment', 'InProgress', 'PendingReview'].includes(data.task.status)
              "
              type="primary"
              @click="act('report')"
              >汇报进展</el-button
            ><el-button
              v-if="!['Completed', 'Cancelled', 'Draft'].includes(data.task.status)"
              @click="act('comment')"
              >提问 / 回复</el-button
            ><el-button @click="refreshDiscussion">刷新讨论</el-button></div
          >
          <el-card v-for="report in data.reports" :key="report.id" class="record"
            ><strong>{{
              report.kind === 'Comment' ? '讨论' : '进展 ' + report.progress + '%'
            }}</strong>
            · {{ person(report.actorId) }} · {{ report.source }} · {{ workDate(report.createdAtUtc)
            }}<p class="text">{{ report.text }}</p
            ><p v-if="report.nextStep">下一步：{{ report.nextStep }}</p
            ><el-tag v-if="report.blocked" type="danger">需要协调</el-tag
            ><el-button
              v-for="file in files(report.id)"
              :key="file.id"
              link
              type="primary"
              @click="download(file)"
              >{{ file.name }}</el-button
            ></el-card
          >
        </el-tab-pane>
        <el-tab-pane label="成果与验收"
          ><el-button
            v-if="data.canWork && data.task.status === 'InProgress'"
            type="primary"
            @click="act('submission.save')"
            >编辑本次成果</el-button
          >
          <el-card v-for="submission in data.submissions" :key="submission.id" class="record"
            ><strong>{{ submissionLabels[submission.status] || submission.status }}</strong> · 版本
            {{ submission.version }} ·
            {{ workDate(submission.submittedAtUtc || submission.createdAtUtc)
            }}<p class="text">{{ submission.text }}</p
            ><div
              ><el-button
                v-for="file in files(submission.id)"
                :key="file.id"
                link
                type="primary"
                @click="download(file)"
                >{{ file.name }}</el-button
              ></div
            >
            <el-button
              v-if="
                data.canWork && submission.status === 'Draft' && data.task.status === 'InProgress'
              "
              type="primary"
              @click="submit(submission)"
              >预览并正式提交</el-button
            >
            <template
              v-if="
                data.canReview &&
                submission.status === 'Submitted' &&
                data.task.status === 'PendingReview'
              "
              ><el-button type="success" @click="decide('review.pass', submission.id)"
                >验收通过</el-button
              ><el-button type="danger" @click="decide('review.return', submission.id)"
                >退回补充</el-button
              ></template
            >
            <p
              v-for="review in data.reviews.filter((x) => x.submissionId === submission.id)"
              :key="review.id"
              >{{ review.accepted ? '通过' : '退回' }}：{{ review.opinion }} ·
              {{ workDate(review.createdAtUtc) }}</p
            >
          </el-card>
        </el-tab-pane>
        <el-tab-pane label="历史记录"
          ><el-collapse
            ><el-collapse-item
              v-for="revision in data.revisions"
              :key="revision.id"
              :title="'要求版本 ' + revision.version + ' · ' + workDate(revision.createdAtUtc)"
            >
              <pre class="text">{{ formatRevision(revision.snapshotJson) }}</pre>
            </el-collapse-item></el-collapse
          ><el-timeline class="timeline"
            ><el-timeline-item
              v-for="audit in data.audit"
              :key="audit.id"
              :timestamp="workDate(audit.createdAtUtc)"
              >{{ workActions[audit.action] || audit.action }} · {{ person(audit.actorId) }} ·
              {{ audit.source
              }}<p v-if="audit.summary" class="text">{{ audit.summary }}</p></el-timeline-item
            ></el-timeline
          ></el-tab-pane
        >
      </el-tabs>
    </div>
    <WorkManagementHandover ref="management" :users="bootstrap.targets" @changed="refresh" />
    <el-dialog
      v-model="actionVisible"
      :title="workActions[action] || '办理任务'"
      width="min(700px,96vw)"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form label-width="100px">
        <el-form-item v-if="action === 'assess'" label="能否承担"
          ><el-switch v-model="form.feasible" active-text="可承担" inactive-text="需要协调"
        /></el-form-item>
        <template v-if="action === 'assess' && form.feasible"
          ><el-form-item label="预计开始"
            ><el-date-picker
              v-model="form.startAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ssZ" /></el-form-item
          ><el-form-item label="承诺完成" required
            ><el-date-picker
              v-model="form.dueAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ssZ" /></el-form-item
          ><div v-for="(node, i) in form.milestones" :key="i" class="node"
            ><el-input v-model="node.title" placeholder="节点名称" /><el-date-picker
              v-model="node.dueAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ssZ"
            /><el-button @click="form.milestones.splice(i, 1)">移除</el-button></div
          ><el-button @click="form.milestones.push({ title: '', dueAt: '' })"
            >添加时间节点（可选）</el-button
          ></template
        >
        <el-form-item v-if="action === 'reassign'" label="新主责人"
          ><WorkPersonPicker
            v-model="form.assigneeId"
            title="选择新的主责员工"
            purpose="assignee"
            :task-id="data?.task.id"
            :group-id="data?.task.groupId"
        /></el-form-item>
        <el-form-item v-if="action === 'participants.change'" label="协作人员">
          <WorkChoicePicker
            v-model="form.collaboratorIds"
            title="调整协作人员"
            :options="collaboratorOptions"
            multiple
          />
        </el-form-item>
        <template v-if="action === 'report'"
          ><el-form-item label="进度"
            ><el-slider v-model="form.progress" :max="100" show-input /></el-form-item
          ><el-form-item label="需要协调"><el-switch v-model="form.blocked" /></el-form-item
          ><el-form-item label="下一步"
            ><el-input v-model="form.nextStep" type="textarea" /></el-form-item
          ><el-form-item label="最新预计"
            ><el-date-picker
              v-model="form.forecastDueAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ssZ" /></el-form-item
        ></template>
        <el-form-item
          v-if="action !== 'participants.change'"
          label="说明"
          :required="action !== 'submission.save'"
          ><el-input
            v-model="form.text"
            type="textarea"
            :rows="5"
            maxlength="10000"
            show-word-limit
            placeholder="填写真实评估、进展、成果或处理原因"
        /></el-form-item>
        <template v-if="['report', 'submission.save'].includes(action)"
          ><el-form-item label="附件"
            ><input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.csv,.docx,.xlsx,.pptx"
              @change="upload"
            /><span>{{ uploadState }}</span></el-form-item
          ><p v-for="id in form.attachmentIds" :key="id"
            >{{ attachmentName(id) }}
            <el-button
              text
              type="danger"
              @click="form.attachmentIds = form.attachmentIds.filter((x) => x !== id)"
              >移除本次关联</el-button
            ></p
          ></template
        > </el-form
      ><div v-if="action === 'submission.save' && sharedAttachments.length"
        ><p>可选入协作人已分享的材料：</p
        ><el-checkbox-group v-model="form.attachmentIds"
          ><el-checkbox v-for="file in sharedAttachments" :key="file.id" :value="file.id"
            >{{ file.name }}（{{ person(file.ownerId) }}）</el-checkbox
          ></el-checkbox-group
        ></div
      ><template #footer
        ><el-button @click="actionVisible = false">返回</el-button
        ><el-button
          type="primary"
          :loading="busy || uploading"
          :disabled="uploading"
          @click="perform"
          >{{ action === 'submission.save' ? '保存成果草稿' : '确认办理' }}</el-button
        ></template
      >
    </el-dialog>
  </el-drawer>
</template>
<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
  import WorkManagementHandover from './WorkManagementHandover.vue'
  import WorkPersonPicker from './WorkPersonPicker.vue'
  import WorkChoicePicker from '@/components/business/work-choice-picker/index.vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    workApi,
    workDate,
    workStatuses,
    workActions,
    type WorkBootstrap,
    type WorkDetail,
    type WorkTask,
    type WorkSubmission,
    type WorkAttachment
  } from '@/api/work-tasks'
  const props = defineProps<{ bootstrap: WorkBootstrap }>()
  const management = ref<InstanceType<typeof WorkManagementHandover>>()
  const emit = defineEmits<{ changed: []; edit: [task: WorkTask] }>()
  const visible = ref(false)
  const busy = ref(false)
  const data = ref<WorkDetail>()
  const actionVisible = ref(false)
  const action = ref('')
  const activeTab = ref('')
  const uploading = ref(false)
  const uploadState = ref('')
  const uploaded = ref<WorkAttachment[]>([])
  const planLabels: Record<string, string> = {
    Pending: '等待主管确认',
    Approved: '排期已生效',
    Rejected: '排期已拒绝',
    NeedsCoordination: '需要协调'
  }
  const submissionLabels: Record<string, string> = {
    Draft: '成果草稿',
    Submitted: '已提交待处理',
    Accepted: '验收通过',
    Returned: '已退回',
    Superseded: '转派前记录'
  }
  const defaults = () => ({
    text: '',
    nextStep: '',
    progress: 0,
    blocked: false,
    feasible: true,
    startAt: null as string | null,
    dueAt: null as string | null,
    forecastDueAt: null as string | null,
    assigneeId: '',
    recordId: '',
    recordVersion: 0,
    attachmentIds: [] as string[],
    collaboratorIds: [] as string[],
    milestones: [] as { title: string; dueAt: string }[]
  })
  const form = reactive(defaults())
  const person = (id: string) =>
    data.value?.participantNames?.find((x) => x.userId === id)?.name ||
    props.bootstrap.targets.find((x) => x.userId === id)?.name ||
    (id === props.bootstrap.userId ? '本人' : id)
  const files = (id: string) =>
    data.value?.attachments.filter((x) =>
      data.value?.attachmentLinks.some((y) => y.recordId === id && y.attachmentId === x.id)
    ) || []
  const collaboratorOptions = computed(() =>
    props.bootstrap.targets
      .filter(
        (x) =>
          x.groupId === data.value?.task.groupId &&
          x.userId !== data.value?.task.assigneeId &&
          x.canAssign
      )
      .map((x) => ({ value: x.userId, label: x.name }))
  )
  const sharedAttachments = computed(
    () =>
      data.value?.attachments.filter(
        (file) =>
          file.ownerId !== props.bootstrap.userId &&
          data.value?.attachmentLinks.some(
            (link) => link.attachmentId === file.id && link.kind === 'Report'
          )
      ) || []
  )
  const attachmentName = (id: string) =>
    uploaded.value.find((x) => x.id === id)?.name ||
    data.value?.attachments.find((x) => x.id === id)?.name ||
    id
  function reset() {
    data.value = undefined
    uploaded.value = []
    actionVisible.value = false
  }
  async function open(id: string) {
    visible.value = true
    activeTab.value = ''
    busy.value = true
    try {
      data.value = await workApi.detail(id)
    } finally {
      busy.value = false
    }
  }
  async function refresh() {
    if (data.value) data.value = await workApi.detail(data.value.task.id)
    emit('changed')
  }
  function act(value: string) {
    action.value = value
    Object.assign(form, defaults(), {
      progress: data.value?.task.progress || 0,
      blocked: data.value?.task.blocked || false,
      forecastDueAt: data.value?.task.forecastDueAtUtc || null,
      collaboratorIds: [...(data.value?.collaborators || [])]
    })
    if (value === 'submission.save') {
      const draft = data.value?.submissions.find(
        (x) => x.status === 'Draft' && x.actorId === props.bootstrap.userId
      )
      if (draft)
        Object.assign(form, {
          text: draft.text,
          recordId: draft.id,
          recordVersion: draft.version,
          attachmentIds: files(draft.id).map((x) => x.id)
        })
    }
    uploadState.value = ''
    actionVisible.value = true
  }
  async function perform() {
    if (!data.value) return
    busy.value = true
    try {
      await workApi.command(data.value.task.id, {
        ...form,
        action: action.value,
        clearForecast:
          action.value === 'report' &&
          form.forecastDueAt === null &&
          !!data.value.task.forecastDueAtUtc,
        expectedVersion: data.value.task.version
      })
      actionVisible.value = false
      await refresh()
      ElMessage.success(
        action.value === 'submission.save' ? '草稿已保存，请预览后正式提交' : '操作已记录'
      )
    } finally {
      busy.value = false
    }
  }
  async function decide(value: string, id: string) {
    if (!data.value) return
    const { value: text } = await ElMessageBox.prompt(
      '填写处理意见，将与本次版本一起保留。',
      workActions[value],
      { inputType: 'textarea', inputValidator: (x) => !!x?.trim() || '请填写意见' }
    )
    busy.value = true
    try {
      await workApi.command(data.value.task.id, {
        action: value,
        recordId: id,
        text,
        expectedVersion: data.value.task.version
      })
      await refresh()
    } finally {
      busy.value = false
    }
  }
  async function submit(submission: WorkSubmission) {
    if (!data.value) return
    const names =
      files(submission.id)
        .map((x) => x.name)
        .join('、') || '无附件'
    await ElMessageBox.confirm(
      `成果说明：${submission.text || '无'}\n附件：${names}\n提交后本版本不可修改，将${data.value.task.requiresReview ? '交给指定领导验收' : '直接标记完成'}。`,
      '正式提交成果',
      { confirmButtonText: '确认正式提交' }
    )
    busy.value = true
    try {
      await workApi.command(data.value.task.id, {
        action: 'submit',
        recordId: submission.id,
        recordVersion: submission.version,
        expectedVersion: data.value.task.version
      })
      await refresh()
    } finally {
      busy.value = false
    }
  }
  async function upload(event: Event) {
    const input = event.target as HTMLInputElement
    if (!data.value || !input.files) return
    uploading.value = true
    try {
      for (const file of Array.from(input.files)) {
        const result = await workApi.upload(data.value.task.id, file, (p) => {
          uploadState.value = `${file.name} ${p}%`
        })
        uploaded.value.push(result)
        form.attachmentIds.push(result.id)
      }
      uploadState.value = '文件校验完成'
    } catch (error) {
      ElMessage.error((error as Error).message)
    } finally {
      uploading.value = false
      input.value = ''
    }
  }
  async function download(file: WorkAttachment) {
    try {
      await workApi.download(file)
    } catch (error) {
      ElMessage.error((error as Error).message)
    }
  }
  function formatRevision(json: string) {
    try {
      const old = JSON.parse(json) as WorkTask
      return `要求：${old.requirements}\n交付标准：${old.acceptanceCriteria}\n主责：${person(old.assigneeId)}\n要求时间：${workDate(old.requestedDueAtUtc)}`
    } catch {
      return '历史内容无法解析'
    }
  }
  async function reload() {
    if (data.value && visible.value) data.value = await workApi.detail(data.value.task.id)
  }
  let timer: ReturnType<typeof setInterval> | undefined
  let polling = false
  async function refreshDiscussion() {
    if (
      !visible.value ||
      activeTab.value !== 'discussion' ||
      document.hidden ||
      actionVisible.value ||
      busy.value ||
      polling ||
      !data.value
    )
      return
    const id = data.value.task.id
    polling = true
    try {
      const latest = await workApi.detail(id, true)
      if (visible.value && data.value?.task.id === id && !actionVisible.value) {
        data.value.reports = latest.reports
        data.value.attachments = latest.attachments
        data.value.attachmentLinks = latest.attachmentLinks
      }
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        [401, 403].includes(Number(error.code))
      ) {
        visible.value = false
        ElMessage.warning('当前任务已无法访问，请刷新列表')
      }
    } finally {
      polling = false
    }
  }
  function onVisible() {
    if (!document.hidden) void refreshDiscussion()
  }
  onMounted(() => {
    timer = setInterval(() => void refreshDiscussion(), 15000)
    document.addEventListener('visibilitychange', onVisible)
  })
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  })
  async function copyId() {
    if (!data.value) return
    try {
      await navigator.clipboard.writeText(data.value.task.id)
      ElMessage.success('任务编号已复制')
    } catch {
      ElMessage.info(data.value.task.id)
    }
  }
  async function reassign(id: string) {
    await open(id)
    act('reassign')
  }
  defineExpose({ open, reload, reassign })
</script>
<style scoped lang="scss">
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin-bottom: 16px;
  }

  .text {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .record {
    margin: 14px 0;
  }

  .timeline {
    margin-top: 20px;
  }

  .node {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }
</style>
