<template>
  <el-dialog
    :model-value="modelValue"
    title="字段推送记录"
    width="min(1200px, 96vw)"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="queue-setting">
      <span>全局队列发送间隔</span>
      <el-input-number
        v-model="intervalSeconds"
        :min="1"
        :max="86400"
        :precision="0"
        :disabled="!settingReady"
      />
      <span>秒</span>
      <el-button
        type="primary"
        :loading="savingSetting"
        :disabled="!settingReady"
        @click="saveSetting"
        >保存间隔</el-button
      >
      <p
        >默认 5
        秒。同一接收人的变更合并发送，不同接收人也按间隔错开发送；超长内容自动分批，不丢弃报警和恢复记录。此配置适用于全部线体，独立于字段变化冷却时间。</p
      >
    </div>
    <div class="push-filters">
      <el-select
        v-model="status"
        clearable
        placeholder="全部发送状态"
        style="width: 170px"
        @change="search"
      >
        <el-option v-for="(label, code) in statusLabels" :key="code" :value="code" :label="label" />
      </el-select>
      <el-select
        v-model="userId"
        filterable
        clearable
        placeholder="全部接收人"
        style="width: 240px"
        @change="search"
      >
        <el-option
          v-for="person in recipients"
          :key="person.userId"
          :value="person.userId"
          :label="person.userName"
        />
      </el-select>
      <el-button @click="load">刷新</el-button>
      <span>每 3 秒刷新；结果未知的任务不会自动重发，请先核实微信收件情况。</span>
    </div>
    <el-table :data="records" border max-height="520" empty-text="当前线体暂无字段推送任务">
      <el-table-column type="expand">
        <template #default="{ row }">
          <pre class="push-content">{{ row.content }}</pre>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="产生时间" min-width="165" />
      <el-table-column prop="deviceMark" label="设备" min-width="130" />
      <el-table-column prop="displayName" label="字段" min-width="115" />
      <el-table-column label="接收人" min-width="120">
        <template #default="{ row }">{{ row.userName || recipientName(row.userId) }}</template>
      </el-table-column>
      <el-table-column label="触发原因" width="115">
        <template #default="{ row }">{{ eventLabels[row.eventType] || row.eventType }}</template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }"
          ><el-tag :type="statusType(row.status)">{{
            statusLabels[row.status] || row.status
          }}</el-tag></template
        >
      </el-table-column>
      <el-table-column prop="attemptCount" label="尝试次数" width="95" />
      <el-table-column prop="deliveryId" label="发送记录 ID" width="115" />
      <el-table-column
        prop="errorMessage"
        label="失败 / 状态说明"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'Failed' || row.status === 'Blocked'"
            link
            type="primary"
            @click="retry(row)"
            >重试</el-button
          >
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="page"
      :page-size="20"
      :total="total"
      layout="total, prev, pager, next"
      class="push-pagination"
      @current-change="load"
    />
  </el-dialog>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, ref, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchDeviceCardPushRecipients,
    fetchDeviceCardPushTasks,
    retryDeviceCardPushTask,
    fetchDeviceCardPushQueueSetting,
    saveDeviceCardPushQueueSetting,
    type DeviceCardPushRecipient,
    type DeviceCardPushTask
  } from '@/api/device-card-push'

  const props = defineProps<{ modelValue: boolean; lineCode: string }>()
  const emit = defineEmits<{ (event: 'update:modelValue', value: boolean): void }>()
  const statusLabels: Record<string, string> = {
    Pending: '等待发送',
    Processing: '发送中',
    Sent: '已发送',
    Retrying: '等待重试',
    Failed: '发送失败',
    Blocked: '暂不可发送',
    Unknown: '结果未知',
    Cancelled: '已取消'
  }
  const eventLabels: Record<string, string> = {
    Changed: '字段变化',
    UpperExceeded: '超过上限',
    LowerExceeded: '低于下限',
    Recovered: '恢复正常',
    Test: '测试消息'
  }
  const records = ref<DeviceCardPushTask[]>([])
  const recipients = ref<DeviceCardPushRecipient[]>([])
  const status = ref('')
  const userId = ref('')
  const page = ref(1)
  const total = ref(0)
  const intervalSeconds = ref(5)
  const savingSetting = ref(false)
  const settingReady = ref(false)
  const saveSetting = async () => {
    savingSetting.value = true
    try {
      await saveDeviceCardPushQueueSetting(intervalSeconds.value)
      ElMessage.success('队列间隔已保存，适用于全部线体')
    } finally {
      savingSetting.value = false
    }
  }
  let loading = false
  let timer: number | undefined
  const load = async () => {
    if (!props.modelValue || loading) return
    loading = true
    try {
      const result = await fetchDeviceCardPushTasks({
        lineCode: props.lineCode,
        status: status.value || undefined,
        userId: userId.value || undefined,
        current: page.value,
        size: 20
      })
      records.value = result.records
      total.value = result.total
    } finally {
      loading = false
    }
  }
  const search = () => {
    page.value = 1
    void load()
  }
  const recipientName = (id: string) =>
    recipients.value.find((person) => person.userId === id)?.userName || id
  const statusType = (code: string) =>
    code === 'Sent'
      ? 'success'
      : code === 'Failed'
        ? 'danger'
        : code === 'Unknown' || code === 'Blocked'
          ? 'warning'
          : 'info'
  const retry = async (row: unknown) => {
    const task = row as DeviceCardPushTask
    await ElMessageBox.confirm(
      `重试给 ${recipientName(task.userId)} 的这条历史消息？`,
      '重试字段推送'
    )
    await retryDeviceCardPushTask(task.id)
    ElMessage.success('已重新加入发送队列')
    await load()
  }
  watch(
    () => props.modelValue,
    async (open) => {
      window.clearInterval(timer)
      timer = undefined
      if (!open) return
      settingReady.value = false
      const setting = await fetchDeviceCardPushQueueSetting()
      intervalSeconds.value = setting.intervalSeconds
      settingReady.value = true
      page.value = 1
      await load()
      recipients.value = await fetchDeviceCardPushRecipients()
      if (props.modelValue) timer = window.setInterval(() => void load(), 3000)
    }
  )
  onBeforeUnmount(() => window.clearInterval(timer))
</script>

<style scoped lang="scss">
  .queue-setting {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    padding: 14px;
    margin-bottom: 16px;
    background: var(--el-fill-color-light);
    border-radius: 6px;

    p {
      width: 100%;
      margin: 0;
      font-size: 12px;
      line-height: 1.7;
      color: var(--el-text-color-secondary);
    }
  }

  .push-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;

    span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .push-content {
    padding: 14px;
    margin: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .push-pagination {
    justify-content: flex-end;
    margin-top: 18px;
  }
</style>
