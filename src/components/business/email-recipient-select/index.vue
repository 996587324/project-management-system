<template>
  <ElSelect
    v-model="selected"
    multiple
    filterable
    remote
    reserve-keyword
    collapse-tags
    collapse-tags-tooltip
    :multiple-limit="100"
    :remote-method="search"
    :loading="loading"
    placeholder="搜索姓名、账号或邮箱，支持批量选择"
    style="width: 100%"
  >
    <ElOption
      v-for="user in options"
      :key="user.userId"
      :value="user.userId"
      :label="`${user.nickName || user.userName} (${user.email || '未维护邮箱'})`"
      :disabled="!user.available"
    />
    <template #footer>
      <div class="recipient-actions">
        <ElButton text :disabled="loading" @click.stop="selectLoaded">选择已加载用户</ElButton>
        <ElButton text :disabled="loading" @click.stop="selectFiltered">批量选择搜索结果</ElButton>
        <ElButton v-if="hasMore" text :disabled="loading" @click.stop="loadMore">加载更多</ElButton>
        <ElButton text @click.stop="selected = []">清空</ElButton>
      </div>
      <small>最多选择100人；未维护有效邮箱的用户不可选。</small>
    </template>
  </ElSelect>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { fetchEmailRecipients, type EmailRecipient } from '@/api/email-push'

  const selected = defineModel<string[]>({ required: true })
  const options = ref<EmailRecipient[]>([])
  const loading = ref(false)
  const hasMore = ref(false)
  const keyword = ref('')
  const page = ref(1)
  const pageSize = ref(30)
  let requestVersion = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  async function load(reset: boolean, requestedSize = 30) {
    const size = reset ? requestedSize : pageSize.value
    const version = ++requestVersion
    const requestedPage = reset ? 1 : page.value + 1
    loading.value = true
    try {
      const result = await fetchEmailRecipients({
        keyword: keyword.value,
        current: requestedPage,
        size
      })
      if (version !== requestVersion) return
      const retained = reset
        ? options.value.filter((item) => selected.value.includes(item.userId))
        : options.value
      options.value = [
        ...new Map([...retained, ...result.records].map((item) => [item.userId, item])).values()
      ]
      page.value = requestedPage
      pageSize.value = size
      hasMore.value = requestedPage * size < result.total
      return result.records
    } finally {
      if (version === requestVersion) loading.value = false
    }
  }

  function search(value: string) {
    keyword.value = value.trim()
    ++requestVersion
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void load(true).catch(() => {})
    }, 250)
  }

  function add(users: EmailRecipient[]) {
    const ids = [
      ...new Set([
        ...selected.value,
        ...users.filter((item) => item.available).map((item) => item.userId)
      ])
    ]
    selected.value = ids.slice(0, 100)
    if (ids.length > 100) ElMessage.warning('最多选择100人，请分批提交')
  }

  function selectLoaded() {
    add(options.value)
  }

  async function selectFiltered() {
    const rows = await load(true, 100)
    if (rows) add(rows)
    if (hasMore.value) ElMessage.info('已选择搜索结果前100条中的有效邮箱用户，更多用户请分批选择')
  }

  function loadMore() {
    return load(false)
  }

  onMounted(() => {
    void load(true).catch(() => {})
  })
  onBeforeUnmount(() => {
    ++requestVersion
    if (timer) clearTimeout(timer)
  })
</script>

<style scoped>
  .recipient-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
</style>
