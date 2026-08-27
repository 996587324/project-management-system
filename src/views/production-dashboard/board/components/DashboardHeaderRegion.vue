<template>
  <header class="production-dashboard__header">
    <div class="production-dashboard__brand">
      <span class="production-dashboard__brand-mark">II</span>
      <div>
        <p>SMART FACTORY · NANSHA TCL</p>
        <h1>自动化产线机械手监控平台</h1>
      </div>
    </div>

    <nav class="production-dashboard__line-tabs" aria-label="线体切换">
      <button
        v-for="line in lines"
        :key="line.id"
        :class="[
          'production-dashboard__line-tab',
          { 'production-dashboard__line-tab--active': activeLineId === line.id }
        ]"
        :style="
          activeLineId === line.id ? { borderColor: line.color, color: line.color } : undefined
        "
        type="button"
        @click="emit('update:activeLineId', line.id)"
      >
        <i :style="{ backgroundColor: line.color }" />{{ line.id }}
        <span>{{ line.robots.length }} 台</span>
      </button>
    </nav>

    <div class="production-dashboard__header-actions">
      <span v-if="offline" class="production-dashboard__offline-badge">离线配置</span>
      <button
        v-if="!readOnly"
        class="production-dashboard__icon-button"
        type="button"
        title="导出当前线体日报"
        aria-label="导出当前线体日报"
        :disabled="offline || exporting"
        @click="emit('exportCurrent')"
      >
        <ArtSvgIcon icon="ri:file-excel-2-line" :class="{ 'is-loading': exporting }" />
      </button>
      <button
        v-if="!readOnly"
        class="production-dashboard__icon-button"
        type="button"
        title="定时导出设置与记录"
        aria-label="定时导出设置与记录"
        :disabled="offline"
        @click="emit('openExports')"
      >
        <ArtSvgIcon icon="ri:calendar-schedule-line" />
      </button>
      <button
        class="production-dashboard__fullscreen-button"
        type="button"
        :title="fullscreen ? '退出全屏' : '全屏显示'"
        :aria-label="fullscreen ? '退出全屏' : '全屏显示'"
        @click="emit('toggleFullscreen')"
      >
        <ArtSvgIcon :icon="fullscreen ? 'ri:fullscreen-exit-line' : 'ri:fullscreen-line'" />
      </button>
      <router-link
        v-if="!readOnly"
        class="production-dashboard__layout-link"
        :to="{ name: 'ProductionDashboardLayoutEditor', query: { lineCode: activeLineId } }"
      >
        布局编辑
      </router-link>
      <button
        v-if="!readOnly"
        class="production-dashboard__config-button"
        type="button"
        @click="emit('openBinding')"
      >
        数据绑定
      </button>
      <button
        v-if="!readOnly"
        class="production-dashboard__config-button"
        type="button"
        @click="emit('openWidgets')"
      >
        图表配置
      </button>
      <button
        v-if="!readOnly"
        class="production-dashboard__config-button"
        type="button"
        @click="emit('openLines')"
      >
        线体配置
      </button>
      <time>{{ currentTime }}</time>
    </div>
  </header>
</template>

<script setup lang="ts">
  import type { ProductionLineBoard } from '@/views/production-dashboard/config/productionDashboard'

  withDefaults(
    defineProps<{
      lines: ProductionLineBoard[]
      activeLineId: string
      offline: boolean
      fullscreen: boolean
      exporting: boolean
      currentTime: string
      readOnly?: boolean
    }>(),
    { readOnly: false }
  )

  const emit = defineEmits<{
    'update:activeLineId': [lineId: string]
    toggleFullscreen: []
    openBinding: []
    openWidgets: []
    openLines: []
    exportCurrent: []
    openExports: []
  }>()
</script>

<style scoped lang="scss">
  .production-dashboard__header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: 100%;
    border-bottom: 1px solid rgb(87 190 245 / 28%);
  }

  .production-dashboard__brand {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .production-dashboard__brand-mark {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    font-weight: 800;
    color: #6df;
    letter-spacing: -3px;
    border: 1px solid #5bd8ff;
    box-shadow: 0 0 18px rgb(62 197 255 / 42%);
  }

  .production-dashboard__brand p {
    margin: 0 0 3px;
    font-size: 9px;
    color: #62cceb;
    letter-spacing: 1.7px;
  }

  .production-dashboard__brand h1 {
    margin: 0;
    font-size: 21px;
    font-weight: 600;
    color: #f0faff;
    letter-spacing: 1px;
  }

  .production-dashboard__line-tabs {
    display: flex;
    gap: 6px;
    align-items: center;
    height: 100%;
  }

  .production-dashboard__line-tab {
    display: flex;
    gap: 6px;
    align-items: center;
    height: 30px;
    padding: 0 11px;
    font-size: 12px;
    color: #91b8ce;
    cursor: pointer;
    background: rgb(11 37 55 / 50%);
    border: 1px solid rgb(110 177 211 / 25%);
    border-radius: 3px;
  }

  .production-dashboard__line-tab i {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    box-shadow: 0 0 8px currentcolor;
  }

  .production-dashboard__line-tab span {
    font-size: 10px;
    color: #68879a;
  }

  .production-dashboard__line-tab--active {
    background: rgb(49 145 190 / 16%);
    box-shadow: inset 0 0 15px rgb(78 203 250 / 8%);
  }

  .production-dashboard__header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
  }

  .production-dashboard__header-actions time {
    margin-left: 5px;
    font-family: Consolas, monospace;
    font-size: 12px;
    color: #9db8c9;
  }

  .production-dashboard__offline-badge {
    padding: 3px 7px;
    font-size: 11px;
    color: #ffd08a;
    white-space: nowrap;
    background: rgb(150 88 13 / 20%);
    border: 1px solid rgb(255 183 77 / 55%);
    border-radius: 3px;
  }

  .production-dashboard__fullscreen-button,
  .production-dashboard__icon-button {
    display: inline-flex;
    flex: 0 0 28px;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    font-size: 16px;
    color: #a6e7ff;
    cursor: pointer;
    background: rgb(31 102 139 / 14%);
    border: 1px solid rgb(100 208 251 / 38%);
    border-radius: 3px;
  }

  .production-dashboard__fullscreen-button:hover,
  .production-dashboard__icon-button:hover {
    background: rgb(31 129 177 / 26%);
    border-color: rgb(100 208 251 / 72%);
  }

  .production-dashboard__fullscreen-button:disabled,
  .production-dashboard__icon-button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .production-dashboard__icon-button .is-loading {
    animation: dashboard-export-spin 0.9s linear infinite;
  }

  @keyframes dashboard-export-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .production-dashboard__layout-link,
  .production-dashboard__config-button {
    height: 28px;
    padding: 0 9px;
    font-size: 11px;
    line-height: 28px;
    color: #a6e7ff;
    text-decoration: none;
    cursor: pointer;
    background: rgb(31 102 139 / 14%);
    border: 1px solid rgb(100 208 251 / 38%);
    border-radius: 3px;
  }

  @media (width <= 1350px) {
    .production-dashboard__brand h1 {
      font-size: 18px;
    }

    .production-dashboard__line-tab {
      padding: 0 8px;
    }
  }

  @media (resolution <= 1.1dppx) and (width >= 1440px) and (height >= 760px) {
    .production-dashboard__brand {
      gap: 12px;
    }

    .production-dashboard__brand-mark {
      width: 38px;
      height: 38px;
      font-size: 18px;
    }

    .production-dashboard__brand p {
      font-size: 12px;
    }

    .production-dashboard__brand h1 {
      font-size: 27px;
    }

    .production-dashboard__line-tabs,
    .production-dashboard__header-actions {
      gap: 9px;
    }

    .production-dashboard__line-tab {
      gap: 7px;
      height: 36px;
      padding: 0 14px;
      font-size: 16px;
    }

    .production-dashboard__line-tab i {
      width: 8px;
      height: 8px;
    }

    .production-dashboard__line-tab span {
      font-size: 14px;
    }

    .production-dashboard__header-actions time {
      font-size: 16px;
    }

    .production-dashboard__offline-badge {
      padding: 4px 9px;
      font-size: 15px;
    }

    .production-dashboard__fullscreen-button,
    .production-dashboard__icon-button {
      flex-basis: 34px;
      width: 34px;
      height: 34px;
      font-size: 20px;
    }

    .production-dashboard__layout-link,
    .production-dashboard__config-button {
      height: 34px;
      padding: 0 12px;
      font-size: 15px;
      line-height: 34px;
    }
  }

  @media (height <= 820px) and (width >= 768px) {
    .production-dashboard__brand p {
      display: none;
    }

    .production-dashboard__brand h1 {
      font-size: 17px;
    }
  }

  @media (width <= 767px) {
    .production-dashboard__header {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
      height: auto;
      padding-bottom: 10px;
    }

    .production-dashboard__brand h1 {
      font-size: 17px;
    }

    .production-dashboard__line-tabs {
      width: 100%;
      overflow-x: auto;
    }

    .production-dashboard__line-tab {
      flex: 0 0 auto;
    }

    .production-dashboard__header-actions {
      justify-content: flex-start;
    }

    .production-dashboard__header-actions time {
      margin-left: auto;
      font-size: 10px;
    }
  }
</style>
