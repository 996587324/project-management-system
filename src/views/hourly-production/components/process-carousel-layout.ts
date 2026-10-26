/** Keep charts readable; additional configured processes become carousel pages, not page overflow. */
export function processPageSize(availableHeight: number, totalRows: number): number {
  const minimumRowHeight = 170
  const rowGap = 10
  const capacity = Math.max(1, Math.floor((availableHeight + rowGap) / (minimumRowHeight + rowGap)))
  return Math.max(1, Math.min(totalRows, capacity, 4))
}

export function clampProcessPage(page: number, totalRows: number, pageSize: number): number {
  const pageCount = Math.max(1, Math.ceil(totalRows / Math.max(1, pageSize)))
  return Math.max(0, Math.min(page, pageCount - 1))
}
