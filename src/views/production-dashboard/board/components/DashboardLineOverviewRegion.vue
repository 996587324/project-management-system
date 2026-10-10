<template>
  <section class="production-dashboard__line-summary">
    <div class="production-dashboard__line-title">
      <span :style="{ backgroundColor: line.color }" />
      <div>
        <b>{{ line.name }}</b>
        <small>{{ line.area }}</small>
      </div>
    </div>
    <article v-if="insight" :class="['ai-insight', `ai-insight--${insight.level.toLowerCase()}`]">
      <div class="ai-insight__label">
        <ArtSvgIcon icon="ri:sparkling-2-line" />
        <span>AI 运行建议</span>
      </div>
      <span class="ai-insight__level">{{ levelLabel }}</span>
      <div class="ai-insight__track" :title="tooltip">
        <div :class="['ai-insight__rail', { 'ai-insight__rail--scrolling': shouldScroll }]">
          <span>{{ insight.content }}</span>
          <template v-if="shouldScroll">
            <span aria-hidden="true">{{ insight.content }}</span>
          </template>
        </div>
      </div>
      <time>{{ generatedTime }}</time>
    </article>
  </section>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { DashboardAiInsight } from '@/api/edge-dashboard'
  import type { ProductionLineBoard } from '@/views/production-dashboard/config/productionDashboard'

  const props = defineProps<{
    line: ProductionLineBoard
    insight?: DashboardAiInsight | null
  }>()

  const levelLabel = computed(
    () => ({ Critical: '严重', Warning: '预警', Info: '提示' })[props.insight?.level || 'Info']
  )
  const shouldScroll = computed(() => (props.insight?.content || '').length > 42)
  const tooltip = computed(() => props.insight?.content || '')
  const generatedTime = computed(() => {
    const value = props.insight?.generatedAt
    return value ? value.replace('T', ' ').slice(11, 16) : ''
  })
</script>

<style scoped lang="scss">
  .production-dashboard__line-summary {
    display: grid;
    grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
    column-gap: 14px;
    align-items: center;
    min-width: 0;
    height: 100%;
  }

  .production-dashboard__line-title {
    display: flex;
    gap: 9px;
    align-items: center;
    width: auto;
    min-width: 0;
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

  .ai-insight {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    gap: 9px;
    align-items: center;
    width: 100%;
    min-width: 0;
    height: 100%;
    padding: 6px 12px;
    overflow: hidden;
    background: linear-gradient(135deg, rgb(19 56 78 / 68%), rgb(9 26 42 / 65%));
    border: 1px solid rgb(88 165 207 / 20%);
    border-left: 3px solid #57c8f2;
    border-radius: 3px;
  }

  .ai-insight__label {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 5px;
    align-items: center;
    font-size: 13px;
    color: #76ddff;
    white-space: nowrap;
  }

  .ai-insight__label :deep(svg) {
    font-size: 17px;
  }

  .ai-insight__level {
    flex: 0 0 auto;
    padding: 2px 5px;
    font-size: 12px;
    color: #9cecff;
    background: rgb(77 207 247 / 13%);
    border: 1px solid rgb(77 207 247 / 34%);
    border-radius: 2px;
  }

  .ai-insight__track {
    min-width: 0;
    overflow: hidden;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.25;
    color: #c4dce8;
    white-space: nowrap;
  }

  .ai-insight__rail {
    display: inline-flex;
    gap: 14px;
    align-items: center;
    min-width: 100%;
  }

  .ai-insight__rail--scrolling {
    width: max-content;
    min-width: max-content;
    animation: ai-insight-marquee 22s linear infinite;
  }

  .ai-insight:hover .ai-insight__rail--scrolling {
    animation-play-state: paused;
  }

  .ai-insight time {
    flex: 0 0 auto;
    font-family: Consolas, monospace;
    font-size: 11px;
    color: #6f8c9d;
  }

  .ai-insight--warning {
    border-left-color: #f4b85b;
  }

  .ai-insight--warning .ai-insight__level {
    color: #ffd492;
    background: rgb(244 184 91 / 12%);
    border-color: rgb(244 184 91 / 46%);
  }

  .ai-insight--critical {
    border-left-color: #ff6277;
  }

  .ai-insight--critical .ai-insight__level {
    color: #ffabb7;
    background: rgb(255 98 119 / 12%);
    border-color: rgb(255 98 119 / 46%);
  }

  @keyframes ai-insight-marquee {
    from {
      transform: translateX(0);
    }

    to {
      transform: translateX(-50%);
    }
  }

  @media (resolution <= 1.1dppx) and (width >= 1440px) and (height >= 760px) {
    .production-dashboard__line-title {
      gap: 11px;
    }

    .production-dashboard__line-summary {
      grid-template-columns: minmax(220px, 310px) minmax(0, 1fr);
      column-gap: 18px;
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

    .ai-insight {
      padding: 7px 15px;
    }

    .ai-insight__label,
    .ai-insight__track {
      font-size: 16px;
    }

    .ai-insight__level,
    .ai-insight time {
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
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
      height: auto;
      padding: 12px 0;
    }

    .production-dashboard__line-title,
    .ai-insight {
      width: 100%;
    }

    .ai-insight {
      grid-template-columns: auto auto minmax(0, 1fr);
      min-height: 42px;
    }

    .ai-insight time {
      display: none;
    }
  }
</style>
