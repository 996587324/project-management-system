<template>
  <ElDialog
    v-model="visible"
    :title="provider ? '编辑模型平台' : '新增模型平台'"
    width="min(780px, 94vw)"
    align-center
    destroy-on-close
  >
    <div class="preset-bar">
      <div class="preset-actions">
        <ElButton :icon="MagicStick" @click="applyTuringPreset">选择 Turing</ElButton>
        <ElButton :icon="MagicStick" @click="applyDeepSeekPreset">选择 DeepSeek</ElButton>
      </div>
      <ElTag type="info">OpenAI Chat Completions</ElTag>
    </div>
    <ElAlert
      title="此处是系统统一模型配置。密钥由后端加密保存，普通用户不可查看或修改。"
      type="info"
      :closable="false"
      show-icon
      class="provider-tip"
    />

    <ElForm ref="formRef" :model="form" :rules="rules" label-width="118px" class="provider-form">
      <div class="form-grid">
        <ElFormItem label="平台名称" prop="providerName">
          <ElInput v-model="form.providerName" placeholder="如 Turing 中转平台" />
        </ElFormItem>
        <ElFormItem label="平台编码" prop="providerCode">
          <ElInput v-model="form.providerCode" placeholder="如 turing" />
        </ElFormItem>
        <ElFormItem label="Base URL" prop="baseUrl" class="span-2">
          <ElInput v-model="form.baseUrl" placeholder="https://example.com/api/v1" />
        </ElFormItem>
        <ElFormItem label="接口路径" prop="endpointPath">
          <ElInput v-model="form.endpointPath" placeholder="/chat/completions" />
        </ElFormItem>
        <ElFormItem label="模型编码" prop="model">
          <ElInput v-model="form.model" placeholder="请输入平台模型编码" />
        </ElFormItem>
        <ElFormItem label="API Key" prop="apiKey" class="span-2">
          <ElInput
            v-model="form.apiKey"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="
              provider?.hasApiKey ? `留空保留原密钥 ${provider.apiKeyMask || ''}` : '请输入 API Key'
            "
          />
        </ElFormItem>
        <ElFormItem label="密钥请求头" prop="apiKeyHeader">
          <ElInput v-model="form.apiKeyHeader" placeholder="Authorization" />
        </ElFormItem>
        <ElFormItem label="协议类型">
          <ElInput v-model="form.protocolType" disabled />
        </ElFormItem>
        <ElFormItem label="Temperature" prop="temperature">
          <ElInputNumber
            v-model="form.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            :precision="1"
            controls-position="right"
          />
        </ElFormItem>
        <ElFormItem label="最大 Tokens" prop="maxTokens">
          <ElInputNumber v-model="form.maxTokens" :min="1" :max="32768" controls-position="right" />
        </ElFormItem>
        <ElFormItem label="平台超时(秒)" prop="platformTimeoutSeconds">
          <ElInputNumber
            v-model="form.platformTimeoutSeconds"
            :min="1"
            :max="600"
            controls-position="right"
          />
        </ElFormItem>
        <ElFormItem label="客户端超时(秒)" prop="clientTimeoutSeconds">
          <ElInputNumber
            v-model="form.clientTimeoutSeconds"
            :min="2"
            :max="900"
            controls-position="right"
          />
        </ElFormItem>
        <ElFormItem label="平台重试次数" prop="maxRetries">
          <ElInputNumber v-model="form.maxRetries" :min="0" :max="5" controls-position="right" />
        </ElFormItem>
        <ElFormItem label="启用状态">
          <ElSwitch v-model="form.enabled" />
        </ElFormItem>
        <ElFormItem label="Fallback JSON" prop="fallbacksJson" class="span-2">
          <ElInput
            v-model="form.fallbacksJson"
            type="textarea"
            :rows="3"
            resize="vertical"
            placeholder='可填 JSON 字符串、对象或数组，如 ["备用模型编码"]'
          />
        </ElFormItem>
        <ElFormItem label="备注" class="span-2">
          <ElInput v-model="form.remark" type="textarea" :rows="2" placeholder="可选" />
        </ElFormItem>
      </div>
    </ElForm>

    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="submit">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { MagicStick } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    saveAgentModelProvider,
    type AgentModelProvider,
    type AgentModelProviderSaveParams
  } from '@/api/agent-model-provider'

  const props = defineProps<{
    modelValue: boolean
    provider?: AgentModelProvider
  }>()

  const emit = defineEmits<{
    (event: 'update:modelValue', value: boolean): void
    (event: 'saved'): void
  }>()

  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })
  const formRef = ref<FormInstance>()
  const saving = ref(false)
  const form = reactive<AgentModelProviderSaveParams>(createDefaultForm())

  const validateApiKey = (
    _rule: unknown,
    value: string | undefined,
    callback: (error?: Error) => void
  ) => {
    if (!props.provider?.hasApiKey && !String(value || '').trim()) {
      callback(new Error('请输入 API Key'))
      return
    }
    callback()
  }

  const validateClientTimeout = (
    _rule: unknown,
    value: number,
    callback: (error?: Error) => void
  ) => {
    if (value <= form.platformTimeoutSeconds) {
      callback(new Error('客户端超时必须大于平台超时'))
      return
    }
    callback()
  }

  const validateFallbackJson = (
    _rule: unknown,
    value: string | undefined,
    callback: (error?: Error) => void
  ) => {
    if (!String(value || '').trim()) {
      callback()
      return
    }
    try {
      const parsed = JSON.parse(String(value))
      if (
        parsed === null ||
        (!Array.isArray(parsed) && typeof parsed !== 'object' && typeof parsed !== 'string')
      ) {
        callback(new Error('请输入 JSON 字符串、对象或数组'))
        return
      }
      callback()
    } catch {
      callback(new Error('Fallback JSON 格式不正确'))
    }
  }

  const rules: FormRules = {
    providerName: [{ required: true, message: '请输入平台名称', trigger: 'blur' }],
    providerCode: [
      { required: true, message: '请输入平台编码', trigger: 'blur' },
      {
        pattern: /^[a-z0-9][a-z0-9_-]{1,63}$/,
        message: '仅支持小写字母、数字、下划线和连字符',
        trigger: 'blur'
      }
    ],
    baseUrl: [
      { required: true, message: '请输入 Base URL', trigger: 'blur' },
      { type: 'url', message: '请输入有效的 http 或 https 地址', trigger: 'blur' }
    ],
    endpointPath: [{ required: true, message: '请输入接口路径', trigger: 'blur' }],
    model: [{ required: true, message: '请输入模型编码', trigger: 'blur' }],
    apiKey: [{ validator: validateApiKey, trigger: 'blur' }],
    apiKeyHeader: [{ required: true, message: '请输入密钥请求头', trigger: 'blur' }],
    temperature: [{ required: true, message: '请输入 Temperature', trigger: 'change' }],
    maxTokens: [{ required: true, message: '请输入最大 Tokens', trigger: 'change' }],
    platformTimeoutSeconds: [{ required: true, message: '请输入平台超时', trigger: 'change' }],
    clientTimeoutSeconds: [{ validator: validateClientTimeout, trigger: 'change' }],
    maxRetries: [{ required: true, message: '请输入重试次数', trigger: 'change' }],
    fallbacksJson: [{ validator: validateFallbackJson, trigger: 'blur' }]
  }

  function createDefaultForm(): AgentModelProviderSaveParams {
    return {
      providerCode: '',
      providerName: '',
      protocolType: 'OpenAIChatCompletions',
      baseUrl: '',
      endpointPath: '/chat/completions',
      apiKey: '',
      apiKeyHeader: 'Authorization',
      model: '',
      temperature: 0.2,
      maxTokens: 1200,
      clientTimeoutSeconds: 90,
      platformTimeoutSeconds: 75,
      maxRetries: 1,
      fallbacksJson: '',
      remark: '',
      enabled: false
    }
  }

  const initializeForm = () => {
    const source = props.provider
    Object.assign(
      form,
      source
        ? {
            id: source.id,
            providerCode: source.providerCode,
            providerName: source.providerName,
            protocolType: source.protocolType,
            baseUrl: source.baseUrl,
            endpointPath: source.endpointPath,
            apiKey: '',
            apiKeyHeader: source.apiKeyHeader,
            model: source.model,
            temperature: source.temperature,
            maxTokens: source.maxTokens,
            clientTimeoutSeconds: source.clientTimeoutSeconds,
            platformTimeoutSeconds: source.platformTimeoutSeconds,
            maxRetries: source.maxRetries,
            fallbacksJson: source.fallbacksJson || '',
            remark: source.remark || '',
            enabled: source.enabled
          }
        : createDefaultForm()
    )
  }

  const applyTuringPreset = () => {
    Object.assign(form, {
      providerCode: 'turing',
      providerName: 'Turing 中转平台',
      protocolType: 'OpenAIChatCompletions',
      baseUrl: 'https://live-turing.cn.llm.tcljd.com/api/v1',
      endpointPath: '/chat/completions',
      apiKeyHeader: 'Authorization',
      clientTimeoutSeconds: 90,
      platformTimeoutSeconds: 75,
      maxRetries: 1
    })
  }

  const applyDeepSeekPreset = () => {
    Object.assign(form, {
      providerCode: 'deepseek',
      providerName: 'DeepSeek',
      protocolType: 'OpenAIChatCompletions',
      baseUrl: 'https://api.deepseek.com',
      endpointPath: '/chat/completions',
      apiKeyHeader: 'Authorization',
      model: 'deepseek-chat',
      clientTimeoutSeconds: 90,
      platformTimeoutSeconds: 75,
      maxRetries: 1
    })
  }

  watch(
    () => props.modelValue,
    (value) => {
      if (!value) return
      initializeForm()
      nextTick(() => formRef.value?.clearValidate())
    }
  )

  const submit = async () => {
    if (!formRef.value) return
    await formRef.value.validate()
    saving.value = true
    try {
      await saveAgentModelProvider({
        ...form,
        apiKey: String(form.apiKey || '').trim() || undefined,
        fallbacksJson: String(form.fallbacksJson || '').trim() || undefined,
        remark: String(form.remark || '').trim() || undefined
      })
      ElMessage.success('模型平台已保存')
      visible.value = false
      emit('saved')
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .preset-bar {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 16px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .preset-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .form-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    column-gap: 18px;
  }

  .provider-tip {
    margin-bottom: 16px;
  }

  .span-2 {
    grid-column: 1 / -1;
  }

  :deep(.el-input-number) {
    width: 100%;
  }

  @media (max-width: 680px) {
    .form-grid {
      display: block;
    }

    .provider-form {
      --el-form-label-font-size: 13px;
    }
  }
</style>
