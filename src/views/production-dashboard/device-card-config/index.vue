<template>
  <main class="device-card-config" v-loading="loading">
    <header class="device-card-config__header">
      <div>
        <p>DEVICE CARD CONFIGURATION</p>
        <h1>设备卡片配置</h1>
        <span>按线体维护设备卡、实时展示字段、状态映射和需要追溯的字段。</span>
      </div>
      <div>
        <el-button @click="load">刷新</el-button>
        <el-button type="primary" @click="router.push({ name: 'ProductionDashboardDeviceCards' })">
          进入设备卡片看板
        </el-button>
      </div>
    </header>

    <section class="device-card-config__toolbar">
      <span>线体</span>
      <el-select v-model="lineCode" class="device-card-config__line" @change="loadCards">
        <el-option
          v-for="line in lines"
          :key="line.lineCode"
          :label="`${line.lineName}（${line.lineCode}）`"
          :value="line.lineCode"
        />
      </el-select>
      <span class="device-card-config__label">每行卡片数</span>
      <el-input-number v-model="columnCount" :min="1" :max="6" controls-position="right" />
      <el-button type="primary" :disabled="!lineCode" @click="saveGrid">保存布局</el-button>
      <el-button :disabled="!lineCode" @click="openAlertRecords">查看越限记录</el-button>
      <el-button :disabled="!lineCode" @click="pushRecordsOpen = true">字段推送记录</el-button>
      <el-button type="primary" :disabled="!lineCode" @click="openDialog()">新增设备卡片</el-button>
    </section>

    <section class="device-card-config__content">
      <el-alert
        title="追溯、AI 分析、字段推送独立配置。系统微信推送可选择已绑定用户；系统负责的字段告警不会重复进入外部 MCP 推送待办。"
        type="info"
        :closable="false"
        show-icon
      />
      <el-table
        :data="cards"
        border
        class="device-card-config__table"
        empty-text="当前线体尚未配置设备卡片"
      >
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column prop="cardName" label="卡片名称" min-width="170">
          <template #default="{ row }">
            <b>{{ row.cardName }}</b>
            <small>{{ row.cardCode }}</small>
          </template>
        </el-table-column>
        <el-table-column prop="deviceMark" label="实时设备" min-width="160" />
        <el-table-column prop="modelMark" label="设备模型" min-width="140">
          <template #default="{ row }">{{ row.modelMark || '—' }}</template>
        </el-table-column>
        <el-table-column label="字段 / 追溯 / AI / 推送" min-width="270">
          <template #default="{ row }">
            {{ row.fields.length }} 个字段 ·
            {{ row.fields.filter((field: DashboardDeviceCardField) => field.traceEnabled).length }}
            个追溯 ·
            {{
              row.fields.filter((field: DashboardDeviceCardField) => field.aiAnalysisEnabled).length
            }}
            个 AI ·
            {{ pushFieldCount(row) }} 个推送
          </template>
        </el-table-column>
        <el-table-column label="状态字段" min-width="170">
          <template #default="{ row }">{{ row.statusSourcePath || '仅在线/离线' }}</template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="editCard(row)">编辑</el-button>
            <el-button link type="danger" @click="removeCard(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog
      v-model="dialogOpen"
      :title="form.id ? '编辑设备卡片' : '新增设备卡片'"
      width="min(1040px, 96vw)"
      top="4vh"
      append-to-body
      destroy-on-close
    >
      <el-form label-position="top">
        <div class="device-card-config__form-grid">
          <el-form-item label="卡片编码" required>
            <el-input v-model.trim="form.cardCode" placeholder="例如 PRESS_01" />
          </el-form-item>
          <el-form-item label="卡片名称" required>
            <el-input v-model.trim="form.cardName" placeholder="例如 压装设备 01" />
          </el-form-item>
          <el-form-item label="在线超时（秒）">
            <el-input-number
              v-model="form.onlineTimeoutSeconds"
              :min="5"
              :max="86400"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="form.enabled" active-text="已启用" inactive-text="已停用" />
          </el-form-item>
        </div>
      </el-form>

      <section class="device-card-config__source">
        <h3>实时数据源</h3>
        <div class="device-card-config__form-grid">
          <el-form-item label="设备模型">
            <el-select
              v-model="modelMark"
              filterable
              clearable
              :loading="sourceLoading"
              @change="loadSources"
            >
              <el-option
                v-for="model in models"
                :key="model.modelMark"
                :label="`${model.displayName}（${model.deviceCount} 台）`"
                :value="model.modelMark"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="实时设备" required>
            <el-select
              v-model="sourceKey"
              filterable
              :loading="sourceLoading"
              @change="selectSource"
            >
              <el-option
                v-for="source in sources"
                :key="`${source.tenantMark}|${source.deviceMark}`"
                :label="`${source.deviceMark} · ${source.dataOnline ? '在线' : '离线'}`"
                :value="`${source.tenantMark}|${source.deviceMark}`"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="状态字段">
            <el-select
              v-model="form.statusSourcePath"
              filterable
              clearable
              placeholder="未配置时仅统计在线/离线"
            >
              <el-option
                v-for="field in sourceFields"
                :key="field.sourcePath"
                :label="sourceFieldLabel(field)"
                :value="field.sourcePath"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="状态值映射（JSON）" class="device-card-config__status-mapping-item">
            <el-input
              v-model.trim="form.statusMappingJson"
              class="device-card-config__status-mapping"
              placeholder='例如 {"2":"FAULT","1":"ONLINE"}'
            />
          </el-form-item>
        </div>
      </section>

      <section class="device-card-config__fields">
        <div class="device-card-config__fields-head">
          <div>
            <h3>展示字段与追溯</h3>
            <p>主值突出显示；标签适合状态或短文本；明细按列表展示。</p>
            <p>上下限只对数值字段生效；持续越限不会重复创建告警，恢复正常会记录恢复事件。</p>
          </div>
          <div>
            <el-select
              v-model="newFieldPath"
              filterable
              placeholder="选择实时字段"
              class="device-card-config__field-select"
            >
              <el-option
                v-for="field in sourceFields"
                :key="field.sourcePath"
                :label="sourceFieldLabel(field)"
                :value="field.sourcePath"
              />
            </el-select>
            <el-button type="primary" :disabled="!newFieldPath" @click="addField">
              添加字段
            </el-button>
          </div>
        </div>
        <el-table
          :data="form.fields"
          border
          max-height="330"
          empty-text="请从实时数据源选择需要显示的字段"
        >
          <el-table-column label="字段名称" min-width="145">
            <template #default="{ row }">
              <el-input v-model.trim="row.displayName" :disabled="row.useModelDisplayMapping" />
            </template>
          </el-table-column>
          <el-table-column label="来源字段" min-width="190">
            <template #default="{ row }">
              <span class="device-card-config__path">{{ row.sourcePath }}</span>
            </template>
          </el-table-column>
          <el-table-column label="模型映射" width="105">
            <template #default="{ row }">
              <el-switch
                v-model="row.useModelDisplayMapping"
                active-text="继承"
                inactive-text="自定义"
              />
            </template>
          </el-table-column>
          <el-table-column label="显示方式" width="120">
            <template #default="{ row }">
              <el-select v-model="row.displayMode">
                <el-option label="主值" value="Primary" />
                <el-option label="标签" value="Tag" />
                <el-option label="明细" value="Detail" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="单位" width="100">
            <template #default="{ row }">
              <el-input v-model.trim="row.unit" :disabled="row.useModelDisplayMapping" />
            </template>
          </el-table-column>
          <el-table-column label="小数位" width="105">
            <template #default="{ row }">
              <el-input-number
                v-model="row.decimals"
                :disabled="row.useModelDisplayMapping"
                :min="0"
                :max="8"
                controls-position="right"
              />
            </template>
          </el-table-column>
          <el-table-column label="追溯" width="90">
            <template #default="{ row }"><el-switch v-model="row.traceEnabled" /></template>
          </el-table-column>
          <el-table-column label="变化阈值" width="125">
            <template #default="{ row }">
              <el-input-number
                v-model="row.traceThreshold"
                :disabled="!row.traceEnabled"
                :min="0"
                :precision="3"
                controls-position="right"
              />
            </template>
          </el-table-column>
          <el-table-column label="下限" width="125">
            <template #default="{ row }">
              <el-input-number
                v-model="row.alarmLowerLimit"
                :disabled="!isNumericField(row)"
                :precision="3"
                controls-position="right"
                placeholder="可选"
              />
            </template>
          </el-table-column>
          <el-table-column label="上限" width="125">
            <template #default="{ row }">
              <el-input-number
                v-model="row.alarmUpperLimit"
                :disabled="!isNumericField(row)"
                :precision="3"
                controls-position="right"
                placeholder="可选"
              />
            </template>
          </el-table-column>
          <el-table-column label="AI 分析" width="90">
            <template #default="{ row }">
              <el-switch v-model="row.aiAnalysisEnabled" />
            </template>
          </el-table-column>
          <el-table-column label="数据推送" width="155">
            <template #default="{ row }">
              <el-switch
                :model-value="Boolean(row.push?.enabled)"
                @change="setPushEnabled(row, $event)"
              />
              <el-button link type="primary" @click="openPushSettings(row)">设置</el-button>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" fixed="right">
            <template #default="{ $index }">
              <el-button link type="danger" @click="form.fields.splice($index, 1)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="alertDialogOpen"
      title="设备字段越限记录"
      width="min(1160px, 96vw)"
      append-to-body
    >
      <el-table
        v-loading="alertLoading"
        :data="alertRecords"
        border
        max-height="560"
        empty-text="当前线体暂无越限记录"
      >
        <el-table-column prop="dataTime" label="发生时间" min-width="165" />
        <el-table-column prop="deviceMark" label="设备" min-width="150" />
        <el-table-column prop="displayName" label="字段" min-width="130">
          <template #default="{ row }">{{ row.displayName }}（{{ row.fieldCode }}）</template>
        </el-table-column>
        <el-table-column prop="numericValue" label="当前值" width="110" />
        <el-table-column label="配置范围" min-width="145">
          <template #default="{ row }">{{ formatAlertRange(row) }}</template>
        </el-table-column>
        <el-table-column label="事件" width="115">
          <template #default="{ row }">
            <el-tag :type="alertTypeTag(row.alertType)">{{ alertTypeLabel(row.alertType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="推送状态" width="120">
          <template #default="{ row }">{{ pushStatusLabel(row.pushStatus) }}</template>
        </el-table-column>
        <el-table-column prop="claimedBy" label="推送智能体" min-width="135">
          <template #default="{ row }">{{ row.claimedBy || '—' }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>
    <FieldPushDialog
      v-model="pushDialogOpen"
      :field="pushField"
      :card-id="form.id"
      :card-name="form.cardName"
      :line-code="lineCode"
      :current-value="
        sourceFields.find((field) => field.sourcePath === pushField?.sourcePath)?.currentValue
      "
      @apply="applyPushSettings"
    />
    <PushRecordsDialog v-model="pushRecordsOpen" :line-code="lineCode" />
  </main>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useRouter } from 'vue-router'
  import FieldPushDialog from './components/FieldPushDialog.vue'
  import PushRecordsDialog from './components/PushRecordsDialog.vue'
  import { defaultDeviceCardPush, type DeviceCardPushConfig } from '@/api/device-card-push'
  import type {
    DashboardDataSourceModelOption,
    DashboardDataSourceOption,
    DashboardDeviceCard,
    DashboardDeviceCardAlertRecord,
    DashboardDeviceCardField,
    DashboardLineConfig,
    DashboardSourceFieldOption
  } from '@/api/edge-dashboard'
  import {
    deleteDashboardDeviceCard,
    fetchDashboardBootstrap,
    fetchDashboardDataSourceModels,
    fetchDashboardDataSourcesByModel,
    fetchDashboardDeviceCardRuntime,
    fetchDashboardDeviceCardAlertRecords,
    fetchDashboardDeviceCards,
    fetchDashboardSourceFields,
    saveDashboardDeviceCard,
    saveDashboardDeviceCardBoardSetting
  } from '@/api/edge-dashboard'

  const router = useRouter()
  const loading = ref(false)
  const saving = ref(false)
  const sourceLoading = ref(false)
  const lines = ref<DashboardLineConfig[]>([])
  const cards = ref<DashboardDeviceCard[]>([])
  const lineCode = ref('')
  const columnCount = ref(4)
  const models = ref<DashboardDataSourceModelOption[]>([])
  const sources = ref<DashboardDataSourceOption[]>([])
  const sourceFields = ref<DashboardSourceFieldOption[]>([])
  const dialogOpen = ref(false)
  const alertDialogOpen = ref(false)
  const alertLoading = ref(false)
  const alertRecords = ref<DashboardDeviceCardAlertRecord[]>([])
  const pushDialogOpen = ref(false)
  const pushRecordsOpen = ref(false)
  const pushField = ref<DashboardDeviceCardField | null>(null)
  const pushFieldCount = (row: unknown) =>
    (row as DashboardDeviceCard).fields.filter((field) => field.push?.enabled).length
  const openPushSettings = (row: unknown) => {
    const field = row as DashboardDeviceCardField
    pushField.value = field
    pushDialogOpen.value = true
  }
  const setPushEnabled = (row: unknown, enabled: unknown) => {
    const field = row as DashboardDeviceCardField
    field.push ??= defaultDeviceCardPush()
    field.push.enabled = Boolean(enabled)
    if (enabled) openPushSettings(field)
  }
  const applyPushSettings = (config: DeviceCardPushConfig) => {
    if (pushField.value)
      pushField.value.push = { ...config, recipientUserIds: [...config.recipientUserIds] }
  }
  const modelMark = ref('')
  const sourceKey = ref('')
  const newFieldPath = ref('')
  const blank = (): DashboardDeviceCard => ({
    id: 0,
    dashboardCode: 'device-card-dashboard',
    lineCode: lineCode.value,
    cardCode: '',
    cardName: '',
    tenantMark: '',
    deviceMark: '',
    onlineTimeoutSeconds: 30,
    sort: cards.value.length * 10 + 10,
    enabled: true,
    fields: []
  })
  const form = ref<DashboardDeviceCard>(blank())
  const loadCards = async () => {
    if (!lineCode.value) return
    cards.value = await fetchDashboardDeviceCards(lineCode.value)
    const runtime = await fetchDashboardDeviceCardRuntime(lineCode.value)
    columnCount.value = runtime.columnCount
  }
  const load = async () => {
    loading.value = true
    try {
      const [bootstrap, modelRows] = await Promise.all([
        fetchDashboardBootstrap('production-dashboard'),
        fetchDashboardDataSourceModels()
      ])
      lines.value = bootstrap.lines.filter((line) => line.enabled)
      models.value = modelRows
      if (!lineCode.value || !lines.value.some((line) => line.lineCode === lineCode.value))
        lineCode.value = lines.value[0]?.lineCode || ''
      await loadCards()
    } finally {
      loading.value = false
    }
  }
  const loadSources = async () => {
    sourceKey.value = ''
    sourceFields.value = []
    sources.value = []
    if (!modelMark.value) return
    sourceLoading.value = true
    try {
      sources.value = await fetchDashboardDataSourcesByModel(modelMark.value)
    } finally {
      sourceLoading.value = false
    }
  }
  const selectSource = async () => {
    const source = sources.value.find(
      (item) => `${item.tenantMark}|${item.deviceMark}` === sourceKey.value
    )
    if (!source) return
    form.value.tenantMark = source.tenantMark
    form.value.deviceMark = source.deviceMark
    form.value.modelMark = source.modelMark
    sourceFields.value = await fetchDashboardSourceFields(source.tenantMark, source.deviceMark)
  }
  /** Element Plus 表格行是响应式代理对象，不能直接传入 structuredClone。 */
  const cloneCard = (card: DashboardDeviceCard): DashboardDeviceCard => ({
    ...card,
    fields: card.fields.map((field) => ({
      ...field,
      push: field.push
        ? { ...field.push, recipientUserIds: [...field.push.recipientUserIds] }
        : defaultDeviceCardPush()
    }))
  })
  const openDialog = async (card?: DashboardDeviceCard) => {
    form.value = card ? cloneCard(card) : blank()
    modelMark.value = form.value.modelMark || ''
    sourceKey.value =
      form.value.tenantMark && form.value.deviceMark
        ? `${form.value.tenantMark}|${form.value.deviceMark}`
        : ''
    sourceFields.value = []
    newFieldPath.value = ''
    if (modelMark.value) {
      await loadSources()
      if (form.value.tenantMark && form.value.deviceMark) {
        sourceKey.value = `${form.value.tenantMark}|${form.value.deviceMark}`
        await selectSource()
      }
    }
    dialogOpen.value = true
  }
  /** 生成当前卡片尚未使用的字段编码，避免删除字段后按数组长度重新产生重复编码。 */
  const getNextFieldCode = (usedCodes: Set<string>) => {
    let index = 1
    let fieldCode = `field_${index}`
    while (usedCodes.has(fieldCode)) {
      index += 1
      fieldCode = `field_${index}`
    }
    return fieldCode
  }
  /** 兼容历史表单中可能已经存在的空编码或重复编码，保存前统一修复。 */
  const normalizeFieldCodes = () => {
    const usedCodes = new Set<string>()
    form.value.fields.forEach((field) => {
      const fieldCode = field.fieldCode?.trim()
      if (fieldCode && !usedCodes.has(fieldCode)) {
        field.fieldCode = fieldCode
        usedCodes.add(fieldCode)
        return
      }
      const nextFieldCode = getNextFieldCode(usedCodes)
      field.fieldCode = nextFieldCode
      usedCodes.add(nextFieldCode)
    })
  }
  /** 数据源已应用模型展示映射时，在下拉项中明确说明字段会与生产看板共用该规则。 */
  const sourceFieldLabel = (field: DashboardSourceFieldOption) =>
    `${field.fieldName}${field.hasModelDisplayMapping ? '（模型映射）' : ''} · ${field.sourcePath}`
  const addField = () => {
    const source = sourceFields.value.find((field) => field.sourcePath === newFieldPath.value)
    if (!source || form.value.fields.some((field) => field.sourcePath === source.sourcePath)) return
    const usedCodes = new Set(form.value.fields.map((field) => field.fieldCode.trim()))
    const field: DashboardDeviceCardField = {
      id: 0,
      fieldCode: getNextFieldCode(usedCodes),
      sourcePath: source.sourcePath,
      displayName: source.fieldName,
      displayMode: form.value.fields.length ? 'Detail' : 'Primary',
      valueType: source.valueType,
      formatType: source.formatType,
      unit: source.unit,
      decimals: source.decimals,
      mappingJson: source.mappingJson,
      useModelDisplayMapping: true,
      traceEnabled: false,
      aiAnalysisEnabled: false,
      push: defaultDeviceCardPush(),
      sort: (form.value.fields.length + 1) * 10,
      enabled: true
    }
    form.value.fields.push(field)
    newFieldPath.value = ''
  }
  const save = async () => {
    if (
      !form.value.cardCode ||
      !form.value.cardName ||
      !form.value.tenantMark ||
      !form.value.deviceMark
    )
      return ElMessage.warning('请填写卡片信息并选择实时设备')
    if (!form.value.fields.length) return ElMessage.warning('请至少添加一个展示字段')
    const invalidPush = form.value.fields.find((field) => {
      const push = field.push
      if (!push?.enabled) return false
      return (
        (!push.onChange && !push.onLimit && !push.onRecovery) ||
        (push.channel === 'WeChat' && !push.recipientUserIds.length) ||
        ((push.onLimit || push.onRecovery) &&
          field.alarmLowerLimit == null &&
          field.alarmUpperLimit == null)
      )
    })
    if (invalidPush)
      return ElMessage.warning(`字段“${invalidPush.displayName}”请完善触发方式、接收人及上下限配置`)
    const invalidLimitField = form.value.fields.find((field) => {
      const hasLimit = field.alarmLowerLimit !== undefined || field.alarmUpperLimit !== undefined
      return (
        (hasLimit && !isNumericField(field)) ||
        (field.alarmLowerLimit !== undefined &&
          field.alarmUpperLimit !== undefined &&
          field.alarmLowerLimit >= field.alarmUpperLimit)
      )
    })
    if (invalidLimitField)
      return ElMessage.warning(`字段“${invalidLimitField.displayName}”的上下限配置无效`)
    normalizeFieldCodes()
    saving.value = true
    try {
      form.value.lineCode = lineCode.value
      await saveDashboardDeviceCard(form.value)
      dialogOpen.value = false
      ElMessage.success('设备卡片已保存')
      await loadCards()
    } finally {
      saving.value = false
    }
  }
  const saveGrid = async () => {
    await saveDashboardDeviceCardBoardSetting({
      id: 0,
      dashboardCode: 'device-card-dashboard',
      lineCode: lineCode.value,
      columnCount: columnCount.value
    })
    ElMessage.success('每行卡片数已保存')
  }
  const remove = async (card: DashboardDeviceCard) => {
    await ElMessageBox.confirm(
      `确认删除“${card.cardName}”吗？历史追溯记录会保留。`,
      '删除设备卡片',
      { type: 'warning' }
    )
    await deleteDashboardDeviceCard(card.id)
    ElMessage.success('设备卡片已删除')
    await loadCards()
  }
  const editCard = (row: unknown) => openDialog(row as DashboardDeviceCard)
  const removeCard = (row: unknown) => remove(row as DashboardDeviceCard)
  const isNumericField = (field: unknown) =>
    /(number|decimal|double|float|int|long)/i.test(
      (field as DashboardDeviceCardField).valueType || ''
    )
  const openAlertRecords = async () => {
    if (!lineCode.value) return
    alertDialogOpen.value = true
    alertLoading.value = true
    try {
      const result = await fetchDashboardDeviceCardAlertRecords({
        lineCode: lineCode.value,
        current: 1,
        size: 100
      })
      alertRecords.value = result.records
    } finally {
      alertLoading.value = false
    }
  }
  const alertTypeLabel = (value: string) =>
    ({ LowerExceeded: '低于下限', UpperExceeded: '高于上限', Recovered: '恢复正常' })[value] ||
    value
  const alertTypeTag = (value: string) =>
    value === 'Recovered' ? 'success' : value === 'UpperExceeded' ? 'danger' : 'warning'
  const pushStatusLabel = (value: string) =>
    (
      ({
        Pending: '待推送',
        Processing: '推送中',
        Sent: '已推送',
        NotRequired: '无需推送',
        Internal: '系统负责（见字段推送记录）'
      }) as Record<string, string>
    )[value] || value
  const formatAlertRange = (row: unknown) => {
    const alert = row as DashboardDeviceCardAlertRecord
    return `${alert.alarmLowerLimit ?? '—'} ~ ${alert.alarmUpperLimit ?? '—'}`
  }
  watch(lineCode, () => {
    if (lineCode.value) loadCards()
  })
  load()
</script>

<style scoped lang="scss">
  .device-card-config {
    min-height: 100%;
    padding: 24px;
    color: #17233d;
    background: #f5f7fb;
  }

  .device-card-config__header,
  .device-card-config__toolbar,
  .device-card-config__fields-head {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  }

  .device-card-config__header {
    margin-bottom: 20px;
  }

  .device-card-config__header p {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    color: #4f7cff;
    letter-spacing: 0.12em;
  }

  .device-card-config__header h1 {
    margin: 5px 0;
    font-size: 25px;
  }

  .device-card-config__header span,
  .device-card-config__fields p {
    font-size: 13px;
    color: #7b8496;
  }

  .device-card-config__toolbar,
  .device-card-config__content,
  .device-card-config__source,
  .device-card-config__fields {
    padding: 18px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 3px 14px rgb(30 58 110 / 6%);
  }

  .device-card-config__toolbar {
    justify-content: flex-start;
    margin-bottom: 16px;
  }

  .device-card-config__line {
    width: 270px;
  }

  .device-card-config__label {
    margin-left: 12px;
  }

  .device-card-config__table {
    margin-top: 16px;
  }

  .device-card-config__table small {
    display: block;
    margin-top: 4px;
    color: #8b95a8;
  }

  .device-card-config__form-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 16px;
  }

  .device-card-config__status-mapping {
    width: 100%;
  }

  .device-card-config__status-mapping-item {
    grid-column: span 3;
  }

  .device-card-config__source,
  .device-card-config__fields {
    margin-top: 18px;
    border: 1px solid #edf0f6;
    box-shadow: none;
  }

  .device-card-config__source h3,
  .device-card-config__fields h3 {
    margin: 0 0 12px;
  }

  .device-card-config__fields-head {
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .device-card-config__fields-head p {
    margin: 5px 0 0;
  }

  .device-card-config__field-select {
    width: 270px;
    margin-right: 8px;
  }

  .device-card-config__path {
    font-family: monospace;
    font-size: 12px;
    color: #596780;
  }

  @media (width <= 760px) {
    .device-card-config {
      padding: 14px;
    }

    .device-card-config__header,
    .device-card-config__toolbar,
    .device-card-config__fields-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .device-card-config__form-grid {
      grid-template-columns: 1fr;
    }

    .device-card-config__line,
    .device-card-config__field-select {
      width: 100%;
    }
  }
</style>
