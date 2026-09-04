<template>
  <section class="production-dashboard__analytics">
    <header>
      <div><span>CONFIGURABLE ANALYTICS</span><h2>生产统计</h2></div>
      <small>{{ widgets.length }} 个实时部件</small>
    </header>
    <div class="production-dashboard__analytics-grid">
      <dashboard-widget-renderer
        v-for="widget in widgets"
        :key="`${widget.id}-${widget.updateTime}`"
        :widget="widget"
        :line-code="lineCode"
        :default-column-span="defaultColumnSpan"
        :public-access="publicAccess"
        @view-details="emit('view-details', $event)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
  import DashboardWidgetRenderer from '@/views/production-dashboard/components/DashboardWidgetRenderer.vue'
  import type { DashboardWidget } from '@/api/edge-dashboard'

  const emit = defineEmits<{ 'view-details': [widget: DashboardWidget] }>()

  withDefaults(
    defineProps<{
      widgets: DashboardWidget[]
      lineCode: string
      defaultColumnSpan: number
      publicAccess?: boolean
    }>(),
    { publicAccess: false }
  )
</script>

<style scoped lang="scss">
  .production-dashboard__analytics {
    display: grid;
    grid-template-rows: 34px minmax(0, 1fr);
    min-height: 0;
  }

  .production-dashboard__analytics > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 0;
    padding: 0 2px 6px;
    border-bottom: 1px solid rgb(82 168 207 / 24%);
  }

  .production-dashboard__analytics > header > div {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }

  .production-dashboard__analytics > header span {
    font-size: 9px;
    color: #42c9ef;
    letter-spacing: 1.6px;
  }

  .production-dashboard__analytics > header h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #eaf8ff;
  }

  .production-dashboard__analytics > header small {
    font-size: 11px;
    color: #6f91a4;
  }

  .production-dashboard__analytics-grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-auto-rows: minmax(0, 1fr);
    grid-auto-flow: dense;
    gap: 8px;
    min-height: 0;
    padding-top: 8px;
    overflow: hidden;
  }

  @media (resolution <= 1.1dppx) and (width >= 1440px) and (height >= 760px) {
    .production-dashboard__analytics {
      grid-template-rows: 40px minmax(0, 1fr);
    }

    .production-dashboard__analytics > header span {
      font-size: 13px;
    }

    .production-dashboard__analytics > header h2 {
      font-size: 19px;
    }

    .production-dashboard__analytics > header small {
      font-size: 15px;
    }

    .production-dashboard__analytics-grid {
      gap: 10px;
      padding-top: 10px;
    }
  }

  @media (height <= 820px) and (width >= 768px) {
    .production-dashboard__analytics {
      grid-template-rows: 28px minmax(0, 1fr);
    }

    .production-dashboard__analytics-grid {
      gap: 6px;
      padding-top: 6px;
    }
  }

  @media (width <= 767px) {
    .production-dashboard__analytics {
      display: block;
      padding-top: 18px;
    }

    .production-dashboard__analytics > header {
      min-height: 42px;
    }

    .production-dashboard__analytics-grid {
      display: flex;
      flex-direction: column;
      overflow: visible;
    }
  }
</style>
