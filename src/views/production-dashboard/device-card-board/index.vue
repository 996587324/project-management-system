<template>
  <main class="device-card-board" v-loading="loading">
    <header class="device-card-board__header">
      <div>
        <p>DEVICE STATUS BOARD</p>
        <h1>设备卡片看板</h1>
        <span>
          实时数据每 5 秒刷新一次 ·
          {{
            runtime?.generatedAt ? `最近刷新 ${formatTime(runtime.generatedAt)}` : '等待实时数据'
          }}
        </span>
      </div>
      <div class="device-card-board__actions">
        <el-select
          v-model="lineCode"
          clearable
          filterable
          :filter-method="filterLines"
          placeholder="搜索线体名称、编码或区域"
        >
          <el-option label="全部线体" value="" />
          <el-option
            v-for="line in filteredLines"
            :key="line.lineCode"
            :label="`${line.lineName} ${line.lineCode} ${line.area}`"
            :value="line.lineCode"
          >
            <div class="device-card-board__line-option">
              <strong>{{ line.lineName }}</strong>
              <span>{{ line.lineCode }}</span>
              <small v-if="line.area">{{ line.area }}</small>
            </div>
          </el-option>
        </el-select>
        <el-button @click="refresh">刷新</el-button>
        <el-button
          type="primary"
          @click="router.push({ name: 'ProductionDashboardDeviceCardConfig' })"
        >
          卡片配置
        </el-button>
        <el-button @click="openAgent">卡片 Agent</el-button>
      </div>
    </header>

    <section
      v-if="aiInsight && lineCode"
      :class="['device-card-board__ai-insight', `is-${aiInsight.level.toLowerCase()}`]"
    >
      <span class="device-card-board__ai-label">AI 运行建议</span>
      <div class="device-card-board__ai-marquee" :title="aiInsight.content">
        <span>{{ aiInsight.content }}</span>
      </div>
      <button type="button" @click="openAgent">查看分析</button>
    </section>

    <section class="device-card-board__overview">
      <button
        v-for="item in overviewItems"
        :key="item.key"
        type="button"
        :class="[
          'overview-card',
          `overview-card--${item.key}`,
          { 'is-active': activeOverviewKey === item.filter }
        ]"
        @click="selectOverviewFilter(item.filter)"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.tip }}</small>
      </button>
    </section>

    <section class="device-card-board__filters">
      <span>设备卡片</span>
      <el-tag v-if="statusFilter" closable @close="statusFilter = ''">
        {{ statusFilterLabel }}
      </el-tag>
      <em>{{ filteredCards.length }} / {{ runtime?.cards.length || 0 }} 台</em>
    </section>
    <section
      class="device-card-board__grid"
      :style="{ '--card-columns': runtime?.columnCount || 4 }"
    >
      <article
        v-for="card in filteredCards"
        :key="card.cardId"
        :class="['device-card', `device-card--${statusKind(card.status)}`]"
        @click="openDetail(card)"
      >
        <header>
          <div>
            <h2>{{ card.cardName }}</h2>
            <span>{{ card.deviceMark }}</span>
          </div>
          <el-tag :type="tagType(card.status)" effect="dark">{{ statusLabel(card.status) }}</el-tag>
        </header>
        <div class="device-card__primary">
          <template v-if="primaryField(card)">
            <strong>{{ displayValue(primaryField(card)?.displayValue) }}</strong>
            <small>{{ primaryField(card)?.unit }}</small>
            <span>{{ primaryField(card)?.displayName }}</span>
          </template>
          <template v-else>
            <strong>{{ card.dataOnline ? '在线' : '离线' }}</strong>
            <span>设备连接状态</span>
          </template>
        </div>
        <div v-if="tagFields(card).length" class="device-card__tags">
          <el-tag v-for="field in tagFields(card)" :key="field.fieldCode" effect="plain">
            {{ field.displayName }}：{{ displayValue(field.displayValue)
            }}{{ field.unit ? ` ${field.unit}` : '' }}
          </el-tag>
        </div>
        <dl>
          <template v-for="field in detailFields(card)" :key="field.fieldCode">
            <dt>{{ field.displayName }}</dt>
            <dd>
              {{ displayValue(field.displayValue) }}
              <small v-if="field.unit">{{ field.unit }}</small>
            </dd>
          </template>
        </dl>
        <footer>
          <span>
            <i :class="{ 'is-offline': !card.dataOnline }" />
            {{ card.dataOnline ? '实时数据在线' : '实时数据已超时' }}
          </span>
          <time>{{ card.receiveTime ? formatTime(card.receiveTime) : '暂无接收记录' }}</time>
        </footer>
      </article>
      <el-empty
        v-if="!filteredCards.length"
        description="没有符合条件的设备卡片，请在卡片配置中新增或调整筛选条件。"
      />
    </section>

    <el-drawer
      v-model="detailOpen"
      :title="selectedCard ? `${selectedCard.cardName} · 设备详情` : '设备详情'"
      size="min(720px, 96vw)"
    >
      <template v-if="selectedCard">
        <section class="device-card-board__detail-status">
          <el-tag :type="tagType(selectedCard.status)" size="large">
            {{ statusLabel(selectedCard.status) }}
          </el-tag>
          <span>数据源：{{ selectedCard.deviceMark }}</span>
          <span>
            最后接收：{{ selectedCard.receiveTime ? formatTime(selectedCard.receiveTime) : '—' }}
          </span>
        </section>
        <el-descriptions :column="2" border>
          <el-descriptions-item
            v-for="field in selectedCard.fields"
            :key="field.fieldCode"
            :label="field.displayName"
          >
            {{ displayValue(field.displayValue) }}{{ field.unit ? ` ${field.unit}` : '' }}
          </el-descriptions-item>
        </el-descriptions>
        <section class="device-card-board__trace">
          <div>
            <h3>字段变更追溯</h3>
            <span>仅显示配置为追溯的字段变化</span>
          </div>
          <el-table
            :data="changeRecords.records"
            v-loading="traceLoading"
            max-height="330"
            empty-text="暂无字段变更记录"
          >
            <el-table-column prop="displayName" label="字段" width="120" />
            <el-table-column label="变更前" min-width="130">
              <template #default="{ row }">{{ jsonValue(row.oldValueJson) }}</template>
            </el-table-column>
            <el-table-column label="变更后" min-width="130">
              <template #default="{ row }">{{ jsonValue(row.newValueJson) }}</template>
            </el-table-column>
            <el-table-column label="数据时间" min-width="170">
              <template #default="{ row }">{{ formatTime(row.dataTime) }}</template>
            </el-table-column>
          </el-table>
        </section>
      </template>
    </el-drawer>
  </main>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import type {
    DashboardDeviceCardBoardRuntime,
    DashboardDeviceCardChangeRecord,
    DashboardDeviceCardRuntime,
    DashboardAiInsight,
    DashboardLineConfig
  } from '@/api/edge-dashboard'
  import {
    fetchDashboardBootstrap,
    fetchDashboardAiInsight,
    fetchDashboardDeviceCardChangeRecords,
    fetchDashboardDeviceCardRuntime
  } from '@/api/edge-dashboard'

  const router = useRouter()
  const loading = ref(false)
  const traceLoading = ref(false)
  const lines = ref<DashboardLineConfig[]>([])
  const lineCode = ref<string>()
  const lineSearchKeyword = ref('')
  const runtime = ref<DashboardDeviceCardBoardRuntime>()
  const aiInsight = ref<DashboardAiInsight | null>(null)
  const statusFilter = ref('')
  const selectedCard = ref<DashboardDeviceCardRuntime>()
  const detailOpen = ref(false)
  const changeRecords = ref<{ records: DashboardDeviceCardChangeRecord[] }>({ records: [] })
  const filteredLines = computed(() => {
    const keyword = lineSearchKeyword.value.trim().toLocaleLowerCase()
    if (!keyword) return lines.value
    return lines.value.filter((line) =>
      [line.lineName, line.lineCode, line.area]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(keyword))
    )
  })
  const filterLines = (keyword: string) => {
    lineSearchKeyword.value = keyword
  }
  const statusKind = (status: string) =>
    status.toLowerCase() === 'fault'
      ? 'fault'
      : ['alarm', 'warning'].includes(status.toLowerCase())
        ? 'alarm'
        : status.toLowerCase() === 'offline'
          ? 'offline'
          : 'online'
  const statusLabel = (status: string) =>
    ({ ONLINE: '在线', OFFLINE: '离线', FAULT: '故障', ALARM: '告警', WARNING: '告警' })[
      status.toUpperCase()
    ] || status
  const tagType = (status: string) =>
    ({ fault: 'danger', alarm: 'warning', offline: 'info', online: 'success' })[
      statusKind(status)
    ] as 'success' | 'warning' | 'danger' | 'info'
  const overviewItems = computed(() => {
    const data = runtime.value?.overview
    return [
      {
        key: 'all',
        label: '设备总数',
        value: data?.totalCount || 0,
        tip: '已启用卡片',
        filter: 'all'
      },
      {
        key: 'online',
        label: '在线设备',
        value: data?.onlineCount || 0,
        tip: '实时数据正常',
        filter: 'online'
      },
      {
        key: 'offline',
        label: '离线设备',
        value: data?.offlineCount || 0,
        tip: '数据接收超时',
        filter: 'offline'
      },
      {
        key: 'fault',
        label: '故障设备',
        value: data?.faultCount || 0,
        tip: '状态映射为故障',
        filter: 'fault'
      },
      {
        key: 'alarm',
        label: '告警设备',
        value: data?.alarmCount || 0,
        tip: '状态映射为告警',
        filter: 'alarm'
      },
      {
        key: 'changes',
        label: '今日变更',
        value: data?.todayChangeCount || 0,
        tip: `${data?.todayChangedDeviceCount || 0} 台设备`,
        filter: 'changes'
      }
    ]
  })
  const activeOverviewKey = computed(() => statusFilter.value || 'all')
  const filteredCards = computed(() => {
    const cards = runtime.value?.cards || []
    switch (statusFilter.value) {
      case 'online':
        return cards.filter((card) => card.dataOnline)
      case 'offline':
        return cards.filter((card) => !card.dataOnline)
      case 'fault':
      case 'alarm':
        return cards.filter((card) => statusKind(card.status) === statusFilter.value)
      case 'changes':
        return cards.filter((card) => card.todayChangeCount > 0)
      default:
        return cards
    }
  })
  const statusFilterLabel = computed(
    () =>
      ({
        online: '在线设备',
        offline: '离线设备',
        fault: '故障设备',
        alarm: '告警设备',
        changes: '今日有变更的设备'
      })[statusFilter.value] || ''
  )
  const selectOverviewFilter = (filter: string) => {
    statusFilter.value = filter === 'all' || statusFilter.value === filter ? '' : filter
  }
  const primaryField = (card: DashboardDeviceCardRuntime) =>
    card.fields.find((field) => field.displayMode === 'Primary')
  const tagFields = (card: DashboardDeviceCardRuntime) =>
    card.fields.filter((field) => field.displayMode === 'Tag')
  const detailFields = (card: DashboardDeviceCardRuntime) =>
    card.fields.filter((field) => field.displayMode === 'Detail')
  const displayValue = (value: unknown) =>
    value === null || value === undefined || value === ''
      ? '—'
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value)
  const jsonValue = (value?: string) => {
    if (!value) return '—'
    try {
      return displayValue(JSON.parse(value))
    } catch {
      return value
    }
  }
  const formatTime = (value: string) =>
    value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
  const refresh = async () => {
    loading.value = true
    try {
      runtime.value = await fetchDashboardDeviceCardRuntime(lineCode.value)
    } finally {
      loading.value = false
    }
  }
  const openAgent = () => {
    router.push({
      name: 'AgentAssistant',
      query: {
        mode: 'work',
        domain: 'production-dashboard',
        dashboard: 'device-card-dashboard',
        lineCode: lineCode.value || ''
      }
    })
  }
  const loadAiInsight = async () => {
    if (!lineCode.value) {
      aiInsight.value = null
      return
    }
    try {
      aiInsight.value = await fetchDashboardAiInsight('device-card-dashboard', lineCode.value)
    } catch {
      aiInsight.value = null
    }
  }
  const openDetail = async (card: DashboardDeviceCardRuntime) => {
    selectedCard.value = card
    detailOpen.value = true
    traceLoading.value = true
    try {
      changeRecords.value = await fetchDashboardDeviceCardChangeRecords({
        current: 1,
        size: 100,
        cardId: card.cardId
      })
    } finally {
      traceLoading.value = false
    }
  }
  const load = async () => {
    loading.value = true
    try {
      const bootstrap = await fetchDashboardBootstrap('production-dashboard')
      lines.value = bootstrap.lines.filter((line) => line.enabled)
      // AI 建议必须与一条明确线体对应；首次进入时默认选中首条启用线体，用户仍可手动切换为全部线体。
      if (!lineCode.value && lines.value.length) lineCode.value = lines.value[0].lineCode
      await refresh()
      await loadAiInsight()
    } finally {
      loading.value = false
    }
  }
  const refreshTimer = window.setInterval(refresh, 5000)
  const aiInsightTimer = window.setInterval(loadAiInsight, 30000)
  onBeforeUnmount(() => {
    window.clearInterval(refreshTimer)
    window.clearInterval(aiInsightTimer)
  })
  watch(lineCode, () => {
    statusFilter.value = ''
    refresh()
    loadAiInsight()
  })
  load()
</script>

<style scoped lang="scss">
  .device-card-board {
    min-height: 100%;
    padding: 24px;
    color: var(--el-text-color-primary);
    background: var(--el-bg-color-page);
  }

  .device-card-board__header,
  .device-card-board__actions,
  .device-card-board__overview,
  .device-card-board__filters,
  .device-card-board__detail-status,
  .device-card-board__trace > div {
    display: flex;
    align-items: center;
  }

  .device-card-board__header {
    gap: 18px;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .device-card-board__header p {
    margin: 0;
    font-size: 12px;
    font-weight: 800;
    color: var(--el-color-primary);
    letter-spacing: 0.14em;
  }

  .device-card-board__header h1 {
    margin: 5px 0;
    font-size: 26px;
  }

  .device-card-board__header span {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .device-card-board__actions {
    gap: 10px;
  }

  .device-card-board__actions .el-select {
    width: 280px;
  }

  .device-card-board__line-option {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) auto;
    gap: 2px 12px;
    align-items: center;
    min-width: 250px;
    line-height: 1.3;
  }

  .device-card-board__line-option strong {
    overflow: hidden;
    font-size: 13px;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-card-board__line-option span {
    font-family: monospace;
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .device-card-board__line-option small {
    grid-column: 1 / -1;
    overflow: hidden;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-card-board__overview {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 14px;
  }

  .device-card-board__ai-insight {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    min-height: 48px;
    padding: 0 14px;
    margin-bottom: 16px;
    overflow: hidden;
    color: var(--el-text-color-secondary);
    background: linear-gradient(
      90deg,
      var(--el-color-primary-light-9),
      var(--el-bg-color) 55%,
      var(--el-color-primary-light-9)
    );
    border: 1px solid var(--el-color-primary-light-5);
    border-radius: var(--business-radius);
  }

  .device-card-board__ai-insight.is-warning {
    background: linear-gradient(
      90deg,
      var(--el-color-warning-light-9),
      var(--el-bg-color) 55%,
      var(--el-color-warning-light-9)
    );
    border-color: var(--el-color-warning-light-5);
  }

  .device-card-board__ai-insight.is-critical {
    background: linear-gradient(
      90deg,
      var(--el-color-danger-light-9),
      var(--el-bg-color) 55%,
      var(--el-color-danger-light-9)
    );
    border-color: var(--el-color-danger-light-5);
  }

  .device-card-board__ai-label {
    padding: 4px 8px;
    font-size: 12px;
    font-weight: 800;
    color: var(--el-color-primary);
    white-space: nowrap;
    background: var(--el-color-primary-light-8);
    border-radius: 99px;
  }

  .device-card-board__ai-insight.is-warning .device-card-board__ai-label {
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-8);
  }

  .device-card-board__ai-insight.is-critical .device-card-board__ai-label {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-8);
  }

  .device-card-board__ai-marquee {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .device-card-board__ai-marquee span {
    display: inline-block;
    min-width: 100%;
    padding-left: 100%;
    font-size: 15px;
    font-weight: 650;
    line-height: 46px;
    animation: device-card-ai-marquee 18s linear infinite;
  }

  .device-card-board__ai-insight button {
    padding: 0;
    font-size: 12px;
    color: var(--el-color-primary);
    white-space: nowrap;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  @keyframes device-card-ai-marquee {
    from {
      transform: translateX(0);
    }

    to {
      transform: translateX(-100%);
    }
  }

  .overview-card {
    min-height: 118px;
    padding: 16px;
    text-align: left;
    cursor: pointer;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--business-radius);
    box-shadow: var(--business-card-shadow);
    transition: 0.2s;
  }

  .overview-card:hover,
  .overview-card.is-active {
    border-color: var(--el-color-primary);
    box-shadow: var(--business-card-shadow);
    transform: translateY(-2px);
  }

  .overview-card span,
  .overview-card small {
    display: block;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .overview-card strong {
    display: block;
    margin: 8px 0 6px;
    font-size: 30px;
  }

  .overview-card--online strong {
    color: var(--el-color-success);
  }

  .overview-card--offline strong {
    color: var(--el-text-color-secondary);
  }

  .overview-card--fault strong {
    color: var(--el-color-danger);
  }

  .overview-card--alarm strong {
    color: var(--el-color-warning);
  }

  .overview-card--changes strong {
    color: var(--el-color-primary);
  }

  .device-card-board__filters {
    gap: 10px;
    justify-content: flex-start;
    margin: 22px 0 12px;
  }

  .device-card-board__filters span {
    font-size: 17px;
    font-weight: 700;
  }

  .device-card-board__filters em {
    font-size: 13px;
    font-style: normal;
    color: var(--el-text-color-secondary);
  }

  .device-card-board__grid {
    display: grid;
    grid-template-columns: repeat(var(--card-columns), minmax(220px, 1fr));
    gap: 16px;
  }

  .device-card {
    min-height: 250px;
    padding: 18px;
    cursor: pointer;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-top: 4px solid var(--el-color-success);
    border-radius: var(--business-radius);
    box-shadow: var(--business-card-shadow);
    transition: 0.2s;
  }

  .device-card:hover {
    box-shadow: var(--business-card-shadow);
    transform: translateY(-3px);
  }

  .device-card--offline {
    border-top-color: var(--el-text-color-placeholder);
  }

  .device-card--fault {
    border-top-color: var(--el-color-danger);
  }

  .device-card--alarm {
    border-top-color: var(--el-color-warning);
  }

  .device-card header {
    display: flex;
    gap: 10px;
    justify-content: space-between;
  }

  .device-card h2 {
    max-width: 160px;
    margin: 0;
    overflow: hidden;
    font-size: 17px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-card header span {
    display: block;
    margin-top: 5px;
    font-family: monospace;
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .device-card__primary {
    min-height: 82px;
    margin: 16px 0 12px;
  }

  .device-card__primary strong {
    font-size: 31px;
    line-height: 1;
    color: var(--el-text-color-primary);
  }

  .device-card__primary small {
    margin-left: 5px;
    color: var(--el-text-color-secondary);
  }

  .device-card__primary span {
    display: block;
    margin-top: 7px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .device-card__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 28px;
  }

  .device-card dl {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    margin: 12px 0;
  }

  .device-card dt,
  .device-card dd {
    margin: 0;
    font-size: 13px;
  }

  .device-card dt {
    overflow: hidden;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-card dd {
    max-width: 160px;
    overflow: hidden;
    color: var(--el-text-color-regular);
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-card dd small {
    color: var(--el-text-color-secondary);
  }

  .device-card footer {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    padding-top: 11px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .device-card footer i {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 5px;
    background: var(--el-color-success);
    border-radius: 50%;
  }

  .device-card footer i.is-offline {
    background: var(--el-text-color-placeholder);
  }

  .device-card footer time {
    white-space: nowrap;
  }

  .device-card-board__detail-status {
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 18px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .device-card-board__trace {
    margin-top: 24px;
  }

  .device-card-board__trace > div {
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .device-card-board__trace h3 {
    margin: 0;
  }

  .device-card-board__trace span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  @media (width <= 1300px) {
    .device-card-board__overview {
      grid-template-columns: repeat(3, 1fr);
    }

    .device-card-board__grid {
      grid-template-columns: repeat(min(3, var(--card-columns)), minmax(220px, 1fr));
    }
  }

  @media (width <= 760px) {
    .device-card-board {
      padding: 14px;
    }

    .device-card-board__header {
      flex-direction: column;
      align-items: flex-start;
    }

    .device-card-board__actions {
      flex-wrap: wrap;
      width: 100%;
    }

    .device-card-board__actions .el-select {
      width: 100%;
    }

    .device-card-board__overview {
      grid-template-columns: repeat(2, 1fr);
      gap: 9px;
    }

    .overview-card {
      min-height: 96px;
      padding: 12px;
    }

    .overview-card strong {
      font-size: 24px;
    }

    .device-card-board__grid {
      grid-template-columns: 1fr;
    }

    .device-card footer {
      flex-direction: column;
    }
  }
</style>
