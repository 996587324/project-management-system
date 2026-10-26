<template>
  <div class="source-tree-select">
    <el-button class="source-trigger" :disabled="disabled" :title="selectionLabel" @click="open">
      <span>{{ selectionLabel }}</span
      ><span class="trigger-action">选择 ›</span>
    </el-button>
    <el-dialog
      v-model="visible"
      title="选择数据源 · 模型 / 设备"
      width="min(860px, 96vw)"
      append-to-body
      destroy-on-close
    >
      <el-input
        v-model="keyword"
        clearable
        maxlength="128"
        placeholder="搜索模型名称 / 模型编码 / 设备名称 / 设备编码"
      />
      <p class="catalog-tip"
        >展开模型后选择设备；字段在选定设备后配置。{{
          kind === 'Edge' ? '设备后显示所属网关和连接。' : '暂未接收新数据的设备仍可选择。'
        }}</p
      >
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <div v-loading="loading" class="catalog-tree">
        <el-tree
          :data="nodes"
          node-key="key"
          :props="{ label: 'label', disabled: 'disabled' }"
          :default-expanded-keys="expanded"
          :current-node-key="selected ? `device:${sourceIdentityKey(selected)}` : undefined"
          highlight-current
          :expand-on-click-node="false"
          @node-expand="expandModel"
          @node-collapse="collapseModel"
          @node-click="chooseNode"
        >
          <template #default="{ data }">
            <div
              class="catalog-node"
              :class="{ 'model-node': data.type === 'model' }"
              :title="data.description || data.label"
            >
              <span>{{ data.label }}</span
              ><small v-if="data.description">{{ data.description }}</small>
            </div>
          </template>
        </el-tree>
        <el-empty
          v-if="!loading && !nodes.length && !error"
          description="没有匹配且已授权的数据源"
        />
      </div>
      <template #footer>
        <span class="catalog-total"
          >{{ keyword.trim() ? '匹配设备' : '模型' }} {{ loadedCount }} / {{ total }}</span
        >
        <el-button v-if="loadedCount < total" :loading="loading" @click="loadMore"
          >加载更多</el-button
        >
        <el-button v-if="error" @click="reload">重新加载</el-button>
        <el-button @click="visible = false">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import {
    sourceCatalogApi,
    sourceIdentityKey,
    type CatalogDevice,
    type CatalogModel,
    type CatalogPurpose,
    type SourceIdentity
  } from '@/api/source-catalog'

  interface CatalogNode {
    key: string
    type: 'model' | 'device' | 'more' | 'hint'
    label: string
    description?: string
    modelMark?: string
    device?: CatalogDevice
    disabled?: boolean
    children?: CatalogNode[]
  }
  const props = withDefaults(
    defineProps<{
      modelValue?: SourceIdentity | null
      kind?: 'Realtime' | 'Edge'
      purpose: CatalogPurpose
      gatewayId?: number
      connectionKey?: string
      processLineId?: number
      disabled?: boolean
    }>(),
    { kind: 'Realtime' }
  )
  const emit = defineEmits<{
    'update:modelValue': [value: SourceIdentity]
    change: [value: CatalogDevice]
    resolved: [value: CatalogDevice]
  }>()
  const visible = ref(false)
  const keyword = ref('')
  const loading = ref(false)
  const error = ref('')
  const models = ref<CatalogModel[]>([])
  const matches = ref<CatalogDevice[]>([])
  const expanded = ref<string[]>([])
  const children = ref<Record<string, { records: CatalogDevice[]; total: number; page: number }>>(
    {}
  )
  const childLoading = new Map<string, number>()
  const selected = ref<CatalogDevice | null>(null)
  const page = ref(1)
  const total = ref(0)
  let revision = 0
  let resolveRevision = 0
  let searchTimer: ReturnType<typeof setTimeout> | undefined

  const context = computed(() => ({
    purpose: props.purpose,
    kind: props.kind,
    gatewayId: props.gatewayId,
    connectionKey: props.connectionKey,
    processLineId: props.processLineId || undefined
  }))
  const loadedCount = computed(() =>
    keyword.value.trim() ? matches.value.length : models.value.length
  )
  const selectionLabel = computed(() => {
    if (selected.value) return `${selected.value.modelName} / ${selected.value.deviceName}`
    const value = props.modelValue
    return value?.deviceKey
      ? `已保存：${value.sourceDeviceCode || value.deviceKey}（${value.sourceKey}）`
      : '选择模型 / 设备'
  })
  const deviceNode = (device: CatalogDevice): CatalogNode => ({
    key: `device:${sourceIdentityKey(device)}`,
    type: 'device',
    device,
    label: device.deviceName || device.sourceDeviceCode || device.deviceKey,
    description:
      device.kind === 'Edge'
        ? `${device.sourceDeviceCode} · ${device.gatewayName || device.deviceKey} / ${device.connectionName || device.sourceKey}`
        : `${device.deviceKey} · ${device.sourceKey}`
  })
  const nodes = computed<CatalogNode[]>(() => {
    if (keyword.value.trim()) {
      const groups = new Map<string, CatalogNode>()
      for (const device of matches.value) {
        if (!groups.has(device.modelMark))
          groups.set(device.modelMark, {
            key: `model:${device.modelMark}`,
            type: 'model',
            modelMark: device.modelMark,
            label: device.modelName,
            description: device.modelMark,
            children: []
          })
        groups.get(device.modelMark)!.children!.push(deviceNode(device))
      }
      return [...groups.values()]
    }
    const availableModels = [...models.value]
    if (
      selected.value &&
      !availableModels.some((model) => model.modelMark === selected.value?.modelMark)
    ) {
      availableModels.unshift({
        modelMark: selected.value.modelMark,
        modelName: selected.value.modelName,
        deviceCount: 0
      })
    }
    return availableModels.map((model) => {
      const state = children.value[model.modelMark]
      const descendants: CatalogNode[] = state
        ? state.records.map(deviceNode)
        : [
            {
              key: `hint:${model.modelMark}`,
              type: 'hint',
              label: '展开加载设备',
              disabled: true
            }
          ]
      if (
        selected.value?.modelMark === model.modelMark &&
        !state?.records.some(
          (device) => sourceIdentityKey(device) === sourceIdentityKey(selected.value)
        )
      ) {
        descendants.unshift(deviceNode(selected.value))
      }
      if (state && state.records.length < state.total)
        descendants.push({
          key: `more:${model.modelMark}`,
          type: 'more',
          modelMark: model.modelMark,
          label: `加载更多设备（${state.records.length} / ${state.total}）`
        })
      return {
        key: `model:${model.modelMark}`,
        type: 'model',
        modelMark: model.modelMark,
        label: `${model.modelName}（${model.deviceCount || '当前绑定'}${model.deviceCount ? ' 台' : ''}）`,
        description: model.modelMark,
        children: descendants
      }
    })
  })

  async function loadRoot(append = false) {
    const current = ++revision
    loading.value = true
    error.value = ''
    const nextPage = append ? page.value + 1 : 1
    try {
      const params = { ...context.value, keyword: keyword.value.trim(), page: nextPage, size: 50 }
      if (params.keyword) {
        const result = await sourceCatalogApi.devices(params)
        if (current !== revision || !visible.value) return
        matches.value = append ? [...matches.value, ...result.records] : result.records
        total.value = result.total
        expanded.value = [...new Set(matches.value.map((item) => `model:${item.modelMark}`))]
      } else {
        const result = await sourceCatalogApi.models(params)
        if (current !== revision || !visible.value) return
        models.value = append ? [...models.value, ...result.records] : result.records
        total.value = result.total
        if (!append && selected.value) {
          expanded.value = [`model:${selected.value.modelMark}`]
          void loadChildren(selected.value.modelMark)
        }
      }
      page.value = nextPage
    } catch (exception) {
      if (current === revision)
        error.value = exception instanceof Error ? exception.message : '数据源加载失败'
    } finally {
      if (current === revision) loading.value = false
    }
  }

  async function loadChildren(modelMark: string, append = false) {
    if (childLoading.get(modelMark) === revision) return
    const current = revision
    const currentContext = JSON.stringify(context.value)
    childLoading.set(modelMark, current)
    try {
      const previous = children.value[modelMark]
      const result = await sourceCatalogApi.devices({
        ...context.value,
        modelMark,
        page: append ? (previous?.page ?? 0) + 1 : 1,
        size: 50
      })
      if (
        current !== revision ||
        currentContext !== JSON.stringify(context.value) ||
        !visible.value
      )
        return
      children.value[modelMark] = {
        records: append ? [...(previous?.records ?? []), ...result.records] : result.records,
        total: result.total,
        page: result.page
      }
    } catch (exception) {
      if (current === revision)
        error.value = exception instanceof Error ? exception.message : '设备加载失败'
    } finally {
      if (childLoading.get(modelMark) === current) childLoading.delete(modelMark)
    }
  }

  function expandModel(node: CatalogNode) {
    if (!expanded.value.includes(node.key)) expanded.value.push(node.key)
    if (!keyword.value.trim() && node.modelMark && !children.value[node.modelMark])
      void loadChildren(node.modelMark)
  }

  function collapseModel(node: CatalogNode) {
    expanded.value = expanded.value.filter((key) => key !== node.key)
  }

  function chooseNode(
    data: CatalogNode,
    node: { expanded: boolean; expand: () => void; collapse: () => void }
  ) {
    if (data.type === 'model') {
      if (node.expanded) node.collapse()
      else {
        node.expand()
        expandModel(data)
      }
    } else if (data.type === 'more' && data.modelMark) {
      void loadChildren(data.modelMark, true)
    } else if (data.type === 'device' && data.device) {
      selected.value = data.device
      emit('update:modelValue', {
        sourceKey: data.device.sourceKey,
        deviceKey: data.device.deviceKey,
        sourceDeviceCode: data.device.sourceDeviceCode
      })
      emit('change', data.device)
      visible.value = false
    }
  }

  async function resolveSelection() {
    const current = ++resolveRevision
    selected.value = null
    if (
      !props.modelValue?.deviceKey &&
      !(props.kind === 'Edge' && props.gatewayId && props.modelValue?.sourceDeviceCode)
    )
      return
    try {
      const result = await sourceCatalogApi.resolve({ ...context.value, ...props.modelValue })
      if (current !== resolveRevision) return
      selected.value = result
      if (result) emit('resolved', result)
      if (result && visible.value && !keyword.value.trim()) {
        expanded.value = [`model:${result.modelMark}`]
        void loadChildren(result.modelMark)
      }
    } catch {
      // 回显失败不能清空旧绑定或冒充已加载成功；用户仍可打开目录重选。
    }
  }

  function reload() {
    children.value = {}
    models.value = []
    matches.value = []
    expanded.value = []
    total.value = 0
    void loadRoot()
  }
  function open() {
    visible.value = true
    keyword.value = ''
    reload()
  }
  function loadMore() {
    void loadRoot(true)
  }

  watch(keyword, () => {
    revision++
    loading.value = true
    total.value = 0
    matches.value = []
    clearTimeout(searchTimer)
    searchTimer = setTimeout(reload, 300)
  })
  watch(
    () => [JSON.stringify(context.value), sourceIdentityKey(props.modelValue)],
    resolveSelection,
    { immediate: true }
  )
  watch(context, () => {
    if (visible.value) reload()
  })
  watch(
    () => props.disabled,
    (value) => {
      if (value) visible.value = false
    }
  )
  watch(visible, (value) => {
    if (!value) {
      revision++
      clearTimeout(searchTimer)
      loading.value = false
    }
  })
  onBeforeUnmount(() => {
    revision++
    resolveRevision++
    clearTimeout(searchTimer)
  })
</script>

<style scoped>
  .source-tree-select {
    width: 100%;
    min-width: 200px;
  }

  .source-trigger {
    display: flex;
    justify-content: space-between;
    width: 100%;
  }

  .source-trigger :deep(span) {
    min-width: 0;
  }

  .source-trigger > :deep(span) {
    display: flex;
    gap: 10px;
    width: 100%;
  }

  .source-trigger span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trigger-action {
    flex-shrink: 0;
    color: var(--el-color-primary);
  }

  .catalog-tip,
  .catalog-total {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .catalog-tree {
    height: min(52vh, 460px);
    margin-top: 12px;
    overflow: auto;
  }

  .catalog-tree :deep(.el-tree-node__content) {
    height: 48px;
  }

  .catalog-node {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .catalog-node span,
  .catalog-node small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .catalog-node small {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .model-node > span {
    font-weight: 600;
  }

  .catalog-total {
    margin-right: 12px;
  }
</style>
