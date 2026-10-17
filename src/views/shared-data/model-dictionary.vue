<template>
  <section class="dictionary-page" v-loading="loading">
    <div class="toolbar"
      ><h2>共享模型与字段映射</h2
      ><div
        ><el-button @click="exportConfiguration">导出配置</el-button
        ><el-button v-if="canWrite" @click="fileInput?.click()">导入 CSV / XLSX</el-button></div
      ></div
    >
    <el-alert
      title="A/B 共用这套中文名称、单位和显示格式。原始编码和实际值不变；报警规则与状态优先级不在这里修改。"
      :closable="false"
    />
    <input
      ref="fileInput"
      type="file"
      accept=".csv,.xlsx,.xls"
      hidden
      @change="importConfiguration"
    />
    <el-tabs v-model="activeTab">
      <el-tab-pane label="模型名称" name="models">
        <el-button v-if="canWrite" class="add-button" @click="addModel">新增模型</el-button>
        <el-table :data="models" border>
          <el-table-column label="模型标识" min-width="180"
            ><template #default="{ row }"
              ><el-input
                v-model.trim="row.modelMark"
                :disabled="!canWrite || row.id > 0" /></template
          ></el-table-column>
          <el-table-column label="中文名称" min-width="200"
            ><template #default="{ row }"
              ><el-input v-model.trim="row.displayName" :disabled="!canWrite" /></template
          ></el-table-column>
          <el-table-column label="设备类别" width="150"
            ><template #default="{ row }"
              ><el-select v-model="row.equipmentType" :disabled="!canWrite"
                ><el-option
                  v-for="type in equipmentTypes"
                  :key="type"
                  :value="type" /></el-select></template
          ></el-table-column>
          <el-table-column label="启用" width="90"
            ><template #default="{ row }"
              ><el-switch v-model="row.enabled" :disabled="!canWrite" /></template
          ></el-table-column>
          <el-table-column v-if="canWrite" label="操作" width="100"
            ><template #default="{ row }"
              ><el-button link type="primary" @click="saveModel(row as ModelMapping)"
                >保存</el-button
              ></template
            ></el-table-column
          >
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="字段中文与格式" name="fields">
        <div class="toolbar">
          <el-select
            v-model="selectedModel"
            filterable
            allow-create
            placeholder="选择或输入模型标识"
            @change="loadFields"
          >
            <el-option
              v-for="model in models"
              :key="model.modelMark"
              :value="model.modelMark"
              :label="`${model.displayName} (${model.modelMark})`"
            />
          </el-select>
          <div
            ><el-button v-if="canWrite" :disabled="!selectedModel" @click="addField"
              >新增字段</el-button
            ><el-button
              v-if="canWrite"
              type="primary"
              :disabled="!selectedModel"
              @click="saveFields"
              >保存字段映射</el-button
            ></div
          >
        </div>
        <el-table :data="fields" border>
          <el-table-column label="完整字段路径" min-width="220"
            ><template #default="{ row }"
              ><el-input v-model.trim="row.sourcePath" :disabled="!canWrite" /></template
          ></el-table-column>
          <el-table-column label="中文名称" min-width="160"
            ><template #default="{ row }"
              ><el-input v-model.trim="row.displayName" :disabled="!canWrite" /></template
          ></el-table-column>
          <el-table-column label="类型" width="140"
            ><template #default="{ row }"
              ><el-select v-model="row.valueType" :disabled="!canWrite"
                ><el-option
                  v-for="type in valueTypes"
                  :key="type"
                  :value="type" /></el-select></template
          ></el-table-column>
          <el-table-column label="格式" width="160"
            ><template #default="{ row }"
              ><el-select v-model="row.formatType" :disabled="!canWrite"
                ><el-option
                  v-for="type in formatTypes"
                  :key="type"
                  :value="type" /></el-select></template
          ></el-table-column>
          <el-table-column label="单位" width="100"
            ><template #default="{ row }"
              ><el-input v-model.trim="row.unit" :disabled="!canWrite" /></template
          ></el-table-column>
          <el-table-column label="小数位" width="120"
            ><template #default="{ row }"
              ><el-input-number
                v-model="row.decimals"
                :min="0"
                :max="8"
                :disabled="!canWrite"
                controls-position="right"
                style="width: 95px" /></template
          ></el-table-column>
          <el-table-column label="值映射 JSON" min-width="220"
            ><template #default="{ row }"
              ><el-input
                v-model.trim="row.mappingJson"
                :disabled="!canWrite"
                placeholder='例如 {"1":"运行","2":"故障"}' /></template
          ></el-table-column>
          <el-table-column label="启用" width="90"
            ><template #default="{ row }"
              ><el-switch v-model="row.enabled" :disabled="!canWrite" /></template
          ></el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="历史字段管理" name="history" lazy>
        <FieldCatalogManager v-if="activeTab === 'history'" :initial-model="selectedModel" />
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<script setup lang="ts">
  import * as XLSX from 'xlsx'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { applicationRequest } from '@/utils/system-applications/client'
  import FieldCatalogManager from '@/components/business/historical-field-catalog/FieldCatalogManager.vue'

  interface ModelMapping {
    id: number
    modelMark: string
    displayName: string
    equipmentType: string
    enabled: boolean
    sort: number
  }
  interface FieldMapping {
    id: number
    sourcePath: string
    displayName: string
    valueType: string
    formatType: string
    unit?: string
    decimals?: number
    mappingJson?: string
    enabled: boolean
    sort: number
  }
  const equipmentTypes = ['Robot', 'Device', 'Machine', 'Inspection']
  const valueTypes = ['String', 'Number', 'Boolean', 'DateTime']
  const formatTypes = ['Direct', 'ValueMap', 'UnixMilliseconds']
  const loading = ref(false)
  const activeTab = ref('models')
  const canWrite = ref(false)
  const models = ref<ModelMapping[]>([])
  const fields = ref<FieldMapping[]>([])
  const selectedModel = ref('')
  const fileInput = ref<HTMLInputElement>()

  onMounted(async () => {
    loading.value = true
    try {
      const context = await applicationRequest<{
        platformAdministrator: boolean
        permissions: string[]
      }>('/api/system-applications/context')
      canWrite.value =
        context.platformAdministrator || context.permissions.includes('shared-dictionary.write')
      await loadModels()
    } catch (error) {
      ElMessage.error((error as Error).message)
    } finally {
      loading.value = false
    }
  })

  async function loadModels() {
    models.value = await applicationRequest<ModelMapping[]>('/api/shared-data/models')
  }

  async function loadFields() {
    try {
      fields.value = await applicationRequest<FieldMapping[]>(
        `/api/shared-data/fields?modelMark=${encodeURIComponent(selectedModel.value)}`
      )
    } catch (error) {
      ElMessage.error((error as Error).message)
    }
  }

  function addModel() {
    models.value.push({
      id: 0,
      modelMark: '',
      displayName: '',
      equipmentType: 'Device',
      enabled: true,
      sort: 0
    })
  }

  function addField() {
    fields.value.push({
      id: 0,
      sourcePath: '',
      displayName: '',
      valueType: 'String',
      formatType: 'Direct',
      enabled: true,
      sort: 0
    })
  }

  async function saveModel(row: ModelMapping) {
    try {
      await applicationRequest('/api/shared-data/models', row)
      await loadModels()
      ElMessage.success('共享模型名称已保存')
    } catch (error) {
      ElMessage.error((error as Error).message)
    }
  }

  async function saveFields() {
    try {
      await applicationRequest('/api/shared-data/fields', {
        modelMark: selectedModel.value,
        mappings: fields.value
      })
      await loadFields()
      ElMessage.success('共享字段映射已保存')
    } catch (error) {
      ElMessage.error((error as Error).message)
    }
  }

  async function exportConfiguration() {
    try {
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(models.value), 'models')
      const rows: (FieldMapping & { modelMark: string })[] = []
      for (const model of models.value.filter((item) => item.modelMark)) {
        const mappings = await applicationRequest<FieldMapping[]>(
          `/api/shared-data/fields?modelMark=${encodeURIComponent(model.modelMark)}`
        )
        rows.push(...mappings.map((item) => ({ ...item, modelMark: model.modelMark })))
      }
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'fields')
      XLSX.writeFile(workbook, '共享模型与字段映射.xlsx')
    } catch (error) {
      ElMessage.error((error as Error).message)
    }
  }

  async function importConfiguration(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('文件不能超过 10MB')
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const modelRows: ModelMapping[] = []
      const fieldRows: (FieldMapping & { modelMark: string })[] = []
      for (const name of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name])
        for (const row of rows) {
          if (!row.modelMark || !row.displayName)
            throw new Error('每行必须包含 modelMark 和 displayName')
          const normalized = {
            ...row,
            id: 0,
            enabled: !['false', '0'].includes(String(row.enabled ?? true).toLowerCase()),
            sort: Number(row.sort || 0)
          }
          if (row.sourcePath)
            fieldRows.push({
              valueType: 'String',
              formatType: 'Direct',
              ...normalized
            } as unknown as FieldMapping & { modelMark: string })
          else modelRows.push({ equipmentType: 'Device', ...normalized } as unknown as ModelMapping)
        }
      }
      await ElMessageBox.confirm(
        `导入 ${modelRows.length} 条模型、${fieldRows.length} 条字段。相同编码/路径更新，未出现在文件中的配置保留。此修改影响 A/B 两边。`,
        '确认共享配置导入',
        { type: 'warning' }
      )
      for (const row of modelRows) {
        row.id = models.value.find((item) => item.modelMark === row.modelMark)?.id || 0
        await applicationRequest('/api/shared-data/models', row)
      }
      const groups = new Map<string, (FieldMapping & { modelMark: string })[]>()
      for (const row of fieldRows)
        groups.set(row.modelMark, [...(groups.get(row.modelMark) || []), row])
      for (const [modelMark, rows] of groups) {
        const existing = await applicationRequest<FieldMapping[]>(
          `/api/shared-data/fields?modelMark=${encodeURIComponent(modelMark)}`
        )
        const merged = new Map(existing.map((item) => [item.sourcePath, item]))
        for (const row of rows)
          merged.set(row.sourcePath, { ...row, id: merged.get(row.sourcePath)?.id || 0 })
        await applicationRequest('/api/shared-data/fields', {
          modelMark,
          mappings: [...merged.values()]
        })
      }
      await loadModels()
      if (selectedModel.value) await loadFields()
      ElMessage.success('导入完成')
    } catch (error) {
      if (error !== 'cancel' && error !== 'close')
        ElMessage.error(`导入未全部完成，请检查配置后重试：${(error as Error).message}`)
    } finally {
      input.value = ''
    }
  }
</script>

<style scoped>
  .dictionary-page {
    padding: 20px;
  }
  .toolbar {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    margin: 16px 0;
    width: 100%;
    max-width: 1200px;
  }
  .add-button {
    margin: 16px 0;
  }
</style>
