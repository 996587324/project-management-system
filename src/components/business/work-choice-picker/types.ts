export interface WorkChoice {
  value: string
  label: string
  description?: string
  groupLabel?: string
  disabled?: boolean
  reason?: string
}
export interface WorkChoiceQuery {
  keyword: string
  page: number
  size: number
  selectedId?: string
}
export interface WorkChoicePage {
  records: WorkChoice[]
  total: number
  selected?: WorkChoice | null
}
