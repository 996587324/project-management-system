export type RuleTemplate = {
  key: string
  label: string
  ruleType: string
  description: string
  json: Record<string, unknown>
}

export const ruleTypes = [
  { value: 'Filter', label: '条件过滤' },
  { value: 'Range', label: '范围过滤' },
  { value: 'Threshold', label: '变化阈值' },
  { value: 'Deduplicate', label: '重复消息过滤' },
  { value: 'Aggregate', label: '时间窗口聚合' }
]

export const ruleTypeText = (ruleType: string) =>
  ruleTypes.find((item) => item.value === ruleType)?.label || ruleType

export const ruleTemplates: RuleTemplate[] = [
  {
    key: 'filter-number-greaterthan',
    label: '条件过滤：数值大于',
    ruleType: 'Filter',
    description: '当目标字段的数值大于比较值时丢弃消息。',
    json: {
      field: 'temperature',
      operator: 'GreaterThan',
      compareValue: 85,
      action: 'Drop'
    }
  },
  {
    key: 'filter-number-greaterthanorequal',
    label: '条件过滤：数值大于或等于',
    ruleType: 'Filter',
    description: '当目标字段的数值大于或等于比较值时丢弃消息。',
    json: {
      field: 'temperature',
      operator: 'GreaterThanOrEqual',
      compareValue: 85,
      action: 'Drop'
    }
  },
  {
    key: 'filter-number-lessthan',
    label: '条件过滤：数值小于',
    ruleType: 'Filter',
    description: '当目标字段的数值小于比较值时丢弃消息。',
    json: {
      field: 'temperature',
      operator: 'LessThan',
      compareValue: 0,
      action: 'Drop'
    }
  },
  {
    key: 'filter-number-lessthanorequal',
    label: '条件过滤：数值小于或等于',
    ruleType: 'Filter',
    description: '当目标字段的数值小于或等于比较值时丢弃消息。',
    json: {
      field: 'temperature',
      operator: 'LessThanOrEqual',
      compareValue: 0,
      action: 'Drop'
    }
  },
  {
    key: 'filter-number-equal',
    label: '条件过滤：数值等于',
    ruleType: 'Filter',
    description: '当目标字段的数值等于比较值时丢弃消息。',
    json: {
      field: 'temperature',
      operator: 'Equal',
      compareValue: 0,
      action: 'Drop'
    }
  },
  {
    key: 'filter-number-notequal',
    label: '条件过滤：数值不等于',
    ruleType: 'Filter',
    description: '当目标字段的数值不等于比较值时丢弃消息。',
    json: {
      field: 'temperature',
      operator: 'NotEqual',
      compareValue: 0,
      action: 'Drop'
    }
  },
  {
    key: 'filter-text-equal',
    label: '条件过滤：文本等于',
    ruleType: 'Filter',
    description: '当目标字段的文本等于比较内容时丢弃消息，比较时忽略大小写。',
    json: {
      field: 'status',
      operator: 'Equal',
      compareText: 'FAULT',
      action: 'Drop'
    }
  },
  {
    key: 'filter-text-notequal',
    label: '条件过滤：文本不等于',
    ruleType: 'Filter',
    description: '当目标字段的文本不等于比较内容时丢弃消息，比较时忽略大小写。',
    json: {
      field: 'status',
      operator: 'NotEqual',
      compareText: 'NORMAL',
      action: 'Drop'
    }
  },
  {
    key: 'filter-text-contains',
    label: '条件过滤：文本包含',
    ruleType: 'Filter',
    description: '当目标字段的文本包含指定内容时丢弃消息，比较时忽略大小写。',
    json: {
      field: 'status',
      operator: 'Contains',
      compareText: 'FAULT',
      action: 'Drop'
    }
  },
  {
    key: 'range',
    label: '范围过滤：超出上下限',
    ruleType: 'Range',
    description: '当目标字段的数值低于最小值或高于最大值时丢弃消息。',
    json: {
      field: 'pressure',
      min: 90,
      max: 120,
      action: 'Drop'
    }
  },
  {
    key: 'threshold',
    label: '变化阈值：抑制小幅变化',
    ruleType: 'Threshold',
    description: '当目标字段与上一次数据的差值小于阈值时丢弃消息。',
    json: {
      field: 'temperature',
      threshold: 0.5,
      action: 'Drop'
    }
  },
  {
    key: 'deduplicate',
    label: '重复消息过滤',
    ruleType: 'Deduplicate',
    description: '在指定秒数内收到完全相同的映射后数据时丢弃重复消息。',
    json: {
      windowSeconds: 10,
      action: 'Drop'
    }
  },
  {
    key: 'aggregate-avg',
    label: '时间窗口聚合：平均值',
    ruleType: 'Aggregate',
    description: '在时间窗口内汇总目标字段，并输出平均值。',
    json: {
      field: 'flow',
      operator: 'Avg',
      windowSeconds: 60,
      action: 'Drop'
    }
  },
  {
    key: 'aggregate-sum',
    label: '时间窗口聚合：求和',
    ruleType: 'Aggregate',
    description: '在时间窗口内汇总目标字段，并输出合计值。',
    json: {
      field: 'flow',
      operator: 'Sum',
      windowSeconds: 60,
      action: 'Drop'
    }
  },
  {
    key: 'aggregate-min',
    label: '时间窗口聚合：最小值',
    ruleType: 'Aggregate',
    description: '在时间窗口内汇总目标字段，并输出最小值。',
    json: {
      field: 'flow',
      operator: 'Min',
      windowSeconds: 60,
      action: 'Drop'
    }
  },
  {
    key: 'aggregate-max',
    label: '时间窗口聚合：最大值',
    ruleType: 'Aggregate',
    description: '在时间窗口内汇总目标字段，并输出最大值。',
    json: {
      field: 'flow',
      operator: 'Max',
      windowSeconds: 60,
      action: 'Drop'
    }
  },
  {
    key: 'aggregate-count',
    label: '时间窗口聚合：计数',
    ruleType: 'Aggregate',
    description: '在时间窗口内统计目标字段收到的数据条数。',
    json: {
      field: 'flow',
      operator: 'Count',
      windowSeconds: 60,
      action: 'Drop'
    }
  }
]
