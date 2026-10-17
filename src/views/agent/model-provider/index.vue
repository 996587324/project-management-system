<template>
  <div class="art-full-height provider-page">
    <AgentModelBindingPanel
      :bindings="bindings"
      :providers="providerOptions"
      :loading="bindingLoading"
      @saved="loadBindings"
    />

    <ElCard shadow="never" class="provider-list-card">
      <template #header>
        <div class="list-header">
          <div>
            <div class="section-title">统一模型平台配置</div>
            <div class="section-subtitle"
              >全系统 Agent 使用此处配置；请选择 Turing 或 DeepSeek，填写密钥后启用并设置 Agent
              绑定。</div
            >
          </div>
        </div>
      </template>

      <div class="toolbar">
        <ElInput
          v-model="query.keyword"
          clearable
          :prefix-icon="Search"
          placeholder="搜索平台名称、编码或模型"
          @keyup.enter="search"
          @clear="search"
        />
        <ElSelect v-model="query.enabled" placeholder="全部状态" clearable @change="search">
          <ElOption label="已启用" :value="true" />
          <ElOption label="已停用" :value="false" />
        </ElSelect>
        <ElButton :icon="Refresh" :loading="loading" @click="refreshAll">刷新</ElButton>
      </div>

      <ElTable v-loading="loading" :data="page.records" row-key="id" height="100%">
        <ElTableColumn prop="providerName" label="平台" min-width="170">
          <template #default="{ row }">
            <div class="primary-cell">
              <span>{{ row.providerName }}</span>
              <small>{{ row.providerCode }}</small>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="model" label="模型" min-width="150" show-overflow-tooltip />
        <ElTableColumn prop="baseUrl" label="Base URL" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ row.baseUrl }}{{ row.endpointPath }}</template>
        </ElTableColumn>
        <ElTableColumn prop="apiKeyMask" label="API Key" width="130">
          <template #default="{ row }">
            <ElTag :type="row.hasApiKey ? 'success' : 'danger'">
              {{ row.hasApiKey ? row.apiKeyMask : '未配置' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="超时" width="120">
          <template #default="{ row }"
            >{{ row.platformTimeoutSeconds }}s / {{ row.clientTimeoutSeconds }}s</template
          >
        </ElTableColumn>
        <ElTableColumn label="状态" width="90">
          <template #default="{ row }">
            <ElTag :type="row.enabled ? 'success' : 'warning'">
              {{ row.enabled ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <ElButton
              link
              :type="row.enabled ? 'warning' : 'success'"
              :icon="SwitchButton"
              :loading="togglingId === row.id"
              :disabled="!row.enabled && !row.hasApiKey"
              @click="toggleProvider(asProvider(row))"
            >
              {{ row.enabled ? '停用' : '启用' }}
            </ElButton>
            <ElButton
              link
              type="success"
              :icon="Connection"
              :loading="testingId === row.id"
              :disabled="!row.hasApiKey"
              @click="testProvider(asProvider(row))"
            >
              测试
            </ElButton>
            <ElButton link type="primary" :icon="Edit" @click="openEdit(asProvider(row))"
              >编辑</ElButton
            >
          </template>
        </ElTableColumn>
      </ElTable>

      <div class="pagination-row">
        <ElPagination
          v-model:current-page="page.current"
          v-model:page-size="page.size"
          :total="page.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadPage"
          @current-change="loadPage"
        />
      </div>
    </ElCard>

    <AgentModelProviderDialog
      v-model="dialogVisible"
      :provider="currentProvider"
      @saved="refreshAll"
    />
  </div>
</template>

<script setup lang="ts">
  import { Connection, Edit, Refresh, Search, SwitchButton } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchAgentModelBindings,
    fetchAgentModelProviderOptions,
    fetchAgentModelProviderPage,
    setAgentModelProviderEnabled,
    testAgentModelProvider,
    type AgentModelBinding,
    type AgentModelProvider,
    type AgentModelProviderPage
  } from '@/api/agent-model-provider'
  import AgentModelBindingPanel from './components/AgentModelBindingPanel.vue'
  import AgentModelProviderDialog from './components/AgentModelProviderDialog.vue'

  defineOptions({ name: 'AgentModelProvider' })

  const loading = ref(false)
  const bindingLoading = ref(false)
  const dialogVisible = ref(false)
  const testingId = ref<number>()
  const togglingId = ref<number>()
  const currentProvider = ref<AgentModelProvider>()
  const bindings = ref<AgentModelBinding[]>([])
  const providerOptions = ref<AgentModelProvider[]>([])
  const query = reactive<{ keyword: string; enabled?: boolean }>({
    keyword: '',
    enabled: undefined
  })
  const page = reactive<AgentModelProviderPage>({ records: [], current: 1, size: 20, total: 0 })

  const loadPage = async () => {
    loading.value = true
    try {
      const result = await fetchAgentModelProviderPage({
        current: page.current,
        size: page.size,
        keyword: query.keyword.trim() || undefined,
        enabled: query.enabled
      })
      Object.assign(page, result)
    } finally {
      loading.value = false
    }
  }

  const loadBindings = async () => {
    bindingLoading.value = true
    try {
      const [bindingData, options] = await Promise.all([
        fetchAgentModelBindings(),
        fetchAgentModelProviderOptions()
      ])
      bindings.value = bindingData
      providerOptions.value = options
    } finally {
      bindingLoading.value = false
    }
  }

  const refreshAll = async () => {
    await Promise.all([loadPage(), loadBindings()])
  }

  const search = () => {
    page.current = 1
    loadPage()
  }

  const openEdit = (provider: AgentModelProvider) => {
    currentProvider.value = provider
    dialogVisible.value = true
  }

  const asProvider = (row: unknown) => row as AgentModelProvider

  const testProvider = async (provider: AgentModelProvider) => {
    testingId.value = provider.id
    try {
      const result = await testAgentModelProvider(provider.id)
      const trace = result.traceId ? `，Trace ID：${result.traceId}` : ''
      ElMessage.success(`${result.message}，耗时 ${result.durationMs} ms${trace}`)
    } finally {
      testingId.value = undefined
    }
  }

  const toggleProvider = async (provider: AgentModelProvider) => {
    const enabled = !provider.enabled
    try {
      await ElMessageBox.confirm(
        enabled
          ? `确定启用模型平台「${provider.providerName}」吗？启用后 Agent 将可按绑定规则调用它。`
          : `确定停用模型平台「${provider.providerName}」吗？Agent 将不再调用它。`,
        enabled ? '启用模型平台' : '停用模型平台',
        {
          type: enabled ? 'success' : 'warning',
          confirmButtonText: enabled ? '启用' : '停用',
          cancelButtonText: '取消'
        }
      )
      togglingId.value = provider.id
      await setAgentModelProviderEnabled(provider.id, enabled)
      ElMessage.success(enabled ? '模型平台已启用' : '模型平台已停用')
      await refreshAll()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') throw error
    } finally {
      togglingId.value = undefined
    }
  }

  onMounted(refreshAll)
</script>

<style scoped>
  .provider-page {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .provider-list-card {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 420px;
  }

  :deep(.provider-list-card > .el-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .list-header,
  .toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .section-title {
    color: var(--art-gray-900);
    font-size: 16px;
    font-weight: 600;
  }

  .section-subtitle {
    margin-top: 4px;
    color: var(--art-gray-600);
    font-size: 13px;
  }

  .toolbar {
    justify-content: flex-start;
    margin-bottom: 14px;
  }

  .toolbar .el-input {
    width: min(340px, 42vw);
  }

  .toolbar .el-select {
    width: 130px;
  }

  .primary-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .primary-cell small {
    color: var(--art-gray-500);
  }

  .pagination-row {
    display: flex;
    justify-content: flex-end;
    padding-top: 14px;
  }

  @media (max-width: 760px) {
    .section-subtitle {
      display: none;
    }

    .toolbar {
      flex-wrap: wrap;
    }

    .toolbar .el-input {
      width: 100%;
    }

    .pagination-row {
      overflow-x: auto;
    }
  }
</style>
