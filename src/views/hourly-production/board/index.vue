<template>
  <main
    ref="boardElement"
    v-loading="loading"
    class="hourly-board"
    :class="{ 'public-board': publicRead }"
  >
    <header class="board-header">
      <div
        ><el-button @click="toggleShift">{{ previous ? '返回当前班次' : '查看上一班次' }}</el-button
        ><span
          >{{ runtime?.shiftName }} {{ runtime?.shiftStart?.replace('T', ' ') }} 至
          {{ runtime?.shiftEnd?.replace('T', ' ') }}</span
        ></div
      >
      <div
        ><h1>{{ runtime?.name || '小时产量与目标看板' }}</h1
        ><span
          >生产日 {{ runtime?.productionDate.slice(0, 10) || '—' }} ·
          {{ runtime?.serverTime.replace('T', ' ').slice(0, 19) || '' }}</span
        ></div
      >
      <div v-if="!publicRead" class="toolbar">
        <el-select v-model="selected" placeholder="选择看板" style="width: 230px" filterable>
          <el-option
            v-for="board in boards"
            :key="board.code"
            :label="board.name"
            :value="board.code"
          />
        </el-select>
        <el-button @click="load">刷新</el-button>
        <el-button @click="toggleFullscreen">全屏</el-button>
      </div>
    </header>
    <div v-if="error" class="error"
      >{{ error }}<span v-if="runtime">，以下保留上次成功数据</span></div
    >
    <template v-if="runtime">
      <div class="legend"
        ><i class="blue" />产出 <i class="orange" />返工 <i class="green" />达标 <b>┄</b>目标
        <span>未来时段待开始；当前小时统计中</span></div
      >
      <div class="layout-controls" v-if="groups.length > 1"
        ><el-button @click="turnGroup(-1)">上一组</el-button
        ><span>对比组 {{ groupIndex + 1 }} / {{ groups.length }}</span
        ><el-button @click="turnGroup(1)">下一组</el-button
        ><el-button @click="paused = !paused">{{
          paused ? '继续轮播' : '暂停轮播'
        }}</el-button></div
      >
      <div
        class="two-lines"
        :style="{ gridTemplateColumns: `repeat(${displayLines.length || 1}, minmax(0,1fr))` }"
      >
        <LineSummary v-for="line in displayLines" :key="line.code" :line="line" />
      </div>
      <ProcessCarousel :key="runtime.code + groupIndex" :lines="displayLines" />
      <footer v-if="runtime.advice" class="advice"
        ><strong>AI 运行建议</strong
        ><div
          ><p :key="runtime.advice">{{ runtime.advice }}</p></div
        ></footer
      >
      <small class="updated"
        >最后统计更新：{{
          runtime.dataUpdatedAt?.replace('T', ' ').slice(0, 19) || '暂无过站统计'
        }}</small
      >
    </template>
    <el-empty
      v-else-if="!loading"
      description="暂无可查看的看板，请先完成配置；公开地址需指定已发布的看板编码。"
    />
  </main>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { hourlyApi, type HourlyBoard, type HourlyRuntime } from '@/api/hourly-production'
  import LineSummary from '../components/LineSummary.vue'
  import ProcessCarousel from '../components/ProcessCarousel.vue'

  const route = useRoute()
  const publicRead = computed(() => route.meta.publicReadOnly === true)
  const selected = ref(String(route.params.boardCode || route.query.code || ''))
  const boards = ref<Pick<HourlyBoard, 'code' | 'name' | 'published'>[]>([])
  function toggleShift() {
    previous.value = !previous.value
    void load()
  }
  const previous = ref(false)
  const runtime = ref<HourlyRuntime>()
  const groupIndex = ref(0)
  const paused = ref(false)
  const groups = computed(() =>
    runtime.value?.layout?.groups?.length
      ? runtime.value.layout.groups
      : [runtime.value?.lines.slice(0, 2).map((x) => x.code) || []]
  )
  const displayLines = computed(() =>
    (groups.value[groupIndex.value] || groups.value[0] || []).flatMap(
      (code) => runtime.value?.lines.filter((line) => line.code === code) || []
    )
  )
  function turnGroup(delta: number) {
    groupIndex.value = (groupIndex.value + delta + groups.value.length) % groups.value.length
  }
  watch(
    () => JSON.stringify([runtime.value?.code, runtime.value?.layout]),
    () => {
      groupIndex.value = 0
      paused.value = false
    }
  )
  let rotationTimer: ReturnType<typeof setInterval> | undefined
  let rotationElapsed = 0
  onMounted(() => {
    rotationTimer = setInterval(() => {
      if (document.hidden || paused.value || runtime.value?.layout?.mode !== 'Rotate') return
      if (++rotationElapsed >= (runtime.value.layout.rotationSeconds || 15)) {
        rotationElapsed = 0
        turnGroup(1)
      }
    }, 1000)
  })
  onBeforeUnmount(() => {
    if (rotationTimer) clearInterval(rotationTimer)
  })
  const loading = ref(false)
  const error = ref('')
  const boardElement = ref<HTMLElement>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let revision = 0
  let disposed = false

  async function load() {
    if (!selected.value || disposed) return
    clearTimeout(timer)
    const current = ++revision
    loading.value = !runtime.value
    try {
      const result = await hourlyApi.runtime(selected.value, publicRead.value, previous.value)
      if (current !== revision || disposed) return
      runtime.value = result
      error.value = ''
    } catch (exception) {
      if (current === revision)
        error.value = exception instanceof Error ? exception.message : '数据获取失败'
    } finally {
      if (current === revision && !disposed) {
        loading.value = false
        timer = setTimeout(load, (runtime.value?.refreshSeconds ?? 10) * 1000)
      }
    }
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await boardElement.value?.requestFullscreen()
  }

  watch(selected, () => {
    revision++
    runtime.value = undefined
    load()
  })
  watch(
    () => String(route.params.boardCode || route.query.code || ''),
    (code) => {
      if (code && code !== selected.value) selected.value = code
    }
  )
  onMounted(async () => {
    if (!publicRead.value) {
      boards.value = await hourlyApi.boards()
      if (!selected.value) {
        selected.value = boards.value[0]?.code ?? ''
        return
      }
    }
    await load()
  })
  onBeforeUnmount(() => {
    disposed = true
    revision++
    clearTimeout(timer)
  })
</script>

<style scoped>
  .hourly-board {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: var(--art-full-height, 100dvh);
    min-height: 0 !important;
    padding: 14px;
    overflow: hidden;
    color: #1e293b;
    color-scheme: light;
    background: #edf3f9;
    container-type: size;
  }

  .hourly-board.public-board,
  .hourly-board:fullscreen {
    height: 100dvh;
  }

  .hourly-board > :not(.process-carousel) {
    flex-shrink: 0;
  }

  .board-header {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .board-header > div:first-child {
    min-width: 0;
  }

  h1 {
    margin: 0 0 2px;
    overflow: hidden;
    font-size: clamp(22px, 1.8vw, 32px);
    color: #173a62;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .board-header span,
  .updated {
    font-size: 13px;
    color: #64748b;
  }

  .toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .two-lines {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
    font-size: 13px;
    color: #475569;
  }

  .legend i {
    width: 12px;
    height: 12px;
    margin-left: 12px;
    border-radius: 3px;
  }

  .legend span {
    margin-left: 16px;
  }

  .blue {
    background: #3b82f6;
  }

  .orange {
    background: #f59e0b;
  }

  .green {
    background: #16a34a;
  }

  .advice {
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 8px 14px;
    font-size: 20px;
    color: #174182;
    background: #e2edff;
    border-radius: 12px;
  }

  .advice strong {
    flex-shrink: 0;
    padding: 5px 10px;
    font-size: 16px;
    color: #fff;
    background: #2563eb;
    border-radius: 6px;
  }

  .advice > div {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .advice p {
    display: inline-block;
    min-width: 100%;
    margin: 0;
    white-space: nowrap;
    animation: advice-scroll 32s linear infinite;
  }

  .updated {
    display: block;
    text-align: right;
  }

  .error {
    padding: 6px 12px;
    color: #b45309;
    background: #fffbeb;
    border-radius: 8px;
  }

  @keyframes advice-scroll {
    from {
      transform: translateX(100%);
    }

    to {
      transform: translateX(-100%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .advice p {
      animation: none;
    }

    .advice > div {
      overflow-x: auto;
    }
  }

  @container (height < 650px) {
    .legend span {
      display: none;
    }

    .advice {
      padding: 5px 10px;
      font-size: 18px;
    }
  }
</style>
