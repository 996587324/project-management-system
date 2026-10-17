<template>
  <section class="application-admin" v-loading="loading">
    <div class="toolbar"
      ><h2>系统入口与统一授权</h2
      ><el-button @click="$router.push('/portal')">返回控制台</el-button></div
    >
    <el-alert
      title="只有平台管理员可以修改。A/B 的名称、入口和菜单独立；共享中文映射只有一份。授权为空默认拒绝。"
      :closable="false"
    />
    <el-tabs class="mt-4">
      <el-tab-pane label="系统入口与菜单">
        <el-card
          v-for="application in applications"
          :key="application.appCode"
          class="application-card"
        >
          <el-form label-width="110px">
            <el-form-item label="固定系统编码">{{ application.appCode }}</el-form-item>
            <el-form-item label="显示名称"
              ><el-input v-model.trim="application.displayName" maxlength="128"
            /></el-form-item>
            <el-form-item label="固定进入地址"
              ><el-input
                v-model.trim="application.entryUrl"
                placeholder="A：站点/#/portal；B：另一个站点/#/auth/entry"
            /></el-form-item>
            <el-form-item label="首页路径"
              ><el-input v-model.trim="application.homePath"
            /></el-form-item>
            <el-form-item label="启用"><el-switch v-model="application.enabled" /></el-form-item>
            <el-form-item label="所属菜单">
              <el-select
                v-model="menuSelection[application.appCode]"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                style="width: 100%"
              >
                <el-option
                  v-for="menu in availableMenus(application.appCode)"
                  :key="menu.menuId"
                  :value="menu.menuId"
                  :label="`${menu.metaTitle || menu.menuName} (${menu.menuName})`"
                />
              </el-select>
            </el-form-item>
            <el-button type="primary" :loading="saving" @click="saveApplication(application)"
              >保存入口与菜单</el-button
            >
          </el-form>
        </el-card>
      </el-tab-pane>
      <el-tab-pane label="账号授权">
        <el-form label-width="120px">
          <el-form-item label="后台账号">
            <el-select v-model="selectedUser" filterable @change="loadGrants">
              <el-option
                v-for="user in users"
                :key="user.userId"
                :value="user.userId"
                :label="user.userName"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="授权系统"
            ><el-radio-group v-model="selectedCode" @change="selectGrant"
              ><el-radio-button
                v-for="application in applications"
                :key="application.appCode"
                :value="application.appCode"
                >{{ application.displayName }}</el-radio-button
              ></el-radio-group
            ></el-form-item
          >
          <el-form-item label="允许进入"><el-switch v-model="grant.enabled" /></el-form-item>
          <el-form-item v-if="selectedCode === 'A'" label="兼容旧角色"
            ><el-switch v-model="grant.useLegacyPermissions" /><span class="hint"
              >仅 A 可继承原有角色权限</span
            ></el-form-item
          >
          <el-form-item label="业务权限">
            <el-select
              v-model="grant.permissions"
              multiple
              filterable
              allow-create
              collapse-tags
              style="width: 100%"
            >
              <el-option
                v-for="permission in permissions"
                :key="permission"
                :label="permission"
                :value="permission"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="MCP 工具范围">
            <el-select
              v-model="grant.mcpScopes"
              multiple
              filterable
              collapse-tags
              style="width: 100%"
            >
              <el-option v-for="scope in mcpScopes" :key="scope" :label="scope" :value="scope" />
            </el-select>
          </el-form-item>
          <el-form-item label="全部业务资源"
            ><el-switch v-model="grant.allResources" /><span class="hint"
              >显式授权所有线体、项目和设备；非默认开启</span
            ></el-form-item
          >
          <template v-if="!grant.allResources">
            <el-form-item v-for="field in resourceFields" :key="field.key" :label="field.label">
              <el-select
                v-model="grant[field.key]"
                multiple
                filterable
                allow-create
                default-first-option
                collapse-tags
                style="width: 100%"
                :placeholder="field.placeholder"
              >
                <el-option
                  v-for="value in grant[field.key]"
                  :key="value"
                  :label="value"
                  :value="value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="批量授权编码">
              <el-select v-model="batchField"
                ><el-option
                  v-for="field in resourceFields"
                  :key="field.key"
                  :label="field.label"
                  :value="field.key"
              /></el-select>
              <el-input
                v-model="batchCodes"
                type="textarea"
                placeholder="每行一个编码；数据源每行使用 租户|设备，保存时转换为内部复合标识"
              />
              <el-button @click="applyBatch">批量加入</el-button>
            </el-form-item>
          </template>
          <el-button type="primary" :disabled="!selectedUser" :loading="saving" @click="saveGrant"
            >保存当前系统授权</el-button
          >
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import {
    applicationRequest,
    getApplicationCode,
    setApplicationName,
    type ApplicationInfo,
    type ApplicationCode
  } from '@/utils/system-applications/client'

  interface Menu {
    menuId: string
    menuName: string
    metaTitle: string
    component: string
  }
  interface Grant {
    userId: string
    appCode: ApplicationCode
    enabled: boolean
    useLegacyPermissions: boolean
    allResources: boolean
    permissions: string[]
    mcpScopes: string[]
    lineCodes: string[]
    projectCodes: string[]
    deviceCodes: string[]
    sourceKeys: string[]
  }
  type ResourceField = 'lineCodes' | 'projectCodes' | 'deviceCodes' | 'sourceKeys'
  const loading = ref(false)
  const saving = ref(false)
  const applications = ref<ApplicationInfo[]>([])
  const menus = ref<Menu[]>([])
  const users = ref<{ userId: string; userName: string }[]>([])
  const menuSelection = reactive<Record<ApplicationCode, string[]>>({ A: [], B: [] })
  const selectedUser = ref('')
  const selectedCode = ref<ApplicationCode>('A')
  const grants = ref<Grant[]>([])
  const grant = reactive<Grant>(emptyGrant())
  const batchCodes = ref('')
  const batchField = ref<ResourceField>('lineCodes')
  const resourceFields: { key: ResourceField; label: string; placeholder: string }[] = [
    {
      key: 'lineCodes',
      label: '允许线体',
      placeholder: '生产线体编码；工艺线体使用 process:ID（配置页可查 ID）'
    },
    { key: 'projectCodes', label: '允许项目', placeholder: '输入项目编码并回车，也可批量粘贴' },
    { key: 'deviceCodes', label: '允许边缘设备', placeholder: '输入边缘设备编码并回车' },
    { key: 'sourceKeys', label: '允许实时数据源', placeholder: '建议通过下方批量输入 租户|设备' }
  ]
  const permissions = computed(() => [
    ...new Set([
      ...menus.value.map((item) => item.menuName),
      '*',
      'shared-dictionary.read',
      'shared-dictionary.write',
      'source.read'
    ])
  ])
  const mcpScopes = [
    '*',
    'dashboard.read',
    'device-card.read',
    'device-history.read',
    'device-alert.read',
    'device-alert.write',
    'project.read',
    'edge.overview.read',
    'edge.device.read',
    'edge.queue.read',
    'edge.event.read',
    'user.audit.read',
    'clawbot.read',
    'clawbot.write'
  ]

  function emptyGrant(): Grant {
    return {
      userId: '',
      appCode: 'A',
      enabled: false,
      useLegacyPermissions: false,
      allResources: false,
      permissions: [],
      mcpScopes: [],
      lineCodes: [],
      projectCodes: [],
      deviceCodes: [],
      sourceKeys: []
    }
  }

  function availableMenus(code: ApplicationCode) {
    return code === 'A'
      ? menus.value.filter((item) => !item.menuName.startsWith('SystemB'))
      : menus.value.filter((item) => item.menuName !== 'SystemBSharedModelDictionary')
  }

  onMounted(async () => {
    loading.value = true
    try {
      const data = await applicationRequest<{
        applications: ApplicationInfo[]
        users: typeof users.value
        menus: Menu[]
        applicationMenus: { appCode: ApplicationCode; menuId: string }[]
      }>('/api/system-applications/administration')
      applications.value = data.applications
      users.value = data.users
      menus.value = data.menus
      for (const code of ['A', 'B'] as const)
        menuSelection[code] = data.applicationMenus
          .filter((item) => item.appCode === code)
          .map((item) => item.menuId)
    } catch (error) {
      ElMessage.error((error as Error).message)
    } finally {
      loading.value = false
    }
  })

  async function saveApplication(application: ApplicationInfo) {
    saving.value = true
    try {
      await applicationRequest('/api/system-applications/configuration', application)
      await applicationRequest(
        `/api/system-applications/menus/${application.appCode}`,
        menuSelection[application.appCode]
      )
      if (application.appCode === getApplicationCode()) setApplicationName(application.displayName)
      ElMessage.success('系统配置已保存；菜单授权下次进入系统生效')
    } catch (error) {
      ElMessage.error((error as Error).message)
    } finally {
      saving.value = false
    }
  }

  async function loadGrants() {
    try {
      grants.value = await applicationRequest<Grant[]>(
        `/api/system-applications/grants/${encodeURIComponent(selectedUser.value)}`
      )
      selectGrant()
    } catch (error) {
      ElMessage.error((error as Error).message)
    }
  }

  function selectGrant() {
    const existing = grants.value.find((item) => item.appCode === selectedCode.value)
    Object.assign(grant, emptyGrant(), existing ? JSON.parse(JSON.stringify(existing)) : {}, {
      userId: selectedUser.value,
      appCode: selectedCode.value
    })
  }

  function applyBatch() {
    const values = batchCodes.value
      .split(/[\r\n,，;；]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => (batchField.value === 'sourceKeys' ? item.replace('|', '\u001f') : item))
    grant[batchField.value] = [...new Set([...grant[batchField.value], ...values])]
    batchCodes.value = ''
  }

  async function saveGrant() {
    saving.value = true
    try {
      await applicationRequest('/api/system-applications/grants', grant)
      await loadGrants()
      ElMessage.success('授权已保存；撤销后已有令牌也会拒绝访问')
    } catch (error) {
      ElMessage.error((error as Error).message)
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .application-admin {
    padding: 20px;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
  }
  .application-card {
    margin: 18px 0;
  }
  .hint {
    margin-left: 12px;
    color: var(--el-text-color-secondary);
  }
</style>
