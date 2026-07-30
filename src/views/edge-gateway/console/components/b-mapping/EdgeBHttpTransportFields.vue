<template>
  <div class="form-grid mapping-endpoint-grid">
    <el-form-item label="请求方法" required>
      <el-select v-model="model.httpMethod">
        <el-option v-for="method in httpMethods" :key="method" :label="method" :value="method" />
      </el-select>
    </el-form-item>
    <el-form-item label="目标地址" required>
      <el-input v-model="model.targetUrl" placeholder="https://b-system.example.com/api/data" />
    </el-form-item>
  </div>

  <el-form-item label="请求头 JSON">
    <el-input
      v-model="model.headersJson"
      type="textarea"
      :rows="5"
      class="code-input"
      placeholder='{ "Authorization": "Bearer token" }'
    />
  </el-form-item>
</template>

<script setup lang="ts">
  import type { EdgeBMapping } from '@/api/edge-gateway'

  const model = defineModel<EdgeBMapping>({ required: true })
  const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
</script>
