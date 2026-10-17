<template>
  <ElCard class="binding-panel" shadow="never">
    <template #header>
      <div class="panel-header">
        <div>
          <div class="panel-title">Agent 平台绑定</div>
          <div class="panel-subtitle"
            >主平台优先调用，失败后按优先级使用备用平台；未绑定时使用全部已启用平台</div
          >
        </div>
        <ElButton
          type="primary"
          :icon="Plus"
          :disabled="agentOptions.length === 0 || enabledProviders.length === 0"
          @click="openAdd()"
        >
          新增绑定
        </ElButton>
      </div>
    </template>

    <ElTable v-loading="loading" :data="displayBindings" row-key="rowKey" max-height="320">
      <ElTableColumn prop="agentName" label="Agent" min-width="160">
        <template #default="{ row }">
          <div class="agent-cell">
            <span>{{ row.agentName }}</span>
            <small>{{ row.agentCode }}</small>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="providerName" label="模型平台" min-width="180">
        <template #default="{ row }">
          <span v-if="row.providerId">{{ row.providerName || providerName(row.providerId) }}</span>
          <ElTag v-else type="info">使用全部已启用平台</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="类型" width="92">
        <template #default="{ row }">
          <ElTag v-if="row.providerId" :type="row.isPrimary ? 'success' : 'info'">
            {{ row.isPrimary ? '主平台' : '备用' }}
          </ElTag>
          <span v-else>-</span>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="priority" label="优先级" width="90">
        <template #default="{ row }">{{ row.providerId ? row.priority : '-' }}</template>
      </ElTableColumn>
      <ElTableColumn label="状态" width="90">
        <template #default="{ row }">
          <ElTag v-if="row.providerId" :type="row.enabled ? 'success' : 'warning'">
            {{ row.enabled ? '启用' : '停用' }}
          </ElTag>
          <span v-else>-</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-if="row.providerId"
            link
            type="primary"
            :icon="Edit"
            @click="openEdit(asBinding(row))"
          >
            编辑
          </ElButton>
          <ElButton v-else link type="primary" :icon="Plus" @click="openAdd(row.agentCode)">
            绑定
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElDialog
      v-model="dialogVisible"
      :title="editing ? '编辑 Agent 绑定' : '新增 Agent 绑定'"
      width="520px"
      align-center
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="96px">
        <ElFormItem label="Agent" prop="agentCode">
          <ElSelect
            v-model="form.agentCode"
            filterable
            placeholder="请选择 Agent"
            class="full-width"
          >
            <ElOption
              v-for="agent in agentOptions"
              :key="agent.agentCode"
              :label="`${agent.agentName} (${agent.agentCode})`"
              :value="agent.agentCode"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="模型平台" prop="providerId">
          <ElSelect
            v-model="form.providerId"
            filterable
            placeholder="请选择模型平台"
            class="full-width"
          >
            <ElOption
              v-for="provider in providers"
              :key="provider.id"
              :label="`${provider.providerName} (${provider.model})`"
              :value="provider.id"
              :disabled="!provider.enabled"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="绑定类型">
          <ElSegmented v-model="form.isPrimary" :options="bindingTypeOptions" block />
        </ElFormItem>
        <ElFormItem label="优先级" prop="priority">
          <ElInputNumber v-model="form.priority" :min="1" :max="9999" controls-position="right" />
        </ElFormItem>
        <ElFormItem label="启用状态">
          <ElSwitch v-model="form.enabled" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="submitBinding">保存</ElButton>
      </template>
    </ElDialog>
  </ElCard>
</template>

<script setup lang="ts">
  import { Edit, Plus } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    saveAgentModelBinding,
    type AgentModelBinding,
    type AgentModelProvider
  } from '@/api/agent-model-provider'

  const props = defineProps<{
    bindings: AgentModelBinding[]
    providers: AgentModelProvider[]
    loading: boolean
  }>()

  const emit = defineEmits<{ (event: 'saved'): void }>()
  const formRef = ref<FormInstance>()
  const dialogVisible = ref(false)
  const saving = ref(false)
  const editing = ref(false)
  const form = reactive({
    agentCode: '',
    providerId: undefined as number | undefined,
    isPrimary: false,
    priority: 100,
    enabled: true
  })

  const rules: FormRules = {
    agentCode: [{ required: true, message: '请选择 Agent', trigger: 'change' }],
    providerId: [{ required: true, message: '请选择模型平台', trigger: 'change' }],
    priority: [{ required: true, message: '请输入优先级', trigger: 'blur' }]
  }

  const bindingTypeOptions = [
    { label: '备用平台', value: false },
    { label: '主平台', value: true }
  ]

  const enabledProviders = computed(() => props.providers.filter((item) => item.enabled))
  const displayBindings = computed(() =>
    props.bindings.map((item, index) => ({
      ...item,
      rowKey: item.id ?? `empty-${item.agentCode}-${index}`
    }))
  )
  const agentOptions = computed(() => {
    const options = new Map<string, { agentCode: string; agentName: string }>()
    props.bindings.forEach((item) => {
      if (!options.has(item.agentCode)) {
        options.set(item.agentCode, { agentCode: item.agentCode, agentName: item.agentName })
      }
    })
    return [...options.values()]
  })

  const providerName = (providerId: number) =>
    props.providers.find((item) => item.id === providerId)?.providerName || `平台 ${providerId}`

  const asBinding = (row: unknown) => row as AgentModelBinding

  const resetForm = () => {
    Object.assign(form, {
      agentCode: agentOptions.value[0]?.agentCode || '',
      providerId: enabledProviders.value[0]?.id,
      isPrimary: false,
      priority: 100,
      enabled: true
    })
  }

  const openAdd = (agentCode?: string) => {
    editing.value = false
    resetForm()
    if (agentCode) form.agentCode = agentCode
    dialogVisible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }

  const openEdit = (binding: AgentModelBinding) => {
    editing.value = true
    Object.assign(form, {
      agentCode: binding.agentCode,
      providerId: binding.providerId,
      isPrimary: binding.isPrimary,
      priority: binding.priority,
      enabled: binding.enabled
    })
    dialogVisible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }

  const submitBinding = async () => {
    if (!formRef.value) return
    await formRef.value.validate()
    if (!form.providerId) return
    saving.value = true
    try {
      await saveAgentModelBinding({
        agentCode: form.agentCode,
        providerId: form.providerId,
        isPrimary: form.isPrimary,
        priority: form.priority,
        enabled: form.enabled
      })
      ElMessage.success('Agent 平台绑定已保存')
      dialogVisible.value = false
      emit('saved')
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .binding-panel {
    margin-bottom: 12px;
  }

  .panel-header {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  }

  .panel-title {
    color: var(--art-gray-900);
    font-size: 16px;
    font-weight: 600;
  }

  .panel-subtitle {
    margin-top: 4px;
    color: var(--art-gray-600);
    font-size: 13px;
  }

  .agent-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .agent-cell small {
    color: var(--art-gray-500);
  }

  .full-width {
    width: 100%;
  }

  @media (max-width: 640px) {
    .panel-header {
      align-items: flex-start;
    }

    .panel-subtitle {
      display: none;
    }
  }
</style>
