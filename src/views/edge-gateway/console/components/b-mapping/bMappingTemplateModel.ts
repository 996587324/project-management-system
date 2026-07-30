export type JsonPathSegment = string | number
export type TemplateValueMode = 'source' | 'fixed'
export type TemplateParseMode = 'template' | 'mapping'

export interface TemplateLeaf {
  id: number
  segments: JsonPathSegment[]
  targetPath: string
  valueMode: TemplateValueMode
  sourcePath: string
  fixedValue: unknown
}

export interface ParsedMappingTemplate {
  root: Record<string, unknown> | unknown[]
  leaves: TemplateLeaf[]
  displayJson: string
}

const standardRoots = new Set([
  'messageid',
  'deviceid',
  'sourceid',
  'sourcedevicecode',
  'timestamp',
  'datatype',
  'values',
  'rawpayload',
  'schemaversion'
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isLiteralMarker = (value: unknown): value is { $literal: unknown } => {
  if (!isRecord(value)) return false
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0].toLowerCase() === '$literal'
}

const getLiteralValue = (value: { $literal: unknown }) =>
  Object.entries(value).find(([key]) => key.toLowerCase() === '$literal')?.[1]

const isSourcePath = (value: string) => {
  const root = value.split('.')[0]?.trim().toLowerCase()
  return Boolean(root && standardRoots.has(root))
}

const isDataField = (segments: JsonPathSegment[]) =>
  segments.some((segment) => typeof segment === 'string' && segment.toLowerCase() === 'data')

export const formatJsonPath = (segments: JsonPathSegment[]) => {
  let result = '$'
  segments.forEach((segment) => {
    if (typeof segment === 'number') {
      result += `[${segment}]`
      return
    }
    result += /^[A-Za-z_$][\w$]*$/.test(segment) ? `.${segment}` : `[${JSON.stringify(segment)}]`
  })
  return result
}

export const parseMappingTemplate = (
  content: string,
  mode: TemplateParseMode
): ParsedMappingTemplate => {
  const parsed = JSON.parse(content) as unknown
  if (!isRecord(parsed) && !Array.isArray(parsed)) {
    throw new Error('JSON 模板根节点必须是对象或数组')
  }

  const leaves: TemplateLeaf[] = []
  let sequence = 0

  const visit = (value: unknown, segments: JsonPathSegment[]): unknown => {
    if (isLiteralMarker(value)) {
      const fixedValue = getLiteralValue(value)
      leaves.push({
        id: (sequence += 1),
        segments,
        targetPath: formatJsonPath(segments),
        valueMode: 'fixed',
        sourcePath: '',
        fixedValue
      })
      return fixedValue
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => visit(item, [...segments, index]))
    }

    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, visit(child, [...segments, key])])
      )
    }

    const useAsSource =
      typeof value === 'string' &&
      (mode === 'mapping' || isSourcePath(value) || isDataField(segments))
    leaves.push({
      id: (sequence += 1),
      segments,
      targetPath: formatJsonPath(segments),
      valueMode: useAsSource ? 'source' : 'fixed',
      sourcePath: useAsSource && typeof value === 'string' && isSourcePath(value) ? value : '',
      fixedValue: useAsSource ? null : value
    })
    return value
  }

  const root = visit(parsed, []) as Record<string, unknown> | unknown[]
  return {
    root,
    leaves,
    displayJson: JSON.stringify(root, null, 2)
  }
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const setValueAtPath = (
  root: Record<string, unknown> | unknown[],
  segments: JsonPathSegment[],
  value: unknown
) => {
  if (!segments.length) return
  let current: any = root
  for (let index = 0; index < segments.length - 1; index += 1) {
    current = current[segments[index]]
  }
  current[segments[segments.length - 1]] = value
}

export const buildMappingJson = (
  root: Record<string, unknown> | unknown[],
  leaves: TemplateLeaf[]
) => {
  const result = cloneJson(root)
  leaves.forEach((leaf) => {
    const value =
      leaf.valueMode === 'source'
        ? leaf.sourcePath.trim()
        : {
            $literal: leaf.fixedValue
          }
    setValueAtPath(result, leaf.segments, value)
  })
  return JSON.stringify(result, null, 2)
}

export const formatFixedValue = (value: unknown) => {
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}
