<template>
  <el-dialog
    :model-value="modelValue"
    :title="form.id ? '编辑边缘规则' : '新增边缘规则'"
    width="720px"
    class="edge-gateway-dialog"
    @close="close"
  >
    <el-form label-width="90px">
      <div class="form-grid">
        <el-form-item label="规则编码" required>
          <el-input v-model="form.ruleCode" />
        </el-form-item>
        <el-form-item label="规则名称" required>
          <el-input v-model="form.ruleName" />
        </el-form-item>
        <el-form-item label="适用设备">
          <el-select v-model="form.deviceId" clearable placeholder="全局规则">
            <el-option
              v-for="device in devices"
              :key="device.id"
              :label="device.deviceName"
              :value="device.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="form.priority" :min="1" :max="9999" />
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      </div>

      <el-form-item label="规则模板" required>
        <div class="rule-template-picker">
          <el-select v-model="selectedTemplateKey" filterable placeholder="请选择中文规则模板">
            <el-option
              v-for="template in ruleTemplates"
              :key="template.key"
              :label="template.label"
              :value="template.key"
            />
          </el-select>
          <el-button type="primary" plain @click="confirmTemplate">确定生成</el-button>
        </div>
      </el-form-item>

      <el-alert
        v-if="jsonVisible"
        :title="helpTitle"
        :description="helpDescription"
        type="info"
        show-icon
        :closable="false"
        class="rule-template-alert"
      />

      <el-form-item v-if="jsonVisible" label="规则 JSON" required>
        <div class="rule-json-editor">
          <el-input
            v-model="form.ruleJson"
            type="textarea"
            :rows="12"
            class="code-input"
            spellcheck="false"
          />
          <div class="rule-json-hint"> 保存时会检查 JSON 格式、必填字段、比较方式和数值范围。 </div>
        </div>
      </el-form-item>
      <div v-else class="rule-json-empty">请选择规则模板，然后点击“确定生成”。</div>
    </el-form>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { saveEdgeRule, type EdgeDevice, type EdgeRule } from '@/api/edge-gateway'
  import { getObjectValue, isNumber, isObject } from '../shared'
  import { ruleTemplates, ruleTypeText } from './ruleDefinitions'

  const props = defineProps<{
    modelValue: boolean
    sourceRule?: EdgeRule
    devices: EdgeDevice[]
  }>()

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    saved: []
  }>()

  const defaultRule = (): EdgeRule => ({
    id: 0,
    deviceId: undefined,
    ruleCode: '',
    ruleName: '',
    ruleType: 'Filter',
    ruleJson: '{}',
    priority: 100,
    enabled: true
  })

  const form = reactive<EdgeRule>(defaultRule())
  const saving = ref(false)
  const selectedTemplateKey = ref('')
  const appliedTemplateKey = ref('')
  const jsonVisible = ref(false)

  const selectedTemplate = computed(() =>
    ruleTemplates.find((item) => item.key === selectedTemplateKey.value)
  )
  const appliedTemplate = computed(() =>
    ruleTemplates.find((item) => item.key === appliedTemplateKey.value)
  )
  const helpTitle = computed(() =>
    appliedTemplate.value
      ? `${appliedTemplate.value.label}，实际类型：${ruleTypeText(appliedTemplate.value.ruleType)}`
      : `当前规则类型：${ruleTypeText(form.ruleType)}`
  )
  const helpDescription = computed(
    () =>
      appliedTemplate.value?.description ||
      '这是已有规则配置。重新选择模板并点击“确定生成”后，当前 JSON 会被新模板替换。'
  )

  const detectTemplate = (rule: EdgeRule) => {
    try {
      const config = JSON.parse(rule.ruleJson) as Record<string, unknown>
      const operator = String(getObjectValue(config, 'operator') || '').toLowerCase()
      if (rule.ruleType === 'Filter') {
        const valueType = getObjectValue(config, 'compareText') !== undefined ? 'text' : 'number'
        return `filter-${valueType}-${operator || 'equal'}`
      }
      if (rule.ruleType === 'Aggregate') return `aggregate-${operator || 'avg'}`
      return rule.ruleType.toLowerCase()
    } catch {
      return ''
    }
  }

  const reset = () => {
    Object.assign(form, defaultRule(), props.sourceRule || {})
    const detectedTemplate = props.sourceRule ? detectTemplate(props.sourceRule) : ''
    selectedTemplateKey.value = detectedTemplate
    appliedTemplateKey.value = detectedTemplate
    jsonVisible.value = Boolean(props.sourceRule)
  }

  watch(
    () => props.modelValue,
    (visible) => {
      if (visible) reset()
    }
  )

  const close = () => emit('update:modelValue', false)

  const confirmTemplate = () => {
    const template = selectedTemplate.value
    if (!template) {
      ElMessage.warning('请先选择一个中文规则模板')
      return
    }
    form.ruleType = template.ruleType
    form.ruleJson = JSON.stringify(template.json, null, 2)
    appliedTemplateKey.value = template.key
    jsonVisible.value = true
    ElMessage.success('规则 JSON 已生成，请按实际业务修改字段和值')
  }

  const validateJson = () => {
    try {
      return JSON.parse(form.ruleJson) as unknown
    } catch {
      ElMessage.warning('JSON 格式不正确')
      return null
    }
  }

  const validateConfiguration = () => {
    const config = validateJson()
    if (!isObject(config)) {
      if (config !== null) ElMessage.warning('规则 JSON 必须是一个对象')
      return false
    }

    const read = (name: string) => getObjectValue(config, name)
    const requireField = () => {
      if (typeof read('field') === 'string' && String(read('field')).trim()) return true
      ElMessage.warning('请填写 field，它必须是映射后的目标字段名')
      return false
    }
    const action = read('action')
    if (action !== undefined && String(action).toLowerCase() !== 'drop') {
      ElMessage.warning('当前只支持 Drop（丢弃）动作')
      return false
    }

    if (form.ruleType === 'Filter') {
      if (!requireField()) return false
      const operator = String(read('operator') || '').toLowerCase()
      const numericOperators = [
        'greaterthan',
        'greaterthanorequal',
        'lessthan',
        'lessthanorequal',
        'equal',
        'notequal'
      ]
      const textOperators = ['equal', 'notequal', 'contains']
      const compareValue = read('compareValue')
      const compareText = read('compareText')
      if (compareValue !== undefined) {
        if (!numericOperators.includes(operator) || !isNumber(compareValue)) {
          ElMessage.warning('数值过滤的比较方式或 compareValue 不正确，请重新选择模板')
          return false
        }
      } else if (
        typeof compareText !== 'string' ||
        !compareText.trim() ||
        !textOperators.includes(operator)
      ) {
        ElMessage.warning('文本过滤必须填写 compareText，并使用等于、不等于或包含')
        return false
      }
    } else if (form.ruleType === 'Range') {
      if (!requireField()) return false
      const min = read('min')
      const max = read('max')
      if (!isNumber(min) || !isNumber(max)) {
        ElMessage.warning('范围过滤的 min 和 max 必须都是数字')
        return false
      }
      if (min > max) {
        ElMessage.warning('范围过滤的最小值不能大于最大值')
        return false
      }
    } else if (form.ruleType === 'Threshold') {
      if (!requireField()) return false
      const threshold = read('threshold')
      if (!isNumber(threshold) || threshold <= 0) {
        ElMessage.warning('变化阈值 threshold 必须是大于 0 的数字')
        return false
      }
    } else if (form.ruleType === 'Deduplicate') {
      const windowSeconds = read('windowSeconds')
      if (!Number.isInteger(windowSeconds) || Number(windowSeconds) < 1) {
        ElMessage.warning('去重窗口 windowSeconds 必须是大于 0 的整数')
        return false
      }
    } else if (form.ruleType === 'Aggregate') {
      if (!requireField()) return false
      const operator = String(read('operator') || '').toLowerCase()
      const windowSeconds = read('windowSeconds')
      if (!['avg', 'sum', 'min', 'max', 'count'].includes(operator)) {
        ElMessage.warning('聚合方式只能选择平均值、求和、最小值、最大值或计数')
        return false
      }
      if (!Number.isInteger(windowSeconds) || Number(windowSeconds) < 1) {
        ElMessage.warning('聚合窗口 windowSeconds 必须是大于 0 的整数')
        return false
      }
    } else {
      ElMessage.warning('请选择系统支持的规则模板')
      return false
    }

    form.ruleJson = JSON.stringify(config, null, 2)
    return true
  }

  const submit = async () => {
    if (!form.ruleCode.trim() || !form.ruleName.trim()) {
      ElMessage.warning('请填写规则编码和规则名称')
      return
    }
    if (!jsonVisible.value) {
      ElMessage.warning('请选择规则模板并生成规则 JSON')
      return
    }
    if (!validateConfiguration()) return

    saving.value = true
    try {
      await saveEdgeRule(form)
      ElMessage.success('规则已保存')
      close()
      emit('saved')
    } finally {
      saving.value = false
    }
  }
</script>
