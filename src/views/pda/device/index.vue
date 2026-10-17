<template>
  <div class="pda-page art-full-height">
    <ElCard shadow="never" class="pda-card">
      <template #header>
        <div class="page-header">
          <div>
            <div class="section-title">PDA 设备</div>
            <div class="section-subtitle"
              >维护允许登录和扫码的 PDA 设备，停用后设备将无法继续使用。</div
            >
          </div>
          <ElButton type="primary" :icon="Plus" @click="openCreate">新增设备</ElButton>
        </div>
      </template>

      <div class="toolbar">
        <ElInput
          v-model="query.keyword"
          clearable
          :prefix-icon="Search"
          placeholder="搜索设备编号、名称或型号"
          @keyup.enter="search"
          @clear="search"
        />
        <ElSelect v-model="query.enabled" placeholder="全部状态" clearable @change="search">
          <ElOption label="已启用" :value="true" />
          <ElOption label="已停用" :value="false" />
        </ElSelect>
        <ElButton :icon="Refresh" :loading="loading" @click="loadPage">刷新</ElButton>
      </div>

      <ElTable v-loading="loading" :data="page.records" :row-key="deviceRowKey" height="100%">
        <ElTableColumn prop="deviceCode" label="设备编号" min-width="150" />
        <ElTableColumn prop="deviceName" label="设备名称" min-width="160" />
        <ElTableColumn prop="model" label="型号" min-width="140" show-overflow-tooltip />
        <ElTableColumn prop="scannerMode" label="扫码模式" width="120">
          <template #default="{ row }">
            <ElTag>{{ row.scannerMode }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="boundUserId" label="绑定用户ID" min-width="130">
          <template #default="{ row }">{{ row.boundUserId || '不限用户' }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="90">
          <template #default="{ row }">
            <ElTag :type="row.enabled ? 'success' : 'warning'">
              {{ row.enabled ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="lastOnlineTime" label="最近在线" min-width="170" />
        <ElTableColumn label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" :icon="Edit" @click="openEdit(asDevice(row))"
              >编辑</ElButton
            >
            <ElButton link type="danger" :icon="Delete" @click="remove(asDevice(row))"
              >删除</ElButton
            >
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

    <ElDialog v-model="dialogVisible" :title="form.id ? '编辑设备' : '新增设备'" width="520px">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="96px">
        <ElFormItem label="设备编号" prop="deviceCode">
          <ElInput v-model.trim="form.deviceCode" placeholder="例如 PDA-001" />
        </ElFormItem>
        <ElFormItem label="设备名称" prop="deviceName">
          <ElInput v-model.trim="form.deviceName" placeholder="例如 一车间 PDA" />
        </ElFormItem>
        <ElFormItem label="设备型号">
          <ElInput v-model.trim="form.model" placeholder="可选" />
        </ElFormItem>
        <ElFormItem label="扫码模式">
          <ElSelect v-model="form.scannerMode">
            <ElOption label="键盘模拟" value="Keyboard" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="绑定用户ID">
          <ElInput v-model.trim="form.boundUserId" placeholder="留空表示允许有权限用户登录" />
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
    deletePdaDevice,
    fetchPdaDevicePage,
    savePdaDevice,
    type PdaDevice,
    type PdaDeviceSaveParams,
    type PdaPage
  } from '@/api/pda'

  defineOptions({ name: 'PdaDevice' })

  const loading = ref(false)
  const saving = ref(false)
  const dialogVisible = ref(false)
  const formRef = ref<FormInstance>()
  const query = reactive<{ keyword: string; enabled?: boolean }>({
    keyword: '',
    enabled: undefined
  })
  const page = reactive<PdaPage<PdaDevice>>({ records: [], current: 1, size: 20, total: 0 })
  const form = reactive<PdaDeviceSaveParams>({
    deviceCode: '',
    deviceName: '',
    model: '',
    scannerMode: 'Keyboard',
    enabled: true,
    boundUserId: ''
  })

  const rules: FormRules = {
    deviceCode: [{ required: true, message: '请输入设备编号', trigger: 'blur' }],
    deviceName: [{ required: true, message: '请输入设备名称', trigger: 'blur' }]
  }

  const loadPage = async () => {
    loading.value = true
    try {
      Object.assign(
        page,
        await fetchPdaDevicePage({
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

  const asDevice = (row: unknown) => row as PdaDevice
  const deviceRowKey = (row: PdaDevice) =>
    row.id === null ? `device-${row.deviceCode}` : String(row.id)

  const resetForm = () => {
    Object.assign(form, {
      id: undefined,
      deviceCode: '',
      deviceName: '',
      model: '',
      scannerMode: 'Keyboard',
      enabled: true,
      boundUserId: ''
    })
  }

  const openCreate = () => {
    resetForm()
    dialogVisible.value = true
  }

  const openEdit = (row: PdaDevice) => {
    if (row.id === null) {
      ElMessage.error('设备 ID 缺失，无法编辑，请刷新页面后重试')
      return
    }
    Object.assign(form, {
      id: row.id,
      deviceCode: row.deviceCode,
      deviceName: row.deviceName,
      model: row.model || '',
      scannerMode: row.scannerMode || 'Keyboard',
      enabled: row.enabled,
      boundUserId: row.boundUserId || ''
    })
    dialogVisible.value = true
  }

  const submit = async () => {
    await formRef.value?.validate()
    saving.value = true
    try {
      await savePdaDevice(form)
      ElMessage.success('设备已保存')
      dialogVisible.value = false
      await loadPage()
    } finally {
      saving.value = false
    }
  }

  const remove = async (row: PdaDevice) => {
    if (row.id === null) {
      ElMessage.error('设备 ID 缺失，无法删除，请刷新页面后重试')
      return
    }
    try {
      await ElMessageBox.confirm(`确定删除设备「${row.deviceName}」吗？`, '删除设备', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await deletePdaDevice(row.id)
      ElMessage.success('设备已删除')
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
