<template>
  <section class="line-summary">
    <div class="heading"
      ><h2>{{ line.name }}</h2
      ><small>总产出口径：{{ line.summaryProcessName || '未配置' }}</small></div
    >
    <div class="metrics">
      <div
        ><span>本班累计产出</span
        ><strong>{{
          line.summaryPoints.some((p) => p.status !== 'Unbound')
            ? line.totalOutput.toLocaleString()
            : '—'
        }}</strong></div
      >
      <div
        ><span>最近完整小时</span><strong>{{ line.latestCompleted?.output ?? '—' }}</strong
        ><small>{{ hour }}</small></div
      >
      <div
        ><span>小时目标 / 达成率</span
        ><strong
          >{{ line.latestCompleted?.target ?? '—' }} /
          {{
            line.latestCompleted?.achievement == null ? '—' : `${line.latestCompleted.achievement}%`
          }}</strong
        ></div
      >
      <div
        ><span>小时返工 / 达标工序</span
        ><strong
          >{{ line.latestCompleted?.rework ?? '—' }} / {{ line.achievedProcesses
          }}<small> / {{ line.targetedProcesses }}</small></strong
        ></div
      >
    </div>
    <HourlyChart
      title="线体小时产出"
      :points="line.summaryPoints"
      compact
      :configured="line.summaryPoints.some((p) => p.status !== 'Unbound')"
    />
  </section>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { HourlyLineRuntime } from '@/api/hourly-production'
  import HourlyChart from './HourlyChart.vue'
  const props = defineProps<{ line: HourlyLineRuntime }>()
  const hour = computed(() => {
    const point = props.line.latestCompleted
    return point ? `${point.start.slice(11, 16)}–${point.end.slice(11, 16)}` : '尚无完整小时'
  })
</script>

<style scoped>
  .line-summary {
    min-width: 0;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid #dbe5f0;
    border-top: 4px solid #3b82f6;
    border-radius: 12px;
  }

  .heading {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    overflow: hidden;
    font-size: 24px;
    color: #1e3a5f;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    font-size: 12px;
    color: #64748b;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin: 8px 0;
  }

  .metrics > div {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  span {
    font-size: 13px;
    color: #64748b;
  }

  strong {
    font-size: clamp(17px, 1.5vw, 27px);
    color: #1d4ed8;
  }

  @container (height < 650px) {
    .line-summary {
      padding: 6px 10px;
    }

    h2 {
      font-size: 20px;
    }

    .metrics {
      margin: 5px 0;
    }
  }
</style>
