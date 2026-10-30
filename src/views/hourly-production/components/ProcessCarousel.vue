<template>
  <section
    class="process-carousel"
    aria-label="工序小时产量轮播"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focused = true"
    @focusout="handleFocusOut"
  >
    <header class="carousel-toolbar">
      <strong>工序小时产量</strong>
      <div class="carousel-controls">
        <span v-if="rows.length" class="page-description">
          工序 {{ pageStart + 1 }}–{{ Math.min(pageStart + pageSize, rows.length) }} /
          {{ rows.length }} · 第 {{ page + 1 }} / {{ pageCount }} 屏
        </span>
        <template v-if="pageCount > 1">
          <button type="button" aria-label="上一屏工序" @click="turnPage(-1)">上一屏</button>
          <button type="button" :aria-pressed="paused" @click="togglePaused">
            {{ paused ? '继续轮播' : '暂停轮播' }}
          </button>
          <button type="button" aria-label="下一屏工序" @click="turnPage(1)">下一屏</button>
        </template>
      </div>
    </header>
    <div ref="viewport" class="carousel-viewport">
      <div
        v-if="rows.length"
        :key="page"
        class="process-page"
        :style="{ gridTemplateRows: `repeat(${visibleRows.length}, minmax(0, 1fr))` }"
      >
        <div
          v-for="row in visibleRows"
          :key="row"
          class="process-row"
          :style="{ gridTemplateColumns: `repeat(${lines.length || 1}, minmax(0,1fr))` }"
        >
          <template v-for="line in lines" :key="line.code">
            <HourlyChart
              v-if="findProcess(line, row)"
              :title="line.name + ' · ' + findProcess(line, row)!.name"
              :points="findProcess(line, row)!.points"
              :configured="findProcess(line, row)!.configured"
              fill
            />
            <div v-else class="placeholder">{{ line.name }}未配置该工序</div>
          </template>
        </div>
      </div>
      <div v-else class="empty">尚未配置工序</div>
    </div>
    <div v-if="pageCount > 1" class="rotation-status">
      <span>{{ rotationLabel }}</span>
      <div class="rotation-track" aria-hidden="true">
        <i :style="{ width: `${(elapsed / rotationSeconds) * 100}%` }" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
  import type { HourlyLineRuntime } from '@/api/hourly-production'
  import HourlyChart from './HourlyChart.vue'
  import { clampProcessPage, processPageSize } from './process-carousel-layout'

  const props = defineProps<{ lines: HourlyLineRuntime[] }>()
  const rotationSeconds = 10
  const viewport = ref<HTMLElement>()
  const viewportHeight = ref(0)
  const page = ref(0)
  const elapsed = ref(0)
  const paused = ref(false)
  const hovered = ref(false)
  const focused = ref(false)
  let observer: ResizeObserver | undefined
  let timer: ReturnType<typeof setInterval> | undefined

  const rows = computed(() => [
    ...new Set(props.lines.flatMap((line) => line.processes.map((process) => process.rowCode)))
  ])
  const pageSize = computed(() => processPageSize(viewportHeight.value, rows.value.length))
  const pageCount = computed(() => Math.max(1, Math.ceil(rows.value.length / pageSize.value)))
  const pageStart = computed(() => page.value * pageSize.value)
  const visibleRows = computed(() =>
    rows.value.slice(pageStart.value, pageStart.value + pageSize.value)
  )
  const rotationLabel = computed(() => {
    if (paused.value) return '已暂停轮播'
    if (hovered.value || focused.value) return '正在查看，轮播暂缓'
    return `${rotationSeconds - elapsed.value} 秒后切换下一屏 · 悬停可暂缓`
  })

  function findProcess(line: HourlyLineRuntime, row: string) {
    return line.processes.find((process) => process.rowCode === row)
  }

  function turnPage(direction: number) {
    page.value = (page.value + direction + pageCount.value) % pageCount.value
    elapsed.value = 0
  }

  function togglePaused() {
    paused.value = !paused.value
    elapsed.value = 0
  }

  function handleFocusOut(event: FocusEvent) {
    focused.value =
      event.currentTarget instanceof HTMLElement &&
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
  }

  function startRotation() {
    if (timer) return
    timer = setInterval(() => {
      if (paused.value || hovered.value || focused.value || document.hidden || pageCount.value <= 1)
        return
      elapsed.value++
      if (elapsed.value >= rotationSeconds) turnPage(1)
    }, 1000)
  }

  function stopRotation() {
    clearInterval(timer)
    timer = undefined
  }

  // Data refreshes do not reset the carousel; only structural changes or resizing change pages.
  watch([pageSize, () => rows.value.join('\u0000')], () => {
    page.value = clampProcessPage(page.value, rows.value.length, pageSize.value)
    elapsed.value = 0
  })

  onMounted(() => {
    if (viewport.value) {
      observer = new ResizeObserver(([entry]) => {
        viewportHeight.value = entry.contentRect.height
      })
      observer.observe(viewport.value)
    }
    startRotation()
  })
  onActivated(startRotation)
  onDeactivated(stopRotation)
  onBeforeUnmount(() => {
    stopRotation()
    observer?.disconnect()
  })
</script>

<style scoped>
  .process-carousel {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    min-height: 0;
  }

  .carousel-toolbar,
  .carousel-controls,
  .rotation-status {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .carousel-toolbar {
    flex-shrink: 0;
    justify-content: space-between;
    min-height: 30px;
  }

  .carousel-toolbar strong {
    font-size: 17px;
    color: #173a62;
  }

  .page-description,
  .rotation-status {
    font-size: 12px;
    color: #64748b;
  }

  button {
    padding: 4px 10px;
    color: #1d4ed8;
    white-space: nowrap;
    cursor: pointer;
    background: #fff;
    border: 1px solid #cbdcf1;
    border-radius: 6px;
  }

  button:hover,
  button:focus-visible {
    background: #dbeafe;
  }

  .carousel-viewport {
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
  }

  .process-page {
    display: grid;
    gap: 10px;
    height: 100%;
    animation: process-enter 350ms ease-out;
  }

  .process-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    min-height: 0;
  }

  .placeholder,
  .empty {
    display: grid;
    place-content: center;
    color: #64748b;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
  }

  .empty {
    height: 100%;
  }

  .rotation-status {
    flex-shrink: 0;
    justify-content: flex-end;
    height: 16px;
  }

  .rotation-track {
    width: 90px;
    height: 4px;
    overflow: hidden;
    background: #dbe5ef;
    border-radius: 4px;
  }

  .rotation-track i {
    display: block;
    height: 100%;
    background: #3b82f6;
    transition: width 300ms linear;
  }

  @keyframes process-enter {
    from {
      opacity: 0;
      transform: translateY(10px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .process-page {
      animation: none;
    }

    .rotation-track i {
      transition: none;
    }
  }
</style>
