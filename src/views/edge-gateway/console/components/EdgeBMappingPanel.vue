<template>
  <div>
    <div class="toolbar toolbar-end">
      <el-tag :type="autoForwardSetting?.enabled ? 'success' : 'info'" effect="plain">
        自动转发：{{ autoForwardSetting?.enabled ? '已启用' : '已停用' }}
      </el-tag>
      <el-button
        type="danger"
        :icon="Delete"
        :disabled="selectedMappings.length === 0"
        :loading="deleteLoading"
        @click="removeMappings(selectedMappings)"
      >
        批量删除
      </el-button>
      <el-button :icon="Setting" @click="autoForwardDialogVisible = true">自动转发设置</el-button>
      <el-button :icon="Files" @click="templateManagerVisible = true">模板管理</el-button>
      <el-button type="primary" :icon="Plus" @click="openDialog()">新增映射</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="mappings"
      height="520"
      stripe
      @selection-change="selectedMappings = $event"
    >
      <el-table-column type="selection" width="46" />
      <el-table-column prop="mappingName" label="映射名称" min-width="180" />
      <el-table-column label="适用范围" min-width="250" show-overflow-tooltip>
        <template #default="{ row }">{{ mappingScope(row) }}</template>
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
      <el-table-column label="操作" width="190" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button
            link
            @click="emit('show-json', { content: row.mappingJson, title: row.mappingName })"
          >
            映射
          </el-button>
          <el-button link type="danger" @click="removeMappings([row])">删除</el-button>
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
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Delete, Files, Plus, Setting } from '@element-plus/icons-vue'
  import {
    deleteEdgeBMappings,
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
  const selectedMappings = ref<EdgeBMapping[]>([])
  const deleteLoading = ref(false)

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

  const mappingScope = (mapping: EdgeBMapping) => {
    if (mapping.sourceDeviceCode) {
      return `${deviceName(mapping.deviceId)} / ${mapping.sourceId} / ${mapping.sourceDeviceCode}`
    }
    return mapping.deviceId ? `${deviceName(mapping.deviceId)} / 节点默认` : '全局默认'
  }

  const openDialog = (row?: EdgeBMapping) => {
    editingMapping.value = row
    dialogVisible.value = true
  }

  const removeMappings = async (rows: EdgeBMapping[]) => {
    if (rows.length === 0) return
    const countText = rows.length === 1 ? `映射“${rows[0].mappingName}”` : `${rows.length} 条映射`
    try {
      await ElMessageBox.confirm(
        `确定删除${countText}吗？删除后该范围的数据将不再按此配置转发。`,
        '删除 B 系统映射',
        {
          type: 'warning',
          confirmButtonText: '删除',
          cancelButtonText: '取消'
        }
      )
    } catch {
      return
    }

    deleteLoading.value = true
    try {
      const count = await deleteEdgeBMappings(rows.map((item) => item.id))
      ElMessage.success(`已删除 ${count} 条 B 系统映射`)
      selectedMappings.value = []
      await loadMappings()
    } finally {
      deleteLoading.value = false
    }
  }

  defineExpose({ refresh })
</script>
