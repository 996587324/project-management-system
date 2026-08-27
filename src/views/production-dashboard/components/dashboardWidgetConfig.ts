export interface DashboardWidgetDisplayConfig {
  columnSpan?: number
  rowSpan: number
  tableRowHeight: number
  autoScroll: boolean
  scrollIntervalSeconds: number
}

const DEFAULT_CONFIG: DashboardWidgetDisplayConfig = {
  rowSpan: 1,
  tableRowHeight: 40,
  autoScroll: true,
  scrollIntervalSeconds: 3
}

const clampInteger = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback
}

const parseRoot = (configJson: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(configJson || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** Read display settings without allowing malformed historical JSON to break the board. */
export const parseDashboardWidgetDisplayConfig = (
  configJson: string
): DashboardWidgetDisplayConfig => {
  const root = parseRoot(configJson)
  const layout =
    root.layout && typeof root.layout === 'object' && !Array.isArray(root.layout)
      ? (root.layout as Record<string, unknown>)
      : {}
  const columnSpan = Number(layout.columnSpan)

  return {
    columnSpan: Number.isFinite(columnSpan)
      ? clampInteger(columnSpan, 3, 12, 4)
      : DEFAULT_CONFIG.columnSpan,
    rowSpan: clampInteger(layout.rowSpan, 1, 3, DEFAULT_CONFIG.rowSpan),
    tableRowHeight: clampInteger(layout.tableRowHeight, 32, 72, DEFAULT_CONFIG.tableRowHeight),
    autoScroll:
      typeof layout.autoScroll === 'boolean' ? layout.autoScroll : DEFAULT_CONFIG.autoScroll,
    scrollIntervalSeconds: clampInteger(
      layout.scrollIntervalSeconds,
      1,
      30,
      DEFAULT_CONFIG.scrollIntervalSeconds
    )
  }
}

/** Merge display settings into ConfigJson while preserving other extension settings. */
export const mergeDashboardWidgetDisplayConfig = (
  configJson: string,
  displayConfig: DashboardWidgetDisplayConfig
) => {
  const root = parseRoot(configJson)
  root.layout = {
    columnSpan: displayConfig.columnSpan,
    rowSpan: displayConfig.rowSpan,
    tableRowHeight: displayConfig.tableRowHeight,
    autoScroll: displayConfig.autoScroll,
    scrollIntervalSeconds: displayConfig.scrollIntervalSeconds
  }
  return JSON.stringify(root)
}
