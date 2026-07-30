<template>
  <div>
    <div class="toolbar">
      <div class="filters">
        <el-select
          v-model="selectedDeviceId"
          filterable
          placeholder="选择设备"
          class="device-select"
          @change="loadConfigs"
        >
          <el-option
            v-for="device in deviceOptions"
            :key="device.id"
            :label="`${device.deviceName} (${device.deviceCode})`"
            :value="device.id"
          />
        </el-select>
      </div>
      <div class="actions">
        <el-button :disabled="!selectedDeviceId" @click="viewCollectedData">
          <el-icon><View /></el-icon>
          查看采集数据
        </el-button>
        <el-button type="primary" :disabled="!selectedDeviceId" @click="openEditor()">
          <el-icon><Plus /></el-icon>
          新建配置版本
        </el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="configs" height="520" stripe>
      <el-table-column prop="version" label="版本" width="90">
        <template #default="{ row }">v{{ row.version }}</template>
      </el-table-column>
      <el-table-column prop="configName" label="配置名称" min-width="220" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.isPublished ? 'success' : 'info'" effect="plain">
            {{ row.isPublished ? '已发布' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdBy" label="创建人" width="120" />
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column label="发布时间" width="170">
        <template #default="{ row }">{{ formatTime(row.publishTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            @click="emit('show-json', { content: row.configJson, title: row.configName })"
          >
            查看
          </el-button>
          <el-button link @click="openEditor(row)">复制新建</el-button>
          <el-button v-if="!row.isPublished" link type="success" @click="publish(row)">
            发布
          </el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <EdgeConfigEditorDialog
      v-model="editorVisible"
      :device-id="selectedDeviceId"
      :source-config="editingConfig"
      :historical-configs="configs"
      @saved="loadConfigs"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus, View } from '@element-plus/icons-vue'
  import {
    deleteDeviceConfig,
    fetchDeviceConfigs,
    publishDeviceConfig,
    type EdgeDevice,
    type EdgeDeviceConfig
  } from '@/api/edge-gateway'
  import EdgeConfigEditorDialog from './config/EdgeConfigEditorDialog.vue'
  import { fetchDeviceOptions, formatTime, type JsonDialogPayload } from './shared'

  const emit = defineEmits<{
    'show-json': [payload: JsonDialogPayload]
    'view-data': [deviceCode: string]
  }>()

  const configs = ref<EdgeDeviceConfig[]>([])
  const deviceOptions = ref<EdgeDevice[]>([])
  const selectedDeviceId = ref<number>()
  const loading = ref(false)
  const editorVisible = ref(false)
  const editingConfig = ref<EdgeDeviceConfig>()

  const loadOptions = async () => {
    deviceOptions.value = await fetchDeviceOptions()
    if (!selectedDeviceId.value && deviceOptions.value.length) {
      selectedDeviceId.value = deviceOptions.value[0].id
    }
  }

  const loadConfigs = async () => {
    if (!selectedDeviceId.value) {
      configs.value = []
      return
    }

    loading.value = true
    try {
      configs.value = await fetchDeviceConfigs(selectedDeviceId.value)
    } finally {
      loading.value = false
    }
  }

  const refresh = async () => {
    await loadOptions()
    await loadConfigs()
  }

  const openEditor = (sourceConfig?: EdgeDeviceConfig) => {
    editingConfig.value = sourceConfig
    editorVisible.value = true
  }

  const viewCollectedData = () => {
    const device = deviceOptions.value.find((item) => item.id === selectedDeviceId.value)
    if (device) emit('view-data', device.deviceCode)
  }

  const publish = async (row: EdgeDeviceConfig) => {
    await publishDeviceConfig(row.id)
    ElMessage.success(`配置 v${row.version} 已发布`)
    await loadConfigs()
  }

  const remove = async (row: EdgeDeviceConfig) => {
    if (row.isPublished) {
      ElMessage.warning('当前生效的配置不能删除，请先复制新建并发布更高版本')
      return
    }

    await ElMessageBox.confirm(
      `确定删除配置“${row.configName}”v${row.version}吗？历史发布快照不会删除。`,
      '删除采集配置',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )
    await deleteDeviceConfig(row.id)
    ElMessage.success('采集配置已删除')
    await loadConfigs()
  }

  defineExpose({ refresh })
</script>
