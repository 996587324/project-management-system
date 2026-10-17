<template>
  <main v-loading="loading">
    <el-card
      ><h2>数据工作台</h2><p>共享接收数据和中文映射，只展示当前账号在 B 中授权的数据源。</p
      ><el-button @click="refresh">刷新数据</el-button
      ><el-button @click="createMcpToken">获取当前授权的 MCP 接入令牌</el-button></el-card
    >
    <el-card class="source-card">
      <el-input
        v-model="keyword"
        placeholder="按设备标识或模型搜索"
        clearable
        @keyup.enter="refresh"
      />
      <el-table :data="sources" @row-dblclick="showFields">
        <el-table-column prop="modelDisplayName" label="模型名称" />
        <el-table-column prop="deviceMark" label="设备标识" />
        <el-table-column prop="tenantMark" label="租户" />
        <el-table-column prop="receiveTime" label="最近接收时间" />
        <el-table-column label="操作"
          ><template #default="{ row }"
            ><el-button link @click="showFields(row as Source)">查看最新字段值</el-button></template
          ></el-table-column
        >
      </el-table>
      <el-empty v-if="!sources.length" description="没有已授权数据源，或这些设备尚未接收到数据" />
    </el-card>
    <el-dialog v-model="detailVisible" title="设备字段最后实际值" width="85%">
      <el-table :data="fields"
        ><el-table-column prop="fieldName" label="中文名称" /><el-table-column
          prop="sourcePath"
          label="原始字段路径" /><el-table-column label="原始实际值"
          ><template #default="{ row }">{{
            renderValue(row.currentValue)
          }}</template></el-table-column
        ><el-table-column label="共享映射展示值"
          ><template #default="{ row }">{{
            renderValue(row.displayValue)
          }}</template></el-table-column
        ><el-table-column prop="unit" label="单位"
      /></el-table>
    </el-dialog>
    <el-dialog v-model="mcpVisible" title="MCP V2 接入" width="700px">
      <el-alert
        title="该令牌属于当前用户的 B 授权，退出或撤销授权会立即失效；不适合长期后台计划任务。不要发送给未授权人员。"
        :closable="false"
      />
      <el-input v-model="mcpToken" type="textarea" :rows="5" readonly />
      <p>接口：/mcp/v2；请求头：Authorization: Bearer 上方令牌。</p>
    </el-dialog>
  </main>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { applicationRequest } from '@/utils/system-applications/client'

  interface Source {
    tenantMark: string
    deviceMark: string
    modelDisplayName: string
    receiveTime: string
  }
  interface Field {
    fieldName: string
    sourcePath: string
    currentValue: unknown
    displayValue: unknown
    unit: string
  }
  const loading = ref(false)
  const keyword = ref('')
  const sources = ref<Source[]>([])
  const fields = ref<Field[]>([])
  const detailVisible = ref(false)
  const mcpVisible = ref(false)
  const mcpToken = ref('')
  onMounted(refresh)

  function renderValue(value: unknown) {
    if (value === null || value === undefined) return '暂无实际值'
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }

  async function refresh() {
    loading.value = true
    try {
      sources.value = await applicationRequest<Source[]>(
        `/api/shared-data/sources?keyword=${encodeURIComponent(keyword.value)}`
      )
    } catch (error) {
      ElMessage.error((error as Error).message)
    } finally {
      loading.value = false
    }
  }

  async function showFields(source: Source) {
    try {
      fields.value = await applicationRequest<Field[]>(
        `/api/shared-data/source-fields?tenantMark=${encodeURIComponent(source.tenantMark)}&deviceMark=${encodeURIComponent(source.deviceMark)}`
      )
      detailVisible.value = true
    } catch (error) {
      ElMessage.error((error as Error).message)
    }
  }

  async function createMcpToken() {
    try {
      const result = await applicationRequest<{ token: string }>(
        '/api/system-applications/mcp-token',
        {}
      )
      mcpToken.value = result.token
      mcpVisible.value = true
    } catch (error) {
      ElMessage.error((error as Error).message)
    }
  }
</script>

<style scoped>
  .source-card {
    margin-top: 20px;
  }
  h2 {
    margin-bottom: 12px;
  }
  p {
    color: var(--el-text-color-secondary);
  }
</style>
