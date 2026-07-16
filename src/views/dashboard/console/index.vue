<template>
  <div class="project-workbench">
    <div class="dashboard-card-list">
      <div v-for="card in statCards" :key="card.key" class="dashboard-card-item">
        <div class="art-card relative flex flex-col justify-center h-35 px-5">
          <span class="text-g-700 text-sm whitespace-nowrap">{{ card.label }}</span>
          <ArtCountTo class="text-[26px] font-medium mt-2" :target="card.value" :duration="1200" />
          <div class="flex-c mt-1">
            <span class="text-xs text-g-600 whitespace-nowrap">{{ card.caption }}</span>
            <span class="ml-1 text-xs font-semibold whitespace-nowrap" :class="card.className">
              {{ card.tip }}
            </span>
          </div>
          <div class="absolute top-0 bottom-0 right-5 m-auto size-12.5 rounded-xl flex-cc bg-theme/10">
            <ArtSvgIcon :icon="card.icon" class="text-xl text-theme" />
          </div>
        </div>
      </div>
    </div>

    <ElRow :gutter="20">
      <ElCol :sm="24" :md="12" :lg="10">
        <div class="art-card h-128 p-5 mb-5 max-sm:mb-4">
          <div class="art-card-header">
            <div class="title">
              <h4>项目状态分布</h4>
              <p>按运行、延期、完成、暂停统计</p>
            </div>
          </div>
          <div ref="statusChartRef" class="status-chart"></div>
        </div>
      </ElCol>

      <ElCol :sm="24" :md="12" :lg="14">
        <div class="art-card h-128 p-5 mb-5 max-sm:mb-4">
          <div class="art-card-header">
            <div class="title">
              <h4>整体项目进度</h4>
              <p>当前平均进度 <span class="text-theme">{{ averageProgressText }}</span></p>
            </div>
          </div>
          <div class="progress-overview">
            <ElProgress type="dashboard" :percentage="averageProgress" :width="190" />
            <div class="progress-copy">
              <span>平均完成度</span>
              <strong>{{ averageProgressText }}</strong>
              <p>待处理任务 {{ stats?.pendingTasks || 0 }} 个，已完成任务 {{ stats?.finishedTasks || 0 }} 个</p>
            </div>
          </div>
        </div>
      </ElCol>
    </ElRow>

    <ElRow :gutter="20">
      <ElCol :span="24">
        <div class="art-card h-128 p-5 mb-5 max-sm:mb-4">
          <div class="art-card-header">
            <div class="title">
              <h4>负责人项目状态分布</h4>
              <p>按负责人统计待启用、进行中、已完成项目数量</p>
            </div>
          </div>
          <div ref="managerProjectChartRef" class="manager-project-chart"></div>
        </div>
      </ElCol>
    </ElRow>

    <ElRow :gutter="20">
      <ElCol :span="24">
        <div class="art-card h-128 p-5 mb-5 max-sm:mb-4 recent-project-card">
          <div class="art-card-header">
            <div class="title">
              <h4>近期项目</h4>
              <p>最近创建或更新的项目动态</p>
            </div>
          </div>
          <ElTable class="recent-project-table" :data="stats?.recentProjects || []" height="calc(100% - 42px)">
            <ElTableColumn prop="projectName" label="项目名称" min-width="180" show-overflow-tooltip />
            <ElTableColumn prop="projectType" label="类型" width="110" show-overflow-tooltip />
            <ElTableColumn prop="contractCode" label="合同号" min-width="150" show-overflow-tooltip />
            <ElTableColumn prop="progress" label="进度" width="180">
              <template #default="{ row }">
                <ElProgress :percentage="Number(row.progress || 0)" :stroke-width="8" />
              </template>
            </ElTableColumn>
            <ElTableColumn prop="endTime" label="截止时间" width="160">
              <template #default="{ row }">{{ formatDate(row.endTime) }}</template>
            </ElTableColumn>
          </ElTable>
        </div>
      </ElCol>
    </ElRow>
  </div>
</template>

<script setup lang="ts">
  import * as echarts from 'echarts'
  import { fetchProjectDashboard } from '@/api/project-manage'
  import { useUserStore } from '@/store/modules/user'

  defineOptions({ name: 'Console' })

  const userStore = useUserStore()
  const stats = ref<Api.ProjectManage.DashboardStats>()
  const statusChartRef = ref<HTMLDivElement>()
  const managerProjectChartRef = ref<HTMLDivElement>()
  let statusChart: echarts.ECharts | undefined
  let managerProjectChart: echarts.ECharts | undefined

  const averageProgress = computed(() => Number(stats.value?.averageProgress || 0))
  const averageProgressText = computed(() => `${averageProgress.value.toFixed(2)}%`)
  const managerProjectStats = computed(() => stats.value?.managerProjectStatusStats || [])
  const projectStatusDistribution = computed(() => {
    const distribution = stats.value?.projectStatusDistribution?.length
      ? stats.value.projectStatusDistribution
      : [
          { label: '待启用', value: stats.value?.pendingProjects || 0, color: '#8b95a5' },
          { label: '进行中', value: stats.value?.runningProjects || 0, color: '#1677ff' },
          { label: '延期', value: stats.value?.delayedProjects || 0, color: '#ffb020' },
          { label: '暂停', value: stats.value?.pausedProjects || 0, color: '#f59e0b' },
          { label: '已完成', value: stats.value?.finishedProjects || 0, color: '#22c55e' },
          { label: '已归档', value: stats.value?.archivedProjects || 0, color: '#94a3b8' }
        ]

    return distribution.map((item) => ({
      ...item,
      name: item.label,
      value: Number(item.value || 0)
    }))
  })

  const statCards = computed(() => [
    {
      key: 'total',
      label: '项目总数',
      value: stats.value?.totalProjects || 0,
      caption: '全部项目',
      tip: `${stats.value?.runningProjects || 0} 个进行中`,
      icon: 'ri:folder-chart-line',
      className: 'text-theme'
    },
    {
      key: 'running',
      label: '进行中',
      value: stats.value?.runningProjects || 0,
      caption: '正在推进',
      tip: `${averageProgressText.value} 平均进度`,
      icon: 'ri:play-circle-line',
      className: 'text-success'
    },
    {
      key: 'delayed',
      label: '延期项目',
      value: stats.value?.delayedProjects || 0,
      caption: '需要关注',
      tip: `${stats.value?.pendingTasks || 0} 个延期`,
      icon: 'ri:alarm-warning-line',
      className: 'text-danger'
    },
    {
      key: 'finished',
      label: '已完成',
      value: stats.value?.finishedProjects || 0,
      caption: '交付完成',
      tip: `${stats.value?.finishedProjects || 0} 个任务完成`,
      icon: 'ri:checkbox-circle-line',
      className: 'text-success'
    }
  ])

  const renderStatusChart = () => {
    if (!statusChartRef.value || !stats.value) return

    statusChart ||= echarts.init(statusChartRef.value)
    statusChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      color: projectStatusDistribution.value.map((item) => item.color || '#1677ff'),
      series: [
        {
          type: 'pie',
          radius: ['48%', '70%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          label: {
            show: true,
            formatter: '{b}\n{c} 个',
            color: '#4b5563',
            lineHeight: 18
          },
          labelLine: {
            show: true,
            length: 12,
            length2: 8
          },
          data: projectStatusDistribution.value
        }
      ]
    }, true)
  }

  const renderManagerProjectChart = () => {
    if (!managerProjectChartRef.value || !stats.value) return

    const data = managerProjectStats.value
    managerProjectChart ||= echarts.init(managerProjectChartRef.value)
    managerProjectChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0 },
      grid: { top: 54, left: 24, right: 24, bottom: data.length > 8 ? 70 : 32, containLabel: true },
      color: ['#8b95a5', '#1677ff', '#22c55e'],
      xAxis: {
        type: 'category',
        data: data.map((item) => item.managerName),
        axisLabel: { interval: 0, rotate: data.length > 6 ? 30 : 0 }
      },
      yAxis: {
        type: 'value',
        minInterval: 1
      },
      dataZoom:
        data.length > 8
          ? [
              { type: 'inside', start: 0, end: Math.min(100, Math.round((8 / data.length) * 100)) },
              { type: 'slider', height: 18, bottom: 16 }
            ]
          : [],
      series: [
        {
          name: '待启用',
          type: 'bar',
          barMaxWidth: 28,
          data: data.map((item) => item.pendingProjects)
        },
        {
          name: '进行中',
          type: 'bar',
          barMaxWidth: 28,
          data: data.map((item) => item.runningProjects)
        },
        {
          name: '已完成',
          type: 'bar',
          barMaxWidth: 28,
          data: data.map((item) => item.finishedProjects)
        }
      ]
    }, true)
  }

  const formatDate = (value?: string) => {
    if (!value) return '-'
    return value.length > 10 ? value.slice(0, 10) : value
  }

  const loadData = async () => {
    stats.value = await fetchProjectDashboard({ userId: userStore.info?.userId })
    await nextTick()
    renderStatusChart()
    renderManagerProjectChart()
  }

  const handleResize = () => {
    statusChart?.resize()
    managerProjectChart?.resize()
  }

  onMounted(() => {
    loadData()
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    statusChart?.dispose()
    managerProjectChart?.dispose()
  })
</script>

<style lang="scss" scoped>
  .project-workbench {
    .dashboard-card-list {
      display: flex;
      flex-wrap: nowrap;
      gap: 20px;
      width: 100%;
      margin-bottom: 20px;
      overflow-x: auto;
    }

    .dashboard-card-item {
      flex: 1 0 0;
      min-width: 220px;
    }

    .status-chart {
      height: calc(100% - 42px);
      min-height: 390px;
    }

    .manager-project-chart {
      height: calc(100% - 42px);
      min-height: 390px;
    }

    .progress-overview {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 42px;
      height: calc(100% - 42px);
      min-height: 390px;
    }

    .progress-copy {
      max-width: 280px;

      span {
        color: var(--el-text-color-secondary);
      }

      strong {
        display: block;
        margin: 10px 0 12px;
        font-size: 34px;
        line-height: 1;
        color: var(--el-text-color-primary);
      }

      p {
        margin: 0;
        color: var(--el-text-color-secondary);
      }
    }

    .recent-project-card {
      display: flex;
      flex-direction: column;
    }

    .recent-project-table {
      flex: 1;
    }
  }

  @media (max-width: 768px) {
    .project-workbench {
      .progress-overview {
        flex-direction: column;
        gap: 20px;
        min-height: 390px;
        text-align: center;
      }
    }
  }
</style>
