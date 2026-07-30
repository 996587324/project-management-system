<template>
  <div class="header-editor">
    <div v-if="model.length" class="header-row header-row-title">
      <span>请求头名称</span>
      <span>请求头值</span>
      <span>操作</span>
    </div>
    <div v-for="(header, index) in model" :key="header.id" class="header-row">
      <el-input v-model="header.name" placeholder="例如 Authorization" />
      <el-input
        v-model="header.value"
        type="password"
        show-password
        placeholder="例如 Bearer token"
      />
      <el-tooltip content="删除请求头" placement="top">
        <el-button
          text
          type="danger"
          :icon="Delete"
          aria-label="删除请求头"
          @click="model.splice(index, 1)"
        />
      </el-tooltip>
    </div>
    <el-button text type="primary" :icon="Plus" @click="addHeader">新增请求头</el-button>
  </div>
</template>

<script setup lang="ts">
  import { Delete, Plus } from '@element-plus/icons-vue'

  export type WebSocketHeaderEntry = {
    id: number
    name: string
    value: string
  }

  const model = defineModel<WebSocketHeaderEntry[]>({ required: true })
  let sequence = 0

  const addHeader = () => {
    model.value.push({ id: (sequence += 1), name: '', value: '' })
  }
</script>
