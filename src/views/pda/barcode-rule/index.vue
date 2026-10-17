<template>
  <div class="pda-page art-full-height">
    <ElCard shadow="never" class="pda-card">
      <template #header>
        <div class="page-header">
          <div>
            <div class="section-title">条码规则</div>
            <div class="section-subtitle"
              >本地规则读取后台配置；远程规则由后端调用已配置的校验接口。</div
            >
          </div>
          <ElButton type="primary" :icon="Plus" @click="openCreate">新增规则</ElButton>
        </div>
      </template>

      <div class="toolbar">
        <ElInput
          v-model="query.keyword"
          clearable
          :prefix-icon="Search"
          placeholder="搜索规则名称、编码或业务类型"
          @keyup.enter="search"
          @clear="search"
        />
        <ElSelect v-model="query.enabled" placeholder="全部状态" clearable @change="search">
          <ElOption label="已启用" :value="true" />
          <ElOption label="已停用" :value="false" />
        </ElSelect>
        <ElButton :icon="Refresh" :loading="loading" @click="loadPage">刷新</ElButton>
      </div>

      <ElTable v-loading="loading" :data="page.records" :row-key="ruleRowKey" height="100%">
        <ElTableColumn prop="ruleName" label="规则名称" min-width="170" />
        <ElTableColumn prop="ruleCode" label="规则编码" min-width="190" show-overflow-tooltip />
        <ElTableColumn prop="prefix" label="前缀" width="100">
          <template #default="{ row }">{{ row.prefix || '不限' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="barcodeLength" label="长度" width="90">
          <template #default="{ row }">{{ row.barcodeLength || '不限' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="businessType" label="业务类型" min-width="140" />
        <ElTableColumn prop="handlerCode" label="处理器" min-width="170" />
        <ElTableColumn label="校验来源" width="110">
          <template #default="{ row }">
            <ElTag :type="row.validationSource === 'Remote' ? 'warning' : 'success'">
              {{ row.validationSource === 'Remote' ? '远程接口' : '后台本地' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="priority" label="优先级" width="90" />
        <ElTableColumn label="状态" width="90">
          <template #default="{ row }">
            <ElTag :type="row.enabled ? 'success' : 'warning'">
              {{ row.enabled ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="version" label="版本" width="80" />
        <ElTableColumn label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" :icon="Edit" @click="openEdit(asRule(row))"
              >编辑</ElButton
            >
            <ElButton link type="danger" :icon="Delete" @click="remove(asRule(row))">删除</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <div class="pagination-row">
        <ElPagination
          v-model:current-page="page.current"
          v-model:page-size="page.size"
          :total="page.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadPage"
          @current-change="loadPage"
        />
      </div>
    </ElCard>

    <ElDialog v-model="dialogVisible" :title="form.id ? '编辑规则' : '新增规则'" width="560px">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="104px">
        <ElFormItem label="规则编码" prop="ruleCode">
          <ElInput v-model.trim="form.ruleCode" placeholder="例如 PRODUCT_BARCODE_DEFAULT" />
        </ElFormItem>
        <ElFormItem label="规则名称" prop="ruleName">
          <ElInput v-model.trim="form.ruleName" placeholder="例如 产品条码默认规则" />
        </ElFormItem>
        <ElFormItem label="条码前缀">
          <ElInput v-model.trim="form.prefix" placeholder="留空表示不限前缀" />
        </ElFormItem>
        <ElFormItem label="条码长度">
          <ElInputNumber v-model="form.barcodeLength" :min="1" :max="256" placeholder="不限" />
        </ElFormItem>
        <ElFormItem label="正则表达式">
          <ElInput v-model.trim="form.pattern" placeholder="可选" />
        </ElFormItem>
        <ElFormItem label="业务类型">
          <ElInput v-model="form.businessType" disabled />
        </ElFormItem>
        <ElFormItem label="处理器">
          <ElInput v-model="form.handlerCode" disabled />
        </ElFormItem>
        <ElFormItem label="校验来源">
          <ElSelect v-model="form.validationSource">
            <ElOption label="后台本地规则" value="Local" />
            <ElOption label="远程校验接口" value="Remote" />
          </ElSelect>
        </ElFormItem>
        <ElAlert
          v-if="form.validationSource === 'Remote'"
          type="info"
          :closable="false"
          title="远程接口地址和鉴权信息仅在后端 PdaOptions 配置，不在此页面填写。"
        />
        <ElFormItem label="优先级">
          <ElInputNumber v-model="form.priority" :min="1" :max="999" />
        </ElFormItem>
        <ElFormItem label="启用状态">
          <ElSwitch v-model="form.enabled" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="submit">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { Delete, Edit, Plus, Refresh, Search } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import {
    deletePdaBarcodeRule,
    fetchPdaBarcodeRulePage,
    savePdaBarcodeRule,
    type PdaBarcodeRule,
    type PdaBarcodeRuleSaveParams,
    type PdaPage
  } from '@/api/pda'

  defineOptions({ name: 'PdaBarcodeRule' })

  const loading = ref(false)
  const saving = ref(false)
  const dialogVisible = ref(false)
  const formRef = ref<FormInstance>()
  const query = reactive<{ keyword: string; enabled?: boolean }>({
    keyword: '',
    enabled: undefined
  })
  const page = reactive<PdaPage<PdaBarcodeRule>>({ records: [], current: 1, size: 20, total: 0 })
  const form = reactive<PdaBarcodeRuleSaveParams>({
    ruleCode: '',
    ruleName: '',
    prefix: '',
    barcodeLength: undefined,
    pattern: '',
    businessType: 'ProductBarcode',
    handlerCode: 'ProductBarcodeQuery',
    validationSource: 'Local',
    priority: 100,
    enabled: true
  })

  const rules: FormRules = {
    ruleCode: [{ required: true, message: '请输入规则编码', trigger: 'blur' }],
    ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }]
  }

  const loadPage = async () => {
    loading.value = true
    try {
      Object.assign(
        page,
        await fetchPdaBarcodeRulePage({
          current: page.current,
          size: page.size,
          keyword: query.keyword.trim() || undefined,
          enabled: query.enabled
        })
      )
    } finally {
      loading.value = false
    }
  }

  const search = () => {
    page.current = 1
    loadPage()
  }

  const asRule = (row: unknown) => row as PdaBarcodeRule
  const ruleRowKey = (row: PdaBarcodeRule) =>
    row.id === null ? `rule-${row.ruleCode}` : String(row.id)

  const resetForm = () => {
    Object.assign(form, {
      id: undefined,
      ruleCode: '',
      ruleName: '',
      prefix: '',
      barcodeLength: undefined,
      pattern: '',
      businessType: 'ProductBarcode',
      handlerCode: 'ProductBarcodeQuery',
      validationSource: 'Local',
      priority: 100,
      enabled: true
    })
  }

  const openCreate = () => {
    resetForm()
    dialogVisible.value = true
  }

  const openEdit = (row: PdaBarcodeRule) => {
    if (row.id === null) {
      ElMessage.error('规则 ID 缺失，无法编辑，请刷新页面后重试')
      return
    }
    Object.assign(form, {
      id: row.id,
      ruleCode: row.ruleCode,
      ruleName: row.ruleName,
      prefix: row.prefix || '',
      barcodeLength: row.barcodeLength,
      pattern: row.pattern || '',
      businessType: row.businessType || 'ProductBarcode',
      handlerCode: row.handlerCode || 'ProductBarcodeQuery',
      validationSource: row.validationSource || 'Local',
      priority: row.priority,
      enabled: row.enabled
    })
    dialogVisible.value = true
  }

  const submit = async () => {
    await formRef.value?.validate()
    saving.value = true
    try {
      await savePdaBarcodeRule(form)
      ElMessage.success('规则已保存')
      dialogVisible.value = false
      await loadPage()
    } finally {
      saving.value = false
    }
  }

  const remove = async (row: PdaBarcodeRule) => {
    if (row.id === null) {
      ElMessage.error('规则 ID 缺失，无法删除，请刷新页面后重试')
      return
    }
    try {
      await ElMessageBox.confirm(`确定删除规则「${row.ruleName}」吗？`, '删除规则', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await deletePdaBarcodeRule(row.id)
      ElMessage.success('规则已删除')
      if (page.records.length === 1 && page.current > 1) page.current--
      await loadPage()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') throw error
    }
  }

  onMounted(loadPage)
</script>

<style scoped>
  .pda-page {
    display: flex;
    min-height: 0;
  }

  .pda-card {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 420px;
  }

  :deep(.pda-card > .el-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .page-header,
  .toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .section-title {
    color: var(--art-gray-900);
    font-size: 16px;
    font-weight: 600;
  }

  .section-subtitle {
    margin-top: 4px;
    color: var(--art-gray-600);
    font-size: 13px;
  }

  .toolbar {
    justify-content: flex-start;
    margin-bottom: 14px;
  }

  .toolbar .el-input {
    width: min(340px, 42vw);
  }

  .toolbar .el-select {
    width: 130px;
  }

  .pagination-row {
    display: flex;
    justify-content: flex-end;
    padding-top: 14px;
  }
</style>
