<template>
  <div>
    <div class="toolbar toolbar-end">
      <el-tag :type="autoForwardSetting?.enabled ? 'success' : 'info'" effect="plain">
        自动转发：{{ autoForwardSetting?.enabled ? '已启用' : '已停用' }}
      </el-tag>
      <el-button :icon="Setting" @click="autoForwardDialogVisible = true">自动转发设置</el-button>
      <el-button :icon="Files" @click="templateManagerVisible = true">模板管理</el-button>
      <el-button type="primary" :icon="Plus" @click="openDialog()">新增映射</el-button>
    </div>

    <el-table v-loading="loading" :data="mappings" height="520" stripe>
      <el-table-column prop="mappingName" label="映射名称" min-width="180" />
      <el-table-column label="适用范围" width="170">
        <template #default="{ row }">{{ deviceName(row.deviceId) }}</template>
      </el-table-column>
      <el-table-column label="报文模板" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.payloadTemplateName || '自定义结构' }}</template>
      </el-table-column>
      <el-table-column label="协议" width="90">
        <template #default="{ row }">
          <el-tag :type="row.protocol === 'MQTT' ? 'warning' : 'primary'" effect="plain">
            {{ row.protocol }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="投递方式" width="120">
        <template #default="{ row }">
          {{ row.protocol === 'MQTT' ? `QoS ${row.mqttQosLevel}` : row.httpMethod }}
        </template>
      </el-table-column>
      <el-table-column label="目标" min-width="280" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.protocol === 'MQTT' ? `${row.targetUrl} / ${row.mqttTopic}` : row.targetUrl }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">
            {{ row.enabled ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button
            link
            @click="emit('show-json', { content: row.mappingJson, title: row.mappingName })"
          >
            映射
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <EdgeBMappingDialog
      v-model="dialogVisible"
      :mapping="editingMapping"
      :device-options="deviceOptions"
      :templates="templates"
      @saved="loadMappings"
      @templates-changed="loadTemplates"
    />

    <EdgeBTemplateManagerDialog
      v-model="templateManagerVisible"
      :templates="templates"
      @changed="loadTemplates"
      @show-json="emit('show-json', $event)"
    />

    <EdgeBAutoForwardSettingDialog
      v-model="autoForwardDialogVisible"
      @saved="autoForwardSetting = $event"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { Files, Plus, Setting } from '@element-plus/icons-vue'
  import {
    fetchEdgeBAutoForwardSetting,
    fetchEdgeBMappings,
    fetchEdgeBPayloadTemplates,
    type EdgeBAutoForwardSetting,
    type EdgeBMapping,
    type EdgeBPayloadTemplate,
    type EdgeDevice
  } from '@/api/edge-gateway'
  import EdgeBAutoForwardSettingDialog from './b-mapping/EdgeBAutoForwardSettingDialog.vue'
  import EdgeBMappingDialog from './b-mapping/EdgeBMappingDialog.vue'
  import EdgeBTemplateManagerDialog from './b-mapping/EdgeBTemplateManagerDialog.vue'
  import { fetchDeviceOptions, getDeviceName, type JsonDialogPayload } from './shared'

  const emit = defineEmits<{
    'show-json': [payload: JsonDialogPayload]
  }>()

  const mappings = ref<EdgeBMapping[]>([])
  const templates = ref<EdgeBPayloadTemplate[]>([])
  const autoForwardSetting = ref<EdgeBAutoForwardSetting>()
  const deviceOptions = ref<EdgeDevice[]>([])
  const loading = ref(false)
  const dialogVisible = ref(false)
  const templateManagerVisible = ref(false)
  const autoForwardDialogVisible = ref(false)
  const editingMapping = ref<EdgeBMapping>()

  const loadMappings = async () => {
    loading.value = true
    try {
      mappings.value = await fetchEdgeBMappings()
    } finally {
      loading.value = false
    }
  }

  const loadTemplates = async () => {
    templates.value = await fetchEdgeBPayloadTemplates()
  }

  const loadAutoForwardSetting = async () => {
    autoForwardSetting.value = await fetchEdgeBAutoForwardSetting()
  }

  const refresh = async () => {
    const [, , , devices] = await Promise.all([
      loadMappings(),
      loadTemplates(),
      loadAutoForwardSetting(),
      fetchDeviceOptions()
    ])
    deviceOptions.value = devices
  }

  const deviceName = (deviceId?: number) => getDeviceName(deviceOptions.value, deviceId)

  const openDialog = (row?: EdgeBMapping) => {
    editingMapping.value = row
    dialogVisible.value = true
  }

  defineExpose({ refresh })
</script>
