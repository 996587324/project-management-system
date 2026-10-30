<template>
  <el-dialog
    v-model="visible"
    title="交接任务管理责任"
    width="min(650px,95vw)"
    append-to-body
    :close-on-click-modal="false"
  >
    <p>任务编号：{{ form.taskId }}</p
    ><el-alert
      title="只交接下派、验收和汇总责任，主责员工与已提交成果不变。新负责人必须已有对应范围的业务授权。"
      type="warning"
      :closable="false"
    />
    <el-form label-width="130px"
      ><el-form-item label="下派负责人" required
        ><WorkPersonPicker
          v-model="form.dispatcherId"
          title="选择下派负责人"
          purpose="dispatcher"
          :task-id="form.taskId"
          :fallback-label="users.find((x) => x.userId === form.dispatcherId)?.name" /></el-form-item
      ><el-form-item label="验收人"
        ><WorkPersonPicker
          v-model="form.reviewerId"
          title="选择验收人"
          purpose="reviewer"
          :task-id="form.taskId"
          :fallback-label="users.find((x) => x.userId === form.reviewerId)?.name" /></el-form-item
      ><el-form-item label="汇总负责人"
        ><WorkPersonPicker
          v-model="form.summaryLeaderId"
          title="选择汇总负责人"
          purpose="leader"
          :task-id="form.taskId"
          :fallback-label="
            users.find((x) => x.userId === form.summaryLeaderId)?.name
          " /></el-form-item
      ><el-form-item label="交接原因" required
        ><el-input v-model="form.reason" type="textarea" :rows="3" maxlength="2000" /></el-form-item
    ></el-form>
    <template #footer
      ><el-button @click="visible = false">返回</el-button
      ><el-button type="primary" :loading="busy" @click="save">确认交接</el-button></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
  import { reactive, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { workApi } from '@/api/work-tasks'
  import WorkPersonPicker from './WorkPersonPicker.vue'
  defineProps<{ users: { userId: string; name: string }[] }>()
  const emit = defineEmits<{ changed: [] }>()
  const visible = ref(false)
  const busy = ref(false)
  const form = reactive({
    taskId: '',
    expectedVersion: 0,
    dispatcherId: '',
    reviewerId: '',
    summaryLeaderId: '',
    reason: ''
  })
  function open(task: {
    id: string
    version: number
    dispatcherId: string
    reviewerId: string
    summaryLeaderId: string
  }) {
    Object.assign(form, {
      taskId: task.id,
      expectedVersion: task.version,
      dispatcherId: task.dispatcherId,
      reviewerId: task.reviewerId,
      summaryLeaderId: task.summaryLeaderId,
      reason: ''
    })
    visible.value = true
  }
  async function save() {
    busy.value = true
    try {
      await workApi.handover(form)
      visible.value = false
      emit('changed')
      ElMessage.success('管理责任已交接，历史记录已保留')
    } finally {
      busy.value = false
    }
  }
  defineExpose({ open })
</script>
