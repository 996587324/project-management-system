<template>
  <el-button text @click="visible = true">MCP 接入</el-button>
  <el-dialog v-model="visible" title="MCP 免认证直连接入" width="min(700px, 90vw)">
    <el-alert
      type="warning"
      title="仅供受控内网使用：无需令牌，可访问全部已开放工具和资源，不按用户或 A/B 系统授权过滤。"
      :closable="false"
    />
    <p>连接类型：Streamable HTTP</p>
    <p>服务地址：后端实际访问地址/mcp/v2（使用后端端口，不是前端页面端口）。</p>
    <p>认证方式：无。无需 ClientId、ClientSecret 或 Authorization 请求头。</p>
    <p>写操作仍需提供明确业务参数和 confirm: true，并记录审计。后台管理页面仍需登录。</p>
  </el-dialog>
</template>

<script setup lang="ts">
  const visible = ref(false)
</script>

<style scoped>
  p {
    margin: 12px 0;
    overflow-wrap: anywhere;
  }
</style>
