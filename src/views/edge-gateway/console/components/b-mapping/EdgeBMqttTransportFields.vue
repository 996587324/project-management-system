<template>
  <el-form-item label="Broker 地址" required>
    <el-input v-model="model.targetUrl" placeholder="mqtt://broker.example.com:1883" />
  </el-form-item>

  <el-form-item label="发布主题" required>
    <el-input v-model="model.mqttTopic" placeholder="factory/gateway/telemetry" />
  </el-form-item>

  <div class="form-grid">
    <el-form-item label="客户端 ID">
      <el-input v-model="model.mqttClientId" placeholder="留空时自动生成" />
    </el-form-item>
    <el-form-item label="用户名">
      <el-input v-model="model.mqttUsername" autocomplete="off" />
    </el-form-item>
  </div>

  <div class="form-grid mqtt-option-grid">
    <el-form-item label="密码">
      <el-input
        v-model="model.mqttPassword"
        type="password"
        show-password
        autocomplete="new-password"
        :placeholder="model.hasMqttPassword ? '已配置，留空保持不变' : '可选'"
      />
    </el-form-item>
    <el-form-item label="服务质量">
      <el-select v-model="model.mqttQosLevel">
        <el-option label="QoS 0 - 最多一次" :value="0" />
        <el-option label="QoS 1 - 至少一次" :value="1" />
        <el-option label="QoS 2 - 仅一次" :value="2" />
      </el-select>
    </el-form-item>
    <el-form-item label="保留消息">
      <el-switch v-model="model.mqttRetain" />
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
  import type { EdgeBMapping } from '@/api/edge-gateway'

  const model = defineModel<EdgeBMapping>({ required: true })
</script>
