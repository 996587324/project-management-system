<template>
  <div class="work-choice-picker">
    <el-button class="choice-trigger" :disabled="disabled" @click="open">
      <span>{{ displayLabel }}</span
      ><span class="trigger-action">选择 ›</span>
    </el-button>
    <p v-if="selectedWarning" class="selection-warning">{{ selectedWarning }}</p>
    <el-dialog
      v-model="visible"
      :title="title"
      width="min(820px,96vw)"
      append-to-body
      destroy-on-close
      :close-on-click-modal="false"
      @closed="invalidate"
    >
      <el-input v-model="keyword" clearable :placeholder="searchPlaceholder" maxlength="128" />
      <p class="choice-tip">{{
        multiple ? '支持跨页选择，确认后回填；取消不改变原选择。' : '请选择一项，确认后回填。'
      }}</p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <div v-if="multiple" class="choice-actions">
        <el-button :disabled="loading || selectingAll || !selectableRows.length" @click="selectPage"
          >全选当前页</el-button
        >
        <el-button
          :disabled="loading || selectingAll || !total"
          :loading="selectingAll"
          @click="selectAll"
          >全选筛选结果（{{ total }}项）</el-button
        >
        <el-button :disabled="selectingAll" @click="draft.clear()">全不选</el-button>
      </div>
      <el-table
        :data="records"
        row-key="value"
        border
        height="320"
        v-loading="loading || selectingAll"
        @row-click="(row) => chooseRow(row.value)"
      >
        <el-table-column label="选择" width="65">
          <template #default="{ row }">
            <el-checkbox
              v-if="multiple"
              :model-value="draft.has(row.value)"
              :disabled="row.disabled"
              :aria-label="'选择' + row.label"
              @click.stop
              @change="chooseRow(row.value)"
            />
            <el-radio
              v-else
              :model-value="draft.has(row.value) ? row.value : ''"
              :value="row.value"
              :disabled="row.disabled"
              :aria-label="'选择' + row.label"
              @click.stop
              @change="chooseRow(row.value)"
              ><span
            /></el-radio>
          </template>
        </el-table-column>
        <el-table-column prop="label" label="名称" min-width="130" />
        <el-table-column
          prop="description"
          label="账号 / 说明"
          min-width="130"
          show-overflow-tooltip
        />
        <el-table-column
          prop="groupLabel"
          label="所属工作组"
          min-width="130"
          show-overflow-tooltip
        />
        <el-table-column label="可选状态" min-width="160"
          ><template #default="{ row }"
            ><span :class="{ 'selection-warning': row.disabled }">{{
              row.disabled ? row.reason || '当前不可选' : '可选择'
            }}</span></template
          ></el-table-column
        >
        <template #empty>{{ emptyText }}</template>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total,prev,pager,next"
        :disabled="loading || selectingAll"
        @current-change="loadPage"
      />
      <div class="chosen-items"
        ><span>已选 {{ draft.size }} 项：</span
        ><el-tag
          v-for="item in Array.from(draft.values())"
          :key="item.value"
          :closable="multiple || clearable"
          @close="draft.delete(item.value)"
          >{{ item.label }}</el-tag
        ><span v-if="!draft.size">暂无</span></div
      >
      <template #footer>
        <el-button v-if="!multiple && clearable" @click="draft.clear()">清空选择</el-button>
        <el-button v-if="error" @click="loadPage">重试</el-button>
        <el-button @click="visible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="
            loading ||
            selectingAll ||
            !!error ||
            (!multiple && !clearable && !draft.size) ||
            hasInvalidSelection
          "
          @click="confirm"
          >确认选择</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts" generic="T extends string | string[] | null | undefined">
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import type { WorkChoice, WorkChoicePage, WorkChoiceQuery } from './types'
  const props = withDefaults(
    defineProps<{
      modelValue: T
      title?: string
      placeholder?: string
      emptyText?: string
      options?: WorkChoice[]
      load?: (query: WorkChoiceQuery) => Promise<WorkChoicePage>
      contextKey?: string
      multiple?: boolean
      clearable?: boolean
      disabled?: boolean
      fallbackLabel?: string
      searchPlaceholder?: string
    }>(),
    {
      title: '请选择',
      placeholder: '请选择',
      emptyText: '当前范围没有符合条件的选项',
      contextKey: '',
      searchPlaceholder: '搜索名称、账号或工作组',
      options: () => []
    }
  )
  const emit = defineEmits<{ 'update:modelValue': [value: T]; change: [value: T] }>()
  const visible = ref(false)
  const keyword = ref('')
  const page = ref(1)
  const pageSize = 20
  const records = ref<WorkChoice[]>([])
  const total = ref(0)
  const loading = ref(false)
  const selectingAll = ref(false)
  const error = ref('')
  const cache = ref(new Map<string, WorkChoice>())
  const draft = ref(new Map<string, WorkChoice>())
  let revision = 0
  let resolveRevision = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const values = computed(() =>
    Array.isArray(props.modelValue) ? props.modelValue : props.modelValue ? [props.modelValue] : []
  )
  const optionFor = (id: string) => props.options.find((x) => x.value === id) || cache.value.get(id)
  const displayLabel = computed(() => {
    if (!values.value.length) return props.placeholder
    const labels = values.value.map(
      (id) => optionFor(id)?.label || props.fallbackLabel || `已选：${id}`
    )
    return props.multiple
      ? `已选 ${labels.length} 项：${labels.slice(0, 2).join('、')}${labels.length > 2 ? '…' : ''}`
      : labels[0]
  })
  const selectedWarning = computed(
    () => values.value.map((id) => optionFor(id)).find((x) => x?.disabled)?.reason || ''
  )
  const hasInvalidSelection = computed(() => [...draft.value.values()].some((x) => x.disabled))
  const selectableRows = computed(() => records.value.filter((x) => !x.disabled))
  const localFiltered = computed(() => {
    const search = keyword.value.trim().toLocaleLowerCase()
    return props.options.filter(
      (x) =>
        !search ||
        [x.label, x.description, x.groupLabel].some((v) => v?.toLocaleLowerCase().includes(search))
    )
  })
  function remember(result: WorkChoicePage) {
    for (const row of result.records) cache.value.set(row.value, row)
    if (result.selected) cache.value.set(result.selected.value, result.selected)
  }
  async function fetchPage(current: number): Promise<WorkChoicePage> {
    return props.load
      ? props.load({
          keyword: keyword.value.trim(),
          page: current,
          size: pageSize,
          selectedId: values.value[0]
        })
      : {
          records: localFiltered.value.slice((current - 1) * pageSize, current * pageSize),
          total: localFiltered.value.length
        }
  }
  async function loadPage() {
    const request = ++revision
    loading.value = true
    error.value = ''
    try {
      const result = await fetchPage(page.value)
      if (request !== revision) return
      remember(result)
      records.value = result.records
      total.value = result.total
      for (const row of result.records)
        if (draft.value.has(row.value)) draft.value.set(row.value, row)
      if (result.selected && draft.value.has(result.selected.value))
        draft.value.set(result.selected.value, result.selected)
    } catch (cause) {
      if (request === revision) {
        records.value = []
        total.value = 0
        error.value = cause instanceof Error ? cause.message : '加载失败，请重试'
      }
    } finally {
      if (request === revision) loading.value = false
    }
  }
  function chooseRow(value: string) {
    const row = records.value.find((x) => x.value === value)
    if (!row) return
    if (row.disabled || selectingAll.value) return
    if (!props.multiple) {
      draft.value = new Map([[row.value, row]])
      return
    }
    if (draft.value.has(row.value)) draft.value.delete(row.value)
    else draft.value.set(row.value, row)
  }
  function selectPage() {
    for (const row of selectableRows.value) draft.value.set(row.value, row)
  }
  async function selectAll() {
    const request = ++revision
    selectingAll.value = true
    error.value = ''
    const selected = new Map(draft.value)
    try {
      if (!props.load)
        for (const row of localFiltered.value) {
          if (!row.disabled) selected.set(row.value, row)
        }
      else {
        let current = 1
        let count = 0
        let available = 0
        do {
          const result = await fetchPage(current++)
          if (request !== revision) return
          remember(result)
          for (const row of result.records) if (!row.disabled) selected.set(row.value, row)
          available = result.total
          count += result.records.length
          if (!result.records.length) break
        } while (count < available)
      }
      if (request === revision) draft.value = selected
    } catch (cause) {
      if (request === revision)
        error.value = cause instanceof Error ? cause.message : '全选失败，请重试'
    } finally {
      if (request === revision) selectingAll.value = false
    }
  }
  function invalidate() {
    revision++
    loading.value = false
    selectingAll.value = false
    if (timer) clearTimeout(timer)
  }
  function open() {
    keyword.value = ''
    page.value = 1
    draft.value = new Map(
      values.value.map((id) => [
        id,
        optionFor(id) || { value: id, label: props.fallbackLabel || id }
      ])
    )
    visible.value = true
    void loadPage()
  }
  function confirm() {
    if (hasInvalidSelection.value) return
    const selected = (
      props.multiple ? [...draft.value.keys()] : [...draft.value.keys()][0] || ''
    ) as T
    for (const item of draft.value.values()) cache.value.set(item.value, item)
    emit('update:modelValue', selected)
    emit('change', selected)
    visible.value = false
  }
  watch(keyword, () => {
    if (!visible.value) return
    invalidate()
    page.value = 1
    timer = setTimeout(() => {
      void loadPage()
    }, 250)
  })
  watch(
    () => [props.contextKey, props.modelValue],
    async () => {
      const request = ++resolveRevision
      if (!props.load || !values.value.length) return
      try {
        const result = await props.load({
          keyword: '',
          page: 1,
          size: 1,
          selectedId: values.value[0]
        })
        if (request === resolveRevision) remember(result)
      } catch {
        /* 不清除已有选值；打开窗体时显示错误并允许重试。 */
      }
    },
    { immediate: true, deep: true }
  )
  watch(
    () => props.contextKey,
    () => {
      invalidate()
      visible.value = false
      cache.value.clear()
    }
  )
  onBeforeUnmount(() => {
    invalidate()
    resolveRevision++
  })
</script>
<style scoped lang="scss">
  .work-choice-picker {
    width: 100%;
    min-width: 180px;
  }

  .choice-trigger {
    display: flex;
    justify-content: space-between;
    width: 100%;
    height: auto;
    min-height: 32px;
    white-space: normal;
  }

  .choice-trigger span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .trigger-action {
    margin-left: 12px;
    color: var(--el-color-primary);
    white-space: nowrap;
  }

  .choice-tip {
    margin: 10px 0;
    color: var(--el-text-color-secondary);
  }

  .choice-actions,
  .chosen-items {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin: 12px 0;
  }

  .selection-warning {
    margin: 6px 0;
    color: var(--el-color-warning-dark-2);
  }
</style>
