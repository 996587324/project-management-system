<template>
  <section class="production-dashboard__line-summary">
    <div class="production-dashboard__line-title">
      <span :style="{ backgroundColor: line.color }" />
      <div>
        <b>{{ line.name }}</b>
        <small>{{ line.area }}</small>
      </div>
    </div>
    <div class="production-dashboard__summary-cards">
      <article class="summary-card summary-card--green">
        <span>机械手在线</span>
        <strong>{{ onlineCount }}</strong>
        <em>/ {{ totalCount }}</em>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
  import type { ProductionLineBoard } from '@/views/production-dashboard/config/productionDashboard'

  defineProps<{
    line: ProductionLineBoard
    onlineCount: number
    totalCount: number
  }>()
</script>

<style scoped lang="scss">
  .production-dashboard__line-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
  }

  .production-dashboard__line-title {
    display: flex;
    gap: 9px;
    align-items: center;
    width: 260px;
  }

  .production-dashboard__line-title > span {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    box-shadow: 0 0 8px currentcolor;
  }

  .production-dashboard__line-title b {
    display: block;
    font-size: 16px;
    color: #f0fbff;
  }

  .production-dashboard__line-title small {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    color: #7090a3;
  }

  .production-dashboard__summary-cards {
    display: grid;
    grid-template-columns: minmax(150px, 190px);
    gap: 8px;
    justify-content: end;
    width: min(190px, calc(100% - 285px));
  }

  .summary-card {
    min-width: 0;
    padding: 10px 12px;
    background: linear-gradient(135deg, rgb(19 56 78 / 68%), rgb(9 26 42 / 65%));
    border: 1px solid rgb(88 165 207 / 20%);
    border-top: 2px solid #57c8f2;
  }

  .summary-card span {
    display: block;
    overflow: hidden;
    font-size: 11px;
    color: #88aabd;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .summary-card strong {
    display: inline-block;
    margin-top: 5px;
    font-family: 'DIN Alternate', Consolas, sans-serif;
    font-size: 22px;
    font-weight: 600;
    color: #ecfaff;
  }

  .summary-card em {
    margin-left: 4px;
    font-size: 10px;
    font-style: normal;
    color: #7793a3;
  }

  .summary-card--green {
    border-top-color: #37dba0;
  }

  @media (resolution <= 1.1dppx) and (width >= 1440px) and (height >= 760px) {
    .production-dashboard__line-title {
      gap: 11px;
      width: 310px;
    }

    .production-dashboard__line-title > span {
      width: 12px;
      height: 12px;
    }

    .production-dashboard__line-title b {
      font-size: 22px;
    }

    .production-dashboard__line-title small {
      font-size: 16px;
    }

    .production-dashboard__summary-cards {
      grid-template-columns: minmax(180px, 220px);
      width: min(220px, calc(100% - 335px));
    }

    .summary-card {
      padding: 11px 15px;
    }

    .summary-card span {
      font-size: 16px;
    }

    .summary-card strong {
      font-size: 32px;
    }

    .summary-card em {
      font-size: 15px;
    }
  }

  @media (height <= 820px) and (width >= 768px) {
    .production-dashboard__line-title small {
      margin-top: 2px;
    }
  }

  @media (width <= 767px) {
    .production-dashboard__line-summary {
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
      height: auto;
      padding: 12px 0;
    }

    .production-dashboard__line-title,
    .production-dashboard__summary-cards {
      width: 100%;
    }

    .production-dashboard__summary-cards {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
