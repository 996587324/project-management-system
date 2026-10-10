<template>
  <div class="user-activity-page">
    <el-card shadow="never">
      <template #header
        ><div class="header"
          ><span>用户行为日志</span
          ><el-button :loading="loading" @click="reload">刷新</el-button></div
        ></template
      >
      <el-row :gutter="16">
        <el-col v-for="item in summaryCards" :key="item.label" :xs="12" :sm="6">
          <div class="summary-card"
            ><span>{{ item.label }}</span
            ><strong>{{ item.value }}</strong></div
          >
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never">
      <el-tabs v-model="activeTab" @tab-change="reloadPage">
        <el-tab-pane label="当前在线" name="online">
          <el-table :data="overview.onlineUsers" border max-height="480">
            <el-table-column prop="userName" label="用户" min-width="130" />
            <el-table-column prop="loginType" label="登录方式" width="110" />
            <el-table-column prop="loginTime" label="登录时间" min-width="170" />
            <el-table-column prop="lastActiveTime" label="最近活跃" min-width="170" />
            <el-table-column label="已在线" width="120"
              ><template #default="{ row }">{{
                formatSeconds(row.onlineSeconds)
              }}</template></el-table-column
            >
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="登录记录" name="login">
          <div class="filters"
            ><el-input
              v-model.trim="loginQuery.userName"
              placeholder="用户名"
              clearable
              @keyup.enter="search"
            /><el-select v-model="loginQuery.status" placeholder="状态" clearable
              ><el-option label="在线" value="Online" /><el-option
                label="已退出"
                value="Offline" /><el-option label="超时离线" value="Timeout" /><el-option
                label="登录失败"
                value="Failed" /></el-select
            ><el-button type="primary" @click="search">查询</el-button></div
          >
          <el-table :data="loginPage.records" border v-loading="tableLoading" max-height="480">
            <el-table-column prop="userName" label="用户" min-width="120" /><el-table-column
              prop="loginType"
              label="方式"
              width="90"
            /><el-table-column label="结果" width="80"
              ><template #default="{ row }"
                ><el-tag :type="row.success ? 'success' : 'danger'">{{
                  row.success ? '成功' : '失败'
                }}</el-tag></template
              ></el-table-column
            ><el-table-column prop="status" label="状态" width="95" /><el-table-column
              prop="clientIp"
              label="IP"
              width="140"
            /><el-table-column prop="loginTime" label="登录时间" min-width="165" /><el-table-column
              label="在线时长"
              width="105"
              ><template #default="{ row }">{{
                formatSeconds(row.onlineSeconds)
              }}</template></el-table-column
            ><el-table-column prop="failureReason" label="失败原因" min-width="160" />
          </el-table>
          <el-pagination
            class="pagination"
            background
            layout="total, prev, pager, next"
            :total="loginPage.total"
            :current-page="loginQuery.current"
            :page-size="loginQuery.size"
            @current-change="changeLoginPage"
          />
        </el-tab-pane>
        <el-tab-pane label="操作记录" name="operation">
          <div class="filters"
            ><el-input
              v-model.trim="operationQuery.userName"
              placeholder="用户名"
              clearable
              @keyup.enter="search"
            /><el-input
              v-model.trim="operationQuery.module"
              placeholder="模块"
              clearable
              @keyup.enter="search"
            /><el-button type="primary" @click="search">查询</el-button></div
          >
          <el-table :data="operationPage.records" border v-loading="tableLoading" max-height="480">
            <el-table-column prop="userName" label="用户" min-width="110" /><el-table-column
              prop="module"
              label="模块"
              min-width="120"
            /><el-table-column prop="httpMethod" label="操作类型" width="110" /><el-table-column
              prop="requestPath"
              label="页面"
              min-width="250"
              show-overflow-tooltip
            /><el-table-column label="结果" width="80"
              ><template #default="{ row }"
                ><el-tag :type="row.success ? 'success' : 'danger'">{{
                  row.success ? '成功' : '失败'
                }}</el-tag></template
              ></el-table-column
            ><el-table-column prop="statusCode" label="状态码" width="90" /><el-table-column
              prop="durationMs"
              label="耗时(ms)"
              width="105"
            /><el-table-column prop="createTime" label="时间" min-width="165" />
          </el-table>
          <el-pagination
            class="pagination"
            background
            layout="total, prev, pager, next"
            :total="operationPage.total"
            :current-page="operationQuery.current"
            :page-size="operationQuery.size"
            @current-change="changeOperationPage"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import {
    fetchUserActivityOverview,
    fetchUserLoginRecords,
    fetchUserOperationRecords,
    type UserActivityOverview,
    type UserActivityPage,
    type UserLoginRecord,
    type UserOperationRecord
  } from '@/api/user-activity'

  defineOptions({ name: 'UserActivity' })

  const activeTab = ref('online')
  const loading = ref(false)
  const tableLoading = ref(false)
  const overview = ref<UserActivityOverview>({
    onlineUserCount: 0,
    onlineSessionCount: 0,
    todayLoginCount: 0,
    todayOperationCount: 0,
    onlineUsers: []
  })
  const loginPage = ref<UserActivityPage<UserLoginRecord>>({
    records: [],
    current: 1,
    size: 20,
    total: 0
  })
  const operationPage = ref<UserActivityPage<UserOperationRecord>>({
    records: [],
    current: 1,
    size: 20,
    total: 0
  })
  const loginQuery = reactive({ userName: '', status: '', current: 1, size: 20 })
  const operationQuery = reactive({ userName: '', module: '', current: 1, size: 20 })
  const summaryCards = computed(() => [
    { label: '在线用户', value: overview.value.onlineUserCount },
    { label: '在线会话', value: overview.value.onlineSessionCount },
    { label: '今日登录', value: overview.value.todayLoginCount },
    { label: '今日操作', value: overview.value.todayOperationCount }
  ])

  const formatSeconds = (seconds: number) => {
    const value = Math.max(0, Math.floor(seconds || 0))
    return `${Math.floor(value / 3600)}时${Math.floor((value % 3600) / 60)}分`
  }
  const loadTable = async () => {
    tableLoading.value = true
    try {
      if (activeTab.value === 'login') loginPage.value = await fetchUserLoginRecords(loginQuery)
      if (activeTab.value === 'operation')
        operationPage.value = await fetchUserOperationRecords(operationQuery)
    } finally {
      tableLoading.value = false
    }
  }
  const reload = async () => {
    loading.value = true
    try {
      overview.value = await fetchUserActivityOverview()
      await loadTable()
    } finally {
      loading.value = false
    }
  }
  const reloadPage = () => void loadTable()
  const search = () => {
    if (activeTab.value === 'login') loginQuery.current = 1
    if (activeTab.value === 'operation') operationQuery.current = 1
    void loadTable()
  }
  const changeLoginPage = (current: number) => {
    loginQuery.current = current
    void loadTable()
  }
  const changeOperationPage = (current: number) => {
    operationQuery.current = current
    void loadTable()
  }
  onMounted(() => void reload())
</script>

<style scoped>
  .user-activity-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
  }

  .summary-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 92px;
    padding: 18px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
  }

  .summary-card span {
    color: var(--el-text-color-secondary);
  }

  .summary-card strong {
    font-size: 26px;
    color: var(--el-color-primary);
  }

  .filters {
    display: flex;
    gap: 12px;
    margin-bottom: 14px;
  }

  .filters :deep(.el-input),
  .filters :deep(.el-select) {
    width: 180px;
  }

  .pagination {
    justify-content: flex-end;
    margin-top: 14px;
  }
</style>
