import { recordUserOperation } from '@/api/user-activity'
import { $t } from '@/locales'
import { router } from '@/router'
import { useUserStore } from '@/store/modules/user'

const operationInterval = 800
const ignoredLabels = new Set(['取消', '关闭', '上一页', '下一页', '展开', '收起'])
const businessActionPattern =
  /新增|创建|保存|编辑|删除|导入|导出|提交|确认|启用|禁用|发送|重试|连接|断开|复制|刷新|查询|查看|生成|上传|下载|启动|停止|配置|认领|同步|发布|校验|绑定|解绑|清理|测试|恢复|应用|批量/
const recentOperations = new Map<string, number>()

function getButtonLabel(element: HTMLElement) {
  return (element.dataset.operationLabel || element.textContent || '').replace(/\s+/g, ' ').trim()
}

function isOperationButton(element: HTMLElement, label: string) {
  if (element.dataset.operationLog === 'ignore') return false
  if (element.closest('.el-pagination, .el-tabs, .el-dialog__headerbtn')) return false
  if (!label || ignoredLabels.has(label)) return false
  return element.dataset.operationLog === 'true' || businessActionPattern.test(label)
}

function canReport(key: string) {
  const now = Date.now()
  const previous = recentOperations.get(key) || 0
  recentOperations.set(key, now)
  return now - previous >= operationInterval
}

function getModuleName() {
  const route = router.currentRoute.value
  const title = route.meta.title
  if (typeof title === 'string' && title) return title.includes('.') ? $t(title) : title
  return route.name?.toString() || '未分类模块'
}

/**
 * 全局记录业务按钮点击。只跟踪明确标注或名称符合常见业务动作的按钮，避免搜索框、分页等产生噪声。
 * 页面可通过 data-operation-log="true" 强制记录，或通过 data-operation-log="ignore" 排除。
 */
export function setupUserOperationTracking() {
  document.addEventListener(
    'click',
    (event) => {
      const source = event.target as HTMLElement | null
      const button = source?.closest<HTMLElement>('button, [role="button"], [data-operation-log]')
      if (!button) return

      const label = getButtonLabel(button)
      if (!isOperationButton(button, label)) return

      const userStore = useUserStore()
      if (!userStore.isLogin || !userStore.accessToken) return

      const route = router.currentRoute.value
      const pagePath = route.fullPath
      const key = `${pagePath}:${label}`
      if (!canReport(key)) return

      const module = button.dataset.operationModule || getModuleName()

      void recordUserOperation({
        module,
        action: button.dataset.operationAction || `点击${label}`,
        pagePath,
        target: button.dataset.operationTarget,
        operationType: 'ButtonClick'
      }).catch(() => undefined)
    },
    true
  )
}
