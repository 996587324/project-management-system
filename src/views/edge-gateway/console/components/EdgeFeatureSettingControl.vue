<template>
  <div class="feature-setting-control" :class="{ 'is-disabled': ready && !enabled }">
    <span class="feature-status-dot" aria-hidden="true"></span>
    <span class="feature-status-text">
      {{ ready ? (enabled ? '边缘计算已开启' : '边缘计算已关闭') : '正在读取功能状态' }}
    </span>
    <el-switch
      v-if="canManage"
      v-model="enabled"
      :loading="loading || saving"
      :disabled="!ready || saving"
      inline-prompt
      active-text="开"
      inactive-text="关"
      @change="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { fetchEdgeGatewayFeatureSetting, saveEdgeGatewayFeatureSetting } from '@/api/edge-gateway'
  import { useUserStore } from '@/store/modules/user'

  const emit = defineEmits<{
    stateChange: [enabled: boolean]
  }>()

  const userStore = useUserStore()
  const enabled = ref(true)
  const ready = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const canManage = computed(() => {
    const roles = userStore.info.roles || []
    const permissions = userStore.info.permissionKeys || []
    return roles.includes('R_SUPER') || roles.includes('R_ADMIN') || permissions.includes('*')
  })

  const loadSetting = async () => {
    loading.value = true
    try {
      const setting = await fetchEdgeGatewayFeatureSetting()
      enabled.value = setting.enabled
    } catch {
      // 请求层会展示错误，保留默认开启状态以兼容尚未升级接口的环境。
    } finally {
      loading.value = false
      ready.value = true
      emit('stateChange', enabled.value)
    }
  }

  const handleChange = async (nextEnabled: string | number | boolean) => {
    const targetEnabled = Boolean(nextEnabled)
    const previousEnabled = !targetEnabled
    try {
      await ElMessageBox.confirm(
        targetEnabled
          ? '开启后将恢复 WebSocket 采集、实时数据接收及 B 系统转发，是否继续？'
          : '关闭后将暂停 WebSocket 采集、实时数据接收及 B 系统转发，现有连接将在配置同步周期内释放，是否继续？',
        targetEnabled ? '开启边缘计算中心' : '关闭边缘计算中心',
        {
          type: targetEnabled ? 'success' : 'warning',
          confirmButtonText: '确定',
          cancelButtonText: '取消'
        }
      )

      saving.value = true
      const setting = await saveEdgeGatewayFeatureSetting({
        enabled: targetEnabled,
        updatedBy: userStore.info.userName
      })
      enabled.value = setting.enabled
      emit('stateChange', setting.enabled)
      ElMessage.success(setting.enabled ? '边缘计算中心已开启' : '边缘计算中心已关闭')
    } catch (error) {
      enabled.value = previousEnabled
      // 请求层负责展示接口错误；取消确认时只恢复开关的原状态。
      if (error === 'cancel' || error === 'close') return
    } finally {
      saving.value = false
    }
  }

  onMounted(() => void loadSetting())
</script>
