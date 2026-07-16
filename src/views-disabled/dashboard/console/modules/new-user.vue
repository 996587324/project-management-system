<template>
  <div class="art-card p-5 h-128 overflow-hidden mb-5 max-sm:mb-4">
    <div class="art-card-header">
      <div class="title">
        <h4>{{ title }}</h4>
        <p>这个月增长<span class="text-success">{{ growthText }}</span></p>
      </div>
      <ElRadioGroup v-model="radio2">
        <ElRadioButton value="本月" label="本月"></ElRadioButton>
        <ElRadioButton value="上月" label="上月"></ElRadioButton>
        <ElRadioButton value="今年" label="今年"></ElRadioButton>
      </ElRadioGroup>
    </div>
    <ArtTable
      class="w-full"
      :data="tableData"
      style="width: 100%"
      size="large"
      :border="false"
      :stripe="false"
      :header-cell-style="{ background: 'transparent' }"
    >
      <template #default>
        <!-- <ElTableColumn label="图片" prop="avatar" width="150px">
          <template #default="scope">
            <div style="display: flex; align-items: center">
              <img class="size-9 rounded-lg" :src="scope.row.avatar" alt="avatar" />
              <span class="ml-2">{{ scope.row.username }}</span>
            </div>
          </template>
        </ElTableColumn> -->
        <ElTableColumn label="商品" prop="province" />
        <ElTableColumn label="销售数量" prop="outNum" />
        <ElTableColumn label="生产数量" prop="AllNum" />
        <!-- <ElTableColumn label="性别" prop="avatar">
          <template #default="scope">
            <div style="display: flex; align-items: center">
              <span style="margin-left: 10px">{{ scope.row.sex === 1 ? '男' : '女' }}</span>
            </div>
          </template>
        </ElTableColumn> -->
        <ElTableColumn label="进度" width="240">
          <template #default="scope">
            <ElProgress
              :percentage="scope.row.pro"
              :color="scope.row.color"
              :stroke-width="4"
              :aria-label="`${scope.row.province}的完成进度: ${scope.row.pro}%`"
            />
          </template>
        </ElTableColumn>
      </template>
    </ArtTable>
  </div>
</template>

<script setup lang="ts">
  import { fetchDashboardNewUser } from '@/api/dashboard'
  import avatar1 from '@/assets/images/avatar/avatar1.webp'
  import avatar2 from '@/assets/images/avatar/avatar2.webp'
  import avatar3 from '@/assets/images/avatar/avatar3.webp'
  import avatar4 from '@/assets/images/avatar/avatar4.webp'
  import avatar5 from '@/assets/images/avatar/avatar5.webp'
  import avatar6 from '@/assets/images/avatar/avatar6.webp'

  interface UserTableItem {
    id?: number | string
    province: string
    outNum: number
    AllNum: number
    percentage: number
    pro: number
    color: string
    avatar: string
  }

  const ANIMATION_DELAY = 100
  const props = withDefaults(
    defineProps<{
      refreshInterval?: number
    }>(),
    {
      refreshInterval: 30000
    }
  )

  const radio2 = ref('本月')
  const title = ref('新用户')
  const growthText = ref('0%')
  const loading = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  /**
   * 新用户表格数据
   * 包含用户基本信息和完成进度
   */
  const defaultTableData: UserTableItem[] = [
    {
      id: 1,
      province: '--',
      outNum: 0,
      AllNum: 0,
      percentage: 0,
      pro: 0,
      color: 'var(--art-primary)',
      avatar: avatar1
    },
    {
      id: 2,
      province: '--',
      outNum: 0,
      AllNum: 0,
      percentage: 0,
      pro: 0,
      color: 'var(--art-secondary)',
      avatar: avatar2
    },
    {
      id: 3,
      province: '--',
      outNum: 0,
      AllNum: 0,
      percentage: 0,
      pro: 0,
      color: 'var(--art-warning)',
      avatar: avatar3
    },
    {
      id: 4,
      province: '--',
      percentage: 0,
      outNum: 0,
      AllNum: 0,
      pro: 0,
      color: 'var(--art-info)',
      avatar: avatar4
    },
    {
      id: 5,
      province: '--',
      percentage: 0,
      outNum: 0,
      AllNum: 0,
      pro: 0,
      color: 'var(--art-error)',
      avatar: avatar5
    },
    {
      id: 6,
      province: '--',
      percentage: 0,
      outNum: 0,
      AllNum: 0,
      pro: 0,
      color: 'var(--art-success)',
      avatar: avatar6
    }
  ]
  const tableData = ref<UserTableItem[]>([...defaultTableData])

  const colors = [
    'var(--art-primary)',
    'var(--art-secondary)',
    'var(--art-warning)',
    'var(--art-info)',
    'var(--art-error)',
    'var(--art-success)'
  ]
  const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6]

  const toNumber = (value: unknown) => {
    const parsed = Number(String(value ?? '').replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  const formatGrowth = (value: unknown) => {
    if (value === undefined || value === null || value === '') return '0%'
    const text = String(value)
    if (text.includes('%')) return text
    const numeric = Number(text)
    if (!Number.isFinite(numeric)) return text
    return `${numeric > 0 ? '+' : ''}${numeric}%`
  }

  const readList = (response: Api.Dashboard.NewUserResponse): Api.Dashboard.NewUserItem[] => {
    if (Array.isArray(response)) return response
    return response.records || response.list || response.data || response.items || []
  }

  const normalizeItem = (item: Api.Dashboard.NewUserItem, index: number): UserTableItem => {
    const percentage = toNumber(item.percentage ?? item.pro)
    return {
      id: item.id ?? index,
      province: item.province || item.productName || item.name || '--',
      outNum: toNumber(item.outNum ?? item.salesNum ?? item.saleNum),
      AllNum: toNumber(item.AllNum ?? item.allNum ?? item.productionNum),
      percentage,
      pro: 0,
      color: item.color || colors[index % colors.length],
      avatar: item.avatar || avatars[index % avatars.length]
    }
  }

  const resetData = () => {
    title.value = '新用户'
    growthText.value = '0%'
    tableData.value = defaultTableData.map((item) => ({ ...item }))
  }

  /**
   * 添加进度条动画效果
   * 延迟后将进度值从 0 更新到目标百分比，触发动画
   */
  const addAnimation = (): void => {
    setTimeout(() => {
      tableData.value.forEach((item) => {
        item.pro = item.percentage
      })
    }, ANIMATION_DELAY)
  }

  const getData = async () => {
    if (loading.value) return
    try {
      loading.value = true
      const response = await fetchDashboardNewUser({ type: radio2.value })
      const list = readList(response)

      title.value = Array.isArray(response) ? '新用户' : response.title || '新用户'
      growthText.value = Array.isArray(response)
        ? '0%'
        : formatGrowth(response.growth ?? response.change)
      tableData.value = list.length
        ? list.map(normalizeItem)
        : defaultTableData.map((item) => ({ ...item }))
      addAnimation()
    } catch (error) {
      resetData()
      addAnimation()
      void error
    } finally {
      loading.value = false
    }
  }

  const stopPolling = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const startPolling = () => {
    stopPolling()
    if (props.refreshInterval > 0) {
      timer = setInterval(getData, props.refreshInterval)
    }
  }

  onMounted(() => {
    getData()
    startPolling()
  })

  watch(radio2, getData)

  onUnmounted(stopPolling)
</script>

<style lang="scss" scoped>
  .art-card {
    :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
      color: var(--el-color-primary) !important;
      background: transparent !important;
    }
  }
</style>
