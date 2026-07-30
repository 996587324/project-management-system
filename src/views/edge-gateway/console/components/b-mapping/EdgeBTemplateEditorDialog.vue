<template>
  <el-dialog
    v-model="visible"
    :title="form.id ? '编辑报文模板' : duplicate ? '复制报文模板' : '新增报文模板'"
    width="min(820px, 96vw)"
    class="edge-gateway-dialog"
    append-to-body
  >
    <el-form label-position="top">
      <div class="form-grid">
        <el-form-item label="模板编码" required>
          <el-input
            v-model="form.templateCode"
            maxlength="64"
            placeholder="例如 EQUIPMENT_DATA_V1"
          />
        </el-form-item>
        <el-form-item label="模板名称" required>
          <el-input v-model="form.templateName" maxlength="128" placeholder="例如 设备数据上报" />
        </el-form-item>
      </div>

      <el-form-item label="JSON 模板" required>
        <el-input
          v-model="form.templateJson"
          type="textarea"
          :rows="17"
          resize="vertical"
          spellcheck="false"
          placeholder="请输入根节点为对象或数组的 JSON"
        />
      </el-form-item>

      <div class="form-grid template-meta-grid">
        <el-form-item label="说明">
          <el-input v-model="form.description" maxlength="256" />
        </el-form-item>
        <el-form-item label="启用模板">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="formatAndValidate">格式化并校验</el-button>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存模板</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { saveEdgeBPayloadTemplate, type EdgeBPayloadTemplate } from '@/api/edge-gateway'
  import { parseMappingTemplate } from './bMappingTemplateModel'

  const props = defineProps<{
    template?: EdgeBPayloadTemplate
    duplicate?: boolean
  }>()

  const emit = defineEmits<{
    saved: [template: EdgeBPayloadTemplate]
  }>()

  const visible = defineModel<boolean>({ required: true })
  const saving = ref(false)

  const sampleJson = JSON.stringify(
    {
      dataList: [
        {
          data: {
            ds201: 'values.ds201',
            ds202: 'values.ds202',
            timestamp: 'timestamp'
          }
        },
        {
          data: {
            ds2203: 'values.ds2203',
            timestamp: 'timestamp'
          }
        }
      ]
    },
    null,
    2
  )

  const defaultTemplate = (): EdgeBPayloadTemplate => ({
    id: 0,
    templateCode: '',
    templateName: '',
    templateJson: sampleJson,
    description: '',
    enabled: true
  })

  const form = reactive<EdgeBPayloadTemplate>(defaultTemplate())

  const resetForm = () => {
    const source = props.template
    Object.assign(form, defaultTemplate(), source || {})
    if (props.duplicate && source) {
      form.id = 0
      form.templateCode = `${source.templateCode}_COPY`.slice(0, 64)
      form.templateName = `${source.templateName}（副本）`.slice(0, 128)
    }
  }

  const formatAndValidate = () => {
    try {
      const parsed = parseMappingTemplate(form.templateJson, 'template')
      if (!parsed.leaves.length) {
        ElMessage.warning('JSON 模板至少需要一个末级字段')
        return false
      }
      form.templateJson = parsed.displayJson
      ElMessage.success('模板 JSON 校验通过')
      return true
    } catch (error) {
      ElMessage.warning(error instanceof Error ? error.message : 'JSON 模板格式不正确')
      return false
    }
  }

  const submit = async () => {
    form.templateCode = form.templateCode.trim()
    form.templateName = form.templateName.trim()
    form.description = form.description?.trim()
    if (!form.templateCode || !form.templateName) {
      ElMessage.warning('请填写模板编码和模板名称')
      return
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(form.templateCode)) {
      ElMessage.warning('模板编码只能包含字母、数字、下划线、点和短横线')
      return
    }
    if (!formatAndValidate()) return

    saving.value = true
    try {
      const result = await saveEdgeBPayloadTemplate(form)
      const saved = {
        ...form,
        id: Number(result?.id || form.id)
      }
      ElMessage.success('报文模板已保存')
      visible.value = false
      emit('saved', saved)
    } finally {
      saving.value = false
    }
  }

  watch(
    () => visible.value,
    (opened) => {
      if (opened) resetForm()
    }
  )
</script>

<style scoped>
  .template-meta-grid {
    grid-template-columns: minmax(260px, 1fr) minmax(120px, 0.35fr);
  }
</style>
