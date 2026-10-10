<template>
  <el-dialog
    v-model="visible"
    title="机械手数据与状态配置"
    width="min(1180px, 96vw)"
    destroy-on-close
    append-to-body
  >
    <div v-loading="loading" class="robot-binding-dialog">
      <el-form label-position="top">
        <div class="robot-binding-dialog__base-grid">
          <el-form-item label="线体 / 机械手">
            <el-input :model-value="`${lineCode} / ${robotName}`" disabled />
          </el-form-item>
          <el-form-item label="设备模型" required>
            <el-select
              v-model="modelMark"
              filterable
              class="w-full"
              placeholder="先选择 modelMark"
              @change="handleModelChange"
            >
              <el-option
                v-for="model in sourceModels"
                :key="model.modelMark"
                :label="model.displayName"
                :value="model.modelMark"
              >
                <span>{{ model.displayName }}</span>
                <small>{{ model.deviceCount }} 台</small>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="设备名称 / 标识" required>
            <el-select
              v-model="sourceKey"
              filterable
              remote
              reserve-keyword
              class="w-full"
              :disabled="!modelMark"
              :loading="sourceLoading"
              :remote-method="queueSourceSearch"
              placeholder="选择或搜索 deviceMark"
              @change="handleSourceChange"
            >
              <el-option
                v-for="source in sources"
                :key="getSourceKey(source)"
                :label="source.deviceMark"
                :value="getSourceKey(source)"
              >
                <span>{{ source.deviceMark }}</span>
                <small :class="{ online: source.dataOnline }">
                  {{ source.dataOnline ? '接收中' : '已中断' }} · {{ source.tenantMark }}
                </small>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="离线判断">
            <el-input-number
              v-model="form.onlineTimeoutSeconds"
              :min="6"
              :max="3600"
              :step="3"
              controls-position="right"
            />
            <span class="robot-binding-dialog__suffix">秒未收到数据</span>
          </el-form-item>
          <el-form-item label="业务日开始时间">
            <el-select v-model="form.businessDayStartHour" class="w-full">
              <el-option
                v-for="hour in 24"
                :key="hour - 1"
                :label="`${hour - 1}:00`"
                :value="hour - 1"
              />
            </el-select>
          </el-form-item>
        </div>

        <el-tabs v-model="activeTab">
          <el-tab-pane label="展示字段" name="fields">
            <div class="robot-binding-dialog__toolbar">
              <span
                >选择需要显示的报文字段；字段名称、格式、单位和值映射请在“模型字段展示映射”中统一维护。</span
              >
              <el-button type="primary" plain :icon="Plus" @click="addField">添加字段</el-button>
            </div>
            <el-table :data="form.fields" max-height="360" border>
              <el-table-column label="字段编码" min-width="130">
                <template #default="{ row }"><el-input v-model.trim="row.fieldCode" /></template>
              </el-table-column>
              <el-table-column label="来源字段" min-width="300">
                <template #default="{ row }">
                  <el-select
                    v-model="row.sourcePath"
                    filterable
                    class="w-full"
                    placeholder="选择完整报文字段"
                    @change="applyFieldOption(row)"
                  >
                    <el-option
                      v-for="field in sourceFields"
                      :key="field.sourcePath"
                      :label="`${field.sourcePath} = ${formatCurrentValue(field.currentValue)}`"
                      :value="field.sourcePath"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="显示顺序" width="118">
                <template #default="{ row }">
                  <el-input-number v-model="row.sort" :min="0" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="62" fixed="right">
                <template #default="{ $index }">
                  <el-button
                    :icon="Delete"
                    text
                    type="danger"
                    title="删除字段"
                    @click="form.fields.splice($index, 1)"
                  />
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="模型报警映射" name="alarms">
            <div class="robot-binding-dialog__toolbar">
              <span>按 modelMark 生效，所属模型下的设备共用这些报警规则。</span>
              <div class="robot-binding-dialog__toolbar-actions">
                <el-button
                  plain
                  :disabled="!modelMark"
                  :loading="modelAlarmSaving"
                  @click="() => saveModelAlarmConfig()"
                  >保存模型报警</el-button
                >
                <el-button
                  type="primary"
                  plain
                  :icon="Plus"
                  :disabled="!modelMark"
                  @click="addAlarmRule"
                  >添加报警映射</el-button
                >
              </div>
            </div>
            <el-table v-loading="modelAlarmLoading" :data="modelAlarmRules" max-height="380" border>
              <el-table-column label="启用" width="70" align="center">
                <template #default="{ row }">
                  <el-switch v-model="row.enabled" />
                </template>
              </el-table-column>
              <el-table-column label="报警名称" min-width="180">
                <template #default="{ row }">
                  <el-input
                    v-model.trim="row.faultReason"
                    placeholder="看板显示名称"
                    @change="syncAlarmRuleName(row)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="判断字段" min-width="300">
                <template #default="{ row }">
                  <el-select
                    v-model="row.sourcePath"
                    filterable
                    class="w-full"
                    placeholder="选择模型字段"
                    @change="applyModelAlarmFieldOption(row)"
                  >
                    <el-option
                      v-for="field in modelSourceFields"
                      :key="field.sourcePath"
                      :label="`${field.sourcePath} = ${formatCurrentValue(field.currentValue)}`"
                      :value="field.sourcePath"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="条件" width="145">
                <template #default="{ row }">
                  <el-select v-model="row.operator">
                    <el-option
                      v-for="option in operatorOptions"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="比较值" width="140">
                <template #default="{ row }">
                  <el-input
                    v-model="row.compareValue"
                    :disabled="['IsEmpty', 'IsNotEmpty'].includes(row.operator)"
                    placeholder="比较值"
                  />
                </template>
              </el-table-column>
              <el-table-column label="故障编码" width="150">
                <template #default="{ row }">
                  <el-input v-model.trim="row.faultCode" />
                </template>
              </el-table-column>
              <el-table-column label="等级" width="120">
                <template #default="{ row }">
                  <el-select v-model="row.faultSeverity">
                    <el-option label="提示" value="Info" />
                    <el-option label="警告" value="Warning" />
                    <el-option label="严重" value="Critical" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="动态原因字段" min-width="240">
                <template #default="{ row }">
                  <el-select v-model="row.faultReasonPath" clearable filterable placeholder="可选">
                    <el-option
                      v-for="field in modelSourceFields"
                      :key="field.sourcePath"
                      :label="field.sourcePath"
                      :value="field.sourcePath"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="优先级" width="110">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.priority"
                    :min="1"
                    :max="9999"
                    controls-position="right"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="62" fixed="right">
                <template #default="{ row }">
                  <el-button
                    :icon="Delete"
                    text
                    type="danger"
                    title="删除报警映射"
                    @click="deleteModelAlarmRule(row)"
                  />
                </template>
              </el-table-column>
            </el-table>
            <el-empty
              v-if="!modelAlarmLoading && modelAlarmRules.length === 0"
              description="还没有模型报警映射"
              :image-size="64"
            />
          </el-tab-pane>

          <el-tab-pane label="状态累计规则" name="rules">
            <div class="robot-binding-dialog__toolbar">
              <span
                >不同状态的冲突顺序由“模型状态优先级”统一决定；本页优先级仅用于相同状态下的规则排序。</span
              >
              <el-dropdown @command="addRule">
                <el-button type="primary" plain :icon="Plus">添加状态规则</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="RUNNING">运行规则</el-dropdown-item>
                    <el-dropdown-item command="IDLE">空闲规则</el-dropdown-item>
                    <el-dropdown-item command="FAULT">故障规则</el-dropdown-item>
                    <el-dropdown-item command="STOPPED">停止规则</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div
              v-for="(rule, index) in form.stateRules"
              :key="`${rule.ruleCode}-${index}`"
              class="state-rule-row"
            >
              <div class="state-rule-row__main">
                <el-select v-model="rule.targetState" class="state-rule-row__state">
                  <el-option label="运行" value="RUNNING" />
                  <el-option label="空闲" value="IDLE" />
                  <el-option label="故障" value="FAULT" />
                  <el-option label="停止" value="STOPPED" />
                </el-select>
                <el-input v-model.trim="rule.ruleName" placeholder="规则名称" />
                <el-select v-model="rule.sourcePath" filterable placeholder="判断字段">
                  <el-option
                    v-for="field in sourceFields"
                    :key="field.sourcePath"
                    :label="field.sourcePath"
                    :value="field.sourcePath"
                  />
                </el-select>
                <el-select v-model="rule.operator" class="state-rule-row__operator">
                  <el-option
                    v-for="option in operatorOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
                <el-input
                  v-model="rule.compareValue"
                  :disabled="['IsEmpty', 'IsNotEmpty'].includes(rule.operator)"
                  placeholder="比较值"
                />
                <el-input-number
                  v-model="rule.priority"
                  :min="1"
                  :max="9999"
                  controls-position="right"
                />
                <el-button
                  :icon="Delete"
                  text
                  type="danger"
                  title="删除规则"
                  @click="form.stateRules.splice(index, 1)"
                />
              </div>
              <div v-if="rule.targetState === 'FAULT'" class="state-rule-row__fault">
                <el-input v-model.trim="rule.faultCode" placeholder="故障编码" />
                <el-input v-model.trim="rule.faultReason" placeholder="固定故障原因" />
                <el-select
                  v-model="rule.faultReasonPath"
                  clearable
                  filterable
                  placeholder="或从字段读取故障原因"
                >
                  <el-option
                    v-for="field in sourceFields"
                    :key="field.sourcePath"
                    :label="field.sourcePath"
                    :value="field.sourcePath"
                  />
                </el-select>
                <el-select v-model="rule.faultSeverity" placeholder="故障等级">
                  <el-option label="提示" value="Info" />
                  <el-option label="警告" value="Warning" />
                  <el-option label="严重" value="Critical" />
                </el-select>
              </div>
            </div>
            <el-empty
              v-if="form.stateRules.length === 0"
              description="至少添加运行、空闲、故障三类规则"
              :image-size="64"
            />
          </el-tab-pane>
        </el-tabs>
      </el-form>
    </div>

    <template #footer>
      <el-button v-if="form.id" type="danger" plain :loading="deleting" @click="removeBinding"
        >删除绑定</el-button
      >
      <span class="robot-binding-dialog__footer-spacer" />
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">校验并保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { Delete, Plus } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    DashboardDataSourceModelOption,
    DashboardDataSourceOption,
    DashboardModelAlarmRule,
    DashboardRobotBinding,
    DashboardRobotField,
    DashboardRobotState,
    DashboardSourceFieldOption,
    deleteDashboardBinding,
    fetchDashboardBindings,
    fetchDashboardDataSourceModels,
    fetchDashboardDataSources,
    fetchDashboardDataSourcesByModel,
    fetchDashboardModelAlarmRules,
    fetchDashboardModelSourceFields,
    fetchDashboardSourceFields,
    saveDashboardBinding,
    saveDashboardModelAlarmRules
  } from '@/api/edge-dashboard'

  const props = defineProps<{
    modelValue: boolean
    lineCode: string
    robotCode: string
    robotName: string
  }>()
  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    saved: [binding: DashboardRobotBinding]
    deleted: []
  }>()

  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })
  const loading = ref(false)
  const saving = ref(false)
  const deleting = ref(false)
  const modelAlarmLoading = ref(false)
  const modelAlarmSaving = ref(false)
  const activeTab = ref('fields')
  const sourceModels = ref<DashboardDataSourceModelOption[]>([])
  const sources = ref<DashboardDataSourceOption[]>([])
  const sourceFields = ref<DashboardSourceFieldOption[]>([])
  const modelSourceFields = ref<DashboardSourceFieldOption[]>([])
  const modelAlarmRules = ref<DashboardModelAlarmRule[]>([])
  const modelMark = ref('')
  const sourceKey = ref('')
  const sourceLoading = ref(false)
  let sourceSearchTimer = 0
  let sourceRequestVersion = 0

  const emptyForm = (): DashboardRobotBinding => ({
    id: 0,
    dashboardCode: 'production-dashboard',
    lineCode: props.lineCode,
    robotCode: props.robotCode,
    robotName: props.robotName,
    tenantMark: '',
    deviceMark: '',
    onlineTimeoutSeconds: 15,
    businessDayStartHour: 0,
    enabled: true,
    fields: [],
    stateRules: []
  })
  const form = ref<DashboardRobotBinding>(emptyForm())
  const bindingFaultRules = computed(() =>
    form.value.stateRules.filter((item) => item.targetState === 'FAULT')
  )

  const operatorOptions = [
    { label: '等于', value: 'Equals' },
    { label: '不等于', value: 'NotEquals' },
    { label: '大于', value: 'GreaterThan' },
    { label: '大于等于', value: 'GreaterThanOrEqual' },
    { label: '小于', value: 'LessThan' },
    { label: '小于等于', value: 'LessThanOrEqual' },
    { label: '包含', value: 'Contains' },
    { label: '不包含', value: 'NotContains' },
    { label: '为空', value: 'IsEmpty' },
    { label: '不为空', value: 'IsNotEmpty' }
  ]

  const getSourceKey = (source: Pick<DashboardDataSourceOption, 'tenantMark' | 'deviceMark'>) =>
    `${source.tenantMark}\u001f${source.deviceMark}`

  const load = async () => {
    loading.value = true
    activeTab.value = 'fields'
    modelMark.value = ''
    sourceKey.value = ''
    sources.value = []
    sourceFields.value = []
    modelSourceFields.value = []
    modelAlarmRules.value = []
    try {
      const [models, bindings] = await Promise.all([
        fetchDashboardDataSourceModels(),
        fetchDashboardBindings(props.lineCode)
      ])
      sourceModels.value = models
      const existing = bindings.find((item) => item.robotCode === props.robotCode)
      form.value = existing ? structuredClone(existing) : emptyForm()
      if (form.value.deviceMark) {
        const matches = await fetchDashboardDataSources(form.value.deviceMark)
        const selectedSource = matches.find(
          (source) =>
            source.tenantMark === form.value.tenantMark &&
            source.deviceMark === form.value.deviceMark
        )
        if (selectedSource) {
          modelMark.value = selectedSource.modelMark?.trim() || '__UNCLASSIFIED__'
          if (!sourceModels.value.some((model) => model.modelMark === modelMark.value)) {
            sourceModels.value.unshift({
              modelMark: modelMark.value,
              displayName: selectedSource.modelMark?.trim() || '未分类',
              deviceCount: 1,
              latestReceiveTime: selectedSource.receiveTime
            })
          }
          await Promise.all([loadModelSources(form.value.deviceMark), loadModelAlarmConfig()])
        }
        sourceKey.value = getSourceKey(form.value)
        await loadSourceFields()
      }
    } finally {
      loading.value = false
    }
  }

  const loadSourceFields = async () => {
    if (!form.value.tenantMark || !form.value.deviceMark) return
    sourceFields.value = await fetchDashboardSourceFields(
      form.value.tenantMark,
      form.value.deviceMark
    )
  }

  const loadModelAlarmConfig = async () => {
    modelSourceFields.value = []
    modelAlarmRules.value = []
    if (!modelMark.value) return
    modelAlarmLoading.value = true
    try {
      const [fields, rules] = await Promise.all([
        fetchDashboardModelSourceFields(modelMark.value),
        fetchDashboardModelAlarmRules(form.value.dashboardCode, modelMark.value)
      ])
      modelSourceFields.value = fields
      modelAlarmRules.value = rules
    } finally {
      modelAlarmLoading.value = false
    }
  }

  const handleSourceChange = async (key: string) => {
    if (!key) {
      form.value.tenantMark = ''
      form.value.deviceMark = ''
      sourceFields.value = []
      return
    }
    const [tenantMark, deviceMark] = key.split('\u001f')
    form.value.tenantMark = tenantMark
    form.value.deviceMark = deviceMark
    await loadSourceFields()
  }

  /** 模型变化后只加载该模型内的设备，避免一次渲染全部数据源。 */
  const handleModelChange = async () => {
    sourceKey.value = ''
    form.value.tenantMark = ''
    form.value.deviceMark = ''
    sourceFields.value = []
    await Promise.all([loadModelSources(), loadModelAlarmConfig()])
  }

  /** 按模型从后端加载设备；版本号防止较慢的旧请求覆盖新搜索结果。 */
  const loadModelSources = async (keyword?: string) => {
    if (!modelMark.value) {
      sources.value = []
      return
    }
    const requestVersion = ++sourceRequestVersion
    sourceLoading.value = true
    try {
      const result = await fetchDashboardDataSourcesByModel(modelMark.value, keyword?.trim())
      if (requestVersion === sourceRequestVersion) sources.value = result
    } finally {
      if (requestVersion === sourceRequestVersion) sourceLoading.value = false
    }
  }

  /** 设备输入检索采用短延迟合并，减少连续输入产生的接口请求。 */
  const queueSourceSearch = (keyword: string) => {
    window.clearTimeout(sourceSearchTimer)
    sourceSearchTimer = window.setTimeout(() => loadModelSources(keyword), 250)
  }

  const addField = () => {
    const index = form.value.fields.length + 1
    form.value.fields.push({
      id: 0,
      fieldCode: `field_${index}`,
      sourcePath: '',
      displayName: `显示字段 ${index}`,
      purpose: 'DisplayValue',
      valueType: 'String',
      formatType: 'Direct',
      sort: index * 10,
      enabled: true
    })
  }

  const applyFieldOption = (row: DashboardRobotField | Record<string, any>) => {
    const option = sourceFields.value.find((item) => item.sourcePath === row.sourcePath)
    if (!option) return
    row.valueType = option.valueType
    if (!row.displayName || row.displayName.startsWith('显示字段'))
      row.displayName = option.fieldName
    if (!row.fieldCode || row.fieldCode.startsWith('field_')) {
      row.fieldCode = option.fieldName.replace(/[^a-zA-Z0-9_]/g, '_') || `field_${row.sort}`
    }
  }

  const nextRuleCode = (prefix: string) => {
    const usedCodes = new Set(form.value.stateRules.map((item) => item.ruleCode.toLowerCase()))
    let index = form.value.stateRules.length + 1
    while (usedCodes.has(`${prefix}_${index}`.toLowerCase())) index++
    return `${prefix}_${index}`
  }

  const nextFaultCode = () => {
    const usedCodes = new Set(
      form.value.stateRules
        .map((item) => item.faultCode)
        .filter(Boolean)
        .map((item) => item!.toLowerCase())
    )
    let index = bindingFaultRules.value.length + 1
    while (usedCodes.has(`ALARM_${index}`.toLowerCase())) index++
    return `ALARM_${index}`
  }

  const nextModelAlarmRuleCode = () => {
    const usedCodes = new Set(modelAlarmRules.value.map((item) => item.ruleCode.toLowerCase()))
    let index = modelAlarmRules.value.length + 1
    while (usedCodes.has(`alarm_${index}`.toLowerCase())) index++
    return `alarm_${index}`
  }

  const nextModelAlarmFaultCode = () => {
    const usedCodes = new Set(
      modelAlarmRules.value
        .map((item) => item.faultCode)
        .filter(Boolean)
        .map((item) => item!.toLowerCase())
    )
    let index = modelAlarmRules.value.length + 1
    while (usedCodes.has(`MODEL_ALARM_${index}`.toLowerCase())) index++
    return `MODEL_ALARM_${index}`
  }

  const addRule = (targetState: DashboardRobotState) => {
    const index = form.value.stateRules.length + 1
    const stateName = { RUNNING: '运行', IDLE: '空闲', FAULT: '故障', STOPPED: '停止' }[
      targetState as 'RUNNING' | 'IDLE' | 'FAULT' | 'STOPPED'
    ]
    form.value.stateRules.push({
      id: 0,
      ruleCode: nextRuleCode(targetState.toLowerCase()),
      ruleName: `${stateName}规则 ${index}`,
      targetState,
      sourcePath: '',
      operator: 'Equals',
      compareValue: targetState === 'IDLE' ? '0' : '1',
      faultCode: targetState === 'FAULT' ? nextFaultCode() : undefined,
      faultReason: targetState === 'FAULT' ? `故障规则 ${index}` : undefined,
      faultSeverity: targetState === 'FAULT' ? 'Warning' : undefined,
      priority: targetState === 'FAULT' ? 10 : index * 100,
      enabled: true
    })
  }

  const addAlarmRule = () => {
    const index = modelAlarmRules.value.length + 1
    const alarmName = `报警 ${index}`
    modelAlarmRules.value.push({
      id: 0,
      dashboardCode: form.value.dashboardCode,
      modelMark: modelMark.value,
      ruleCode: nextModelAlarmRuleCode(),
      ruleName: alarmName,
      sourcePath: '',
      operator: 'Equals',
      compareValue: '1',
      faultCode: nextModelAlarmFaultCode(),
      faultReason: alarmName,
      faultSeverity: 'Warning',
      priority: 10 + index,
      enabled: true
    })
  }

  const deleteModelAlarmRule = (rule: Record<string, any>) => {
    const index = modelAlarmRules.value.indexOf(rule as DashboardModelAlarmRule)
    if (index >= 0) modelAlarmRules.value.splice(index, 1)
  }

  const syncAlarmRuleName = (rule: Record<string, any>) => {
    const name = rule.faultReason?.trim()
    if (name) rule.ruleName = name
  }

  const applyModelAlarmFieldOption = (rule: Record<string, any>) => {
    const option = modelSourceFields.value.find((item) => item.sourcePath === rule.sourcePath)
    if (!option) return
    const defaultNames = [/^报警\s*\d+$/]
    const shouldRename =
      !rule.faultReason || defaultNames.some((pattern) => pattern.test(rule.faultReason ?? ''))
    if (shouldRename) {
      rule.faultReason = `${option.fieldName}报警`
      rule.ruleName = rule.faultReason
    }
  }

  const validateModelAlarmRules = () => {
    if (modelAlarmRules.value.length > 0 && !modelMark.value) return '请先选择设备模型'
    const ruleCodes = modelAlarmRules.value.map((item) => item.ruleCode.toLowerCase())
    if (new Set(ruleCodes).size !== ruleCodes.length) return '模型报警编码不能重复'
    for (const rule of modelAlarmRules.value) {
      if (!rule.ruleCode || !rule.ruleName || !rule.sourcePath)
        return '模型报警的编码、名称和判断字段都不能为空'
      if (!['IsEmpty', 'IsNotEmpty'].includes(rule.operator) && !rule.compareValue?.trim())
        return `模型报警 ${rule.ruleName} 必须填写比较值`
      if (!rule.faultReason && !rule.faultReasonPath)
        return '每条模型报警都需要固定名称或动态原因字段'
    }
    return ''
  }

  const saveModelAlarmConfig = async (showMessage = true) => {
    const error = validateModelAlarmRules()
    if (error) {
      ElMessage.warning(error)
      return false
    }
    if (!modelMark.value) {
      if (showMessage) ElMessage.warning('请先选择设备模型')
      return false
    }
    modelAlarmSaving.value = true
    try {
      modelAlarmRules.value = await saveDashboardModelAlarmRules(
        form.value.dashboardCode,
        modelMark.value,
        modelAlarmRules.value
      )
      if (showMessage) ElMessage.success('模型报警映射已保存')
      return true
    } finally {
      modelAlarmSaving.value = false
    }
  }

  const validate = () => {
    const modelAlarmError = validateModelAlarmRules()
    if (modelAlarmError) return modelAlarmError
    if (!form.value.tenantMark || !form.value.deviceMark) return '请选择 HTTP 数据源'
    if (form.value.fields.some((item) => !item.fieldCode || !item.displayName || !item.sourcePath))
      return '展示字段的编码、名称和来源字段都不能为空'
    const duplicateCodes = new Set<string>()
    for (const field of form.value.fields) {
      const code = field.fieldCode.toLowerCase()
      if (duplicateCodes.has(code)) return `字段编码不能重复：${field.fieldCode}`
      duplicateCodes.add(code)
      if (field.formatType === 'ValueMap' && field.mappingJson) {
        try {
          JSON.parse(field.mappingJson)
        } catch {
          return `${field.displayName} 的数值映射不是有效 JSON`
        }
      }
    }
    for (const state of ['RUNNING', 'IDLE', 'FAULT']) {
      if (!form.value.stateRules.some((item) => item.enabled && item.targetState === state))
        return `至少需要一条${{ RUNNING: '运行', IDLE: '空闲', FAULT: '故障' }[state]}规则`
    }
    if (form.value.stateRules.some((item) => !item.ruleCode || !item.ruleName || !item.sourcePath))
      return '状态规则的编码、名称和判断字段都不能为空'
    const ruleCodes = form.value.stateRules.map((item) => item.ruleCode.toLowerCase())
    if (new Set(ruleCodes).size !== ruleCodes.length) return '状态规则编码不能重复'
    if (
      form.value.stateRules.some(
        (item) => !['IsEmpty', 'IsNotEmpty'].includes(item.operator) && !item.compareValue?.trim()
      )
    )
      return '除“为空/不为空”外，每条状态规则都需要填写比较值'
    if (
      form.value.stateRules.some(
        (item) => item.targetState === 'FAULT' && !item.faultReason && !item.faultReasonPath
      )
    )
      return '每条故障规则都需要固定原因或原因字段'
    return ''
  }

  const submit = async () => {
    const error = validate()
    if (error) return ElMessage.warning(error)
    saving.value = true
    try {
      if (modelMark.value) {
        const alarmSaved = await saveModelAlarmConfig(false)
        if (!alarmSaved) return
      }
      const saved = await saveDashboardBinding(form.value)
      form.value = structuredClone(saved)
      ElMessage.success('机械手数据与模型报警规则已保存')
      emit('saved', saved)
      visible.value = false
    } finally {
      saving.value = false
    }
  }

  const removeBinding = async () => {
    await ElMessageBox.confirm('删除后该机械手将停止累计状态时间，历史统计仍会保留。', '删除绑定', {
      type: 'warning'
    })
    deleting.value = true
    try {
      await deleteDashboardBinding(form.value.id)
      ElMessage.success('机械手绑定已删除')
      emit('deleted')
      visible.value = false
    } finally {
      deleting.value = false
    }
  }

  const formatCurrentValue = (value: unknown) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    return (text ?? 'null').slice(0, 48)
  }

  watch(
    () => props.modelValue,
    (open) => open && load()
  )
</script>

<style scoped lang="scss">
  .robot-binding-dialog {
    min-height: 430px;
  }

  .robot-binding-dialog__base-grid {
    display: grid;
    grid-template-columns:
      minmax(170px, 1fr) minmax(160px, 0.9fr) minmax(250px, 1.45fr) minmax(130px, 0.75fr)
      minmax(130px, 0.75fr);
    gap: 0 16px;
  }

  .robot-binding-dialog__suffix {
    margin-left: 8px;
    color: var(--el-text-color-secondary);
  }

  .robot-binding-dialog__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 42px;
    margin-bottom: 10px;
    color: var(--el-text-color-secondary);
  }

  .state-rule-row {
    padding: 12px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .state-rule-row__main {
    display: grid;
    grid-template-columns: 110px 150px minmax(210px, 1.6fr) 130px 130px 110px 40px;
    gap: 8px;
    align-items: center;
  }

  .state-rule-row__fault {
    display: grid;
    grid-template-columns: 150px 1fr 1.4fr 130px;
    gap: 8px;
    margin: 10px 48px 0 118px;
  }

  .robot-binding-dialog__footer-spacer {
    display: inline-block;
    width: calc(100% - 330px);
  }

  :deep(.el-select-dropdown__item small) {
    float: right;
    margin-left: 18px;
    color: var(--el-color-danger);
  }

  :deep(.el-select-dropdown__item small.online) {
    color: var(--el-color-success);
  }

  @media (width <= 1100px) {
    .robot-binding-dialog__base-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (width <= 900px) {
    .state-rule-row__main,
    .state-rule-row__fault {
      grid-template-columns: 1fr 1fr;
      margin-left: 0;
    }
  }
</style>
