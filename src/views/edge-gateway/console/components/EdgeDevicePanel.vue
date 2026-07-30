<template>
  <div>
    <div class="toolbar">
      <div class="filters">
        <el-input
          v-model="query.keyword"
          clearable
          placeholder="设备编码、名称或站点"
          class="filter-wide"
          @keyup.enter="loadDevices"
        />
        <el-select v-model="query.onlineStatus" clearable placeholder="在线状态">
          <el-option label="在线" value="Online" />
          <el-option label="离线" value="Offline" />
        </el-select>
        <el-button @click="loadDevices">查询</el-button>
      </div>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>
        新增设备
      </el-button>
    </div>

    <el-table v-loading="loading" :data="devices.records" height="520" stripe>
      <el-table-column label="状态" width="88" fixed>
        <template #default="{ row }">
          <el-tag :type="row.online ? 'success' : 'info'" effect="plain">
            {{ row.online ? '在线' : '离线' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="deviceCode" label="设备编码" min-width="150" show-overflow-tooltip />
      <el-table-column prop="deviceName" label="设备名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="siteName" label="站点" min-width="130" show-overflow-tooltip />
      <el-table-column prop="deviceType" label="类型" width="120" />
      <el-table-column prop="appVersion" label="版本" width="100" />
      <el-table-column prop="configuredIpAddress" label="配置 IP" width="140" />
      <el-table-column prop="ipAddress" label="上报 IP" width="140" />
      <el-table-column label="资源" width="180">
        <template #default="{ row }">
          CPU {{ row.cpuUsage }}% / 内存 {{ row.memoryUsage }}%
        </template>
      </el-table-column>
      <el-table-column prop="queueDepth" label="本地积压" width="100" align="right" />
      <el-table-column label="最后心跳" width="170">
        <template #default="{ row }">{{ formatTime(row.lastHeartbeat) }}</template>
      </el-table-column>
      <el-table-column label="启用" width="82" fixed="right">
        <template #default="{ row }">
          <el-switch v-model="row.enabled" @change="changeEnabled(row)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="removeDevice(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-row">
      <el-pagination
        v-model:current-page="query.current"
        v-model:page-size="query.size"
        layout="total, prev, pager, next"
        :total="devices.total"
        @current-change="loadDevices"
      />
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑设备' : '新增设备'"
      width="560px"
      class="edge-gateway-dialog"
    >
      <el-form label-width="90px">
        <el-form-item label="设备编码" required>
          <el-input v-model="form.deviceCode" :disabled="form.id > 0" />
        </el-form-item>
        <el-form-item label="设备名称" required>
          <el-input v-model="form.deviceName" />
        </el-form-item>
        <el-form-item label="配置 IP">
          <el-input v-model="form.configuredIpAddress" placeholder="IPv4 或 IPv6，可不填" />
        </el-form-item>
        <el-form-item label="站点"><el-input v-model="form.siteName" /></el-form-item>
        <el-form-item label="设备类型"><el-input v-model="form.deviceType" /></el-form-item>
        <el-form-item label="分组"><el-input v-model="form.groupName" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import {
    deleteEdgeDevice,
    fetchEdgeDevices,
    saveEdgeDevice,
    setEdgeDeviceEnabled,
    type EdgeDevice,
    type EdgeDeviceSave
  } from '@/api/edge-gateway'
  import { emptyPage, formatTime } from './shared'

  const emit = defineEmits<{
    'overview-changed': []
  }>()

  const defaultDevice = (): EdgeDeviceSave => ({
    id: 0,
    deviceCode: '',
    deviceName: '',
    siteName: '',
    configuredIpAddress: '',
    deviceType: 'EdgeGateway',
    groupName: '',
    enabled: true
  })

  const devices = reactive(emptyPage<EdgeDevice>())
  const query = reactive({ current: 1, size: 20, keyword: '', onlineStatus: '' })
  const loading = ref(false)
  const saving = ref(false)
  const dialogVisible = ref(false)
  const form = reactive<EdgeDeviceSave>(defaultDevice())

  const loadDevices = async () => {
    loading.value = true
    try {
      Object.assign(devices, await fetchEdgeDevices(query))
    } finally {
      loading.value = false
    }
  }

  const openDialog = (row?: EdgeDevice) => {
    Object.assign(form, defaultDevice(), row || {})
    dialogVisible.value = true
  }

  const submit = async () => {
    if (!form.deviceCode.trim() || !form.deviceName.trim()) {
      ElMessage.warning('请填写设备编码和设备名称')
      return
    }
    if (!isValidIpAddress(form.configuredIpAddress)) {
      ElMessage.warning('配置 IP 不是有效的 IPv4 或 IPv6 地址')
      return
    }

    saving.value = true
    try {
      await saveEdgeDevice(form)
      ElMessage.success('设备已保存')
      dialogVisible.value = false
      await loadDevices()
      emit('overview-changed')
    } finally {
      saving.value = false
    }
  }

  const changeEnabled = async (row: EdgeDevice) => {
    try {
      await setEdgeDeviceEnabled(row.id, row.enabled)
      ElMessage.success('设备状态已更新')
      emit('overview-changed')
    } catch {
      row.enabled = !row.enabled
    }
  }

  const removeDevice = async (row: EdgeDevice) => {
    await ElMessageBox.confirm(
      `确定删除设备“${row.deviceName}”吗？删除后该设备的采集和上传会停止。`,
      '删除设备',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )
    await deleteEdgeDevice(row.id)
    ElMessage.success('设备已删除')
    await loadDevices()
    emit('overview-changed')
  }

  const isValidIpAddress = (input?: string) => {
    const value = input?.trim()
    if (!value) return true
    const ipv4Parts = value.split('.')
    if (
      ipv4Parts.length === 4 &&
      ipv4Parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
    ) {
      return true
    }
    if (!value.includes(':')) return false
    try {
      new URL(`http://[${value}]/`)
      return true
    } catch {
      return false
    }
  }

  defineExpose({ refresh: loadDevices })
</script>
