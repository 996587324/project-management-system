<template>
  <el-dialog
    :model-value="modelValue"
    title="新建数据处理配置版本"
    width="min(1080px, 94vw)"
    top="4vh"
    class="edge-gateway-dialog config-editor-dialog"
    @close="close"
  >
    <el-form label-position="top">
      <div class="config-heading-grid">
        <el-form-item label="配置名称" required>
          <el-input v-model="form.configName" placeholder="例如：生产线 A 字段映射" />
        </el-form-item>
        <el-form-item label="配置方式">
          <el-segmented :model-value="editMode" :options="modeOptions" @change="switchEditMode" />
        </el-form-item>
      </div>

      <template v-if="editMode === 'visual'">
        <EdgeVisualMappingEditor v-model="mappingGroups" :suggestions="mappingSuggestions" />

        <div v-if="generated" class="generated-config-preview">
          <div class="generated-config-header">
            <strong>生成的配置 JSON</strong>
            <el-tag v-if="validationState === 'valid'" type="success" effect="plain">
              校验通过
            </el-tag>
          </div>
          <pre>{{ form.configJson }}</pre>
        </div>
      </template>

      <template v-else>
        <el-alert
          title="JSON 高级模式"
          description="适合直接编辑完整配置。修改后必须重新校验；切回可视化模式时，系统会先校验并解析当前 JSON。"
          type="warning"
          show-icon
          :closable="false"
          class="config-help-alert"
        />
        <el-form-item label="配置 JSON" required>
          <el-input
            v-model="form.configJson"
            type="textarea"
            :rows="20"
            class="code-input"
            spellcheck="false"
            @input="markJsonDirty"
          />
        </el-form-item>
      </template>
    </el-form>

    <template #footer>
      <div class="config-dialog-footer">
        <el-tag v-if="validationState === 'valid'" type="success" effect="plain">
          配置已校验
        </el-tag>
        <span v-else class="config-validation-hint">保存前需要完成配置校验</span>
        <div>
          <el-button @click="close">取消</el-button>
          <el-button @click="validateCurrent">
            <el-icon><CircleCheckFilled /></el-icon>
            {{ editMode === 'visual' ? '生成并校验' : '校验配置' }}
          </el-button>
          <el-button type="primary" :loading="saving" @click="submit">保存草稿</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { CircleCheckFilled } from '@element-plus/icons-vue'
  import {
    fetchWebSocketSources,
    saveDeviceConfig,
    type EdgeDeviceConfig
  } from '@/api/edge-gateway'
  import EdgeVisualMappingEditor from './EdgeVisualMappingEditor.vue'
  import {
    buildVisualConfiguration,
    collectMappingSuggestions,
    createVisualMappingGroup,
    hasVisualInput,
    parseConfigurationToVisual,
    validateMappingConfiguration,
    type ConfigEditMode,
    type ConfigValidationState,
    type VisualMappingGroup
  } from './editorModel'

  const props = defineProps<{
    modelValue: boolean
    deviceId?: number
    sourceConfig?: EdgeDeviceConfig
    historicalConfigs: EdgeDeviceConfig[]
  }>()

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    saved: []
  }>()

  const emptyConfiguration = '{\n  "mappings": [],\n  "rules": []\n}'
  const modeOptions = [
    { label: '可视化配置', value: 'visual' },
    { label: 'JSON 高级模式', value: 'json' }
  ]

  const form = reactive({
    configName: '',
    configJson: emptyConfiguration
  })
  const editMode = ref<ConfigEditMode>('visual')
  const validationState = ref<ConfigValidationState>('idle')
  const generated = ref(false)
  const saving = ref(false)
  const syncingVisualConfig = ref(false)
  const mappingGroups = ref<VisualMappingGroup[]>([createVisualMappingGroup()])
  const configRules = ref<Record<string, unknown>[]>([])
  const connectionSourceIds = ref<string[]>([])
  const connectionSourceFields = ref<Record<string, string[]>>({})
  let sourceRequestSequence = 0

  const mappingSuggestions = computed(() =>
    collectMappingSuggestions(
      mappingGroups.value,
      props.historicalConfigs,
      connectionSourceIds.value,
      connectionSourceFields.value
    )
  )

  watch(
    mappingGroups,
    () => {
      if (syncingVisualConfig.value) return
      generated.value = false
      validationState.value = 'idle'
    },
    { deep: true, flush: 'sync' }
  )

  const close = () => emit('update:modelValue', false)

  const showValidationError = (error?: string) => {
    if (error) ElMessage.warning(error)
  }

  const checkConfiguration = (showSuccess = true) => {
    const result = validateMappingConfiguration(form.configJson)
    if (!result.valid) {
      validationState.value = 'invalid'
      showValidationError(result.error)
      return false
    }

    form.configJson = result.formattedJson || form.configJson
    validationState.value = 'valid'
    if (showSuccess) ElMessage.success('配置校验通过')
    return true
  }

  const generateConfiguration = (showSuccess = true) => {
    const result = buildVisualConfiguration(mappingGroups.value, configRules.value)
    if (!result.configuration) {
      generated.value = false
      validationState.value = 'invalid'
      showValidationError(result.error)
      return false
    }

    form.configJson = JSON.stringify(result.configuration, null, 2)
    generated.value = true
    const valid = checkConfiguration(false)
    if (valid && showSuccess) ElMessage.success('配置 JSON 已生成并通过校验')
    return valid
  }

  const parseToVisual = (showSuccess = true) => {
    const validation = validateMappingConfiguration(form.configJson)
    if (!validation.valid) {
      validationState.value = 'invalid'
      showValidationError(validation.error)
      return false
    }
    form.configJson = validation.formattedJson || form.configJson

    const result = parseConfigurationToVisual(form.configJson)
    if (!result.groups || !result.rules) {
      validationState.value = 'invalid'
      showValidationError(result.error)
      return false
    }

    syncingVisualConfig.value = true
    mappingGroups.value = result.groups
    configRules.value = result.rules
    syncingVisualConfig.value = false
    generated.value = true
    validationState.value = 'valid'
    if (showSuccess) ElMessage.success('JSON 已解析为可视化配置')
    return true
  }

  const validateCurrent = () => {
    if (editMode.value === 'visual') generateConfiguration()
    else checkConfiguration()
  }

  const switchEditMode = (value: string | number) => {
    const requestedMode = String(value) as ConfigEditMode
    if (requestedMode === editMode.value) return

    if (requestedMode === 'json') {
      if (hasVisualInput(mappingGroups.value) && !generateConfiguration(false)) return
      editMode.value = 'json'
      return
    }

    if (!parseToVisual(false)) return
    editMode.value = 'visual'
  }

  const markJsonDirty = () => {
    validationState.value = 'idle'
    generated.value = false
  }

  const loadConnectionSourceIds = async () => {
    const requestSequence = ++sourceRequestSequence
    connectionSourceIds.value = []
    connectionSourceFields.value = {}
    if (!props.deviceId) return

    try {
      const sources = await fetchWebSocketSources(props.deviceId)
      if (requestSequence !== sourceRequestSequence) return
      connectionSourceIds.value = [
        ...new Set(sources.map((source) => source.sourceId.trim()).filter(Boolean))
      ]
      connectionSourceFields.value = Object.fromEntries(
        sources.map((source) => [
          source.sourceId.trim(),
          [
            ...new Set(
              source.subscriptionDevices.flatMap((device) =>
                device.parameters.map((parameter) => parameter.parameterName.trim()).filter(Boolean)
              )
            )
          ].sort()
        ])
      )
    } catch {
      if (requestSequence === sourceRequestSequence) {
        connectionSourceIds.value = []
        connectionSourceFields.value = {}
      }
    }
  }

  const reset = () => {
    editMode.value = 'visual'
    validationState.value = 'idle'
    generated.value = false
    Object.assign(form, {
      configName: props.sourceConfig ? `${props.sourceConfig.configName} - 副本` : '',
      configJson: props.sourceConfig?.configJson || emptyConfiguration
    })

    syncingVisualConfig.value = true
    mappingGroups.value = [createVisualMappingGroup()]
    configRules.value = []
    syncingVisualConfig.value = false

    if (props.sourceConfig && !parseToVisual(false)) {
      editMode.value = 'json'
      generated.value = false
      ElMessage.warning('该版本无法转换为可视化配置，已使用 JSON 高级模式打开')
    }
  }

  watch(
    () => props.modelValue,
    (visible) => {
      if (visible) {
        reset()
        loadConnectionSourceIds()
      } else {
        sourceRequestSequence += 1
      }
    }
  )

  const submit = async () => {
    if (!props.deviceId || !form.configName.trim()) {
      ElMessage.warning('请选择设备并填写配置名称')
      return
    }
    const valid = editMode.value === 'visual' ? generateConfiguration(false) : checkConfiguration()
    if (!valid) return

    saving.value = true
    try {
      await saveDeviceConfig(props.deviceId, form)
      ElMessage.success('配置草稿已保存')
      close()
      emit('saved')
    } finally {
      saving.value = false
    }
  }
</script>
