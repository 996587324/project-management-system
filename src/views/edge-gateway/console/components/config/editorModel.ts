import type { EdgeDeviceConfig } from '@/api/edge-gateway'
import { getObjectValue, isNumber, isObject } from '../shared'
import { ruleTypes } from '../rules/ruleDefinitions'

export type ConfigEditMode = 'visual' | 'json'
export type ConfigValidationState = 'idle' | 'valid' | 'invalid'
export type MappingTransformType = 'direct' | 'numeric' | 'enum' | 'enumNumeric'

export type VisualEnumEntry = {
  id: string
  sourceValue: string
  targetValue: string
}

export type VisualMapping = {
  id: string
  sourceField: string
  targetField: string
  transformType: MappingTransformType
  factor: number | undefined
  offset: number | undefined
  enumEntries: VisualEnumEntry[]
}

export type VisualMappingGroup = {
  id: string
  sourceId: string
  mappings: VisualMapping[]
}

export type MappingSuggestions = {
  sourceIds: string[]
  sourceFields: string[]
  targetFields: string[]
  sourceFieldsBySource: Record<string, string[]>
}

type ConfigurationResult = {
  error?: string
  configuration?: {
    mappings: Record<string, unknown>[]
    rules: Record<string, unknown>[]
  }
}

type ValidationResult = {
  valid: boolean
  error?: string
  formattedJson?: string
}

type ParseResult = {
  error?: string
  groups?: VisualMappingGroup[]
  rules?: Record<string, unknown>[]
}

let visualEditorSequence = 0
const nextId = (prefix: string) => `${prefix}-${(visualEditorSequence += 1)}`

export const createEnumEntry = (sourceValue = '', targetValue = ''): VisualEnumEntry => ({
  id: nextId('enum'),
  sourceValue,
  targetValue
})

export const createVisualMapping = (
  values: Partial<Omit<VisualMapping, 'id' | 'enumEntries'>> & {
    enumEntries?: VisualEnumEntry[]
  } = {}
): VisualMapping => ({
  id: nextId('mapping'),
  sourceField: values.sourceField || '',
  targetField: values.targetField || '',
  transformType: values.transformType || 'direct',
  factor: values.factor ?? 1,
  offset: values.offset ?? 0,
  enumEntries: values.enumEntries?.length
    ? values.enumEntries.map((entry) => createEnumEntry(entry.sourceValue, entry.targetValue))
    : []
})

export const createVisualMappingGroup = (
  sourceId = '',
  mappings: VisualMapping[] = [createVisualMapping()]
): VisualMappingGroup => ({
  id: nextId('source'),
  sourceId,
  mappings
})

export const buildVisualConfiguration = (
  groups: VisualMappingGroup[],
  rules: Record<string, unknown>[]
): ConfigurationResult => {
  if (!groups.length) return { error: '请至少新增一个数据源组' }

  const mappings: Record<string, unknown>[] = []
  const mappingKeys = new Set<string>()

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex]
    if (!group.mappings.length) {
      return { error: `数据源组 ${groupIndex + 1} 至少需要一个字段映射` }
    }

    for (let mappingIndex = 0; mappingIndex < group.mappings.length; mappingIndex += 1) {
      const mapping = group.mappings[mappingIndex]
      const location = `数据源组 ${groupIndex + 1} 的第 ${mappingIndex + 1} 个字段`
      if (!mapping.sourceField.trim()) return { error: `${location}没有填写源字段路径` }
      if (!mapping.targetField.trim()) return { error: `${location}没有填写目标字段` }

      const mappingKey = `${group.sourceId.trim()}:${mapping.targetField.trim()}`.toLowerCase()
      if (mappingKeys.has(mappingKey)) {
        return { error: `${location}与前面的映射使用了相同的数据源和目标字段` }
      }
      mappingKeys.add(mappingKey)

      const usesNumeric =
        mapping.transformType === 'numeric' || mapping.transformType === 'enumNumeric'
      const usesEnum = mapping.transformType === 'enum' || mapping.transformType === 'enumNumeric'
      if (usesNumeric && (!isNumber(mapping.factor) || !isNumber(mapping.offset))) {
        return { error: `${location}的倍率和偏移量必须是数字` }
      }

      const enumMap: Record<string, string> = {}
      if (usesEnum) {
        if (!mapping.enumEntries.length) return { error: `${location}至少需要一个枚举转换值` }

        for (let entryIndex = 0; entryIndex < mapping.enumEntries.length; entryIndex += 1) {
          const entry = mapping.enumEntries[entryIndex]
          if (!entry.sourceValue.trim() || !entry.targetValue.trim()) {
            return { error: `${location}的第 ${entryIndex + 1} 个枚举值没有填写完整` }
          }
          if (Object.hasOwn(enumMap, entry.sourceValue)) {
            return { error: `${location}存在重复的枚举原始值：${entry.sourceValue}` }
          }
          enumMap[entry.sourceValue] = entry.targetValue
        }
      }

      mappings.push({
        sourceId: group.sourceId.trim(),
        sourceField: mapping.sourceField.trim(),
        targetField: mapping.targetField.trim(),
        factor: usesNumeric ? mapping.factor : 1,
        offset: usesNumeric ? mapping.offset : 0,
        enumMap
      })
    }
  }

  return { configuration: { mappings, rules } }
}

const validateInlineRule = (rule: Record<string, unknown>, index: number) => {
  const prefix = `rules[${index}]`
  const read = (name: string) => getObjectValue(rule, name)
  const code = read('code')
  const type = String(read('type') || '')
  const field = read('field')
  const action = read('action')
  const enabled = read('enabled')

  if (typeof code !== 'string' || !code.trim()) return `${prefix}.code 必须填写规则编码`
  if (!ruleTypes.some((item) => item.value === type)) {
    return `${prefix}.type 只能是 Filter、Range、Threshold、Deduplicate 或 Aggregate`
  }
  if (action !== undefined && String(action).toLowerCase() !== 'drop') {
    return `${prefix}.action 当前只支持 Drop`
  }
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return `${prefix}.enabled 必须是 true 或 false`
  }
  if (type !== 'Deduplicate' && (typeof field !== 'string' || !field.trim())) {
    return `${prefix}.field 必须填写映射后的目标字段名`
  }

  if (type === 'Filter') {
    const operator = String(read('operator') || '').toLowerCase()
    const compareValue = read('compareValue')
    const compareText = read('compareText')
    const numericOperators = [
      'greaterthan',
      'greaterthanorequal',
      'lessthan',
      'lessthanorequal',
      'equal',
      'notequal'
    ]
    if (compareValue !== undefined && compareValue !== null) {
      if (!isNumber(compareValue)) return `${prefix}.compareValue 必须是数字`
      if (!numericOperators.includes(operator)) return `${prefix}.operator 不是有效的数值比较方式`
    } else if (
      typeof compareText !== 'string' ||
      !['equal', 'notequal', 'contains'].includes(operator)
    ) {
      return `${prefix} 必须正确填写 compareValue 或 compareText 及其比较方式`
    }
  }

  if (type === 'Range') {
    const min = read('min')
    const max = read('max')
    if (!isNumber(min) && !isNumber(max)) return `${prefix} 至少需要填写数字类型的 min 或 max`
    if (min !== undefined && min !== null && !isNumber(min)) return `${prefix}.min 必须是数字`
    if (max !== undefined && max !== null && !isNumber(max)) return `${prefix}.max 必须是数字`
    if (isNumber(min) && isNumber(max) && min > max) return `${prefix}.min 不能大于 max`
  }

  if (type === 'Threshold' && !isNumber(read('threshold'))) {
    return `${prefix}.threshold 必须是数字`
  }

  if (type === 'Deduplicate') {
    const windowSeconds = read('windowSeconds')
    if (!Number.isInteger(windowSeconds) || Number(windowSeconds) < 1) {
      return `${prefix}.windowSeconds 必须是大于 0 的整数`
    }
  }

  if (type === 'Aggregate') {
    const operator = String(read('operator') || '').toLowerCase()
    const windowSeconds = read('windowSeconds')
    if (!['avg', 'sum', 'min', 'max', 'count'].includes(operator)) {
      return `${prefix}.operator 只能是 Avg、Sum、Min、Max 或 Count`
    }
    if (!Number.isInteger(windowSeconds) || Number(windowSeconds) < 1) {
      return `${prefix}.windowSeconds 必须是大于 0 的整数`
    }
  }

  return ''
}

export const validateMappingConfiguration = (content: string): ValidationResult => {
  let parsed: unknown
  try {
    parsed = JSON.parse(content) as unknown
  } catch {
    return { valid: false, error: 'JSON 格式不正确' }
  }

  if (!isObject(parsed)) {
    return { valid: false, error: '配置 JSON 的根节点必须是一个对象' }
  }

  const allowedFields = ['mappings', 'rules']
  const unsupportedFields = Object.keys(parsed).filter(
    (key) => !allowedFields.includes(key.toLowerCase())
  )
  if (unsupportedFields.some((key) => key.toLowerCase() === 'sources')) {
    return {
      valid: false,
      error: 'sources 不支持通过配置版本热更新，请在 appsettings.json 中配置并重启'
    }
  }
  if (unsupportedFields.length) {
    return { valid: false, error: `配置中存在不支持的字段：${unsupportedFields.join('、')}` }
  }

  const mappings = getObjectValue(parsed, 'mappings')
  if (!Array.isArray(mappings)) return { valid: false, error: 'mappings 必须是一个数组' }

  const mappingKeys = new Set<string>()
  for (let index = 0; index < mappings.length; index += 1) {
    const mapping = mappings[index]
    if (!isObject(mapping)) return { valid: false, error: `mappings[${index}] 必须是一个对象` }

    const sourceId = getObjectValue(mapping, 'sourceId')
    const sourceField = getObjectValue(mapping, 'sourceField')
    const targetField = getObjectValue(mapping, 'targetField')
    const factor = getObjectValue(mapping, 'factor')
    const offset = getObjectValue(mapping, 'offset')
    const enumMap = getObjectValue(mapping, 'enumMap')

    if (typeof sourceId !== 'string') {
      return {
        valid: false,
        error: `mappings[${index}].sourceId 必须是文本，空字符串表示全部数据源`
      }
    }
    if (typeof sourceField !== 'string' || !sourceField.trim()) {
      return { valid: false, error: `mappings[${index}].sourceField 不能为空` }
    }
    if (typeof targetField !== 'string' || !targetField.trim()) {
      return { valid: false, error: `mappings[${index}].targetField 不能为空` }
    }
    if (factor !== undefined && !isNumber(factor)) {
      return { valid: false, error: `mappings[${index}].factor 必须是数字` }
    }
    if (offset !== undefined && !isNumber(offset)) {
      return { valid: false, error: `mappings[${index}].offset 必须是数字` }
    }
    if (
      enumMap !== undefined &&
      (!isObject(enumMap) || Object.values(enumMap).some((value) => typeof value !== 'string'))
    ) {
      return { valid: false, error: `mappings[${index}].enumMap 必须是文本键值对象` }
    }

    const mappingKey = `${sourceId.toLowerCase()}:${targetField.trim().toLowerCase()}`
    if (mappingKeys.has(mappingKey)) {
      return {
        valid: false,
        error: `mappings[${index}] 与前面的映射使用了相同的数据源和目标字段`
      }
    }
    mappingKeys.add(mappingKey)
  }

  const rules = getObjectValue(parsed, 'rules')
  if (rules !== undefined && !Array.isArray(rules)) {
    return { valid: false, error: 'rules 必须是一个数组' }
  }
  if (Array.isArray(rules)) {
    for (let index = 0; index < rules.length; index += 1) {
      if (!isObject(rules[index])) {
        return { valid: false, error: `rules[${index}] 必须是一个对象` }
      }
      const error = validateInlineRule(rules[index], index)
      if (error) return { valid: false, error }
    }
  }

  return { valid: true, formattedJson: JSON.stringify(parsed, null, 2) }
}

export const parseConfigurationToVisual = (content: string): ParseResult => {
  const validation = validateMappingConfiguration(content)
  if (!validation.valid) return { error: validation.error }

  const parsed = JSON.parse(validation.formattedJson || content) as Record<string, unknown>
  const mappings = getObjectValue(parsed, 'mappings') as Record<string, unknown>[]
  const rules = getObjectValue(parsed, 'rules')
  const groups = new Map<string, VisualMappingGroup>()

  mappings.forEach((mapping) => {
    const sourceId = String(getObjectValue(mapping, 'sourceId') || '')
    const sourceField = String(getObjectValue(mapping, 'sourceField') || '')
    const targetField = String(getObjectValue(mapping, 'targetField') || '')
    const factorValue = getObjectValue(mapping, 'factor')
    const offsetValue = getObjectValue(mapping, 'offset')
    const factor = isNumber(factorValue) ? factorValue : 1
    const offset = isNumber(offsetValue) ? offsetValue : 0
    const enumMapValue = getObjectValue(mapping, 'enumMap')
    const enumEntries = isObject(enumMapValue)
      ? Object.entries(enumMapValue).map(([sourceValue, targetValue]) =>
          createEnumEntry(sourceValue, String(targetValue))
        )
      : []
    const usesNumeric = factor !== 1 || offset !== 0
    const transformType: MappingTransformType = enumEntries.length
      ? usesNumeric
        ? 'enumNumeric'
        : 'enum'
      : usesNumeric
        ? 'numeric'
        : 'direct'

    let group = groups.get(sourceId)
    if (!group) {
      group = createVisualMappingGroup(sourceId, [])
      groups.set(sourceId, group)
    }
    group.mappings.push(
      createVisualMapping({
        sourceField,
        targetField,
        transformType,
        factor,
        offset,
        enumEntries
      })
    )
  })

  return {
    groups: groups.size ? [...groups.values()] : [createVisualMappingGroup()],
    rules: Array.isArray(rules)
      ? rules.filter((rule): rule is Record<string, unknown> => isObject(rule))
      : []
  }
}

export const collectMappingSuggestions = (
  groups: VisualMappingGroup[],
  configs: EdgeDeviceConfig[],
  connectionSourceIds: string[] = [],
  connectionSourceFields: Record<string, string[]> = {}
): MappingSuggestions => {
  const sourceIds = new Set<string>()
  const sourceFields = new Set<string>()
  const targetFields = new Set<string>()
  const sourceFieldsBySource = new Map<string, Set<string>>()

  const collectSourceField = (sourceId: string, sourceField: string) => {
    const normalizedSourceId = sourceId.trim().toLowerCase()
    const normalizedSourceField = sourceField.trim()
    if (!normalizedSourceId || !normalizedSourceField) return
    const fields = sourceFieldsBySource.get(normalizedSourceId) ?? new Set<string>()
    fields.add(normalizedSourceField)
    sourceFieldsBySource.set(normalizedSourceId, fields)
  }

  const collectMapping = (mapping: Record<string, unknown>) => {
    const sourceId = getObjectValue(mapping, 'sourceId')
    const sourceField = getObjectValue(mapping, 'sourceField')
    const targetField = getObjectValue(mapping, 'targetField')
    if (typeof sourceId === 'string' && sourceId.trim()) sourceIds.add(sourceId)
    if (typeof sourceField === 'string' && sourceField.trim()) {
      sourceFields.add(sourceField)
      if (typeof sourceId === 'string') collectSourceField(sourceId, sourceField)
    }
    if (typeof targetField === 'string' && targetField.trim()) targetFields.add(targetField)
  }

  groups.forEach((group) => {
    if (group.sourceId.trim()) sourceIds.add(group.sourceId)
    group.mappings.forEach((mapping) =>
      collectMapping({
        sourceId: group.sourceId,
        sourceField: mapping.sourceField,
        targetField: mapping.targetField
      })
    )
  })

  configs.forEach((config) => {
    try {
      const parsed = JSON.parse(config.configJson) as unknown
      if (!isObject(parsed)) return
      const mappings = getObjectValue(parsed, 'mappings')
      if (Array.isArray(mappings)) {
        mappings.forEach((mapping) => {
          if (isObject(mapping)) collectMapping(mapping)
        })
      }
    } catch {
      // Invalid historical JSON is ignored only for input suggestions.
    }
  })

  connectionSourceIds.forEach((sourceId) => {
    if (sourceId.trim()) sourceIds.add(sourceId.trim())
  })

  Object.entries(connectionSourceFields).forEach(([sourceId, fields]) => {
    if (sourceId.trim()) sourceIds.add(sourceId.trim())
    fields.forEach((field) => {
      if (!field.trim()) return
      sourceFields.add(field.trim())
      collectSourceField(sourceId, field)
    })
  })

  return {
    sourceIds: [...sourceIds].sort(),
    sourceFields: [...sourceFields].sort(),
    targetFields: [...targetFields].sort(),
    sourceFieldsBySource: Object.fromEntries(
      [...sourceFieldsBySource.entries()].map(([sourceId, fields]) => [
        sourceId,
        [...fields].sort()
      ])
    )
  }
}

export const hasVisualInput = (groups: VisualMappingGroup[]) =>
  groups.some(
    (group) =>
      group.sourceId.trim() ||
      group.mappings.some(
        (mapping) =>
          mapping.sourceField.trim() ||
          mapping.targetField.trim() ||
          mapping.enumEntries.some((entry) => entry.sourceValue.trim() || entry.targetValue.trim())
      )
  )
