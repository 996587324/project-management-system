import type { HourlyBoard, HourlyLine, HourlyProcess } from '@/api/hourly-production'

export function removeHourlyProcess(line: HourlyLine, process: HourlyProcess) {
  const index = line.processes.indexOf(process)
  if (index < 0 || line.processes.length <= 1) return false
  line.processes.splice(index, 1)
  if (line.summaryProcessCode === process.code) line.summaryProcessCode = ''
  return true
}

export function hourlyConfigIssue(board: HourlyBoard) {
  for (const line of board.lines) {
    for (const process of line.processes) {
      for (const [index, binding] of process.bindings.entries()) {
        const missing: string[] = []
        if (!['Realtime', 'Edge'].includes(binding.kind)) missing.push('接入类型')
        if (!binding.deviceKey?.trim()) missing.push('设备')
        if (process.mode === 'DistinctSn' && !binding.snPath?.trim()) missing.push('SN字段')
        if (process.mode === 'Sum' && !binding.quantityPath?.trim()) missing.push('求和字段')
        if (missing.length)
          return {
            lineCode: line.code,
            processCode: process.code,
            message: `${line.name} / ${process.name} / 数据绑定 ${index + 1}：请配置${missing.join('、')}；不需要此绑定时请移除绑定`
          }
      }
    }
    if (
      !line.processes.some((process) => process.enabled && process.code === line.summaryProcessCode)
    )
      return {
        lineCode: line.code,
        processCode: '',
        message: `${line.name}：请重新选择启用的工序作为总产出口径`
      }
  }
}
