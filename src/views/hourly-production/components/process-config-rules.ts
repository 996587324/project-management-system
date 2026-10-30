import type { HourlyBoard, HourlyLine, HourlyProcess } from '@/api/hourly-production'

export function removeHourlyLine(board: HourlyBoard, line: HourlyLine) {
  const index = board.lines.indexOf(line)
  if (index < 0 || board.lines.length <= 1) return false
  board.lines.splice(index, 1)
  if (board.layout) {
    board.layout.groups = board.layout.groups.filter((group) => !group.includes(line.code))
    if (!board.layout.groups.length)
      board.layout = { mode: 'Single', rotationSeconds: 15, groups: [[board.lines[0].code]] }
  }
  const hadSelectedLines = board.push.lineCodes.length > 0
  board.push.lineCodes = board.push.lineCodes.filter((code) => code !== line.code)
  if (hadSelectedLines && !board.push.lineCodes.length) board.push.enabled = false
  if (board.shiftChange) {
    for (const targets of [board.shiftChange.dayTargets, board.shiftChange.nightTargets]) {
      for (const key of Object.keys(targets))
        if (key === line.code || key.startsWith(line.code + '/')) delete targets[key]
    }
  }
  return true
}

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
