<template>
  <section class="parameter-page-editor">
    <div class="device-fields">
      <el-form-item label="设备代码" required>
        <el-input v-model="model.deviceCode" maxlength="128" />
      </el-form-item>
      <el-form-item label="设备名称">
        <el-input v-model="model.deviceName" maxlength="128" />
      </el-form-item>
      <el-form-item label="设备状态">
        <el-switch v-model="model.enabled" active-text="启用" inactive-text="停用" />
      </el-form-item>
    </div>

    <div class="parameter-heading">
      <strong>参数配置</strong>
      <span>共 {{ model.parameters.length }} 项，每页仅渲染 {{ pageSize }} 项</span>
      <el-button type="primary" plain :icon="Plus" @click="addParameter">新增参数</el-button>
    </div>

    <el-table :data="pagedParameters" height="390" stripe>
      <el-table-column label="参数名称" min-width="180">
        <template #default="{ row }">
          <el-input v-model="row.parameterName" maxlength="128" placeholder="例如 Ua" />
        </template>
      </el-table-column>
      <el-table-column label="中文名称" min-width="180">
        <template #default="{ row }">
          <el-input v-model="row.parameterNameCn" maxlength="128" placeholder="例如 A 相电压" />
        </template>
      </el-table-column>
      <el-table-column label="数据类型" min-width="150">
        <template #default="{ row }">
          <el-select
            v-model="row.dataType"
            clearable
            filterable
            allow-create
            default-first-option
            placeholder="自动"
          >
            <el-option label="数值 Number" value="Number" />
            <el-option label="文本 String" value="String" />
            <el-option label="布尔 Boolean" value="Boolean" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="82" align="center">
        <template #default="{ row }"><el-switch v-model="row.enabled" /></template>
      </el-table-column>
      <el-table-column label="操作" width="70" align="center">
        <template #default="{ $index }">
          <el-tooltip content="删除参数" placement="top">
            <el-button
              text
              type="danger"
              :icon="Delete"
              aria-label="删除参数"
              @click="removeParameter(pageOffset + $index)"
            />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next, jumper"
      :total="model.parameters.length"
    />
  </section>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { Delete, Plus } from '@element-plus/icons-vue'
  import type { EdgeWebSocketSubscriptionDevice } from '@/api/edge-gateway'
  import { createSubscriptionParameter } from './subscriptionEditorUtils'

  const model = defineModel<EdgeWebSocketSubscriptionDevice>({ required: true })
  const currentPage = ref(1)
  const pageSize = ref(20)
  const pageOffset = computed(() => (currentPage.value - 1) * pageSize.value)
  const pagedParameters = computed(() =>
    model.value.parameters.slice(pageOffset.value, pageOffset.value + pageSize.value)
  )

  const normalizeCurrentPage = () => {
    const maxPage = Math.max(1, Math.ceil(model.value.parameters.length / pageSize.value))
    if (currentPage.value > maxPage) currentPage.value = maxPage
  }

  const addParameter = async () => {
    model.value.parameters.push(createSubscriptionParameter())
    currentPage.value = Math.ceil(model.value.parameters.length / pageSize.value)
    await nextTick()
  }

  const removeParameter = (index: number) => {
    model.value.parameters.splice(index, 1)
    normalizeCurrentPage()
  }

  watch(
    () => model.value,
    () => (currentPage.value = 1)
  )
  watch(pageSize, normalizeCurrentPage)
</script>

<style scoped lang="scss">
  .device-fields {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) minmax(200px, 1fr) 130px;
    gap: 0 16px;
  }

  .parameter-heading {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 12px;
  }

  .parameter-heading span {
    margin-right: auto;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .el-pagination {
    justify-content: flex-end;
    padding-top: 14px;
  }

  @media (width <= 760px) {
    .device-fields {
      grid-template-columns: minmax(0, 1fr);
    }

    .parameter-heading {
      flex-wrap: wrap;
    }

    .el-pagination {
      justify-content: flex-start;
      overflow-x: auto;
    }
  }
</style>
