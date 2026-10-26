<template>
  <section class="process-config" v-loading="loading">
    <header
      ><div><h2>工艺看板配置</h2><p>独立区域、线体、工艺参数卡片</p></div>
      <el-button @click="router.push({ name: 'ProcessBoard' })">查看看板</el-button></header
    >
    <el-tabs v-model="kind">
      <el-tab-pane label="区域管理" name="Region" />
      <el-tab-pane label="工艺线体" name="Line" />
      <el-tab-pane label="参数卡片" name="Card" />
      <el-tab-pane label="采样与发送" name="Settings" />
    </el-tabs>
    <template v-if="kind !== 'Settings'">
      <div class="toolbar">
        <el-select
          v-if="kind !== 'Region'"
          v-model="parentFilter"
          clearable
          filterable
          placeholder="筛选所属区域 / 线体"
        >
          <el-option
            v-for="item in parentOptions"
            :key="item.id"
            :value="item.id"
            :label="`${item.name} (${item.code})`"
          />
        </el-select>
        <el-button type="primary" @click="open()">新增{{ kindLabel }}</el-button>
        <el-button @click="load">刷新配置</el-button>
      </div>
      <el-table :data="filteredRows" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="code" label="编码" min-width="160" />
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column label="所属"
          ><template #default="{ row }">{{ parentName(row.parentId) }}</template></el-table-column
        >
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="启用" width="90"
          ><template #default="{ row }"
            ><el-tag :type="row.enabled ? 'success' : 'info'">{{
              row.enabled ? '启用' : '停用'
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="操作" width="190"
          ><template #default="{ row }">
            <el-button link type="primary" @click="open(row as ProcessDefinition)">编辑</el-button>
            <el-button v-if="row.kind === 'Line'" link @click="viewLine(row.id)"
              >流程 / 布局</el-button
            >
          </template></el-table-column
        >
      </el-table>
    </template>
    <el-form v-else label-width="150px" class="settings-form">
      <el-alert
        title="采样、保留与发送间隔为平台级配置，仅平台管理员可保存。微信间隔与原设备卡片共用。"
        :closable="false"
      />
      <el-divider>mXparser 授权配置</el-divider>
      <el-form-item label="使用类型">
        <el-select v-model="setting.formulaUseType">
          <el-option label="个人非商业使用" value="Personal" />
          <el-option label="已取得商业授权" value="Commercial" />
        </el-select>
      </el-form-item>
      <el-form-item label="使用者署名"
        ><el-input
          v-model.trim="setting.formulaSignature"
          maxlength="128"
          placeholder="填写真实使用者或授权主体名称"
      /></el-form-item>
      <el-form-item label="条款确认"
        ><el-checkbox v-model="setting.formulaTermsAccepted">{{
          setting.formulaUseType === 'Personal'
            ? '确认仅用于个人非商业用途'
            : '确认已取得适用的商业授权'
        }}</el-checkbox></el-form-item
      >
      <el-alert title="原始字段正常展示，公式返回明确提示。" type="warning" :closable="false" />
      <el-form-item label="采样间隔（秒）"
        ><el-input-number v-model="setting.sampleIntervalSeconds" :min="1" :max="3600"
      /></el-form-item>
      <el-form-item label="数据保留（小时）"
        ><el-input-number v-model="setting.retentionHours" :min="1" :max="8760"
      /></el-form-item>
      <el-form-item label="微信聚合间隔（秒）"
        ><el-input-number v-model="setting.pushIntervalSeconds" :min="1" :max="86400"
      /></el-form-item>
      <el-form-item
        ><el-button :loading="saving" type="primary" @click="saveSetting"
          >保存全局设置</el-button
        ></el-form-item
      >
    </el-form>
    <el-dialog
      v-model="dialog"
      :title="`${form.id ? '编辑' : '新增'}${form.kind === 'Region' ? '区域' : form.kind === 'Line' ? '工艺线体' : '参数卡片'}`"
      width="min(1100px, 95vw)"
      destroy-on-close
    >
      <el-form label-width="110px">
        <el-row :gutter="20">
          <el-col :span="12"
            ><el-form-item label="编码"
              ><el-input v-model.trim="form.code" maxlength="64" /></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="名称"
              ><el-input v-model.trim="form.name" maxlength="128" /></el-form-item
          ></el-col>
        </el-row>
        <el-form-item v-if="form.kind !== 'Region'" label="所属">
          <el-select v-model="form.parentId" :disabled="form.id > 0" filterable style="width: 100%">
            <el-option
              v-for="parent in formParents"
              :key="parent.id"
              :value="parent.id"
              :label="`${parent.name} (${parent.code})`"
            />
          </el-select>
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12"
            ><el-form-item label="排序"><el-input-number v-model="form.sort" /></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item
          ></el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12"
            ><el-form-item label="宽度（px）"
              ><el-input-number v-model="form.width" :min="160" :max="3840" /></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="高度（px）"
              ><el-input-number v-model="form.height" :min="100" :max="2160" /></el-form-item
          ></el-col>
        </el-row>
        <el-form-item v-if="form.kind === 'Card'" label="每行参数数量">
          <div>
            <el-input-number v-model="form.fieldColumns" :min="1" :max="6" :precision="0" />
            <p class="tip">每行最多展示几组 Key / Value；卡片宽度不足时自动减少，默认 1 组。</p>
          </div>
        </el-form-item>
        <template v-if="form.kind !== 'Card'">
          <el-form-item label="排列方式"
            ><el-select v-model="form.layout"
              ><el-option label="响应式网格" value="grid" /><el-option
                label="横向"
                value="horizontal" /><el-option label="纵向" value="vertical" /><el-option
                v-if="form.kind === 'Line'"
                label="自由定位"
                value="free" /></el-select
          ></el-form-item>
          <el-form-item label="每行数量"
            ><el-input-number v-model="form.columns" :min="1" :max="12"
          /></el-form-item>
        </template>
        <template v-if="form.kind === 'Line'">
          <el-form-item label="曲线布局"
            ><el-select v-model="form.panelLayout"
              ><el-option label="卡片 / 曲线标签切换" value="tabs" /><el-option
                label="卡片与曲线同屏"
                value="split" /></el-select
          ></el-form-item>
          <el-row :gutter="20">
            <el-col :span="12"
              ><el-form-item label="流程区域高度"
                ><el-input-number v-model="form.flowHeight" :min="160" :max="2160" /></el-form-item
            ></el-col>
            <el-col :span="12"
              ><el-form-item label="曲线区域高度"
                ><el-input-number v-model="form.trendHeight" :min="200" :max="2160" /></el-form-item
            ></el-col>
            <el-col :span="12"
              ><el-form-item label="流程区域宽度"
                ><el-input-number v-model="form.flowWidth" :min="0" :max="3840" /></el-form-item
            ></el-col>
            <el-col :span="12"
              ><el-form-item label="曲线区域宽度"
                ><el-input-number v-model="form.trendWidth" :min="0" :max="3840" /></el-form-item
            ></el-col>
          </el-row>
          <p class="tip">区域宽度填 0 时自适应，其他尺寸单位为 px。</p>
          <el-divider>线体关联设备</el-divider>
          <div v-for="(_device, index) in form.devices" :key="index" class="device-row"
            ><SourceBindingEditor v-model="form.devices[index]" device-only /><el-button
              link
              type="danger"
              @click="form.devices.splice(index, 1)"
              >移除</el-button
            ></div
          >
          <el-button @click="form.devices.push(emptyBinding())">新增关联设备</el-button>
          <p class="tip"
            >工艺流程和卡片拖动布局在“流程 /
            布局”入口编辑；下属卡片的字段和公式变量只能选择这里关联的设备。</p
          >
        </template>
        <template v-if="form.kind === 'Card' || form.kind === 'Line'">
          <el-alert
            v-if="form.kind === 'Card'"
            :closable="false"
            :type="cardDeviceIssues.length ? 'warning' : 'info'"
            :title="
              cardDeviceIssues.length
                ? `存在不在线体范围内的绑定：${cardDeviceIssues.map((issue) => issue.label).join('、')}。原有绑定保留，新增或改绑需选择线体内设备。`
                : '字段及公式变量仅可选择所属线体已关联、且当前账号已授权的设备。固定文本和固定数值不受限制。'
            "
          />
          <el-divider>{{
            form.kind === 'Line'
              ? '线体独立曲线字段（无需展示在卡片中）'
              : '展示字段 / 公式 / 追溯 / 推送'
          }}</el-divider>
          <el-button @click="editField()">新增字段</el-button>
          <el-table :data="form.fields" border class="fields-table">
            <el-table-column prop="code" label="字段编码" /><el-table-column
              prop="name"
              label="Key 名称"
            />
            <el-table-column prop="formula" label="公式" show-overflow-tooltip />
            <el-table-column label="历史"
              ><template #default="{ row }"
                >{{ row.trendEnabled ? '曲线 ' : '' }}{{ row.traceEnabled ? '追溯' : '' }}</template
              ></el-table-column
            >
            <el-table-column label="操作" width="200"
              ><template #default="{ $index }"
                ><el-button link @click="editField($index)">编辑</el-button
                ><el-button link @click="moveField($index, -1)">上移</el-button
                ><el-button link type="danger" @click="form.fields.splice($index, 1)"
                  >移除</el-button
                ></template
              ></el-table-column
            >
          </el-table>
        </template>
      </el-form>
      <template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save">保存配置</el-button></template
      >
    </el-dialog>
    <ParameterFieldEditor
      v-model="fieldDialog"
      :value="fieldDraft"
      :process-line-id="form.kind === 'Card' ? form.parentId : undefined"
      :allowed-devices="form.kind === 'Card' ? cardAllowedDevices : undefined"
      @save="applyField"
    />
  </section>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import {
    emptyBinding,
    emptyDefinition,
    emptyField,
    normalizeFieldColumns,
    processApi,
    type ProcessDefinition,
    type ProcessField,
    type ProcessSettings
  } from '@/api/process-board'
  import ParameterFieldEditor from '../components/ParameterFieldEditor.vue'
  import SourceBindingEditor from '../components/SourceBindingEditor.vue'
  import {
    processDeviceIssues,
    processDeviceReferences,
    processDeviceKey
  } from '../components/device-scope'

  const router = useRouter()
  const loading = ref(false)
  const saving = ref(false)
  const definitions = ref<ProcessDefinition[]>([])
  const kind = ref<ProcessDefinition['kind'] | 'Settings'>('Region')
  const parentFilter = ref<number>()
  const dialog = ref(false)
  const form = ref(emptyDefinition('Region'))
  const originalDefinition = ref<ProcessDefinition>()
  const cardAllowedDevices = computed(
    () =>
      definitions.value.find((item) => item.kind === 'Line' && item.id === form.value.parentId)
        ?.devices || []
  )
  const cardDeviceIssues = computed(() =>
    form.value.kind === 'Card'
      ? processDeviceIssues(form.value, cardAllowedDevices.value, originalDefinition.value)
      : []
  )
  const fieldDialog = ref(false)
  const fieldDraft = ref(emptyField())
  const fieldIndex = ref(-1)
  const setting = ref<ProcessSettings>({
    formulaUseType: 'Personal',
    formulaSignature: '',
    formulaTermsAccepted: false,
    sampleIntervalSeconds: 5,
    retentionHours: 120,
    pushIntervalSeconds: 5
  })
  const kindLabel = computed(
    () => ({ Region: '区域', Line: '工艺线体', Card: '参数卡片', Settings: '' })[kind.value]
  )
  const parentOptions = computed(() =>
    definitions.value.filter((item) => item.kind === (kind.value === 'Line' ? 'Region' : 'Line'))
  )
  const formParents = computed(() =>
    definitions.value.filter(
      (item) => item.kind === (form.value.kind === 'Line' ? 'Region' : 'Line')
    )
  )
  const filteredRows = computed(() =>
    definitions.value.filter(
      (item) =>
        item.kind === kind.value && (!parentFilter.value || item.parentId === parentFilter.value)
    )
  )

  watch(kind, () => {
    parentFilter.value = undefined
  })

  function parentName(id: number) {
    return definitions.value.find((item) => item.id === id)?.name || '—'
  }

  async function load() {
    loading.value = true
    try {
      const [rows, configuration] = await Promise.all([
        processApi.definitions(),
        processApi.setting()
      ])
      definitions.value = rows
      setting.value = configuration
    } finally {
      loading.value = false
    }
  }

  function open(row?: ProcessDefinition) {
    if (kind.value === 'Settings') return
    originalDefinition.value = row ? JSON.parse(JSON.stringify(row)) : undefined
    form.value = row
      ? JSON.parse(JSON.stringify(row))
      : emptyDefinition(kind.value, parentFilter.value || 0)
    form.value.fieldColumns = normalizeFieldColumns(form.value.fieldColumns)
    dialog.value = true
  }

  async function save() {
    const invalid = cardDeviceIssues.value.find((issue) => !issue.legacy)
    if (invalid) {
      ElMessage.warning(
        `${invalid.label}的设备未关联到所属线体，请重新选择或先在线体配置中关联设备`
      )
      return
    }
    if (form.value.kind === 'Line' && originalDefinition.value) {
      const remaining = new Set(
        form.value.devices.filter((source) => source.fixedValue == null).map(processDeviceKey)
      )
      const removed = new Set(
        originalDefinition.value.devices
          .filter((source) => source.fixedValue == null && !remaining.has(processDeviceKey(source)))
          .map(processDeviceKey)
      )
      const referenced = definitions.value
        .filter((item) => item.kind === 'Card' && item.parentId === form.value.id)
        .flatMap((card) =>
          processDeviceReferences(card)
            .filter((ref) => removed.has(processDeviceKey(ref.source)))
            .map((ref) => `卡片“${card.name}”${ref.label}`)
        )
      if (referenced.length) {
        ElMessage.warning(`不能移除正在使用的设备，请先调整：${referenced.slice(0, 4).join('；')}`)
        return
      }
    }
    if (!form.value.code || !form.value.name) {
      ElMessage.warning('请填写编码和名称')
      return
    }
    if (
      !Number.isInteger(form.value.fieldColumns) ||
      form.value.fieldColumns < 1 ||
      form.value.fieldColumns > 6
    ) {
      ElMessage.warning('每行参数数量必须为 1～6 组')
      return
    }
    saving.value = true
    try {
      await processApi.save(JSON.parse(JSON.stringify(form.value)))
      dialog.value = false
      ElMessage.success('配置已保存')
      await load()
    } finally {
      saving.value = false
    }
  }

  function editField(index = -1) {
    fieldIndex.value = index
    fieldDraft.value = index >= 0 ? form.value.fields[index] : emptyField()
    fieldDialog.value = true
  }

  function applyField(field: ProcessField) {
    if (
      form.value.fields.some(
        (item, index) =>
          index !== fieldIndex.value && item.code.toLowerCase() === field.code.toLowerCase()
      )
    ) {
      ElMessage.warning('同一卡片的字段编码不可重复，请重新编辑')
      return
    }
    if (fieldIndex.value < 0) form.value.fields.push(field)
    else form.value.fields[fieldIndex.value] = field
  }

  function moveField(index: number, offset: number) {
    const next = index + offset
    if (next < 0 || next >= form.value.fields.length) return
    const [field] = form.value.fields.splice(index, 1)
    form.value.fields.splice(next, 0, field)
  }

  function viewLine(id: number) {
    router.push({ name: 'ProcessBoard', query: { line: id, edit: '1' } })
  }

  async function saveSetting() {
    saving.value = true
    try {
      await processApi.saveSetting(setting.value)
      ElMessage.success('全局设置已保存')
    } finally {
      saving.value = false
    }
  }

  onMounted(load)
</script>

<style scoped lang="scss">
  .process-config {
    padding: 24px;
    color: var(--el-text-color-primary);
    background: var(--el-bg-color);
    border-radius: var(--business-radius);
    box-shadow: var(--business-card-shadow);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;

    h2 {
      margin: 0 0 8px;
    }

    p {
      margin: 0;
      color: var(--el-text-color-secondary);
    }
  }

  .toolbar {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;

    .el-select {
      width: 320px;
    }
  }

  .device-row {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }

  .tip {
    color: var(--el-text-color-secondary);
  }

  .fields-table {
    margin-top: 16px;
  }

  .settings-form {
    max-width: 720px;

    .el-alert {
      margin-bottom: 24px;
    }
  }
</style>
