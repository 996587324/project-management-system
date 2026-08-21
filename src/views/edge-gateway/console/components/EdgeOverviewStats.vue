<template>
  <section v-if="loading" class="stats-grid" aria-label="运行概览加载中">
    <div v-for="index in 5" :key="index" class="stat-item stat-skeleton">
      <el-skeleton animated>
        <template #template>
          <div class="stat-skeleton-content">
            <el-skeleton-item variant="circle" class="stat-skeleton-icon" />
            <div class="stat-skeleton-lines">
              <el-skeleton-item variant="text" class="stat-skeleton-label" />
              <el-skeleton-item variant="h3" class="stat-skeleton-value" />
              <el-skeleton-item variant="text" />
            </div>
          </div>
        </template>
      </el-skeleton>
    </div>
  </section>
  <section v-else class="stats-grid">
    <div class="stat-item status-stat">
      <div class="stat-icon"><Connection /></div>
      <div>
        <span>在线连接</span>
        <strong>{{ overview.receivingConnectionCount }} / {{ overview.connectionCount }}</strong>
        <small
          >{{ overview.noDataConnectionCount }} 个未正常接收，{{
            overview.disabledConnectionCount
          }}
          个停用</small
        >
      </div>
    </div>
    <div class="stat-item queue-stat">
      <div class="stat-icon"><DataLine /></div>
      <div>
        <span>待处理队列</span>
        <strong>{{ overview.queueDepth }}</strong>
        <small>中心端待转发消息</small>
      </div>
    </div>
    <div class="stat-item error-stat">
      <div class="stat-icon"><WarningFilled /></div>
      <div>
        <span>失败与告警</span>
        <strong>{{ overview.failedCount + overview.activeAlarmCount }}</strong>
        <small
          >{{ overview.failedCount }} 条失败，{{ overview.activeAlarmCount }} 条未处理告警</small
        >
      </div>
    </div>
    <div class="stat-item forward-stat">
      <div class="stat-icon"><Promotion /></div>
      <div>
        <span>转发成功</span>
        <strong>{{ overview.successfulForwardCount }}</strong>
        <small>累计成功转发到 B 系统</small>
      </div>
    </div>
    <div class="stat-item success-stat">
      <div class="stat-icon"><CircleCheckFilled /></div>
      <div>
        <span>转发成功率</span>
        <strong>{{ overview.uploadSuccessRate.toFixed(2) }}%</strong>
        <small>B 系统适配转发统计</small>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import {
    CircleCheckFilled,
    Connection,
    DataLine,
    Promotion,
    WarningFilled
  } from '@element-plus/icons-vue'
  import type { EdgeOverview } from '@/api/edge-gateway'

  defineProps<{
    overview: EdgeOverview
    loading?: boolean
  }>()
</script>
