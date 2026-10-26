<template>
  <div class="art-full-height external-mcp-page">
    <ElCard shadow="never" class="external-mcp-page__card">
      <template #header>
        <div class="external-mcp-page__header">
          <div>
            <div class="external-mcp-page__title">MCP 服务配置</div>
            <div class="external-mcp-page__subtitle">
              内网直连模式已启用：调用方无需 ClientId、ClientSecret 或 Token。
            </div>
          </div>
          <ElButton :icon="Setting" @click="openServerSetting">V1/V2 服务名称配置</ElButton>
        </div>
      </template>

      <ElAlert
        title="已开放内网免认证直连读写"
        type="warning"
        :closable="false"
        show-icon
        description="MCP 和外部工具接口不校验客户端密钥、Token、权限范围、资源编码或来源 IP。请仅通过可信内网、VPN 或受控网关开放服务地址。"
      />

      <ElDescriptions :column="1" border class="external-mcp-page__description">
        <ElDescriptionsItem label="标准 MCP V2 地址">/mcp/v2（Streamable HTTP）</ElDescriptionsItem>
        <ElDescriptionsItem label="兼容 MCP V1 地址">POST /mcp</ElDescriptionsItem>
        <ElDescriptionsItem label="服务名称配置">
          保存后同时更新 V1 与 V2；V2 客户端重新初始化后读取新名称。
        </ElDescriptionsItem>
        <ElDescriptionsItem label="OpenAPI 工具目录">GET /api/external/v1/tools</ElDescriptionsItem>
        <ElDescriptionsItem label="OpenAPI 工具调用">
          POST /api/external/v1/tools/{toolName}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="读取范围">
          支持不传项目、线体或设备编码的全局统计；例如 project.get 可返回全部项目进度汇总。
        </ElDescriptionsItem>
        <ElDescriptionsItem label="审计">
          所有调用均记录到 ExternalToolAccessLog，包含来源 IP、工具、结果和耗时。
        </ElDescriptionsItem>
        <ElDescriptionsItem label="写操作">
          写工具须传入布尔值 confirm: true 和对应必要业务参数；具体能力以工具目录为准。 ClawBot
          文本推送还需接收用户编码及幂等键。
        </ElDescriptionsItem>
      </ElDescriptions>
    </ElCard>

    <ElDialog
      v-model="serverSettingVisible"
      title="MCP V1/V2 服务配置"
      width="560px"
      destroy-on-close
    >
      <ElAlert
        title="保存需同时满足管理员权限，并输入服务器当前时间格式的动态配置口令：yyyyMMddHHmm。"
        type="warning"
        :closable="false"
        show-icon
      />
      <ElForm
        ref="serverSettingFormRef"
        :model="serverSettingForm"
        :rules="serverSettingRules"
        label-width="130px"
        class="external-mcp-page__server-form"
      >
        <ElFormItem label="MCP 服务名称（V1/V2）" prop="serverName">
          <ElInput
            v-model.trim="serverSettingForm.serverName"
            placeholder="例如 intelligent-manufacturing-mcp"
            maxlength="128"
            show-word-limit
          />
        </ElFormItem>
        <ElFormItem label="服务版本" prop="version">
          <ElInput
            v-model.trim="serverSettingForm.version"
            placeholder="例如 1.0.0"
            maxlength="32"
          />
        </ElFormItem>
        <ElFormItem label="配置口令" prop="configurationPassword">
          <ElInput
            v-model.trim="serverSettingForm.configurationPassword"
            type="password"
            show-password
            placeholder="服务器当前时间，例如 202609181630"
            maxlength="12"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="serverSettingVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="saveServerSetting">保存配置</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { Setting } from '@element-plus/icons-vue'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import {
    fetchExternalToolServerSetting,
    saveExternalToolServerSetting,
    type ExternalToolServerSettingSaveParams
  } from '@/api/external-tool-client'

  defineOptions({ name: 'ExternalToolClients' })

  const serverSettingVisible = ref(false)
  const saving = ref(false)
  const serverSettingFormRef = ref<FormInstance>()
  const serverSettingForm = reactive<ExternalToolServerSettingSaveParams>({
    serverName: 'calmadmin-external-tools',
    version: '1.0.0',
    configurationPassword: ''
  })
  const serverSettingRules: FormRules = {
    serverName: [{ required: true, message: '请输入 MCP 服务名称', trigger: 'blur' }],
    version: [{ required: true, message: '请输入服务版本', trigger: 'blur' }],
    configurationPassword: [{ required: true, message: '请输入动态配置口令', trigger: 'blur' }]
  }

  async function openServerSetting() {
    const setting = await fetchExternalToolServerSetting()
    Object.assign(serverSettingForm, {
      serverName: setting.serverName,
      version: setting.version,
      configurationPassword: ''
    })
    serverSettingVisible.value = true
  }

  async function saveServerSetting() {
    await serverSettingFormRef.value?.validate()
    saving.value = true
    try {
      await saveExternalToolServerSetting({ ...serverSettingForm })
      serverSettingVisible.value = false
      ElMessage.success('MCP V1/V2 服务配置已保存；外部客户端重新初始化后会读取新名称')
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .external-mcp-page,
  .external-mcp-page__card {
    min-height: 0;
  }

  .external-mcp-page__card {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  :deep(.external-mcp-page__card > .el-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
  }

  .external-mcp-page__header {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  }

  .external-mcp-page__title {
    font-size: 18px;
    font-weight: 600;
  }

  .external-mcp-page__subtitle {
    margin-top: 4px;
    color: var(--art-gray-500);
  }

  .external-mcp-page__description {
    max-width: 980px;
  }

  .external-mcp-page__server-form {
    margin-top: 20px;
  }
</style>
