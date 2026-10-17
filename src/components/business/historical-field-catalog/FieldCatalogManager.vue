<template>
  <section class="field-catalog" v-loading="initializing">
    <el-alert
      :closable="false"
      type="warning"
      title="A/B 共用模型字段库。移除只影响字段选择，不删除原始报文、设备最新值或追溯历史；再次上报不会自动恢复。"
    />
    <el-alert v-if="accessError" :closable="false" type="error" :title="accessError" />
    <template v-else>
      <el-form class="catalog-filters" inline @submit.prevent="search">
        <el-form-item label="模型">
          <el-select
            v-model="model"
            filterable
            placeholder="选择模型"
            :disabled="mutating"
            @change="changeModel"
          >
            <el-option v-for="item in models" :key="item" :value="item" :label="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="字段搜索">
          <el-input
            v-model.trim="keyword"
            clearable
            :maxlength="512"
            placeholder="名称、中文映射名或完整路径"
            :disabled="mutating"
            @clear="search"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="status" :disabled="mutating" @change="search">
            <el-option label="可选字段" value="active" /><el-option
              label="已移除"
              value="removed"
            /><el-option label="全部" value="all" />
          </el-select>
        </el-form-item>
        <el-form-item label="最后出现时间">
          <el-date-picker
            v-model="range"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            :disabled="mutating"
            @change="search"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            native-type="submit"
            type="primary"
            :disabled="!model || mutating"
            :loading="loading"
            >查询</el-button
          >
          <el-button :disabled="!model || mutating" @click="loadPage">刷新</el-button>
        </el-form-item>
      </el-form>
      <div class="catalog-actions">
        <span>当前页已选 {{ selection.length }} 项，最多每页 100 项</span>
        <template v-if="canWrite">
          <el-button
            type="danger"
            plain
            :disabled="!selection.some((row) => !row.removed) || loading || mutating"
            :loading="mutating"
            @click="changeSelection(selection, true)"
            >批量移出字段库</el-button
          >
          <el-button
            type="success"
            plain
            :disabled="!selection.some((row) => row.removed) || loading || mutating"
            @click="changeSelection(selection, false)"
            >批量恢复</el-button
          >
        </template>
      </div>
      <el-table
        ref="table"
        :data="records"
        row-key="id"
        border
        v-loading="loading"
        @selection-change="onSelectionChange"
      >
        <el-table-column v-if="canWrite" type="selection" width="48" />
        <el-table-column
          prop="displayName"
          label="展示名称"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="fieldName"
          label="原字段名称"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="sourcePath"
          label="完整字段路径"
          min-width="240"
          show-overflow-tooltip
        />
        <el-table-column prop="valueType" label="类型" width="100" />
        <el-table-column label="状态" width="100"
          ><template #default="{ row }">
            <el-tag :type="row.removed ? 'info' : 'success'">{{
              row.removed ? '已移除' : '可选择'
            }}</el-tag>
          </template></el-table-column
        >
        <el-table-column prop="firstSeenTime" label="首次出现" min-width="170" />
        <el-table-column prop="lastSeenTime" label="最后出现" min-width="170" />
        <el-table-column prop="seenCount" label="上报次数" width="110" />
        <el-table-column label="引用" width="90"
          ><template #default="{ row }">
            <el-button
              link
              type="primary"
              :disabled="mutating"
              @click="showReferences(row as HistoricalField)"
              >{{ row.referenceCount }} 处</el-button
            >
          </template></el-table-column
        >
        <el-table-column v-if="canWrite" label="操作" width="140" fixed="right"
          ><template #default="{ row }">
            <el-button
              link
              :type="row.removed ? 'success' : 'danger'"
              :disabled="loading || mutating"
              @click="changeSelection([row as HistoricalField], !row.removed)"
              >{{ row.removed ? '恢复字段' : '移出字段库' }}</el-button
            >
          </template></el-table-column
        >
        <template #empty>{{ model ? '当前条件没有历史字段' : '请先选择模型' }}</template>
      </el-table>
      <el-pagination
        v-model:current-page="current"
        v-model:page-size="size"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        :disabled="mutating"
        @current-change="loadPage"
        @size-change="search"
      />
      <el-drawer
        v-model="referenceOpen"
        title="字段引用位置"
        size="min(960px, 95vw)"
        append-to-body
      >
        <el-alert
          :closable="false"
          :title="
            referenceMessage || '请先在对应配置中解绑，再移出字段库；停用的配置也属于有效引用。'
          "
        />
        <el-table :data="references" border v-loading="referenceLoading">
          <el-table-column
            prop="sourcePath"
            label="字段路径"
            min-width="210"
            show-overflow-tooltip
          />
          <el-table-column prop="module" label="引用模块" min-width="150" />
          <el-table-column prop="location" label="配置位置" min-width="260" show-overflow-tooltip />
        </el-table>
      </el-drawer>
    </template>
  </section>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import { ElMessage, ElMessageBox, type TableInstance } from 'element-plus'
  import { applicationRequest } from '@/utils/system-applications/client'
  import { fieldCatalogApi, type FieldReference, type HistoricalField } from '@/api/field-catalog'

  const props = defineProps<{ initialModel?: string }>()
  const emit = defineEmits<{ changed: [] }>()
  const initializing = ref(true)
  const accessError = ref('')
  const canWrite = ref(false)
  const models = ref<string[]>([])
  const model = ref(props.initialModel || '')
  const keyword = ref('')
  const status = ref('active')
  const range = ref<[string, string] | null>(null)
  const current = ref(1)
  const size = ref(20)
  const total = ref(0)
  const records = ref<HistoricalField[]>([])
  const selection = ref<HistoricalField[]>([])
  const table = ref<TableInstance>()
  const loading = ref(false)
  const mutating = ref(false)
  const referenceOpen = ref(false)
  const referenceLoading = ref(false)
  const referenceMessage = ref('')
  const references = ref<FieldReference[]>([])
  let revision = 0
  let referenceRevision = 0
  let disposed = false

  function onSelectionChange(rows: HistoricalField[]) {
    selection.value = rows
  }

  function clearSelection() {
    selection.value = []
    table.value?.clearSelection()
  }

  async function loadPage() {
    const request = ++revision
    clearSelection()
    if (!model.value || disposed) return
    loading.value = true
    try {
      const page = await fieldCatalogApi.page({
        modelMark: model.value,
        keyword: keyword.value,
        removed: status.value === 'all' ? undefined : status.value === 'removed',
        lastSeenStart: range.value?.[0],
        lastSeenEnd: range.value?.[1],
        current: current.value,
        size: size.value
      })
      if (disposed || request !== revision) return
      const lastPage = Math.max(1, Math.ceil(page.total / size.value))
      if (current.value > lastPage) {
        current.value = lastPage
        return await loadPage()
      }
      records.value = page.records
      total.value = page.total
    } catch (error) {
      if (!disposed && request === revision) {
        records.value = []
        total.value = 0
        ElMessage.error((error as Error).message)
      }
    } finally {
      if (!disposed && request === revision) loading.value = false
    }
  }

  function search() {
    current.value = 1
    return loadPage()
  }

  function changeModel() {
    records.value = []
    total.value = 0
    return search()
  }

  async function showReferences(row: HistoricalField) {
    const request = ++referenceRevision
    references.value = []
    referenceMessage.value = ''
    referenceOpen.value = true
    referenceLoading.value = true
    try {
      const result = await fieldCatalogApi.references(model.value, row.id)
      if (!disposed && request === referenceRevision) references.value = result
    } catch (error) {
      if (!disposed && request === referenceRevision) ElMessage.error((error as Error).message)
    } finally {
      if (!disposed && request === referenceRevision) referenceLoading.value = false
    }
  }

  async function changeSelection(rows: HistoricalField[], removed: boolean) {
    if (!canWrite.value || mutating.value) return
    const ids = [...new Set(rows.filter((row) => row.removed !== removed).map((row) => row.id))]
    if (ids.length === 0) return
    const selectedModel = model.value
    mutating.value = true
    try {
      await ElMessageBox.confirm(
        `${removed ? '移出' : '恢复'}模型 ${selectedModel} 的 ${ids.length} 个字段。该操作影响 A/B 共用的字段选择，不删除任何业务数值；已被引用的字段会阻止整批移除。`,
        removed ? '确认移出字段库' : '确认恢复字段',
        { type: 'warning' }
      )
      if (disposed) return
      const result = await fieldCatalogApi.change(selectedModel, ids, removed)
      if (disposed) return
      if (!result.applied) {
        referenceRevision++
        referenceLoading.value = false
        references.value = result.references
        referenceMessage.value = `整批未移除：仍有 ${result.referenceCount} 处引用，请先解绑。最多展示前 1000 处。`
        referenceOpen.value = true
        return
      }
      emit('changed')
      ElMessage.success(removed ? '字段已移出候选库' : '字段已恢复为可选择')
      await loadPage()
    } catch (error) {
      if (!disposed && error !== 'cancel' && error !== 'close')
        ElMessage.error((error as Error).message)
    } finally {
      if (!disposed) mutating.value = false
    }
  }

  onMounted(async () => {
    try {
      const access = await applicationRequest<{
        platformAdministrator: boolean
        permissions: string[]
      }>('/api/system-applications/context')
      if (disposed) return
      if (!access.platformAdministrator && !access.permissions.includes('shared-dictionary.read')) {
        accessError.value = '没有共享字段库读取权限，请联系管理员授权'
        return
      }
      canWrite.value =
        access.platformAdministrator || access.permissions.includes('shared-dictionary.write')
      const result = await fieldCatalogApi.models()
      if (disposed) return
      models.value = result
      await loadPage()
    } catch (error) {
      if (!disposed) accessError.value = (error as Error).message
    } finally {
      if (!disposed) initializing.value = false
    }
  })

  onBeforeUnmount(() => {
    disposed = true
    revision++
    referenceRevision++
  })
</script>

<style scoped>
  .field-catalog {
    min-width: 0;
    color: var(--el-text-color-primary);
  }
  .catalog-filters {
    margin-top: 20px;
  }
  .catalog-filters :deep(.el-select) {
    width: 220px;
  }
  .catalog-filters :deep(.el-input) {
    min-width: 220px;
  }
  .catalog-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .catalog-actions span {
    color: var(--el-text-color-secondary);
  }
  .el-pagination {
    margin-top: 16px;
    justify-content: flex-end;
  }
  .el-alert + .el-table {
    margin-top: 16px;
  }
  @media (width <= 700px) {
    .catalog-filters :deep(.el-date-editor) {
      width: 100%;
    }
  }
</style>
