<template>
  <div class="work-page" v-loading="loading">
    <div class="toolbar"
      ><h2>{{ team ? '团队工作' : '我的工作' }}</h2
      ><el-button v-if="boot?.canDispatch" type="primary" @click="editTask()"
        >新建工作任务</el-button
      ><el-button @click="load">刷新</el-button></div
    >
    <el-alert
      v-if="boot && !boot.canUse"
      title="尚未获得工作任务业务授权，请联系工作任务管理员。平台管理权限不会自动获得任务内容。"
      type="info"
      :closable="false"
    />
    <el-tabs v-model="view" @tab-change="load">
      <el-tab-pane :label="team ? '团队任务' : '本人任务'" :name="team ? 'team' : 'my'" />
      <el-tab-pane v-if="boot?.canDispatch" label="我的草稿" name="drafts" />
      <el-tab-pane v-if="team" label="待我验收" name="review" />
      <el-tab-pane v-if="!team" label="提醒与日终汇总" name="inbox" />
    </el-tabs>
    <template v-if="view !== 'inbox'">
      <div class="toolbar"
        ><el-input
          v-model="keyword"
          placeholder="搜索任务标题"
          clearable
          @keyup.enter="load"
        /><el-select v-model="status" placeholder="全部状态" clearable @change="load"
          ><el-option
            v-for="(label, key) in workStatuses"
            :key="key"
            :label="label"
            :value="key" /></el-select
        ><el-button @click="load">查询</el-button></div
      >
      <el-table :data="rows" stripe @row-click="openTask">
        <el-table-column prop="title" label="工作任务" min-width="220"
          ><template #default="{ row }"
            ><el-button link type="primary">{{ row.title }}</el-button
            ><el-tag v-if="row.blocked" type="danger" size="small">阻塞</el-tag></template
          ></el-table-column
        >
        <el-table-column label="状态" width="115"
          ><template #default="{ row }">{{ workStatuses[row.status] }}</template></el-table-column
        >
        <el-table-column label="主责人" width="130"
          ><template #default="{ row }">{{ person(row.assigneeId) }}</template></el-table-column
        >
        <el-table-column label="当前承诺" min-width="180"
          ><template #default="{ row }"
            ><span :class="{ late: isLate(row as WorkTask) }">{{
              workDate(row.committedDueAtUtc)
            }}</span></template
          ></el-table-column
        >
        <el-table-column label="进度" width="100"
          ><template #default="{ row }">{{ row.progress }}%</template></el-table-column
        >
        <el-table-column label="最近更新" min-width="175"
          ><template #default="{ row }">{{ workDate(row.updatedAtUtc) }}</template></el-table-column
        > </el-table
      ><el-empty v-if="!rows.length" description="当前没有符合条件的任务" />
      <el-pagination
        v-model:current-page="page"
        :page-size="20"
        :total="total"
        layout="prev,pager,next,total"
        @current-change="load"
      />
    </template>
    <template v-else>
      <el-empty
        v-if="!inbox.length"
        description="暂无提醒；管理员启用日终规则后，将按配置生成汇总"
      />
      <el-card v-for="item in inbox" :key="item.id" class="inbox-card">
        <div class="toolbar"
          ><strong
            >{{ item.perspective === 'Leader' ? '团队' : '个人'
            }}{{ item.kind === 'Digest' ? '日终汇总' : '任务提醒' }} {{ item.businessDate }}</strong
          ><el-tag v-if="!item.readAtUtc">未读</el-tag
          ><el-button text @click="markRead(item.id)">标记已读</el-button></div
        >
        <p v-if="item.cutoffUtc"
          >数据截止：{{ workDate(item.cutoffUtc) }}；未更新不代表没有开展工作。</p
        >
        <div
          v-for="task in item.tasks || (item.task ? [item.task] : [])"
          :key="task.id"
          class="digest-row"
          ><el-button link type="primary" @click="openTask(task)">{{ task.title }}</el-button
          ><span
            >{{ workStatuses[task.status] }} · {{ task.progress }}% ·
            {{ workDate(task.committedDueAtUtc) }}</span
          ></div
        >
      </el-card>
    </template>
    <WorkTaskEditor
      v-if="boot"
      ref="editor"
      :bootstrap="boot"
      @saved="afterEdit"
      @reassign="detail?.reassign($event)"
    />
    <WorkTaskDetail v-if="boot" ref="detail" :bootstrap="boot" @changed="load" @edit="editTask" />
  </div>
</template>
<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import {
    workApi,
    workStatuses,
    workDate,
    type WorkTask,
    type WorkBootstrap,
    type WorkInbox
  } from '@/api/work-tasks'
  import WorkTaskEditor from './WorkTaskEditor.vue'
  import WorkTaskDetail from './WorkTaskDetail.vue'
  const props = defineProps<{ team?: boolean }>()
  const boot = ref<WorkBootstrap>()
  const loading = ref(false)
  const rows = ref<WorkTask[]>([])
  const inbox = ref<WorkInbox[]>([])
  const view = ref(props.team ? 'team' : 'my')
  const status = ref('')
  const keyword = ref('')
  const page = ref(1)
  const total = ref(0)
  const editor = ref<InstanceType<typeof WorkTaskEditor>>()
  const detail = ref<InstanceType<typeof WorkTaskDetail>>()
  const person = (id: string) =>
    boot.value?.targets.find((x) => x.userId === id)?.name ||
    (id === boot.value?.userId ? '本人' : id)
  const isLate = (task: WorkTask) =>
    ['PendingAssessment', 'InProgress'].includes(task.status) &&
    !!task.committedDueAtUtc &&
    Date.parse(task.committedDueAtUtc) < Date.now()
  async function load() {
    loading.value = true
    try {
      boot.value = await workApi.bootstrap()
      if (view.value === 'inbox') inbox.value = await workApi.inbox()
      else {
        const result = await workApi.list({
          view: view.value,
          status: status.value || undefined,
          keyword: keyword.value,
          page: page.value
        })
        rows.value = result.records
        total.value = result.total
      }
    } finally {
      loading.value = false
    }
  }
  function openTask(task: WorkTask) {
    detail.value?.open(task.id)
  }
  function editTask(task?: WorkTask) {
    editor.value?.open(task)
  }
  async function afterEdit() {
    await load()
    await detail.value?.reload()
  }
  async function markRead(id: string) {
    await workApi.read(id)
    await load()
  }
  onMounted(load)
</script>
<style scoped lang="scss">
  .work-page {
    padding: 20px;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
  }

  .toolbar h2 {
    margin-right: auto;
  }

  .toolbar .el-input {
    max-width: 280px;
  }

  .toolbar .el-select {
    width: 180px;
  }

  .late {
    color: var(--el-color-danger);
  }

  .inbox-card {
    margin-bottom: 14px;
  }

  .digest-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: space-between;
    padding: 8px 0;
  }
</style>
