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
  import type {
    EdgeWebSocketSubscriptionDevice,
    EdgeWebSocketSubscriptionParameter
  } from '@/api/edge-gateway'

  const model = defineModel<EdgeWebSocketSubscriptionDevice[]>({ required: true })

  const createParameter = (): EdgeWebSocketSubscriptionParameter => ({
    parameterName: '',
    parameterNameCn: '',
    dataType: '',
    enabled: true,
    sort: 0
  })

  const createDevice = (): EdgeWebSocketSubscriptionDevice => ({
    deviceCode: '',
    deviceName: '',
    enabled: true,
    sort: 0,
    parameters: [createParameter()]
  })

  const parameterCount = computed(() =>
    model.value.reduce((total, device) => total + device.parameters.length, 0)
  )

  const normalizedDevices = computed(() =>
    model.value
      .filter((device) => device.enabled)
      .map((device) => ({
        deviceCode: device.deviceCode.trim(),
        parameters: device.parameters
          .filter((parameter) => parameter.enabled)
          .map((parameter) => parameter.parameterName.trim())
          .filter(Boolean)
      }))
      .filter((device) => device.deviceCode && device.parameters.length)
  )

  const subscriptionPayload = computed(() =>
    JSON.stringify({ devices: normalizedDevices.value }, null, 2)
  )

  const addDevice = () => model.value.push(createDevice())
  const removeDevice = (index: number) => model.value.splice(index, 1)
  const addParameter = (deviceIndex: number) =>
    model.value[deviceIndex].parameters.push(createParameter())

  const validate = () => {
    if (!model.value.length) {
      ElMessage.warning('至少需要配置一个订阅设备')
      return false
    }
    if (model.value.length > 500) {
      ElMessage.warning('单个连接最多配置 500 个订阅设备')
      return false
    }
    if (parameterCount.value > 5000) {
      ElMessage.warning('单个连接的订阅参数总数不能超过 5000 个')
      return false
    }
    const deviceCodes = new Set<string>()
    let enabledDeviceCount = 0
    for (let deviceIndex = 0; deviceIndex < model.value.length; deviceIndex += 1) {
      const device = model.value[deviceIndex]
      const deviceCode = device.deviceCode.trim()
      if (!deviceCode) {
        ElMessage.warning(`第 ${deviceIndex + 1} 个订阅设备没有填写设备代码`)
        return false
      }
      if (deviceCode.length > 128) {
        ElMessage.warning(`设备代码 ${deviceCode} 不能超过 128 个字符`)
        return false
      }
      if ((device.deviceName?.trim().length ?? 0) > 128) {
        ElMessage.warning(`设备 ${deviceCode} 的名称不能超过 128 个字符`)
        return false
      }
      if (deviceCodes.has(deviceCode.toLowerCase())) {
        ElMessage.warning(`设备代码重复：${deviceCode}`)
        return false
      }
      deviceCodes.add(deviceCode.toLowerCase())
      if (!device.parameters.length) {
        ElMessage.warning(`设备 ${deviceCode} 至少需要配置一个参数`)
        return false
      }
      if (device.parameters.length > 200) {
        ElMessage.warning(`设备 ${deviceCode} 最多配置 200 个参数`)
        return false
      }
      const parameterNames = new Set<string>()
      let enabledParameterCount = 0
      for (let parameterIndex = 0; parameterIndex < device.parameters.length; parameterIndex += 1) {
        const parameter = device.parameters[parameterIndex]
        const parameterName = parameter.parameterName.trim()
        if (!parameterName) {
          ElMessage.warning(`设备 ${deviceCode} 的第 ${parameterIndex + 1} 个参数名称为空`)
          return false
        }
        if (parameterName.length > 128) {
          ElMessage.warning(`参数 ${parameterName} 不能超过 128 个字符`)
          return false
        }
        if ((parameter.parameterNameCn?.trim().length ?? 0) > 128) {
          ElMessage.warning(`参数 ${parameterName} 的中文名称不能超过 128 个字符`)
          return false
        }
        if ((parameter.dataType?.trim().length ?? 0) > 32) {
          ElMessage.warning(`参数 ${parameterName} 的数据类型不能超过 32 个字符`)
          return false
        }
        if (parameterNames.has(parameterName.toLowerCase())) {
          ElMessage.warning(`设备 ${deviceCode} 的参数重复：${parameterName}`)
          return false
        }
        parameterNames.add(parameterName.toLowerCase())
        if (parameter.enabled) enabledParameterCount += 1
      }
      if (device.enabled) {
        if (!enabledParameterCount) {
          ElMessage.warning(`启用设备 ${deviceCode} 至少需要启用一个参数`)
          return false
        }
        enabledDeviceCount += 1
      }
    }
    if (!enabledDeviceCount) {
      ElMessage.warning('至少需要启用一个订阅设备')
      return false
    }
    return true
  }

  const copyPayload = async () => {
    await navigator.clipboard.writeText(subscriptionPayload.value)
    ElMessage.success('订阅 JSON 已复制')
  }

  defineExpose({ validate })
</script>
