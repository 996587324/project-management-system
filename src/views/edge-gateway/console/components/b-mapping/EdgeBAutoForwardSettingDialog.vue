<template>
  <el-dialog
    v-model="visible"
    title="自动转发设置"
    width="min(660px, 94vw)"
    class="edge-gateway-dialog"
  >
    <div v-loading="loading">
      <el-alert
        :title="
          form.enabled
            ? '中心后台正在按数据库设置自动转发，关闭前端不会停止'
            : '自动转发当前已停用，仍可在消息队列中手动转发'
        "
        :type="form.enabled ? 'success' : 'info'"
        :closable="false"
        show-icon
      />

      <el-form label-position="top" class="auto-forward-form">
        <div class="form-grid">
          <el-form-item label="启用自动转发">
            <el-switch v-model="form.enabled" />
          </el-form-item>
          <el-form-item label="扫描间隔">
            <el-input-number
              v-model="form.scanIntervalSeconds"
              :min="1"
              :max="300"
              :step="1"
              controls-position="right"
            />
            <span class="input-unit">秒</span>
          </el-form-item>
          <el-form-item label="每批处理数量">
            <el-input-number
              v-model="form.batchSize"
              :min="1"
              :max="500"
              :step="10"
              controls-position="right"
            />
            <span class="input-unit">条</span>
          </el-form-item>
        </div>
      </el-form>

      <el-divider content-position="left">最近运行状态</el-divider>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="最近扫描">
          {{ formatTime(form.lastRunTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近成功">
          {{ formatTime(form.lastSuccessTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="上一轮读取">
          {{ form.lastRequestedCount }} 条
        </el-descriptions-item>
        <el-descriptions-item label="上一轮结果">
          <span class="success-count">成功 {{ form.lastSuccessCount }}</span>
          <span v-if="form.lastFailedCount" class="failed-count">
            ，失败 {{ form.lastFailedCount }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="最近错误" :span="2">
          <span :class="{ 'failed-count': form.lastError }">{{ form.lastError || '无' }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <template #footer>
      <el-button :icon="Refresh" :loading="loading" @click="loadSetting">刷新状态</el-button>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存设置</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { Refresh } from '@element-plus/icons-vue'
  import {
    fetchEdgeBAutoForwardSetting,
    saveEdgeBAutoForwardSetting,
    type EdgeBAutoForwardSetting
  } from '@/api/edge-gateway'
  import { formatTime } from '../shared'

  const emit = defineEmits<{
    saved: [setting: EdgeBAutoForwardSetting]
  }>()

  const visible = defineModel<boolean>({ required: true })
  const loading = ref(false)
  const saving = ref(false)
  const form = reactive<EdgeBAutoForwardSetting>({
    enabled: false,
    scanIntervalSeconds: 5,
    batchSize: 100,
    lastRequestedCount: 0,
    lastSuccessCount: 0,
    lastFailedCount: 0
  })

  const loadSetting = async () => {
    loading.value = true
    try {
      Object.assign(form, await fetchEdgeBAutoForwardSetting())
    } finally {
      loading.value = false
    }
  }

  const submit = async () => {
    if (form.scanIntervalSeconds < 1 || form.scanIntervalSeconds > 300) {
      ElMessage.warning('扫描间隔必须在 1 到 300 秒之间')
      return
    }
    if (form.batchSize < 1 || form.batchSize > 500) {
      ElMessage.warning('每批处理数量必须在 1 到 500 条之间')
      return
    }

    saving.value = true
    try {
      const setting = await saveEdgeBAutoForwardSetting({
        enabled: form.enabled,
        scanIntervalSeconds: form.scanIntervalSeconds,
        batchSize: form.batchSize
      })
      Object.assign(form, setting)
      ElMessage.success('自动转发设置已保存')
      visible.value = false
      emit('saved', setting)
    } finally {
      saving.value = false
    }
  }

  watch(
    () => visible.value,
    (opened) => {
      if (opened) loadSetting()
    }
  )
</script>

<style scoped>
  .auto-forward-form {
    margin-top: 18px;
  }

  .auto-forward-form .form-grid {
    grid-template-columns: minmax(130px, 0.6fr) repeat(2, minmax(180px, 1fr));
  }

  .input-unit {
    margin-left: 8px;
    color: var(--el-text-color-secondary);
  }

  .success-count {
    color: var(--el-color-success);
  }

  .failed-count {
    color: var(--el-color-danger);
  }

  @media (width <= 680px) {
    .auto-forward-form .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
