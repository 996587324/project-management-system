<template>
  <ElAlert
    :title="
      administrator
        ? '管理员可查看全部邮件投递记录。每个收件人分别记录结果。'
        : '仅显示本人在当前系统发起的邮件。'
    "
    type="info"
    :closable="false"
  />
  <div class="record-filters">
    <ElInput
      v-model.trim="keyword"
      clearable
      placeholder="主题、接收用户编码或邮箱"
      @keyup.enter="search"
    />
    <ElSelect v-model="status" clearable placeholder="全部状态">
      <ElOption
        v-for="(label, value) in emailStatusLabels"
        :key="value"
        :label="label"
        :value="value"
      />
    </ElSelect>
    <ElSelect v-model="source" clearable placeholder="全部来源">
      <ElOption label="MCP 推送" value="MCP" />
      <ElOption label="人工发送" value="Manual" /><ElOption label="Agent" value="Agent" /><ElOption
        label="测试邮件"
        value="Test"
      />
    </ElSelect>
    <ElDatePicker
      v-model="range"
      type="datetimerange"
      value-format="YYYY-MM-DD HH:mm:ss"
      start-placeholder="开始时间"
      end-placeholder="结束时间"
    />
    <ElButton type="primary" @click="search">查询</ElButton>
    <ElButton :loading="loading" @click="reload">刷新</ElButton>
  </div>
  <ElTable v-loading="loading" :data="page.records" border>
    <ElTableColumn prop="taskId" label="任务编号" width="105" />
    <ElTableColumn prop="subject" label="主题" min-width="190" show-overflow-tooltip />
    <ElTableColumn prop="address" label="接收邮箱" min-width="220" show-overflow-tooltip />
    <ElTableColumn prop="fromAddress" label="实际发件邮箱" min-width="220" show-overflow-tooltip />
    <ElTableColumn prop="recipientUserId" label="接收用户编码" min-width="125" />
    <ElTableColumn label="类型" width="80"
      ><template #default="{ row }">{{
        row.recipientKind === 'Cc' ? '抄送' : '收件'
      }}</template></ElTableColumn
    >
    <ElTableColumn label="状态" min-width="160">
      <template #default="{ row }"
        ><ElTag :type="statusType(row.status)">{{
          emailStatusLabels[row.status] || row.status
        }}</ElTag></template
      >
    </ElTableColumn>
    <ElTableColumn prop="source" label="来源" width="90" />
    <ElTableColumn prop="createdBy" label="发起用户编码" min-width="125" />
    <ElTableColumn prop="appCode" label="系统" width="70" />
    <ElTableColumn prop="attemptCount" label="尝试次数" width="95" />
    <ElTableColumn prop="createTime" label="提交时间" min-width="180" />
    <ElTableColumn prop="sentTime" label="服务器接受时间" min-width="180" />
    <ElTableColumn
      prop="errorMessage"
      label="失败／待核实原因"
      min-width="250"
      show-overflow-tooltip
    />
    <ElTableColumn v-if="administrator" label="操作" width="100" fixed="right">
      <template #default="{ row }"
        ><ElButton
          v-if="['Failed', 'Unknown'].includes(row.status)"
          link
          type="primary"
          :loading="retrying === row.id"
          @click="retry(row as EmailRecord)"
          >重试</ElButton
        ></template
      >
    </ElTableColumn>
  </ElTable>
  <ElPagination
    v-model:current-page="page.current"
    v-model:page-size="page.size"
    :total="page.total"
    :page-sizes="[20, 50, 100]"
    layout="total, sizes, prev, pager, next"
    class="pagination"
    @current-change="reload"
    @size-change="search"
  />
  <p>“邮件服务器已接受”不等于收件人已经收到或阅读。“结果待核实”不会自动重发。</p>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    emailStatusLabels,
    fetchEmailRecords,
    retryEmail,
    type EmailPage,
    type EmailRecord
  } from '@/api/email-push'

  defineProps<{ administrator: boolean }>()
  const keyword = ref('')
  const status = ref('')
  const source = ref('')
  const range = ref<[string, string]>()
  const loading = ref(false)
  const retrying = ref<number>()
  const page = reactive<EmailPage<EmailRecord>>({ current: 1, size: 20, total: 0, records: [] })
  let requestVersion = 0

  function statusType(value: string) {
    if (value === 'Sent') return 'success'
    if (value === 'Failed') return 'danger'
    if (value === 'Unknown' || value === 'Retrying') return 'warning'
    return 'info'
  }

  async function reload() {
    const version = ++requestVersion
    loading.value = true
    try {
      const result = await fetchEmailRecords({
        current: page.current,
        size: page.size,
        keyword: keyword.value,
        status: status.value,
        source: source.value,
        startTime: range.value?.[0],
        endTime: range.value?.[1]
      })
      if (version === requestVersion) Object.assign(page, result)
    } finally {
      if (version === requestVersion) loading.value = false
    }
  }

  async function search() {
    page.current = 1
    await reload()
  }

  async function retry(row: EmailRecord) {
    try {
      await ElMessageBox.confirm(
        row.status === 'Unknown'
          ? '此邮件可能已经发送。请先核实；继续重试可能造成重复邮件，是否接受该风险？'
          : '确认重新投递这条失败邮件？',
        '管理员重试',
        { type: 'warning' }
      )
    } catch {
      return
    }
    retrying.value = row.id
    try {
      await retryEmail(row.id, row.status === 'Unknown')
      ElMessage.success('已重新加入发送队列')
      await reload()
    } finally {
      retrying.value = undefined
    }
  }

  defineExpose({ reload })
  onMounted(() => {
    void reload().catch(() => {})
  })
  onBeforeUnmount(() => {
    ++requestVersion
  })
</script>

<style scoped>
  .record-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 16px 0;
  }

  .record-filters > .el-input {
    width: 250px;
  }

  .record-filters > .el-select {
    width: 180px;
  }

  .pagination {
    justify-content: flex-end;
    margin: 20px 0;
  }

  p {
    color: var(--el-text-color-secondary);
  }
</style>
