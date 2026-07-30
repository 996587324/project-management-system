<template>
  <div>
    <div class="toolbar">
      <div class="filters">
        <el-select v-model="query.deviceId" clearable placeholder="全部设备" @change="loadRules">
          <el-option
            v-for="device in deviceOptions"
            :key="device.id"
            :label="device.deviceName"
            :value="device.id"
          />
        </el-select>
        <el-select v-model="query.ruleType" clearable placeholder="规则类型" @change="loadRules">
          <el-option
            v-for="type in ruleTypes"
            :key="type.value"
            :label="type.label"
            :value="type.value"
          />
        </el-select>
      </div>
      <div class="actions">
        <el-button @click="publish">
          <el-icon><Promotion /></el-icon>
          发布版本
        </el-button>
        <el-button type="primary" @click="openEditor()">
          <el-icon><Plus /></el-icon>
          新增规则
        </el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="rules.records" height="350" stripe>
      <el-table-column prop="priority" label="优先级" width="90" />
      <el-table-column prop="ruleCode" label="规则编码" min-width="150" />
      <el-table-column prop="ruleName" label="规则名称" min-width="180" />
      <el-table-column label="类型" width="130">
        <template #default="{ row }">{{ ruleTypeText(row.ruleType) }}</template>
      </el-table-column>
      <el-table-column label="范围" width="150">
        <template #default="{ row }">{{ deviceName(row.deviceId) }}</template>
      </el-table-column>
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">
            {{ row.enabled ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditor(row)">编辑</el-button>
          <el-button
            link
            @click="emit('show-json', { content: row.ruleJson, title: row.ruleName })"
          >
            JSON
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="subsection-title">
      <span>已发布版本</span>
      <el-button link type="primary" @click="loadVersions">刷新</el-button>
    </div>
    <el-table :data="versions" height="190" size="small">
      <el-table-column prop="version" label="版本" width="90">
        <template #default="{ row }">v{{ row.version }}</template>
      </el-table-column>
      <el-table-column label="范围" width="160">
        <template #default="{ row }">{{ deviceName(row.deviceId) }}</template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip />
      <el-table-column prop="publishedBy" label="发布人" width="120" />
      <el-table-column label="发布时间" width="170">
        <template #default="{ row }">{{ formatTime(row.publishTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="130">
        <template #default="{ row }">
          <el-button
            link
            @click="
              emit('show-json', {
                content: row.snapshotJson,
                title: `规则版本 v${row.version}`
              })
            "
          >
            查看
          </el-button>
          <el-button link type="warning" @click="rollback(row)">回滚</el-button>
        </template>
      </el-table-column>
    </el-table>

    <EdgeRuleEditorDialog
      v-model="editorVisible"
      :source-rule="editingRule"
      :devices="deviceOptions"
      @saved="loadRules"
    />
  </div>
</template>

<script setup lang="ts">
  import { reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus, Promotion } from '@element-plus/icons-vue'
  import {
    fetchEdgeRules,
    fetchEdgeRuleVersions,
    publishEdgeRules,
    rollbackEdgeRules,
    type EdgeDevice,
    type EdgeRule,
    type EdgeRuleVersion
  } from '@/api/edge-gateway'
  import {
    emptyPage,
    fetchDeviceOptions,
    formatTime,
    getDeviceName,
    type JsonDialogPayload
  } from './shared'
  import EdgeRuleEditorDialog from './rules/EdgeRuleEditorDialog.vue'
  import { ruleTypes, ruleTypeText } from './rules/ruleDefinitions'

  const emit = defineEmits<{
    'show-json': [payload: JsonDialogPayload]
  }>()

  const rules = reactive(emptyPage<EdgeRule>())
  const versions = ref<EdgeRuleVersion[]>([])
  const deviceOptions = ref<EdgeDevice[]>([])
  const query = reactive({
    current: 1,
    size: 100,
    deviceId: undefined as number | undefined,
    ruleType: ''
  })
  const loading = ref(false)
  const editorVisible = ref(false)
  const editingRule = ref<EdgeRule>()

  const loadVersions = async () => {
    versions.value = await fetchEdgeRuleVersions(query.deviceId)
  }

  const loadRules = async () => {
    loading.value = true
    try {
      Object.assign(rules, await fetchEdgeRules(query))
      await loadVersions()
    } finally {
      loading.value = false
    }
  }

  const refresh = async () => {
    const [, devices] = await Promise.all([loadRules(), fetchDeviceOptions()])
    deviceOptions.value = devices
  }

  const deviceName = (deviceId?: number) => getDeviceName(deviceOptions.value, deviceId)

  const openEditor = (row?: EdgeRule) => {
    editingRule.value = row
    editorVisible.value = true
  }

  const publish = async () => {
    await publishEdgeRules({ deviceId: query.deviceId, remark: '运行中心发布' })
    ElMessage.success('规则版本已发布')
    await loadVersions()
  }

  const rollback = async (row: EdgeRuleVersion) => {
    await ElMessageBox.confirm(
      `确认回滚到规则版本 v${row.version}？系统会生成一个新的发布版本。`,
      '规则回滚',
      { type: 'warning' }
    )
    await rollbackEdgeRules(row.id)
    ElMessage.success(`已回滚到 v${row.version}`)
    await loadVersions()
  }

  defineExpose({ refresh })
</script>
