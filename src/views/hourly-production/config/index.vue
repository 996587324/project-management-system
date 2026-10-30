<template>
  <div v-loading="loading" class="hourly-config art-full-height">
    <div class="config-toolbar"
      ><el-select
        v-model="selectedCode"
        filterable
        placeholder="选择看板"
        style="width: 260px"
        @change="selectBoard"
        ><el-option
          v-for="board in boards"
          :key="board.code"
          :label="board.name"
          :value="board.code" /></el-select
      ><el-button @click="newBoard">新建看板</el-button
      ><el-button @click="copyBoard">复制为新看板</el-button
      ><el-button type="primary" :loading="saving" @click="save">保存全部配置</el-button
      ><el-button v-if="form.version > 0" @click="previewBoard">查看看板</el-button></div
    >
    <el-tabs v-model="tab">
      <el-tab-pane label="基础与发布" name="basic">
        <el-form label-width="145px" class="basic-form"
          ><el-form-item label="看板编码"
            ><el-input
              v-model.trim="form.code"
              :disabled="form.version > 0"
              maxlength="64" /></el-form-item
          ><el-form-item label="看板名称"
            ><el-input v-model.trim="form.name" maxlength="100" /></el-form-item
          ><el-form-item label="刷新间隔（秒）"
            ><el-input-number v-model="form.refreshSeconds" :min="5" :max="300" /></el-form-item
          ><el-form-item label="公开免登录查看"><el-switch v-model="form.published" /></el-form-item
          ><el-form-item v-if="form.published && form.version > 0" label="公开地址"
            ><el-input :model-value="publicUrl" readonly /><el-button text @click="copyUrl"
              >复制地址</el-button
            ></el-form-item
          ></el-form
        >
        <el-alert type="info" :closable="false"
          >发布只开放当前看板的汇总展示，公开页没有配置按钮，后端写接口仍需要登录授权。A/B菜单与数据授权独立，默认不跨系统共享未发布看板。</el-alert
        >
      </el-tab-pane>
      <el-tab-pane label="线体、工序与数据" name="process"
        ><ProcessConfig ref="processConfig" v-model="form"
      /></el-tab-pane>
      <el-tab-pane label="班次与小时目标" name="targets"
        ><TargetConfig v-model="form"
      /></el-tab-pane>
      <el-tab-pane label="展示布局" name="layout"><LayoutConfig v-model="form" /></el-tab-pane>
      <el-tab-pane label="AI建议" name="ai"
        ><el-form label-width="160px"
          ><el-form-item label="AI运行建议"><el-switch v-model="form.aiEnabled" /></el-form-item
          ><el-form-item label="分析间隔（分钟）"
            ><el-input-number
              v-model="form.aiIntervalMinutes"
              :min="1"
              :max="120" /></el-form-item></el-form
        ><el-alert type="info" :closable="false"
          >复用模型平台中“生产看板Agent”的模型绑定。后台独立分析真实小时数据、返工及线体差异；页面只读缓存，模型失败隐藏内容，不阻塞统计或页面。</el-alert
        ></el-tab-pane
      >
      <el-tab-pane label="小时推送" name="push" lazy><PushConfig v-model="form" /></el-tab-pane>
      <el-tab-pane v-if="form.version > 0" label="报表与推送记录" name="records" lazy
        ><ReportRecords :code="form.code"
      /></el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { createBoard, hourlyApi, type HourlyBoard } from '@/api/hourly-production'
  import ProcessConfig from '../components/ProcessConfig.vue'
  import TargetConfig from '../components/TargetConfig.vue'
  import LayoutConfig from '../components/LayoutConfig.vue'
  import PushConfig from '../components/PushConfig.vue'
  import ReportRecords from '../components/ReportRecords.vue'
  import { hourlyConfigIssue } from '../components/process-config-rules'
  const router = useRouter()
  const boards = ref<HourlyBoard[]>([])
  const form = ref(createBoard())
  const selectedCode = ref('')
  const loading = ref(false)
  const saving = ref(false)
  const tab = ref('basic')
  const processConfig = ref<InstanceType<typeof ProcessConfig>>()
  const publicUrl = computed(
    () =>
      `${location.origin}${location.pathname}#/public/hourly-production/${encodeURIComponent(form.value.code)}`
  )

  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
  }

  function selectBoard() {
    const board = boards.value.find((item) => item.code === selectedCode.value)
    if (board) form.value = clone(board)
  }

  async function newBoard() {
    await ElMessageBox.confirm('切换到新看板草稿，当前未保存修改不会保留。', '新建看板')
    selectedCode.value = ''
    form.value = createBoard()
    tab.value = 'basic'
  }

  function copyBoard() {
    const copy = clone(form.value)
    copy.code = `hourly_${Date.now()}`
    copy.name += '（副本）'
    copy.version = 0
    copy.published = false
    copy.push.enabled = false
    for (const line of copy.lines)
      for (const process of line.processes) {
        process.instanceId = ''
        process.creationMode = 'New'
        process.activeSince = null
      }
    form.value = copy
    selectedCode.value = ''
    tab.value = 'basic'
  }

  async function save() {
    if (saving.value) return
    const issue = hourlyConfigIssue(form.value)
    if (issue) {
      tab.value = 'process'
      await nextTick()
      processConfig.value?.focusProcess(issue.lineCode, issue.processCode)
      ElMessage.warning(issue.message)
      return
    }
    saving.value = true
    try {
      const result = await hourlyApi.save(clone(form.value))
      form.value = result
      selectedCode.value = result.code
      boards.value = await hourlyApi.definitions()
      ElMessage.success('配置已保存，后续实际过站将按规则统计')
    } finally {
      saving.value = false
    }
  }

  function previewBoard() {
    router.push({ name: 'HourlyProduction', query: { code: form.value.code } })
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(publicUrl.value)
      ElMessage.success('已复制')
    } catch {
      ElMessage.info('当前浏览器不允许自动复制，请在地址框中手动复制')
    }
  }

  onMounted(async () => {
    loading.value = true
    try {
      boards.value = await hourlyApi.definitions()
      if (boards.value.length) {
        selectedCode.value = boards.value[0].code
        selectBoard()
      }
    } finally {
      loading.value = false
    }
  })
</script>

<style scoped>
  .hourly-config {
    padding: 20px;
    overflow: auto;
    background: var(--el-bg-color);
    border-radius: 10px;
  }

  .config-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 18px;
  }

  .basic-form {
    max-width: 850px;
  }
</style>
