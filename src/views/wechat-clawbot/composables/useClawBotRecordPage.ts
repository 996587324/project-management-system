import { onUnmounted, ref, shallowReactive } from 'vue'
import type { WeChatClawBotPage } from '@/api/wechat-clawbot'

/** 收发记录共用分页状态；业务表格及字段展示由各自 Tab 维护。 */
export function useClawBotRecordPage<T>(
  fetchPage: (params: { current: number; size: number }) => Promise<WeChatClawBotPage<T>>
) {
  const page = shallowReactive<WeChatClawBotPage<T>>({
    records: [],
    current: 1,
    size: 10,
    total: 0
  })
  const loading = ref(false)
  let requestGeneration = 0

  async function refresh() {
    const generation = ++requestGeneration
    loading.value = true
    try {
      const result = await fetchPage({ current: page.current, size: page.size })
      // 翻页时旧请求可能晚于新请求返回，不能覆盖用户当前选择的页。
      if (generation === requestGeneration) Object.assign(page, result)
    } finally {
      if (generation === requestGeneration) loading.value = false
    }
  }

  onUnmounted(() => {
    requestGeneration += 1
  })

  return { page, loading, refresh }
}
