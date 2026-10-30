<template>
  <el-dialog
    v-model="visible"
    :title="mode === 'revise' ? '变更任务要求' : '编辑工作任务'"
    width="min(800px,96vw)"
    :close-on-click-modal="false"
    @closed="stopAutoSave"
  >
    <el-form label-width="120px">
      <el-form-item label="任务标题" required
        ><el-input v-model="form.title" maxlength="160" show-word-limit
      /></el-form-item>
      <el-form-item label="工作组" required
        ><WorkChoicePicker
          v-model="form.groupId"
          title="选择工作组"
          placeholder="选择工作组"
          :options="groupOptions"
          :disabled="mode === 'revise'"
          @change="changeGroup"
      /></el-form-item>
      <el-form-item label="主责员工" required
        ><WorkPersonPicker
          v-model="form.assigneeId"
          title="选择主责员工"
          purpose="assignee"
          :group-id="form.groupId"
          :task-id="mode === 'revise' ? id : undefined"
          :disabled="mode === 'revise'"
          :fallback-label="bootstrap.targets.find((x) => x.userId === form.assigneeId)?.name"
          placeholder="先选择工作组，再选择主责员工"
        />
        <span class="hint">{{
          mode === 'revise'
            ? '已下派任务更换员工需要办理转派，保留责任和成果记录。'
            : '仅能选择本工作组内已获得执行授权的员工。'
        }}</span>
        <el-button v-if="mode === 'revise'" type="primary" text @click="requestTransfer"
          >更换主责员工（转派）</el-button
        ></el-form-item
      >
      <el-form-item v-if="mode === 'save'" label="协作员工">
        <WorkChoicePicker
          v-model="form.collaboratorIds"
          title="选择协作员工"
          :options="collaboratorOptions"
          multiple
        />
        <span class="hint">协作人共享任务和讨论，主责人负责评估与最终提交。</span>
      </el-form-item>
      <el-form-item label="任务要求" required
        ><el-input v-model="form.requirements" type="textarea" :rows="4" maxlength="20000"
      /></el-form-item>
      <el-form-item label="交付标准" required
        ><el-input
          v-model="form.acceptanceCriteria"
          type="textarea"
          :rows="3"
          placeholder="明确交付内容、判断完成的标准"
          maxlength="10000"
      /></el-form-item>
      <el-form-item label="优先级"
        ><el-select v-model="form.priority"
          ><el-option label="低" value="Low" /><el-option label="普通" value="Normal" /><el-option
            label="高"
            value="High" /><el-option label="紧急" value="Urgent" /></el-select
      ></el-form-item>
      <el-form-item label="要求完成时间"
        ><el-date-picker
          v-model="form.requestedDueAt"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ssZ"
          placeholder="留空由员工评估排期"
          clearable
      /></el-form-item>
      <el-form-item label="成果要求"
        ><el-radio-group v-model="form.materialRule"
          ><el-radio value="TextOrFile">文字或附件</el-radio
          ><el-radio value="FileRequired">必须有附件</el-radio></el-radio-group
        ></el-form-item
      >
      <el-form-item label="提交后验收"
        ><el-switch v-model="form.requiresReview" /><span class="hint"
          >关闭后，员工正式提交即完成</span
        ></el-form-item
      >
      <el-form-item v-if="form.requiresReview" label="验收人"
        ><WorkPersonPicker
          v-model="form.reviewerId"
          title="选择验收人"
          purpose="reviewer"
          :group-id="form.groupId"
          :assignee-id="form.assigneeId"
          :task-id="mode === 'revise' ? id : undefined"
        /><span class="hint">必须具备本范围的派发授权，且不能自验收</span></el-form-item
      >
      <el-form-item label="汇总负责人"
        ><WorkPersonPicker
          v-model="form.summaryLeaderId"
          title="选择汇总负责人"
          purpose="leader"
          :group-id="form.groupId"
          :assignee-id="form.assigneeId"
          :task-id="mode === 'revise' ? id : undefined"
      /></el-form-item>
      <el-form-item v-if="mode === 'save'" label="下派通知">
        <el-checkbox v-model="pushOnDispatch">下派后向主责员工推送</el-checkbox>
        <span class="hint">使用工作设置中已配置的微信和邮件通道；未勾选时只发送站内提醒。</span>
      </el-form-item>
      <el-form-item v-if="mode === 'revise'" label="变更原因" required
        ><el-input v-model="form.text" type="textarea" maxlength="2000"
      /></el-form-item>
    </el-form>
    <el-alert
      v-if="mode === 'revise'"
      title="正式要求变更后，员工需要重新评估；原要求和承诺记录将保留。"
      type="warning"
      :closable="false"
    />
    <template #footer
      ><span class="hint">{{ saveState }}</span
      ><el-button @click="visible = false">关闭</el-button
      ><el-button :loading="saving" @click="save(false)">{{
        mode === 'revise' ? '确认变更' : '保存草稿'
      }}</el-button
      ><el-button v-if="mode === 'save'" :loading="saving" type="primary" @click="dispatch"
        >保存并正式下派</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { workApi, type WorkBootstrap, type WorkTask } from '@/api/work-tasks'
  import WorkChoicePicker from '@/components/business/work-choice-picker/index.vue'
  import WorkPersonPicker from './WorkPersonPicker.vue'
  import { workGroupChoices } from './work-choices'
  const props = defineProps<{ bootstrap: WorkBootstrap }>()
  const emit = defineEmits<{ saved: []; reassign: [id: string] }>()
  const visible = ref(false)
  const saving = ref(false)
  const pushOnDispatch = ref(false)
  const id = ref<string>()
  const version = ref(0)
  const mode = ref('save')
  const saveState = ref('填写标题和工作组后自动保存草稿')
  let hydrating = false
  let openedSnapshot = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  const defaults = () => ({
    title: '',
    requirements: '',
    acceptanceCriteria: '',
    groupId: '',
    assigneeId: '',
    collaboratorIds: [] as string[],
    reviewerId: props.bootstrap.userId,
    summaryLeaderId: props.bootstrap.userId,
    priority: 'Normal',
    materialRule: 'TextOrFile',
    requiresReview: true,
    requestedDueAt: null as string | null,
    text: ''
  })
  const form = reactive(defaults())
  const groupOptions = computed(() => workGroupChoices(props.bootstrap.groups))
  const collaboratorOptions = computed(() =>
    props.bootstrap.targets
      .filter((x) => x.groupId === form.groupId && x.userId !== form.assigneeId && x.canAssign)
      .map((x) => ({ value: x.userId, label: x.name }))
  )
  watch(
    () => form.assigneeId,
    (id) => {
      form.collaboratorIds = form.collaboratorIds.filter((x) => x !== id)
    }
  )
  function changeGroup() {
    form.assigneeId = ''
    form.collaboratorIds = []
    form.reviewerId = props.bootstrap.userId
    form.summaryLeaderId = props.bootstrap.userId
  }
  async function requestTransfer() {
    if (!id.value || saving.value) return
    if (JSON.stringify(form) !== openedSnapshot)
      await ElMessageBox.confirm(
        '即将打开转派窗口，当前未保存的要求修改将不会保留。',
        '更换主责员工'
      )
    visible.value = false
    emit('reassign', id.value)
  }
  function ready() {
    return !!(form.title.trim() && form.groupId)
  }
  function stopAutoSave() {
    if (timer) clearTimeout(timer)
  }
  async function open(task?: WorkTask) {
    stopAutoSave()
    pushOnDispatch.value = false
    hydrating = true
    id.value = task?.id
    version.value = task?.version || 0
    mode.value = task && task.status !== 'Draft' ? 'revise' : 'save'
    const collaborators = task ? (await workApi.detail(task.id)).collaborators : []
    Object.assign(
      form,
      defaults(),
      task
        ? {
            title: task.title,
            requirements: task.requirements,
            acceptanceCriteria: task.acceptanceCriteria,
            groupId: task.groupId,
            assigneeId: task.assigneeId,
            collaboratorIds: collaborators,
            reviewerId: task.reviewerId,
            summaryLeaderId: task.summaryLeaderId,
            priority: task.priority,
            materialRule: task.materialRule,
            requiresReview: task.requiresReview,
            requestedDueAt: task.requestedDueAtUtc,
            text: ''
          }
        : {}
    )
    saveState.value = mode.value === 'save' ? '填写标题和工作组后自动保存草稿' : '变更需要明确确认'
    openedSnapshot = JSON.stringify(form)
    visible.value = true
    await nextTick()
    hydrating = false
  }
  async function save(quiet = false) {
    if (saving.value) return false
    if (!ready()) {
      if (!quiet) ElMessage.warning('请先填写标题和工作组')
      return false
    }
    stopAutoSave()
    saving.value = true
    const snapshot = JSON.stringify(form)
    let saved = false
    try {
      const result = await workApi.command(
        id.value,
        { ...form, action: mode.value, expectedVersion: version.value },
        quiet
      )
      id.value = result.taskId
      version.value = result.version
      saveState.value = '已保存 ' + new Date().toLocaleTimeString()
      emit('saved')
      saved = true
      if (mode.value === 'revise') {
        visible.value = false
        ElMessage.success('要求已变更，等待员工重新评估')
      }
      return true
    } catch (error) {
      saveState.value = '保存失败，请重试'
      if (!quiet) throw error
      return false
    } finally {
      saving.value = false
      if (saved && visible.value && mode.value === 'save' && snapshot !== JSON.stringify(form)) {
        saveState.value = '尚有未保存修改'
        timer = setTimeout(() => {
          void save(true)
        }, 500)
      }
    }
  }
  async function dispatch() {
    if (!form.assigneeId || !form.summaryLeaderId || (form.requiresReview && !form.reviewerId)) {
      ElMessage.warning('请选择主责员工、汇总负责人及需要的验收人')
      return
    }
    await ElMessageBox.confirm(
      '正式下派后将产生员工待办，确认任务要求、主责人和验收规则已填写正确。',
      '正式下派'
    )
    if (!(await save())) return
    if (!id.value || saving.value) return
    saving.value = true
    try {
      await workApi.command(id.value, {
        action: 'dispatch',
        expectedVersion: version.value,
        pushOnDispatch: pushOnDispatch.value
      })
      visible.value = false
      emit('saved')
      ElMessage.success('已下派')
    } finally {
      saving.value = false
    }
  }
  watch(
    form,
    () => {
      if (hydrating || !visible.value || mode.value !== 'save') return
      stopAutoSave()
      saveState.value = '尚有未保存修改'
      timer = setTimeout(() => {
        void save(true)
      }, 1500)
    },
    { deep: true }
  )
  onBeforeUnmount(stopAutoSave)
  defineExpose({ open })
</script>
<style scoped lang="scss">
  .full {
    width: 100%;
  }

  .hint {
    margin: 0 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
</style>
