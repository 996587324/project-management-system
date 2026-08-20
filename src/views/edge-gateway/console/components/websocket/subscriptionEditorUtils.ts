import type {
  EdgeWebSocketSubscriptionDevice,
  EdgeWebSocketSubscriptionParameter
} from '@/api/edge-gateway'

export const createSubscriptionParameter = (): EdgeWebSocketSubscriptionParameter => ({
  parameterName: '',
  parameterNameCn: '',
  dataType: '',
  enabled: true,
  sort: 0
})

export const createSubscriptionDevice = (): EdgeWebSocketSubscriptionDevice => ({
  deviceCode: '',
  deviceName: '',
  enabled: true,
  sort: 0,
  parameters: [createSubscriptionParameter()]
})

export const countSubscriptionParameters = (devices: EdgeWebSocketSubscriptionDevice[]) =>
  devices.reduce((total, device) => total + device.parameters.length, 0)

export const buildSubscriptionPayload = (devices: EdgeWebSocketSubscriptionDevice[]) => {
  const normalizedDevices = devices
    .filter((device) => device.enabled)
    .map((device) => ({
      deviceCode: device.deviceCode.trim(),
      parameters: device.parameters
        .filter((parameter) => parameter.enabled)
        .map((parameter) => parameter.parameterName.trim())
        .filter(Boolean)
    }))
    .filter((device) => device.deviceCode && device.parameters.length)

  return JSON.stringify({ devices: normalizedDevices }, null, 2)
}

/** 返回首个校验错误；空字符串表示全部订阅配置有效。 */
export const validateSubscriptions = (devices: EdgeWebSocketSubscriptionDevice[]) => {
  if (!devices.length) return '至少需要配置一个订阅设备'
  if (devices.length > 500) return '单个连接最多配置 500 个订阅设备'

  const deviceCodes = new Set<string>()
  let enabledDeviceCount = 0
  for (let deviceIndex = 0; deviceIndex < devices.length; deviceIndex += 1) {
    const device = devices[deviceIndex]
    const deviceCode = device.deviceCode.trim()
    if (!deviceCode) return `第 ${deviceIndex + 1} 个订阅设备没有填写设备代码`
    if (deviceCode.length > 128) return `设备代码 ${deviceCode} 不能超过 128 个字符`
    if ((device.deviceName?.trim().length ?? 0) > 128)
      return `设备 ${deviceCode} 的名称不能超过 128 个字符`
    if (deviceCodes.has(deviceCode.toLowerCase())) return `设备代码重复：${deviceCode}`
    deviceCodes.add(deviceCode.toLowerCase())

    if (!device.parameters.length) return `设备 ${deviceCode} 至少需要配置一个参数`
    if (device.parameters.length > 200) return `设备 ${deviceCode} 最多配置 200 个参数`

    const parameterNames = new Set<string>()
    let enabledParameterCount = 0
    for (let parameterIndex = 0; parameterIndex < device.parameters.length; parameterIndex += 1) {
      const parameter = device.parameters[parameterIndex]
      const parameterName = parameter.parameterName.trim()
      if (!parameterName) return `设备 ${deviceCode} 的第 ${parameterIndex + 1} 个参数名称为空`
      if (parameterName.length > 128) return `参数 ${parameterName} 不能超过 128 个字符`
      if ((parameter.parameterNameCn?.trim().length ?? 0) > 128)
        return `参数 ${parameterName} 的中文名称不能超过 128 个字符`
      if ((parameter.dataType?.trim().length ?? 0) > 32)
        return `参数 ${parameterName} 的数据类型不能超过 32 个字符`
      if (parameterNames.has(parameterName.toLowerCase()))
        return `设备 ${deviceCode} 的参数重复：${parameterName}`
      parameterNames.add(parameterName.toLowerCase())
      if (parameter.enabled) enabledParameterCount += 1
    }

    if (device.enabled) {
      if (!enabledParameterCount) return `启用设备 ${deviceCode} 至少需要启用一个参数`
      enabledDeviceCount += 1
    }
  }

  return enabledDeviceCount ? '' : '至少需要启用一个订阅设备'
}
