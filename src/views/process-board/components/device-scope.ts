import type { ProcessDefinition, SourceBinding } from '@/api/process-board'

export const processDeviceKey = (source: Pick<SourceBinding, 'tenantMark' | 'deviceMark'>) =>
  JSON.stringify([source.tenantMark, source.deviceMark])

export function isLineDevice(source: SourceBinding, allowed: SourceBinding[]) {
  return (
    source.fixedValue != null ||
    allowed.some(
      (device) => device.fixedValue == null && processDeviceKey(device) === processDeviceKey(source)
    )
  )
}

interface Reference {
  fieldCode: string
  slot: string
  label: string
  source: SourceBinding
}
export function processDeviceReferences(card: ProcessDefinition): Reference[] {
  const references: Reference[] = card.devices
    .filter((x) => x.fixedValue == null)
    .map((source) => ({ fieldCode: '', slot: 'device', label: '关联设备', source }))
  for (const field of card.fields) {
    if (field.fixedText == null && field.source.fixedValue == null)
      references.push({
        fieldCode: field.code,
        slot: 'source',
        label: `字段“${field.name}”`,
        source: field.source
      })
    for (const [name, source] of Object.entries(field.variables)) {
      if (source.fixedValue == null)
        references.push({
          fieldCode: field.code,
          slot: `variable:${name}`,
          label: `字段“${field.name}”变量“${name}”`,
          source
        })
    }
  }
  return references
}

export function processDeviceIssues(
  card: ProcessDefinition,
  allowed: SourceBinding[],
  original?: ProcessDefinition
) {
  const previous = original ? processDeviceReferences(original) : []
  return processDeviceReferences(card)
    .filter((reference) => !isLineDevice(reference.source, allowed))
    .map((reference) => ({
      ...reference,
      legacy: previous.some(
        (old) =>
          old.fieldCode.toLowerCase() === reference.fieldCode.toLowerCase() &&
          old.slot === reference.slot &&
          processDeviceKey(old.source) === processDeviceKey(reference.source) &&
          old.source.sourcePath === reference.source.sourcePath
      )
    }))
}
