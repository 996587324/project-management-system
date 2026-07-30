<template>
  <el-dialog
    v-model="visible"
    title="报文模板管理"
    width="min(980px, 96vw)"
    class="edge-gateway-dialog"
  >
    <div class="template-toolbar">
      <el-button type="primary" :icon="Plus" @click="openEditor()">新增模板</el-button>
    </div>

    <el-table :data="templates" height="500" stripe>
      <el-table-column prop="templateCode" label="模板编码" min-width="180" show-overflow-tooltip />
      <el-table-column prop="templateName" label="模板名称" min-width="180" />
      <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">
            {{ row.enabled ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="184" fixed="right">
        <template #default="{ row }">
          <el-tooltip content="查看 JSON" placement="top">
            <el-button text :icon="View" aria-label="查看 JSON" @click="showTemplateJson(row)" />
          </el-tooltip>
          <el-tooltip content="编辑模板" placement="top">
            <el-button text :icon="Edit" aria-label="编辑模板" @click="openEditor(row)" />
          </el-tooltip>
          <el-tooltip content="复制模板" placement="top">
            <el-button
              text
              :icon="CopyDocument"
              aria-label="复制模板"
              @click="openEditor(row, true)"
            />
          </el-tooltip>
          <el-tooltip content="删除模板" placement="top">
            <el-button
              text
              type="danger"
              :icon="Delete"
              aria-label="删除模板"
              @click="removeTemplate(row)"
            />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <EdgeBTemplateEditorDialog
      v-model="editorVisible"
      :template="editingTemplate"
      :duplicate="duplicate"
      @saved="handleSaved"
    />
  </el-dialog>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { CopyDocument, Delete, Edit, Plus, View } from '@element-plus/icons-vue'
  import { deleteEdgeBPayloadTemplate, type EdgeBPayloadTemplate } from '@/api/edge-gateway'
  import type { JsonDialogPayload } from '../shared'
  import EdgeBTemplateEditorDialog from './EdgeBTemplateEditorDialog.vue'

  defineProps<{
    templates: EdgeBPayloadTemplate[]
  }>()

  const emit = defineEmits<{
    changed: []
    'show-json': [payload: JsonDialogPayload]
  }>()

  const visible = defineModel<boolean>({ required: true })
  const editorVisible = ref(false)
  const editingTemplate = ref<EdgeBPayloadTemplate>()
  const duplicate = ref(false)

  const openEditor = (template?: EdgeBPayloadTemplate, asCopy = false) => {
    editingTemplate.value = template
    duplicate.value = asCopy
    editorVisible.value = true
  }

  const handleSaved = () => {
    emit('changed')
  }

  const showTemplateJson = (template: EdgeBPayloadTemplate) => {
    emit('show-json', {
      title: `报文模板：${template.templateName}`,
      content: template.templateJson
    })
  }

  const removeTemplate = async (template: EdgeBPayloadTemplate) => {
    await ElMessageBox.confirm(
      `确定删除报文模板“${template.templateName}”吗？已有映射保存的是结构快照，不会被修改。`,
      '删除确认',
      { type: 'warning' }
    )
    await deleteEdgeBPayloadTemplate(template.id)
    ElMessage.success('报文模板已删除')
    emit('changed')
  }
</script>

<style scoped>
  .template-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }
</style>
