<template>
  <main class="dashboard-config" v-loading="loading">
    <input
      ref="modelConfigurationImportInputRef"
      class="dashboard-config__hidden-file-input"
      type="file"
      accept=".csv,.xls,.xlsx"
      @change="handleModelConfigurationImport"
    />
    <header class="dashboard-config__header">
      <div
        ><p>PRODUCTION DASHBOARD</p><h1>产线看板配置</h1
        ><span>统一维护产线、Three.js 布局、设备数据源、模型名称和图表。</span></div
      >
      <div class="dashboard-config__actions"
        ><el-button @click="load">刷新</el-button
        ><el-button type="primary" @click="router.push({ name: 'ProductionDashboardBoard' })"
          >进入生产看板</el-button
        ></div
      >
    </header>

    <section class="dashboard-config__toolbar">
      <span>当前线体</span>
      <el-select v-model="lineCode" class="dashboard-config__line-select" :disabled="!lines.length">
        <el-option
          v-for="line in lines"
          :key="line.lineCode"
          :label="`${line.lineName}（${line.lineCode}）`"
          :value="line.lineCode"
        />
      </el-select>
      <el-tag v-if="activeLine" :type="activeLine.enabled ? 'success' : 'info'">{{
        activeLine.enabled ? '已启用' : '已停用'
      }}</el-tag>
    </section>

    <el-tabs v-model="activeTab" class="dashboard-config__tabs">
      <el-tab-pane label="产线与布局" name="lines">
        <section class="dashboard-config__section">
          <div class="dashboard-config__section-head"
            ><div><h2>产线配置</h2><p>维护线体基础信息并进入对应 Three.js 场景布局。</p></div
            ><el-button type="primary" @click="openLineDialog()">新增线体</el-button></div
          >
          <el-table :data="lines" border>
            <el-table-column prop="lineCode" label="线体编码" min-width="130" />
            <el-table-column prop="lineName" label="线体名称" min-width="180" />
            <el-table-column prop="area" label="区域" min-width="180" />
            <el-table-column label="状态" width="100"
              ><template #default="{ row }"
                ><el-tag :type="row.enabled ? 'success' : 'info'">{{
                  row.enabled ? '启用' : '停用'
                }}</el-tag></template
              ></el-table-column
            >
            <el-table-column label="操作" width="320" fixed="right"
              ><template #default="{ row }"
                ><el-button link type="primary" @click="openLineDialog(row)">编辑</el-button
                ><el-button link type="primary" @click="copyLine(row)">复制</el-button
                ><el-button link type="primary" @click="openLayout(row.lineCode)"
                  >编辑布局</el-button
                ><el-button link type="danger" @click="removeLine(row)">删除</el-button></template
              ></el-table-column
            >
          </el-table>
        </section>
      </el-tab-pane>

      <el-tab-pane label="设备数据绑定" name="bindings">
        <section class="dashboard-config__section">
          <div class="dashboard-config__section-head"
            ><div
              ><h2>场景组件数据绑定</h2><p>机械手维护状态规则；普通设备仅绑定实时展示字段。</p></div
            ><el-button :disabled="!lineCode" @click="loadBindings">刷新绑定</el-button></div
          >
          <el-table :data="bindingRows" border empty-text="当前布局尚未添加机械手或设备组件">
            <el-table-column label="组件" min-width="180"
              ><template #default="{ row }"
                ><b>{{ row.name }}</b
                ><small>{{ row.code }}</small></template
              ></el-table-column
            >
            <el-table-column label="类别" width="110"
              ><template #default="{ row }"
                ><el-tag :type="row.type === 'robot' ? 'warning' : 'primary'">{{
                  row.type === 'robot' ? '机械手' : '设备'
                }}</el-tag></template
              ></el-table-column
            >
            <el-table-column label="绑定数据源" min-width="200"
              ><template #default="{ row }">{{
                row.source || '尚未绑定'
              }}</template></el-table-column
            >
            <el-table-column label="展示字段" min-width="180"
              ><template #default="{ row }">{{ row.fieldNames || '—' }}</template></el-table-column
            >
            <el-table-column label="操作" width="110" fixed="right"
              ><template #default="{ row }"
                ><el-button link type="primary" @click="openBinding(row)">{{
                  row.source ? '调整绑定' : '配置绑定'
                }}</el-button></template
              ></el-table-column
            >
          </el-table>
        </section>
      </el-tab-pane>

      <el-tab-pane label="设备模型映射" name="models">
        <section class="dashboard-config__section">
          <div class="dashboard-config__section-head"
            ><div
              ><h2>模型业务名称</h2
              ><p>将接入模型标识映射为看板中的业务名称；删除映射不会影响已绑定数据。</p></div
            ><div class="dashboard-config__actions"
              ><el-button
                :loading="exportingModelConfiguration"
                @click="downloadModelConfiguration(false)"
                >下载模板</el-button
              ><el-button
                :loading="exportingModelConfiguration"
                @click="downloadModelConfiguration(true)"
                >导出当前配置</el-button
              ><el-button
                type="primary"
                :loading="importingModelConfiguration"
                @click="selectModelConfigurationImport('model-display')"
                >导入模型映射</el-button
              ><el-button type="primary" @click="openMappingDialog()">新增映射</el-button></div
            ></div
          >
          <el-table :data="mappings" border>
            <el-table-column prop="modelMark" label="模型标识" min-width="180" />
            <el-table-column prop="displayName" label="显示名称" min-width="190" />
            <el-table-column label="建议类别" width="130"
              ><template #default="{ row }">{{
                equipmentTypeLabel(row.equipmentType)
              }}</template></el-table-column
            >
            <el-table-column label="状态" width="100"
              ><template #default="{ row }"
                ><el-tag :type="row.enabled ? 'success' : 'info'">{{
                  row.enabled ? '启用' : '停用'
                }}</el-tag></template
              ></el-table-column
            >
            <el-table-column prop="sort" label="排序" width="90" />
            <el-table-column label="操作" width="130" fixed="right"
              ><template #default="{ row }"
                ><el-button link type="primary" @click="openMappingDialog(row)">编辑</el-button
                ><el-button link type="danger" @click="removeMapping(row)"
                  >删除</el-button
                ></template
              ></el-table-column
            >
          </el-table>
        </section>
      </el-tab-pane>

      <el-tab-pane label="模型字段与状态" name="model-fields">
        <section class="dashboard-config__section">
          <div class="dashboard-config__section-head">
            <div>
              <h2>模型字段展示映射</h2>
              <p>统一维护同模型字段的名称、单位、格式和值映射；不会修改原始接收数据。</p>
            </div>
            <div class="dashboard-config__actions">
              <el-button
                :loading="exportingModelConfiguration"
                @click="downloadModelConfiguration(false)"
                >下载模板</el-button
              >
              <el-button
                :loading="exportingModelConfiguration"
                @click="downloadModelConfiguration(true)"
                >导出当前配置</el-button
              >
              <el-button
                type="primary"
                :loading="importingModelConfiguration"
                @click="selectModelConfigurationImport('model-fields')"
                >导入字段映射</el-button
              >
              <el-button :disabled="!fieldMappingModelMark" @click="loadModelFieldMappings"
                >刷新</el-button
              >
              <el-button
                type="primary"
                :disabled="!fieldMappingModelMark"
                @click="openFieldMappingDialog"
                >新增字段映射</el-button
              >
              <el-button
                type="success"
                :disabled="!fieldMappingModelMark"
                :loading="saving"
                @click="saveModelFieldMappings"
                >保存全部</el-button
              >
            </div>
          </div>
          <el-form label-position="top"
            ><el-form-item label="选择设备模型"
              ><el-select
                v-model="fieldMappingModelMark"
                class="dashboard-config__model-select"
                filterable
                placeholder="选择已有实时数据的模型"
                ><el-option
                  v-for="item in dataModels"
                  :key="item.modelMark"
                  :label="`${item.displayName}（${item.modelMark}）`"
                  :value="item.modelMark" /></el-select></el-form-item
          ></el-form>
          <el-table
            :data="modelFieldMappings"
            border
            empty-text="请选择模型后新增需要统一展示的字段"
          >
            <el-table-column prop="sourcePath" label="原始字段" min-width="220" />
            <el-table-column label="展示名称" min-width="160"
              ><template #default="{ row }"><el-input v-model.trim="row.displayName" /></template
            ></el-table-column>
            <el-table-column label="格式" width="145"
              ><template #default="{ row }"
                ><el-select v-model="row.formatType"
                  ><el-option label="原样" value="Direct" /><el-option
                    label="值映射"
                    value="ValueMap" /><el-option
                    label="Unix 毫秒时间"
                    value="UnixMilliseconds" /></el-select></template
            ></el-table-column>
            <el-table-column label="单位" width="110"
              ><template #default="{ row }"><el-input v-model.trim="row.unit" /></template
            ></el-table-column>
            <el-table-column label="小数位" width="105"
              ><template #default="{ row }"
                ><el-input-number
                  v-model="row.decimals"
                  :min="0"
                  :max="8"
                  controls-position="right" /></template
            ></el-table-column>
            <el-table-column label="值映射 JSON" min-width="220"
              ><template #default="{ row }"
                ><el-input
                  v-model.trim="row.mappingJson"
                  :disabled="row.formatType !== 'ValueMap'"
                  placeholder='例如 {"1":"运行","0":"待机"}' /></template
            ></el-table-column>
            <el-table-column label="启用" width="90"
              ><template #default="{ row }"><el-switch v-model="row.enabled" /></template
            ></el-table-column>
            <el-table-column label="操作" width="80" fixed="right"
              ><template #default="{ $index }"
                ><el-button link type="danger" @click="modelFieldMappings.splice($index, 1)"
                  >移除</el-button
                ></template
              ></el-table-column
            >
          </el-table>

          <div class="dashboard-config__section-head dashboard-config__state-priority-head">
            <div>
              <h3>模型状态优先级</h3>
              <p>当同一报文同时命中报警、空闲等状态时，数值越小越优先。默认故障 10、空闲 20。</p>
            </div>
            <el-button
              type="success"
              :disabled="!fieldMappingModelMark"
              :loading="saving"
              @click="saveModelStatePriorities"
              >保存状态优先级</el-button
            >
            <el-button
              type="primary"
              :loading="importingModelConfiguration"
              @click="selectModelConfigurationImport('model-state-priorities')"
              >导入状态优先级</el-button
            >
          </div>
          <el-table :data="modelStatePriorities" border empty-text="请选择设备模型后加载状态优先级">
            <el-table-column label="状态" min-width="180"
              ><template #default="{ row }">{{
                statePriorityLabel(row.state)
              }}</template></el-table-column
            >
            <el-table-column prop="state" label="状态编码" min-width="160" />
            <el-table-column label="优先级（越小越优先）" min-width="220"
              ><template #default="{ row }"
                ><el-input-number
                  v-model="row.priority"
                  :min="0"
                  :max="100000"
                  controls-position="right" /></template
            ></el-table-column>
          </el-table>
        </section>
      </el-tab-pane>

      <el-tab-pane label="产量绑定" name="output">
        <section class="dashboard-config__section dashboard-config__placeholder"
          ><h2>线体产量来源</h2
          ><p>选择任意实时设备的数值字段作为当前线体产出。累计计数可跨重启连续计算。</p
          ><el-button type="primary" :disabled="!lineCode" @click="lineOutputBindingOpen = true"
            >配置 {{ activeLine?.lineName || '' }} 的产量来源</el-button
          ></section
        >
      </el-tab-pane>

      <el-tab-pane label="图表配置" name="widgets">
        <section class="dashboard-config__section dashboard-config__placeholder"
          ><h2>表格与图表</h2><p>配置图表数据源、字段、详情导出和每行图表数量。</p
          ><el-button type="primary" :disabled="!lineCode" @click="widgetConfigOpen = true"
            >配置 {{ activeLine?.lineName || '' }} 的图表</el-button
          ></section
        >
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="lineDialogOpen"
      :title="copySourceLineCode ? '复制线体配置' : lineForm.id ? '编辑线体' : '新增线体'"
      width="min(620px, 94vw)"
      append-to-body
    >
      <el-form label-position="top"
        ><div class="dashboard-config__form-grid">
          <el-form-item v-if="copySourceLineCode" label="复制来源"
            ><el-input :model-value="copySourceLineCode" disabled
          /></el-form-item>
          <el-form-item label="线体编码" required
            ><el-input v-model.trim="lineForm.lineCode" placeholder="例如 W4"
          /></el-form-item>
          <el-form-item label="线体名称" required
            ><el-input v-model.trim="lineForm.lineName"
          /></el-form-item>
          <el-form-item label="区域"><el-input v-model.trim="lineForm.area" /></el-form-item>
          <el-form-item label="主题色"
            ><el-color-picker v-model="lineForm.color" show-alpha
          /></el-form-item>
          <el-form-item label="启用"
            ><el-switch v-model="lineForm.enabled" active-text="已启用" inactive-text="已停用"
          /></el-form-item> </div
      ></el-form>
      <template #footer
        ><el-button @click="lineDialogOpen = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="saveLine">保存</el-button></template
      >
    </el-dialog>

    <el-dialog
      v-model="mappingDialogOpen"
      :title="mappingForm.id ? '编辑设备模型映射' : '新增设备模型映射'"
      width="min(620px, 94vw)"
      append-to-body
    >
      <el-form label-position="top"
        ><div class="dashboard-config__form-grid">
          <el-form-item label="模型标识" required
            ><el-input
              v-model.trim="mappingForm.modelMark"
              :disabled="Boolean(mappingForm.id)"
              placeholder="例如 CHUANPXX_JQR"
          /></el-form-item>
          <el-form-item label="显示名称" required
            ><el-input v-model.trim="mappingForm.displayName" placeholder="例如 穿片下线机器人"
          /></el-form-item>
          <el-form-item label="建议类别"
            ><el-select v-model="mappingForm.equipmentType" class="w-full"
              ><el-option label="机械手" value="Robot" /><el-option
                label="通用设备"
                value="Device" /><el-option label="加工设备" value="Machine" /><el-option
                label="检测设备"
                value="Inspection" /></el-select
          ></el-form-item>
          <el-form-item label="排序"
            ><el-input-number
              v-model="mappingForm.sort"
              :min="0"
              :max="9999"
              controls-position="right"
          /></el-form-item>
          <el-form-item label="启用"
            ><el-switch v-model="mappingForm.enabled" active-text="已启用" inactive-text="已停用"
          /></el-form-item> </div
      ></el-form>
      <template #footer
        ><el-button @click="mappingDialogOpen = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="saveMapping">保存</el-button></template
      >
    </el-dialog>

    <el-dialog
      v-model="fieldMappingDialogOpen"
      title="新增模型字段展示映射"
      width="min(620px, 94vw)"
      append-to-body
    >
      <el-form label-position="top"
        ><div class="dashboard-config__form-grid">
          <el-form-item label="原始字段" required
            ><el-select v-model="fieldMappingForm.sourcePath" class="w-full" filterable
              ><el-option
                v-for="field in modelSourceFields"
                :key="field.sourcePath"
                :label="`${field.fieldName} · ${field.sourcePath}`"
                :value="field.sourcePath" /></el-select
          ></el-form-item>
          <el-form-item label="展示名称" required
            ><el-input v-model.trim="fieldMappingForm.displayName"
          /></el-form-item>
          <el-form-item label="格式"
            ><el-select v-model="fieldMappingForm.formatType" class="w-full"
              ><el-option label="原样" value="Direct" /><el-option
                label="值映射"
                value="ValueMap" /><el-option
                label="Unix 毫秒时间"
                value="UnixMilliseconds" /></el-select
          ></el-form-item>
          <el-form-item label="单位"
            ><el-input v-model.trim="fieldMappingForm.unit"
          /></el-form-item>
          <el-form-item label="小数位"
            ><el-input-number
              v-model="fieldMappingForm.decimals"
              :min="0"
              :max="8"
              controls-position="right"
          /></el-form-item>
          <el-form-item label="启用"
            ><el-switch v-model="fieldMappingForm.enabled"
          /></el-form-item> </div
        ><el-form-item
          v-if="fieldMappingForm.formatType === 'ValueMap'"
          label="值映射 JSON"
          required
          ><el-input
            v-model.trim="fieldMappingForm.mappingJson"
            type="textarea"
            :rows="3"
            placeholder='例如 {"1":"运行","0":"待机"}' /></el-form-item
      ></el-form>
      <template #footer
        ><el-button @click="fieldMappingDialogOpen = false">取消</el-button
        ><el-button type="primary" @click="addFieldMapping">加入待保存列表</el-button></template
      >
    </el-dialog>

    <dashboard-robot-binding-dialog
      v-if="selectedRobot"
      v-model="robotBindingDialogOpen"
      :line-code="lineCode"
      :robot-code="selectedRobot.code"
      :robot-name="selectedRobot.name"
      @saved="loadBindings"
      @deleted="loadBindings"
    />
    <dashboard-device-binding-dialog
      v-if="selectedDevice"
      v-model="deviceBindingDialogOpen"
      :line-code="lineCode"
      :device-code="selectedDevice.code"
      :device-name="selectedDevice.name"
      @saved="loadBindings"
    />
    <dashboard-line-output-binding-dialog v-model="lineOutputBindingOpen" :line-code="lineCode" />
    <dashboard-widget-config-dialog
      v-model="widgetConfigOpen"
      dashboard-code="production-dashboard"
      :line-code="lineCode"
    />
  </main>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useRouter } from 'vue-router'
  import { useUserStore } from '@/store/modules/user'
  import { downloadResponseStream } from '@/utils/file/stream-download'
  import DashboardDeviceBindingDialog from '@/views/production-dashboard/components/DashboardDeviceBindingDialog.vue'
  import DashboardLineOutputBindingDialog from '@/views/production-dashboard/components/DashboardLineOutputBindingDialog.vue'
  import DashboardRobotBindingDialog from '@/views/production-dashboard/components/DashboardRobotBindingDialog.vue'
  import DashboardWidgetConfigDialog from '@/views/production-dashboard/components/DashboardWidgetConfigDialog.vue'
  import {
    type DashboardDataSourceModelOption,
    type DashboardDeviceBinding,
    type DashboardLineConfig,
    type DashboardModelConfigurationCsvType,
    type DashboardModelConfigurationImportResult,
    type DashboardModelDisplayMapping,
    type DashboardModelFieldDisplayMapping,
    type DashboardModelStatePriority,
    type DashboardRobotBinding,
    type DashboardSourceFieldOption,
    changeDashboardLineCode,
    deleteDashboardLineConfig,
    deleteDashboardModelDisplayMapping,
    fetchDashboardBindings,
    fetchDashboardBootstrap,
    fetchDashboardDataSourceModels,
    fetchDashboardDeviceBindings,
    fetchDashboardModelDisplayMappings,
    fetchDashboardModelFieldDisplayMappings,
    fetchDashboardModelSourceFields,
    fetchDashboardModelStatePriorities,
    getDashboardModelConfigurationTemplateUrl,
    importDashboardModelConfiguration,
    copyDashboardLineConfig,
    saveDashboardLineConfig,
    saveDashboardModelDisplayMapping,
    saveDashboardModelFieldDisplayMappings,
    saveDashboardModelStatePriorities,
    saveDashboardSceneLayout
  } from '@/api/edge-dashboard'
  import {
    cloneDefaultLineLayout,
    type ProductionLineLayout
  } from '@/views/production-dashboard/config/robotLine'

  const dashboardCode = 'production-dashboard'
  const router = useRouter()
  const userStore = useUserStore()
  const loading = ref(false)
  const saving = ref(false)
  const exportingModelConfiguration = ref(false)
  const importingModelConfiguration = ref(false)
  const modelConfigurationImportInputRef = ref<HTMLInputElement>()
  const modelConfigurationCsvType = ref<DashboardModelConfigurationCsvType>('model-display')
  const activeTab = ref('lines')
  const lines = ref<DashboardLineConfig[]>([])
  const layouts = ref(new Map<string, ProductionLineLayout>())
  const lineCode = ref('')
  const robotBindings = ref<DashboardRobotBinding[]>([])
  const deviceBindings = ref<DashboardDeviceBinding[]>([])
  const mappings = ref<DashboardModelDisplayMapping[]>([])
  const dataModels = ref<DashboardDataSourceModelOption[]>([])
  const modelSourceFields = ref<DashboardSourceFieldOption[]>([])
  const modelFieldMappings = ref<DashboardModelFieldDisplayMapping[]>([])
  const modelStatePriorities = ref<DashboardModelStatePriority[]>([])
  const fieldMappingModelMark = ref('')
  const lineDialogOpen = ref(false)
  const mappingDialogOpen = ref(false)
  const fieldMappingDialogOpen = ref(false)
  const robotBindingDialogOpen = ref(false)
  const deviceBindingDialogOpen = ref(false)
  const lineOutputBindingOpen = ref(false)
  const widgetConfigOpen = ref(false)
  const copySourceLineCode = ref('')
  const selectedRobot = ref<{ code: string; name: string }>()
  const selectedDevice = ref<{ code: string; name: string }>()
  const emptyLine = () => ({
    id: 0,
    lineCode: '',
    lineName: '',
    area: '',
    color: '#55d5ff',
    enabled: true,
    sort: lines.value.length * 10
  })
  const lineForm = ref(emptyLine())
  const emptyMapping = (): DashboardModelDisplayMapping => ({
    id: 0,
    dashboardCode,
    modelMark: '',
    displayName: '',
    equipmentType: 'Device',
    sort: mappings.value.length * 10,
    enabled: true
  })
  const mappingForm = ref<DashboardModelDisplayMapping>(emptyMapping())
  const emptyFieldMapping = (): DashboardModelFieldDisplayMapping => ({
    id: 0,
    sourcePath: '',
    displayName: '',
    valueType: 'String',
    formatType: 'Direct',
    unit: undefined,
    decimals: undefined,
    mappingJson: undefined,
    sort: 0,
    enabled: true
  })
  const fieldMappingForm = ref<DashboardModelFieldDisplayMapping>(emptyFieldMapping())
  const activeLine = computed(() => lines.value.find((item) => item.lineCode === lineCode.value))
  const layout = computed(() => layouts.value.get(lineCode.value))
  const bindingRows = computed(() => {
    const robots = (layout.value?.robots || []).map((item) => {
      const binding = robotBindings.value.find((row) => row.robotCode === item.id)
      return {
        type: 'robot',
        code: item.id,
        name: item.name,
        source: binding?.deviceMark || '',
        fieldNames:
          binding?.fields
            .filter((field) => field.enabled)
            .map((field) => field.displayName)
            .join('、') || ''
      }
    })
    const devices = (layout.value?.devices || []).map((item) => {
      const binding = deviceBindings.value.find((row) => row.deviceCode === item.id)
      return {
        type: 'device',
        code: item.id,
        name: item.name,
        source: binding?.sourceDeviceMark || '',
        fieldNames:
          binding?.fields
            .filter((field) => field.enabled)
            .map((field) => field.displayName)
            .join('、') || ''
      }
    })
    return [...robots, ...devices]
  })
  const parseLayout = (value: string) => {
    try {
      const parsed = JSON.parse(value) as ProductionLineLayout
      return parsed?.lineId ? parsed : undefined
    } catch {
      return undefined
    }
  }
  const loadBindings = async () => {
    if (!lineCode.value) return
    ;[robotBindings.value, deviceBindings.value] = await Promise.all([
      fetchDashboardBindings(lineCode.value),
      fetchDashboardDeviceBindings(lineCode.value)
    ])
  }
  const load = async () => {
    loading.value = true
    try {
      const [bootstrap, modelRows, sourceModels] = await Promise.all([
        fetchDashboardBootstrap(dashboardCode),
        fetchDashboardModelDisplayMappings(dashboardCode),
        fetchDashboardDataSourceModels()
      ])
      lines.value = bootstrap.lines
      mappings.value = modelRows
      dataModels.value = sourceModels
      const nextLayouts = new Map<string, ProductionLineLayout>()
      bootstrap.sceneLayouts.forEach((item) => {
        const parsed = parseLayout(item.layoutJson)
        if (parsed) nextLayouts.set(item.lineCode, parsed)
      })
      layouts.value = nextLayouts
      if (!lines.value.some((item) => item.lineCode === lineCode.value))
        lineCode.value = lines.value[0]?.lineCode || ''
      await loadBindings()
    } finally {
      loading.value = false
    }
  }
  const openLayout = (code: string) =>
    router.push({ name: 'ProductionDashboardLayoutEditor', query: { lineCode: code } })
  const createInitialLayout = (line: typeof lineForm.value): ProductionLineLayout => {
    const result = cloneDefaultLineLayout()
    result.lineId = line.lineCode
    result.lineName = line.lineName
    result.lineArea = line.area
    result.lineColor = line.color
    result.enabled = line.enabled
    result.updatedAt = new Date().toISOString()
    result.robots = result.robots.map((robot, index) => ({
      ...robot,
      id: `${line.lineCode}-R-${String(index + 1).padStart(2, '0')}`,
      name: `机械手 ${String(index + 1).padStart(2, '0')}`,
      bindings: {
        ...robot.bindings,
        deviceId: `${line.lineCode}-R-${String(index + 1).padStart(2, '0')}`
      }
    }))
    return result
  }
  /** 场景数据来自响应式 Map，先序列化为普通对象再编辑，避免 structuredClone 无法处理 Vue Proxy。 */
  const cloneLineLayout = (source: ProductionLineLayout): ProductionLineLayout =>
    JSON.parse(JSON.stringify(source)) as ProductionLineLayout
  const openLineDialog = (source?: unknown) => {
    const line = source as DashboardLineConfig | undefined
    copySourceLineCode.value = ''
    lineForm.value = line
      ? {
          id: line.id,
          lineCode: line.lineCode,
          lineName: line.lineName,
          area: line.area,
          color: line.color,
          enabled: line.enabled,
          sort: line.sort
        }
      : emptyLine()
    lineDialogOpen.value = true
  }
  const copyLine = (source: unknown) => {
    const line = source as DashboardLineConfig
    copySourceLineCode.value = line.lineCode
    lineForm.value = {
      id: 0,
      lineCode: '',
      lineName: `${line.lineName} - 副本`,
      area: line.area,
      color: line.color,
      enabled: line.enabled,
      sort: lines.value.length * 10
    }
    lineDialogOpen.value = true
  }
  const saveLine = async () => {
    const form = lineForm.value
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(form.lineCode) || !form.lineName)
      return ElMessage.warning('请填写有效的线体编码和名称')
    saving.value = true
    try {
      const previous = lines.value.find((item) => item.id === form.id)
      if (copySourceLineCode.value) {
        await copyDashboardLineConfig({
          dashboardCode,
          sourceLineCode: copySourceLineCode.value,
          targetLineCode: form.lineCode,
          targetLineName: form.lineName,
          area: form.area,
          color: form.color,
          enabled: form.enabled,
          sort: form.sort
        })
        lineCode.value = form.lineCode
        lineDialogOpen.value = false
        copySourceLineCode.value = ''
        ElMessage.success('线体及全部可编辑配置已复制')
        await load()
        return
      }
      const currentLayout = previous ? layouts.value.get(previous.lineCode) : undefined
      const nextLayout = currentLayout ? cloneLineLayout(currentLayout) : createInitialLayout(form)
      nextLayout.lineId = form.lineCode
      nextLayout.lineName = form.lineName
      nextLayout.lineArea = form.area
      nextLayout.lineColor = form.color
      nextLayout.enabled = form.enabled
      nextLayout.updatedAt = new Date().toISOString()
      if (previous && previous.lineCode !== form.lineCode)
        await changeDashboardLineCode({
          dashboardCode,
          oldLineCode: previous.lineCode,
          newLineCode: form.lineCode,
          lineName: form.lineName,
          layoutVersion: nextLayout.version,
          layoutJson: JSON.stringify(nextLayout)
        })
      else {
        await saveDashboardLineConfig(
          {
            dashboardCode,
            lineCode: form.lineCode,
            lineName: form.lineName,
            area: form.area,
            color: form.color,
            enabled: form.enabled,
            sort: form.sort
          },
          false
        )
        await saveDashboardSceneLayout(
          {
            dashboardCode,
            lineCode: form.lineCode,
            lineName: form.lineName,
            layoutVersion: nextLayout.version,
            layoutJson: JSON.stringify(nextLayout)
          },
          false
        )
      }
      lineCode.value = form.lineCode
      lineDialogOpen.value = false
      ElMessage.success('线体配置已保存')
      await load()
    } finally {
      saving.value = false
    }
  }
  const removeLine = async (source: unknown) => {
    const line = source as DashboardLineConfig
    await ElMessageBox.confirm(`确认删除线体“${line.lineName}”及其关联场景配置吗？`, '删除线体', {
      type: 'warning'
    })
    await deleteDashboardLineConfig(dashboardCode, line.lineCode)
    ElMessage.success('线体已删除')
    await load()
  }
  const openBinding = (source: unknown) => {
    const row = source as { type: string; code: string; name: string }
    if (row.type === 'robot') {
      selectedRobot.value = row
      robotBindingDialogOpen.value = true
    } else {
      selectedDevice.value = row
      deviceBindingDialogOpen.value = true
    }
  }
  const openMappingDialog = (source?: unknown) => {
    const row = source as DashboardModelDisplayMapping | undefined
    mappingForm.value = row ? { ...row } : emptyMapping()
    mappingDialogOpen.value = true
  }
  const saveMapping = async () => {
    if (!mappingForm.value.modelMark || !mappingForm.value.displayName)
      return ElMessage.warning('请填写模型标识和显示名称')
    saving.value = true
    try {
      await saveDashboardModelDisplayMapping(mappingForm.value)
      mappingDialogOpen.value = false
      ElMessage.success('设备模型映射已保存')
      mappings.value = await fetchDashboardModelDisplayMappings(dashboardCode)
    } finally {
      saving.value = false
    }
  }
  const removeMapping = async (source: unknown) => {
    const row = source as DashboardModelDisplayMapping
    await ElMessageBox.confirm(`确认删除“${row.displayName}”的模型映射吗？`, '删除映射', {
      type: 'warning'
    })
    await deleteDashboardModelDisplayMapping(row.id)
    mappings.value = await fetchDashboardModelDisplayMappings(dashboardCode)
    ElMessage.success('设备模型映射已删除')
  }
  const downloadModelConfiguration = async (includeData: boolean) => {
    if (exportingModelConfiguration.value) return

    exportingModelConfiguration.value = true
    const fileName = includeData
      ? `产线看板模型配置-${new Date().toISOString().slice(0, 10)}.xlsx`
      : '产线看板模型配置导入模板.xlsx'
    try {
      const result = await downloadResponseStream({
        url: getDashboardModelConfigurationTemplateUrl(dashboardCode, includeData),
        fileName,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        accessToken: userStore.accessToken,
        withCredentials: import.meta.env.VITE_WITH_CREDENTIALS === 'true'
      })
      if (result === 'completed') ElMessage.success('配置文件导出完成')
      if (result === 'started') ElMessage.success('配置文件已开始下载')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '配置文件导出失败')
    } finally {
      exportingModelConfiguration.value = false
    }
  }
  const selectModelConfigurationImport = (type: DashboardModelConfigurationCsvType) => {
    modelConfigurationCsvType.value = type
    modelConfigurationImportInputRef.value?.click()
  }
  const formatModelConfigurationImportFailures = (
    result: DashboardModelConfigurationImportResult
  ) =>
    result.failures
      .slice(0, 20)
      .map(
        (item) =>
          `【${item.sheetName}】第 ${item.rowIndex} 行（${item.key || '未识别键'}）：${item.reason}`
      )
      .join('<br />')
  const handleModelConfigurationImport = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!/\.(csv|xls|xlsx)$/i.test(file.name)) {
      ElMessage.warning('仅支持 CSV、XLS 或 XLSX 文件')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      ElMessage.warning('导入文件不能超过 10MB')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('dashboardCode', dashboardCode)
    formData.append('csvConfigurationType', modelConfigurationCsvType.value)
    importingModelConfiguration.value = true
    try {
      const result = await importDashboardModelConfiguration(formData)
      if (result.failedCount > 0) {
        await ElMessageBox.alert(
          formatModelConfigurationImportFailures(result) || result.message,
          `导入完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条`,
          {
            dangerouslyUseHTMLString: true,
            confirmButtonText: '知道了',
            type: 'warning'
          }
        )
      } else {
        ElMessage.success(`已成功导入 ${result.successCount} 条配置`)
      }
      await load()
      if (fieldMappingModelMark.value) await loadModelFieldMappings()
    } finally {
      importingModelConfiguration.value = false
    }
  }
  const loadModelFieldMappings = async () => {
    if (!fieldMappingModelMark.value) return
    const [fields, mappings, priorities] = await Promise.all([
      fetchDashboardModelSourceFields(fieldMappingModelMark.value),
      fetchDashboardModelFieldDisplayMappings(dashboardCode, fieldMappingModelMark.value),
      fetchDashboardModelStatePriorities(dashboardCode, fieldMappingModelMark.value)
    ])
    modelSourceFields.value = fields
    modelFieldMappings.value = mappings
    modelStatePriorities.value = priorities
  }
  const openFieldMappingDialog = () => {
    fieldMappingForm.value = emptyFieldMapping()
    fieldMappingDialogOpen.value = true
  }
  const addFieldMapping = () => {
    const source = modelSourceFields.value.find(
      (item) => item.sourcePath === fieldMappingForm.value.sourcePath
    )
    if (!source || !fieldMappingForm.value.displayName)
      return ElMessage.warning('请选择原始字段并填写展示名称')
    if (
      modelFieldMappings.value.some((item) => item.sourcePath === fieldMappingForm.value.sourcePath)
    )
      return ElMessage.warning('该字段已经加入映射列表')
    modelFieldMappings.value.push({
      ...fieldMappingForm.value,
      valueType: source.valueType,
      sort: (modelFieldMappings.value.length + 1) * 10
    })
    fieldMappingDialogOpen.value = false
  }
  const saveModelFieldMappings = async () => {
    if (
      modelFieldMappings.value.some(
        (item) => !item.displayName || (item.formatType === 'ValueMap' && !item.mappingJson)
      )
    )
      return ElMessage.warning('请完善展示名称和值映射 JSON')
    saving.value = true
    try {
      modelFieldMappings.value = await saveDashboardModelFieldDisplayMappings(
        dashboardCode,
        fieldMappingModelMark.value,
        modelFieldMappings.value
      )
      ElMessage.success('模型字段展示映射已保存')
    } finally {
      saving.value = false
    }
  }
  const saveModelStatePriorities = async () => {
    if (!fieldMappingModelMark.value) return
    saving.value = true
    try {
      modelStatePriorities.value = await saveDashboardModelStatePriorities(
        dashboardCode,
        fieldMappingModelMark.value,
        modelStatePriorities.value
      )
      ElMessage.success('模型状态优先级已保存')
    } finally {
      saving.value = false
    }
  }
  const statePriorityLabel = (state: DashboardModelStatePriority['state']) =>
    ({ FAULT: '故障 / 报警', IDLE: '空闲', STOPPED: '停止', RUNNING: '运行', UNKNOWN: '未知' })[
      state
    ] || state
  const equipmentTypeLabel = (type: string) =>
    ({ Robot: '机械手', Device: '通用设备', Machine: '加工设备', Inspection: '检测设备' })[type] ||
    type
  watch(lineCode, () => loadBindings())
  watch(fieldMappingModelMark, () => loadModelFieldMappings())
  load()
</script>

<style scoped lang="scss">
  .dashboard-config {
    min-height: 100%;
    padding: 22px;
    background: var(--el-bg-color-page);
  }

  .dashboard-config__hidden-file-input {
    display: none;
  }

  .dashboard-config__header,
  .dashboard-config__section-head,
  .dashboard-config__toolbar,
  .dashboard-config__actions {
    display: flex;
    gap: 14px;
    align-items: center;
    justify-content: space-between;
  }

  .dashboard-config__header {
    padding: 4px 0 20px;
  }

  .dashboard-config__header p {
    margin: 0;
    font-size: 12px;
    color: var(--el-color-primary);
    letter-spacing: 1.4px;
  }

  .dashboard-config__header h1 {
    margin: 5px 0;
    font-size: 25px;
  }

  .dashboard-config__header span,
  .dashboard-config__section-head p,
  .dashboard-config__placeholder p {
    color: var(--el-text-color-secondary);
  }

  .dashboard-config__toolbar {
    justify-content: flex-start;
    padding: 14px 16px;
    margin-bottom: 14px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .dashboard-config__line-select {
    width: min(360px, 60vw);
  }

  .dashboard-config__section {
    padding: 20px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .dashboard-config__section h2 {
    margin: 0 0 6px;
    font-size: 18px;
  }

  .dashboard-config__section p {
    margin: 0 0 16px;
  }

  .dashboard-config__section-head {
    margin-bottom: 18px;
  }

  .dashboard-config__state-priority-head {
    margin-top: 26px;
  }

  .dashboard-config__section h3 {
    margin: 0 0 6px;
    font-size: 16px;
  }

  .dashboard-config__section-head p {
    margin-bottom: 0;
  }

  .dashboard-config__placeholder {
    min-height: 240px;
    padding-top: 52px;
    text-align: center;
  }

  .dashboard-config__form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 16px;
  }

  :deep(.el-table b),
  :deep(.el-table small) {
    display: block;
  }

  :deep(.el-table small) {
    margin-top: 3px;
    color: var(--el-text-color-secondary);
  }

  @media (width <= 720px) {
    .dashboard-config {
      padding: 14px;
    }

    .dashboard-config__header,
    .dashboard-config__section-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .dashboard-config__form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
