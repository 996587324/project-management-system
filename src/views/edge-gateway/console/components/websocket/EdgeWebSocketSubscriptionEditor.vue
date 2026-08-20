<template>
  <section class="subscription-editor">
    <div class="subscription-editor-heading">
      <div>
        <strong>订阅设备与参数</strong>
        <span>{{ model.length }} 台设备，{{ parameterCount }} 个参数</span>
      </div>
      <el-button type="primary" plain :icon="Plus" @click="addDevice">新增设备</el-button>
    </div>

    <el-empty v-if="!model.length" description="暂无订阅设备" :image-size="72">
      <el-button type="primary" :icon="Plus" @click="addDevice">新增设备</el-button>
    </el-empty>

    <div
      v-for="(device, deviceIndex) in model"
      :key="device.id || `device-${deviceIndex}`"
      class="subscription-device"
    >
      <div class="subscription-device-heading">
        <el-input v-model="device.deviceCode" placeholder="设备代码 deviceCode" maxlength="128" />
        <el-input v-model="device.deviceName" placeholder="设备名称（可选）" maxlength="128" />
        <el-switch v-model="device.enabled" active-text="启用" inactive-text="停用" />
        <el-tooltip content="删除设备" placement="top">
          <el-button
            text
            type="danger"
            :icon="Delete"
            aria-label="删除设备"
            @click="removeDevice(deviceIndex)"
          />
        </el-tooltip>
      </div>

      <div class="subscription-parameter-list">
        <div class="subscription-parameter-row subscription-parameter-title">
          <span>参数名称</span>
          <span>中文名称</span>
          <span>数据类型</span>
          <span>状态</span>
          <span>操作</span>
        </div>
        <div
          v-for="(parameter, parameterIndex) in device.parameters"
          :key="parameter.id || `parameter-${deviceIndex}-${parameterIndex}`"
          class="subscription-parameter-row"
        >
          <el-input v-model="parameter.parameterName" placeholder="例如 Ua" maxlength="128" />
          <el-input
            v-model="parameter.parameterNameCn"
            placeholder="例如 A 相电压"
            maxlength="128"
          />
          <el-select
            v-model="parameter.dataType"
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
          <el-switch v-model="parameter.enabled" />
          <el-tooltip content="删除参数" placement="top">
            <el-button
              text
              type="danger"
              :icon="Delete"
              aria-label="删除参数"
              @click="device.parameters.splice(parameterIndex, 1)"
            />
          </el-tooltip>
        </div>
        <el-button text type="primary" :icon="Plus" @click="addParameter(deviceIndex)">
          新增参数
        </el-button>
      </div>
    </div>

    <div class="subscription-preview">
      <div class="subscription-preview-heading">
        <strong>订阅 JSON</strong>
        <el-button text :icon="DocumentCopy" @click="copyPayload">复制</el-button>
      </div>
      <pre>{{ subscriptionPayload }}</pre>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { ElMessage } from 'element-plus'
  import { Delete, DocumentCopy, Plus } from '@element-plus/icons-vue'
  import type { EdgeWebSocketSubscriptionDevice } from '@/api/edge-gateway'
  import {
    buildSubscriptionPayload,
    countSubscriptionParameters,
    createSubscriptionDevice,
    createSubscriptionParameter,
    validateSubscriptions
  } from './subscriptionEditorUtils'

  const model = defineModel<EdgeWebSocketSubscriptionDevice[]>({ required: true })

  const parameterCount = computed(() => countSubscriptionParameters(model.value))
  const subscriptionPayload = computed(() => buildSubscriptionPayload(model.value))

  const addDevice = () => model.value.push(createSubscriptionDevice())
  const removeDevice = (index: number) => model.value.splice(index, 1)
  const addParameter = (deviceIndex: number) =>
    model.value[deviceIndex].parameters.push(createSubscriptionParameter())

  const validate = () => {
    const error = validateSubscriptions(model.value)
    if (error) ElMessage.warning(error)
    return !error
  }

  const copyPayload = async () => {
    await navigator.clipboard.writeText(subscriptionPayload.value)
    ElMessage.success('订阅 JSON 已复制')
  }

  defineExpose({ validate })
</script>
