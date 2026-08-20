<template>
  <section class="paged-subscription-editor">
    <div class="editor-heading">
      <div>
        <strong>订阅设备与参数</strong>
        <span>{{ model.length }} 台设备，{{ parameterCount }} 个参数</span>
      </div>
      <div class="heading-actions">
        <el-button :icon="View" @click="openPreview">查看订阅 JSON</el-button>
        <el-button type="primary" plain :icon="Plus" @click="addDevice">新增设备</el-button>
      </div>
    </div>

    <el-alert
      title="已启用分页编辑模式"
      description="设备和参数只渲染当前页，编辑与保存仍覆盖完整订阅配置。"
      type="info"
      show-icon
      :closable="false"
    />

    <el-table
      :data="pagedDevices"
      height="330"
      stripe
      highlight-current-row
      @row-click="selectDevice"
    >
      <el-table-column label="序号" width="70" align="right">
        <template #default="{ $index }">{{ devicePageOffset + $index + 1 }}</template>
      </el-table-column>
      <el-table-column prop="deviceCode" label="设备代码" min-width="230" show-overflow-tooltip />
      <el-table-column prop="deviceName" label="设备名称" min-width="180" show-overflow-tooltip />
      <el-table-column label="参数" width="90" align="right">
        <template #default="{ row }">{{ row.parameters.length }} 项</template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">
            {{ row.enabled ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" align="center">
        <template #default="{ row, $index }">
          <el-button link type="primary" @click.stop="selectDevice(row)">编辑</el-button>
          <el-button link type="danger" @click.stop="removeDevice(devicePageOffset + $index)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="devicePage"
      v-model:page-size="devicePageSize"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next, jumper"
      :total="model.length"
      @current-change="selectFirstDeviceOnPage"
      @size-change="selectFirstDeviceOnPage"
    />

    <div v-if="selectedDevice" class="selected-device-heading">
      <strong
        >正在编辑：{{ selectedDevice.deviceCode || `第 ${selectedDeviceIndex + 1} 台设备` }}</strong
      >
      <span>修改会保留在当前完整订阅配置中</span>
    </div>
    <EdgeWebSocketParameterPageEditor v-if="selectedDevice" v-model="selectedDevice" />

    <el-drawer v-model="previewVisible" title="订阅 JSON" size="min(720px, 92vw)" append-to-body>
      <pre class="payload-preview">{{ previewPayload }}</pre>
      <template #footer>
        <el-button :icon="DocumentCopy" @click="copyPayload">复制 JSON</el-button>
      </template>
    </el-drawer>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { DocumentCopy, Plus, View } from '@element-plus/icons-vue'
  import type { EdgeWebSocketSubscriptionDevice } from '@/api/edge-gateway'
  import EdgeWebSocketParameterPageEditor from './EdgeWebSocketParameterPageEditor.vue'
  import {
    buildSubscriptionPayload,
    countSubscriptionParameters,
    createSubscriptionDevice,
    validateSubscriptions
  } from './subscriptionEditorUtils'

  const model = defineModel<EdgeWebSocketSubscriptionDevice[]>({ required: true })
  const devicePage = ref(1)
  const devicePageSize = ref(20)
  const selectedDeviceIndex = ref(0)
  const previewVisible = ref(false)
  const previewPayload = ref('')

  const parameterCount = computed(() => countSubscriptionParameters(model.value))
  const devicePageOffset = computed(() => (devicePage.value - 1) * devicePageSize.value)
  const pagedDevices = computed(() =>
    model.value.slice(devicePageOffset.value, devicePageOffset.value + devicePageSize.value)
  )
  const selectedDevice = computed<EdgeWebSocketSubscriptionDevice | undefined>({
    get: () => model.value[selectedDeviceIndex.value],
    set: (value) => {
      if (value) model.value[selectedDeviceIndex.value] = value
    }
  })

  const selectDevice = (device: EdgeWebSocketSubscriptionDevice) => {
    const index = model.value.indexOf(device)
    if (index >= 0) selectedDeviceIndex.value = index
  }

  const selectFirstDeviceOnPage = () => {
    const maxPage = Math.max(1, Math.ceil(model.value.length / devicePageSize.value))
    if (devicePage.value > maxPage) devicePage.value = maxPage
    selectedDeviceIndex.value = Math.min(
      devicePageOffset.value,
      Math.max(0, model.value.length - 1)
    )
  }

  const addDevice = () => {
    model.value.push(createSubscriptionDevice())
    devicePage.value = Math.ceil(model.value.length / devicePageSize.value)
    selectedDeviceIndex.value = model.value.length - 1
  }

  const removeDevice = (index: number) => {
    model.value.splice(index, 1)
    selectFirstDeviceOnPage()
  }

  const openPreview = () => {
    previewPayload.value = buildSubscriptionPayload(model.value)
    previewVisible.value = true
  }

  const copyPayload = async () => {
    await navigator.clipboard.writeText(previewPayload.value)
    ElMessage.success('订阅 JSON 已复制')
  }

  const validate = () => {
    const error = validateSubscriptions(model.value)
    if (error) ElMessage.warning(error)
    return !error
  }

  defineExpose({ validate })
</script>

<style scoped lang="scss">
  .paged-subscription-editor {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .editor-heading,
  .editor-heading > div,
  .heading-actions,
  .selected-device-heading {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .editor-heading {
    justify-content: space-between;
  }

  .editor-heading span,
  .selected-device-heading span {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .selected-device-heading {
    padding-top: 8px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .el-pagination {
    justify-content: flex-end;
  }

  .payload-preview {
    min-height: 100%;
    padding: 14px;
    margin: 0;
    overflow: auto;
    font-family: Consolas, 'Courier New', monospace;
    line-height: 1.6;
    white-space: pre-wrap;
    background: var(--el-fill-color-light);
  }

  @media (width <= 720px) {
    .editor-heading,
    .selected-device-heading {
      flex-direction: column;
      align-items: flex-start;
    }

    .heading-actions {
      flex-wrap: wrap;
    }

    .el-pagination {
      justify-content: flex-start;
      overflow-x: auto;
    }
  }
</style>
