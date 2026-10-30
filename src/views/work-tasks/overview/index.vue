<template>
  <div class="overview" v-loading="loading">
    <div class="heading"><h2>任务总览</h2><el-button @click="load">刷新</el-button></div>
    <el-alert
      title="任务范围根据工作任务授权自动确定；查看权限不会自动授予下派或验收权限。"
      type="info"
      :closable="false"
    />
    <div class="layout">
      <aside>
        <h3>部门 / 小组</h3>
        <el-button text type="primary" @click="selectGroup('')">全部可见任务</el-button>
        <el-tree
          :data="tree"
          node-key="id"
          :props="{ label: 'name', children: 'children' }"
          default-expand-all
          highlight-current
          @node-click="selectNode"
        />
      </aside>
      <main>
        <div class="statistics">
          <span v-for="item in statistics" :key="item.label"
            >{{ item.label }} <strong>{{ item.value }}</strong></span
          >
        </div>
        <div class="filters">
          <el-input v-model="keyword" placeholder="搜索任务标题" clearable @keyup.enter="search" />
          <el-select v-model="userId" placeholder="全部员工" clearable filterable @change="search">
            <el-option
              v-for="person in people"
              :key="person.userId"
              :label="person.name"
              :value="person.userId"
            />
          </el-select>
          <el-select v-model="status" placeholder="全部状态" clearable @change="search">
            <el-option
              v-for="(label, key) in workStatuses"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
          <el-button type="primary" @click="search">查询</el-button>
        </div>
        <el-table :data="data?.records || []" stripe @row-click="openTask">
          <el-table-column label="任务名称" prop="title" min-width="180"
            ><template #default="{ row }"
              ><el-button link type="primary">{{ row.title }}</el-button
              ><el-tag v-if="row.blocked" type="danger" size="small">阻塞</el-tag></template
            ></el-table-column
          >
          <el-table-column label="所属小组" min-width="120"
            ><template #default="{ row }">{{ groupName(row.groupId) }}</template></el-table-column
          >
          <el-table-column label="主责人" min-width="100"
            ><template #default="{ row }">{{
              personName(row.assigneeId)
            }}</template></el-table-column
          >
          <el-table-column label="状态" min-width="100"
            ><template #default="{ row }">{{
              workStatuses[row.status] || row.status
            }}</template></el-table-column
          >
          <el-table-column label="进度" width="80"
            ><template #default="{ row }">{{ row.progress }}%</template></el-table-column
          >
          <el-table-column label="承诺完成时间" min-width="165"
            ><template #default="{ row }">{{
              workDate(row.committedDueAtUtc)
            }}</template></el-table-column
          >
          <el-table-column label="最近更新" min-width="165"
            ><template #default="{ row }">{{
              workDate(row.updatedAtUtc)
            }}</template></el-table-column
          >
        </el-table>
        <el-empty v-if="!loading && !data?.records.length" description="当前范围暂无任务" />
        <el-pagination
          v-model:current-page="page"
          :page-size="20"
          :total="data?.total || 0"
          layout="prev,pager,next,total"
          @current-change="load"
        />
      </main>
    </div>
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
  import { computed, onMounted, ref } from 'vue'
  import {
    workApi,
    workDate,
    workStatuses,
    type WorkBootstrap,
    type WorkOverview,
    type WorkTask
  } from '@/api/work-tasks'
  import WorkTaskDetail from '../components/WorkTaskDetail.vue'
  import WorkTaskEditor from '../components/WorkTaskEditor.vue'
  interface TreeNode {
    id: string
    name: string
    parentId?: string | null
    userId?: string
    groupId?: string
    children: TreeNode[]
  }
  const boot = ref<WorkBootstrap>()
  const data = ref<WorkOverview>()
  const detail = ref<InstanceType<typeof WorkTaskDetail>>()
  const editor = ref<InstanceType<typeof WorkTaskEditor>>()
  const loading = ref(false)
  const groupId = ref('')
  const userId = ref('')
  const status = ref('')
  const keyword = ref('')
  const page = ref(1)
  const tree = computed(() => {
    const nodes = (data.value?.groups || []).map((group) => ({
      ...group,
      children: [] as TreeNode[]
    }))
    const byId = new Map(nodes.map((node) => [node.id, node]))
    for (const person of data.value?.members || []) {
      byId.get(person.groupId)?.children.push({
        id: `person:${person.groupId}:${person.userId}`,
        name: person.name,
        groupId: person.groupId,
        userId: person.userId,
        children: []
      })
    }
    return nodes.filter((node) => {
      const parent = node.parentId && byId.get(node.parentId)
      if (parent) {
        parent.children.push(node)
        return false
      }
      return true
    })
  })
  const people = computed(() =>
    Array.from(
      new Map((data.value?.members || []).map((person) => [person.userId, person])).values()
    )
  )
  const statistics = computed(() => {
    const c = data.value?.counts
    return [
      { label: '全部', value: c?.total || 0 },
      { label: '待评估', value: c?.pendingAssessment || 0 },
      { label: '进行中', value: c?.inProgress || 0 },
      { label: '待验收', value: c?.pendingReview || 0 },
      { label: '已完成', value: c?.completed || 0 },
      { label: '阻塞', value: c?.blocked || 0 },
      { label: '逾期', value: c?.overdue || 0 }
    ]
  })
  const groupName = (id: string) => data.value?.groups.find((x) => x.id === id)?.name || id
  const personName = (id: string) => people.value.find((x) => x.userId === id)?.name || id
  let requestNumber = 0
  async function load() {
    const current = ++requestNumber
    loading.value = true
    try {
      const result = await workApi.overview({
        groupId: groupId.value || undefined,
        userId: userId.value || undefined,
        status: status.value || undefined,
        keyword: keyword.value,
        page: page.value
      })
      if (current === requestNumber) data.value = result
    } finally {
      if (current === requestNumber) loading.value = false
    }
  }
  function search() {
    page.value = 1
    void load()
  }
  function selectGroup(id: string) {
    groupId.value = id
    userId.value = ''
    search()
  }
  function selectNode(node: TreeNode) {
    groupId.value = node.groupId || node.id
    userId.value = node.userId || ''
    search()
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
  onMounted(async () => {
    boot.value = await workApi.bootstrap()
    await load()
  })
</script>
<style scoped lang="scss">
  .overview {
    padding: 20px;
  }

  .heading,
  .filters,
  .statistics {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
  }

  .heading h2 {
    flex: 1;
  }

  .layout {
    display: flex;
    gap: 20px;
    margin-top: 18px;
  }

  aside {
    flex-shrink: 0;
    width: 220px;
  }

  main {
    flex: 1;
    min-width: 0;
  }

  .filters .el-input,
  .filters .el-select {
    width: 180px;
  }

  .statistics span {
    padding: 10px 14px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
  }

  .statistics strong {
    margin-left: 5px;
  }

  @media (width <= 800px) {
    .layout {
      flex-direction: column;
    }

    aside {
      width: 100%;
    }
  }
</style>
