export interface HourlyBoardSummary {
  code: string
  name: string
  published: boolean
}

type BoardListItem = Partial<HourlyBoardSummary> & {
  Code?: string
  Name?: string
  Published?: boolean
}

// 兼容尚未更新的后端：旧 /boards 接口使用 PascalCase，其余接口使用 camelCase。
export function normalizeHourlyBoards(rows: BoardListItem[]): HourlyBoardSummary[] {
  return rows
    .map((row) => ({
      code: row.code ?? row.Code ?? '',
      name: row.name ?? row.Name ?? row.code ?? row.Code ?? '',
      published: row.published ?? row.Published ?? false
    }))
    .filter((row) => row.code.length > 0)
}
