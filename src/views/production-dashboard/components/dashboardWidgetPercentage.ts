export interface DashboardPercentageItem {
  name: string
  value: number
  itemStyle?: { color?: string }
}

/**
 * Convert configured values into percentages and distribute rounding residue so the sum stays 100%.
 */
export const normalizeDashboardPercentages = <T extends DashboardPercentageItem>(
  items: T[],
  decimals = 1
) => {
  const precision = Math.min(2, Math.max(0, Math.round(decimals)))
  const factor = 10 ** precision
  const targetUnits = 100 * factor
  const values = items.map((item) => Math.max(0, Number(item.value) || 0))
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return items.map((item) => ({ ...item, value: 0 }))

  const scaledValues = values.map((value) => (value * targetUnits) / total)
  const resultUnits = scaledValues.map(Math.floor)
  let residue = targetUnits - resultUnits.reduce((sum, value) => sum + value, 0)
  const residueOrder = scaledValues
    .map((value, index) => ({ index, fraction: value - resultUnits[index] }))
    .sort((left, right) => right.fraction - left.fraction)

  for (let index = 0; residue > 0; index++, residue--)
    resultUnits[residueOrder[index % residueOrder.length].index]++

  return items.map((item, index) => ({ ...item, value: resultUnits[index] / factor }))
}
