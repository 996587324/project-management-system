<template>
  <el-dialog
    :model-value="modelValue"
    :title="`${field?.displayName || '字段'} · 数据推送`"
    width="min(700px, 95vw)"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-width="135px">
      <el-form-item label="启用推送">
        <el-switch v-model="draft.enabled" />
      </el-form-item>
      <el-form-item label="推送负责人">
        <el-radio-group v-model="draft.channel">
          <el-radio-button value="WeChat">本系统微信</el-radio-button>
          <el-radio-button value="ExternalMcp">外部 MCP</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-alert
        v-if="draft.channel === 'ExternalMcp'"
        title="外部智能体自行读取字段、变化记录或越限事件并调度推送。本系统不会发送微信；变化记录需要另行开启字段追溯。"
        type="info"
        :closable="false"
        class="push-notice"
      />
      <el-form-item v-if="draft.channel === 'WeChat'" label="微信接收人">
        <el-select
          v-model="draft.recipientUserIds"
          :loading="loading"
          multiple
          :multiple-limit="100"
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择已绑定微信的用户，可多选"
          style="width: 100%"
        >
          <el-option
            v-for="person in recipients"
            :key="person.userId"
            :value="person.userId"
            :label="`${person.userName} · ${person.status}`"
            :disabled="!person.selectable"
          />
        </el-select>
        <small>会话未就绪的用户需先在微信向 ClawBot 发送一条消息。</small>
      </el-form-item>
      <el-form-item label="触发方式">
        <el-checkbox v-model="draft.onChange">字段变化</el-checkbox>
        <el-checkbox v-model="draft.onLimit" :disabled="!hasLimits">超过上下限</el-checkbox>
        <el-checkbox v-model="draft.onRecovery" :disabled="!hasLimits">恢复正常</el-checkbox>
        <small v-if="!hasLimits">越限和恢复通知需先在字段行配置数值上下限。</small>
      </el-form-item>
      <el-form-item v-if="draft.onChange" label="推送变化阈值">
        <el-input-number
          v-model="draft.changeThreshold"
          :min="0"
          :precision="6"
          controls-position="right"
        />
        <small>留空或 0 表示变化即触发；数值按与上次推送基准的差值计算，不要求开启追溯。</small>
      </el-form-item>
      <el-form-item v-if="draft.onChange" label="变化推送间隔">
        <el-input-number
          v-model="draft.changeIntervalSeconds"
          :min="0"
          :max="86400"
          controls-position="right"
        />
        <span>&nbsp;秒</span>
        <small>用于防止变化消息刷屏；越限/恢复事件不受此间隔抑制，持续越限不会每帧重复通知。</small>
      </el-form-item>
      <el-form-item v-if="draft.channel === 'WeChat'" label="消息模板">
        <el-input
          v-model="draft.messageTemplate"
          type="textarea"
          :rows="4"
          :maxlength="2000"
          show-word-limit
          placeholder="留空使用默认模板"
        />
        <small
          >可用变量：{event}、{line}、{device}、{field}、{oldValue}、{value}、{unit}、{lower}、{upper}、{time}</small
        >
      </el-form-item>
      <el-form-item v-if="draft.channel === 'WeChat'" label="内容预览">
        <pre class="push-preview">{{ preview }}</pre>
      </el-form-item>
    </el-form>
    <el-alert
      title="设置先应用到当前表单，点击卡片的“保存”才写入后台。首次上报仅建立基准，缺失字段不推送，明确空值默认不通知。"
      type="info"
      :closable="false"
    />
    <template #footer>
      <el-button
        v-if="draft.channel === 'WeChat'"
        :disabled="!cardId || !field?.id || !draft.recipientUserIds.length"
        :loading="testing"
        @click="test"
        >测试推送</el-button
      >
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="apply">应用到表单</el-button>
    </template>
    <small
      >测试使用已保存字段的实际最后值、当前选择的接收人与模板。新卡片/字段请先保存；测试结果在“字段推送记录”查看。</small
    >
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { DashboardDeviceCardField } from '@/api/edge-dashboard'
  import {
    defaultDeviceCardPush,
    fetchDeviceCardPushRecipients,
    queueDeviceCardPushTest,
    type DeviceCardPushConfig,
    type DeviceCardPushRecipient
  } from '@/api/device-card-push'

  const props = defineProps<{
    modelValue: boolean
    field: DashboardDeviceCardField | null
    cardId: number
    cardName: string
    lineCode: string
    currentValue?: unknown
  }>()
  const emit = defineEmits<{
    (event: 'update:modelValue', value: boolean): void
    (event: 'apply', value: DeviceCardPushConfig): void
  }>()
  const draft = ref<DeviceCardPushConfig>(defaultDeviceCardPush())
  const recipients = ref<DeviceCardPushRecipient[]>([])
  const loading = ref(false)
  const testing = ref(false)
  const hasLimits = computed(
    () => props.field?.alarmLowerLimit != null || props.field?.alarmUpperLimit != null
  )

  watch(
    () => props.modelValue,
    async (open) => {
      if (!open) return
      const saved = props.field?.push || defaultDeviceCardPush()
      draft.value = { ...saved, recipientUserIds: [...saved.recipientUserIds] }
      if (!hasLimits.value) {
        draft.value.onLimit = false
        draft.value.onRecovery = false
        if (!draft.value.onChange) draft.value.onChange = true
      }
      draft.value.changeThreshold ??= props.field?.traceThreshold
      loading.value = true
      try {
        recipients.value = await fetchDeviceCardPushRecipients()
      } finally {
        loading.value = false
      }
    }
  )

  const preview = computed(() => {
    const raw = props.currentValue
    const value = raw == null ? '—' : typeof raw === 'object' ? JSON.stringify(raw) : String(raw)
    const template =
      draft.value.messageTemplate ||
      '【设备字段通知】{event}\n线体：{line}\n设备：{device}\n字段：{field}\n旧值：{oldValue}\n当前值：{value}{unit}\n范围：{lower} ～ {upper}\n数据时间：{time}'
    const tokens: Record<string, string> = {
      event: '触发时填写',
      line: props.lineCode,
      device: props.cardName,
      field: props.field?.displayName || '',
      oldValue: '触发时填写',
      value: value.slice(0, 500),
      unit: props.field?.unit || '',
      lower: String(props.field?.alarmLowerLimit ?? '—'),
      upper: String(props.field?.alarmUpperLimit ?? '—'),
      time: '实际字段上报时间'
    }
    return template.replace(/\{(\w+)\}/g, (match, key: string) => tokens[key] ?? match)
  })

  const apply = () => {
    const config = draft.value
    if (config.enabled && !config.onChange && !config.onLimit && !config.onRecovery)
      return ElMessage.warning('请至少选择一种触发方式')
    if (config.enabled && config.channel === 'WeChat' && !config.recipientUserIds.length)
      return ElMessage.warning('请选择微信接收人')
    emit('apply', { ...config, recipientUserIds: [...config.recipientUserIds] })
    emit('update:modelValue', false)
  }

  const test = async () => {
    if (!props.field) return
    await ElMessageBox.confirm(
      '将使用该设备的实际最后已知值，向当前选中的微信用户发送测试消息，是否继续？',
      '测试字段推送'
    )
    testing.value = true
    try {
      await queueDeviceCardPushTest({
        cardId: props.cardId,
        fieldCode: props.field.fieldCode,
        recipientUserIds: draft.value.recipientUserIds,
        messageTemplate: draft.value.messageTemplate
      })
      ElMessage.success('测试消息已入队，请在字段推送记录查看结果')
    } finally {
      testing.value = false
    }
  }
</script>

<style scoped lang="scss">
  small {
    display: block;
    width: 100%;
    margin-top: 6px;
    line-height: 1.6;
    color: #8793a6;
  }

  .push-notice {
    margin-bottom: 18px;
  }

  .push-preview {
    width: 100%;
    max-height: 260px;
    padding: 12px;
    margin: 0;
    overflow: auto;
    line-height: 1.6;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    background: #f5f7fa;
  }
</style>
