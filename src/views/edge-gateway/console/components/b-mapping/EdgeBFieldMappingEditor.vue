<template>
  <div v-loading="loading" class="b-field-mapping-editor">
    <div class="template-editor-header">
      <div>
        <strong>JSON 结构</strong>
        <span>修改结构后点击“解析结构”，下方会按末级字段生成绑定项。</span>
      </div>
      <el-button :icon="Refresh" @click="parseTemplateDraft">解析结构</el-button>
    </div>

    <el-input
      v-model="templateDraft"
      type="textarea"
      :rows="9"
      resize="vertical"
      spellcheck="false"
      placeholder="请输入根节点为对象或数组的 JSON 模板"
    />

    <div v-if="leaves.length" class="binding-list">
      <div class="binding-column-header">
        <span>目标位置</span>
        <span>值类型</span>
        <span>来源字段或固定值</span>
      </div>

      <div v-for="leaf in leaves" :key="leaf.id" class="binding-row">
        <el-tooltip :content="leaf.targetPath" placement="top">
          <span class="target-path">{{ leaf.targetPath }}</span>
        </el-tooltip>
        <el-select v-model="leaf.valueMode" aria-label="值类型">
          <el-option label="设备字段" value="source" />
          <el-option label="固定值" value="fixed" />
        </el-select>
        <el-select
          v-if="leaf.valueMode === 'source'"
          v-model="leaf.sourcePath"
          filterable
          :allow-create="!deviceId"
          :default-first-option="!deviceId"
          clearable
          :placeholder="sourcePlaceholder"
        >
          <el-option-group label="标准消息字段">
            <el-option
              v-for="option in standardOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-option-group>
          <el-option-group v-if="deviceFieldOptions.length" label="设备采集字段">
            <el-option
              v-for="option in deviceFieldOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-option-group>
          <el-option-group v-if="missingSourceOptions.length" label="当前设备未发现">
            <el-option
              v-for="option in missingSourceOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
              disabled
            />
          </el-option-group>
        </el-select>
        <el-input
          v-else
          :model-value="formatFixedValue(leaf.fixedValue)"
          placeholder="文本直接输入；数字、布尔值可按 JSON 格式输入"
          @update:model-value="updateFixedValue(leaf, $event)"
        />
      </div>
    </div>

    <el-empty v-else :image-size="64" description="解析结构后，在这里配置末级字段" />

    <div class="mapping-json-preview">
      <div class="mapping-json-preview-header">
        <span>生成的字段映射 JSON</span>
        <el-tag v-if="validationState === 'valid'" type="success" effect="plain"> 校验通过 </el-tag>
      </div>
      <pre>{{ model }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { Refresh } from '@element-plus/icons-vue'
  import {
    buildMappingJson,
    formatFixedValue,
    parseMappingTemplate,
    type ParsedMappingTemplate,
    type TemplateLeaf
  } from './bMappingTemplateModel'
  import { useBSourceFields } from './useBSourceFields'

  const props = defineProps<{
    deviceId?: number
    deviceCode?: string
  }>()

  const model = defineModel<string>({ required: true })
  const templateDraft = ref('{}')
  const templateRoot = ref<ParsedMappingTemplate['root']>({})
  const leaves = ref<TemplateLeaf[]>([])
  const validationState = ref<'idle' | 'valid' | 'invalid'>('idle')
  let generatedJson = ''
  let loadingContent = false

  const { candidatePaths, deviceFieldOptions, loading, sourcePlaceholder, standardOptions } =
    useBSourceFields(
      () => props.deviceId,
      () => props.deviceCode
    )

  const missingSourceOptions = computed(() => {
    if (!props.deviceId) return []
    const options = new Map<string, { value: string; label: string }>()
    leaves.value.forEach((leaf) => {
      if (leaf.valueMode !== 'source') return
      const path = leaf.sourcePath.trim()
      if (path && !candidatePaths.value.has(path.toLowerCase())) {
        options.set(path.toLowerCase(), {
          value: path,
          label: `${path}（当前设备未发现）`
        })
      }
    })
    return [...options.values()]
  })

  const setParsedTemplate = (parsed: ParsedMappingTemplate, updateModel: boolean) => {
    loadingContent = true
    templateRoot.value = parsed.root
    leaves.value = parsed.leaves
    templateDraft.value = parsed.displayJson
    validationState.value = 'idle'
    loadingContent = false
    if (updateModel) rebuildMappingJson()
  }

  const rebuildMappingJson = () => {
    generatedJson = buildMappingJson(templateRoot.value, leaves.value)
    model.value = generatedJson
    validationState.value = 'idle'
  }

  const applyTemplate = (content: string) => {
    try {
      setParsedTemplate(parseMappingTemplate(content, 'template'), true)
      return true
    } catch (error) {
      ElMessage.warning(error instanceof Error ? error.message : 'JSON 模板格式不正确')
      return false
    }
  }

  const parseTemplateDraft = () => {
    if (applyTemplate(templateDraft.value)) {
      ElMessage.success('JSON 结构已解析，请检查字段绑定')
    }
  }

  const updateFixedValue = (leaf: TemplateLeaf, input: string) => {
    try {
      leaf.fixedValue = JSON.parse(input)
    } catch {
      leaf.fixedValue = input
    }
  }

  const validate = () => {
    if (loading.value) {
      ElMessage.warning('当前设备字段正在加载，请稍后再保存')
      return false
    }
    if (!leaves.value.length) {
      validationState.value = 'invalid'
      ElMessage.warning('JSON 模板至少需要一个末级字段')
      return false
    }

    for (const leaf of leaves.value) {
      if (leaf.valueMode !== 'source') continue
      const sourcePath = leaf.sourcePath.trim()
      if (!sourcePath) {
        validationState.value = 'invalid'
        ElMessage.warning(`目标位置 ${leaf.targetPath} 还没有选择来源字段`)
        return false
      }
      if (props.deviceId && !candidatePaths.value.has(sourcePath.toLowerCase())) {
        validationState.value = 'invalid'
        ElMessage.warning(`当前设备没有找到来源字段：${sourcePath}`)
        return false
      }
    }

    rebuildMappingJson()
    validationState.value = 'valid'
    return true
  }

  watch(
    leaves,
    () => {
      if (!loadingContent) rebuildMappingJson()
    },
    { deep: true, flush: 'sync' }
  )

  watch(
    model,
    (content) => {
      if (content === generatedJson) return
      try {
        setParsedTemplate(parseMappingTemplate(content || '{}', 'mapping'), false)
      } catch {
        templateDraft.value = content || '{}'
        templateRoot.value = {}
        leaves.value = []
      }
    },
    { immediate: true }
  )

  defineExpose({ applyTemplate, validate })
</script>

<style scoped>
  .b-field-mapping-editor {
    width: 100%;
    min-height: 240px;
  }

  .template-editor-header,
  .mapping-json-preview-header {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    min-height: 40px;
  }

  .template-editor-header > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .template-editor-header span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .binding-list {
    margin-top: 14px;
  }

  .binding-column-header,
  .binding-row {
    display: grid;
    grid-template-columns: minmax(180px, 0.75fr) 130px minmax(320px, 1.25fr);
    gap: 12px;
    align-items: center;
  }

  .binding-column-header {
    padding-bottom: 8px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .binding-row {
    min-height: 40px;
    margin-bottom: 10px;
  }

  .target-path {
    min-width: 0;
    overflow: hidden;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 13px;
    color: var(--el-text-color-regular);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mapping-json-preview {
    margin-top: 14px;
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .mapping-json-preview-header {
    padding: 6px 12px;
    font-size: 13px;
    background: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .mapping-json-preview pre {
    min-height: 110px;
    max-height: 260px;
    padding: 12px;
    margin: 0;
    overflow: auto;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.6;
    color: var(--el-text-color-primary);
    word-break: break-word;
    white-space: pre-wrap;
    background: var(--el-bg-color);
  }

  @media (width <= 760px) {
    .binding-column-header {
      display: none;
    }

    .binding-row {
      grid-template-columns: minmax(0, 1fr) 120px;
    }

    .binding-row > :last-child {
      grid-column: 1 / -1;
    }
  }
</style>
