<template>
  <div class="b-mapping-panel">
    <div class="toolbar b-mapping-toolbar">
      <div class="filters b-mapping-filters">
        <el-input
          v-model="query.keyword"
          clearable
          placeholder="名称 / 数据源 / 子设备 / 目标地址"
          @keyup.enter="searchMappings"
          @clear="searchMappings"
        />
        <el-select
          v-model="query.deviceId"
          clearable
          placeholder="全部设备"
          @change="searchMappings"
        >
          <el-option
            v-for="device in deviceOptions"
            :key="device.id"
            :label="device.deviceName"
            :value="device.id"
          />
        </el-select>
        <el-select
          v-model="query.protocol"
          clearable
          placeholder="全部协议"
          @change="searchMappings"
        >
          <el-option label="HTTP" value="HTTP" />
          <el-option label="MQTT" value="MQTT" />
        </el-select>
        <el-select
          v-model="query.enabled"
          clearable
          placeholder="全部状态"
          @change="searchMappings"
        >
          <el-option label="启用" :value="true" />
          <el-option label="停用" :value="false" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="searchMappings">查询</el-button>
        <el-button :icon="RefreshLeft" @click="resetFilters">重置</el-button>
      </div>

      <div class="actions b-mapping-actions">
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
    </div>

    <el-table
      v-loading="loading"
      :data="mappings.records"
      height="470"
      stripe
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="46" />
      <el-table-column prop="mappingName" label="映射名称" min-width="180" />
      <el-table-column label="适用范围" min-width="250" show-overflow-tooltip>
        <template #default="{ row }">{{ mappingScope(asMapping(row)) }}</template>
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
          <el-button link type="primary" @click="openDialog(asMapping(row))">编辑</el-button>
          <el-button
            link
            @click="emit('show-json', { content: row.mappingJson, title: row.mappingName })"
          >
            映射
          </el-button>
          <el-button link type="danger" @click="removeMappings([asMapping(row)])">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-row">
      <el-pagination
        v-model:current-page="query.current"
        v-model:page-size="query.size"
        :page-sizes="[10, 20, 50, 100]"
        :total="mappings.total"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="loadMappings"
        @size-change="handleSizeChange"
      />
    </div>

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
  import { reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Delete, Files, Plus, RefreshLeft, Search, Setting } from '@element-plus/icons-vue'
  import {
    deleteEdgeBMappings,
    fetchEdgeBAutoForwardSetting,
    fetchEdgeBMappingPage,
    fetchEdgeBPayloadTemplates,
    type EdgeBAutoForwardSetting,
    type EdgeBMapping,
    type EdgeBTransportProtocol,
    type EdgeBPayloadTemplate,
    type EdgeDevice
  } from '@/api/edge-gateway'
  import EdgeBAutoForwardSettingDialog from './b-mapping/EdgeBAutoForwardSettingDialog.vue'
  import EdgeBMappingDialog from './b-mapping/EdgeBMappingDialog.vue'
  import EdgeBTemplateManagerDialog from './b-mapping/EdgeBTemplateManagerDialog.vue'
  import { emptyPage, fetchDeviceOptions, getDeviceName, type JsonDialogPayload } from './shared'

  const emit = defineEmits<{
    'show-json': [payload: JsonDialogPayload]
  }>()

  const mappings = reactive(emptyPage<EdgeBMapping>())
  const asMapping = (row: unknown) => row as EdgeBMapping
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
  const query = reactive({
    current: 1,
    size: 20,
    keyword: '',
    deviceId: undefined as number | undefined,
    protocol: undefined as EdgeBTransportProtocol | undefined,
    enabled: undefined as boolean | undefined
  })

  const loadMappings = async () => {
    loading.value = true
    try {
      Object.assign(mappings, await fetchEdgeBMappingPage(query))
      selectedMappings.value = []
    } finally {
      loading.value = false
    }
  }

  const searchMappings = () => {
    query.current = 1
    return loadMappings()
  }

  const resetFilters = () => {
    Object.assign(query, {
      current: 1,
      keyword: '',
      deviceId: undefined,
      protocol: undefined,
      enabled: undefined
    })
    return loadMappings()
  }

  const handleSizeChange = () => {
    query.current = 1
    return loadMappings()
  }

  const handleSelectionChange = (rows: EdgeBMapping[]) => {
    selectedMappings.value = rows
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
      if (mappings.records.length === 0 && query.current > 1) {
        query.current -= 1
        await loadMappings()
      }
    } finally {
      deleteLoading.value = false
    }
  }

  defineExpose({ refresh })
</script>

<style lang="scss" scoped>
  .b-mapping-toolbar {
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .b-mapping-filters,
  .b-mapping-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .b-mapping-filters {
    flex: 1 1 620px;
  }

  .b-mapping-filters :deep(.el-input) {
    width: min(320px, 100%);
  }

  .b-mapping-filters :deep(.el-select) {
    width: 140px;
  }

  .b-mapping-actions {
    flex: 0 1 auto;
    justify-content: flex-end;
  }

  @media (width <= 1200px) {
    .b-mapping-toolbar {
      flex-direction: column;
    }

    .b-mapping-filters,
    .b-mapping-actions {
      flex-basis: auto;
      justify-content: flex-start;
      width: 100%;
    }
  }
</style>
