<template>
  <el-button text :loading="loading" @click="openAccess">MCP 接入</el-button>
  <el-dialog v-model="visible" title="当前系统的 MCP 授权令牌" width="min(700px, 90vw)">
    <el-alert
      title="令牌只用于当前用户在当前系统中获准的工具和资源；统一会话过期、退出或撤权后失效。长期外部任务应使用独立客户端。"
      :closable="false"
    />
    <el-input v-model="token" type="textarea" :rows="5" readonly class="token-input" />
    <p>标准 Streamable HTTP：后端地址/mcp/v2</p>
    <p>请求头：Authorization: Bearer 上方令牌。请勿公开分享令牌。</p>
  </el-dialog>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { applicationRequest } from '@/utils/system-applications/client'

  const visible = ref(false)
  const loading = ref(false)
  const token = ref('')

  async function openAccess() {
    loading.value = true
    try {
      const result = await applicationRequest<{ token: string }>(
        '/api/system-applications/mcp-token',
        {}
      )
      token.value = result.token
      visible.value = true
    } catch (error) {
      ElMessage.error((error as Error).message)
    } finally {
      loading.value = false
    }
  }

  watch(visible, (value) => {
    if (!value) token.value = ''
  })
</script>

<style scoped>
  .token-input {
    margin: 18px 0;
  }
  p {
    margin: 12px 0;
    overflow-wrap: anywhere;
  }
</style>
