<template>
  <div class="settings" v-loading="loading"
    ><div class="toolbar"><h2>工作任务设置</h2><el-button @click="load">刷新</el-button></div
    ><el-alert
      title="应用准入、业务角色和任务办理权分别校验。平台管理员可配置首位任务管理员，不因此获得全部任务内容。"
      type="info"
      :closable="false"
    />
    <el-tabs v-if="data">
      <el-tab-pane label="工作组与成员">
        <el-form inline class="toolbar"
          ><el-form-item label="工作组名称"
            ><el-input v-model="group.name" maxlength="120" /></el-form-item
          ><el-form-item label="上级组"
            ><WorkChoicePicker
              v-model="group.parentId"
              title="选择上级工作组"
              :options="workGroupChoices(data.groups.filter((x) => x.id !== group.id))"
              clearable /></el-form-item
          ><el-form-item label="负责人"
            ><WorkPersonPicker
              v-model="group.leaderId"
              title="选择工作组负责人"
              purpose="admin-user"
              clearable /></el-form-item
          ><el-button type="primary" @click="saveGroup">{{
            group.id ? '更新工作组' : '新增工作组'
          }}</el-button
          ><el-button @click="resetGroup">清空</el-button></el-form
        >
        <el-table :data="data.groups"
          ><el-table-column prop="name" label="工作组" /><el-table-column label="负责人"
            ><template #default="{ row }">{{ person(row.leaderId) }}</template></el-table-column
          ><el-table-column label="状态"
            ><template #default="{ row }">{{
              row.enabled ? '启用' : '停用'
            }}</template></el-table-column
          ><el-table-column label="操作"
            ><template #default="{ row }"
              ><el-button text @click="Object.assign(group, row)">编辑</el-button
              ><el-button text @click="save('groups', { ...row, enabled: !row.enabled })">{{
                row.enabled ? '停用' : '启用'
              }}</el-button></template
            ></el-table-column
          ></el-table
        >
        <h3>成员</h3
        ><div class="toolbar"
          ><WorkChoicePicker
            v-model="member.groupId"
            title="选择成员所属工作组"
            placeholder="选择工作组"
            :options="workGroupChoices(data.groups)"
          /><WorkPersonPicker
            v-model="member.userId"
            title="选择工作组成员"
            purpose="admin-user"
          /><el-button type="primary" @click="save('members', member)"
            >添加 / 恢复成员</el-button
          ></div
        >
        <el-table :data="data.members"
          ><el-table-column label="工作组"
            ><template #default="{ row }">{{ groupName(row.groupId) }}</template></el-table-column
          ><el-table-column label="成员"
            ><template #default="{ row }">{{ person(row.userId) }}</template></el-table-column
          ><el-table-column label="状态"
            ><template #default="{ row }">{{
              row.enabled ? '有效' : '已移出'
            }}</template></el-table-column
          ><el-table-column label="操作"
            ><template #default="{ row }"
              ><el-button text @click="save('members', { ...row, enabled: !row.enabled })">{{
                row.enabled ? '移出' : '恢复'
              }}</el-button></template
            ></el-table-column
          ></el-table
        >
      </el-tab-pane>
      <el-tab-pane label="业务角色与范围"
        ><el-alert
          title="每一行授权绑定一个角色和范围。例如维修组主管与生产组员工，不会组合成生产组主管。任务查看为只读；下派和验收须另行授权。成员加入工作组后，还需授予执行员工角色才能接任务。"
          :closable="false"
        />
        <el-form label-width="115px" class="grant-form"
          ><el-form-item label="人员"
            ><WorkPersonPicker
              v-model="grant.userId"
              title="选择授权人员"
              purpose="admin-user" /></el-form-item
          ><el-form-item label="业务角色"
            ><el-select v-model="grant.role" @change="roleChanged"
              ><el-option
                v-for="(label, key) in roles"
                :key="key"
                :label="label"
                :value="key" /></el-select></el-form-item
          ><el-form-item label="适用范围"
            ><el-select v-model="grant.scope"
              ><el-option v-if="grant.role === 'worker'" label="本人相关" value="Self" /><el-option
                label="指定人员"
                value="User" /><el-option label="指定工作组" value="Group" /><el-option
                label="工作组及下级"
                value="GroupTree" /><el-option
                v-if="data.canConfigureGlobal"
                label="本应用全模块"
                value="All" /></el-select></el-form-item
          ><el-form-item v-if="['Group', 'GroupTree'].includes(grant.scope)" label="工作组"
            ><WorkChoicePicker
              v-model="grant.targetId"
              title="选择授权工作组"
              :options="workGroupChoices(data.groups)" /></el-form-item
          ><el-form-item v-if="grant.scope === 'User'" label="目标人员"
            ><WorkPersonPicker
              v-model="grant.targetId"
              title="选择授权目标人员"
              purpose="admin-user" /></el-form-item
          ><el-form-item label="有效至"
            ><el-date-picker
              v-model="grant.expiresAtUtc"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ssZ"
              placeholder="留空长期有效"
              clearable /></el-form-item
          ><el-button type="primary" @click="save('grants', grant)"
            >保存配对授权</el-button
          ></el-form
        >
        <el-table :data="data.grants"
          ><el-table-column label="人员"
            ><template #default="{ row }">{{ person(row.userId) }}</template></el-table-column
          ><el-table-column label="角色"
            ><template #default="{ row }">{{ roles[row.role] }}</template></el-table-column
          ><el-table-column label="范围"
            ><template #default="{ row }"
              >{{ scopes[row.scope] }}
              {{
                row.scope.startsWith('Group')
                  ? groupName(row.targetId)
                  : row.scope === 'User'
                    ? person(row.targetId)
                    : ''
              }}</template
            ></el-table-column
          ><el-table-column label="有效至"
            ><template #default="{ row }">{{
              workDate(row.expiresAtUtc)
            }}</template></el-table-column
          ><el-table-column label="状态"
            ><template #default="{ row }">{{
              row.enabled ? '有效' : '撤销'
            }}</template></el-table-column
          ><el-table-column label="操作"
            ><template #default="{ row }"
              ><el-button text @click="save('grants', { ...row, enabled: !row.enabled })">{{
                row.enabled ? '撤销' : '恢复'
              }}</el-button></template
            ></el-table-column
          ></el-table
        >
      </el-tab-pane>
      <el-tab-pane label="责任交接"
        ><el-alert
          title="仅显示交接所需的任务编号与责任信息，不授予任务正文访问权。员工或领导停用后，可明确交给已有授权的新负责人。"
          :closable="false" /><el-table :data="data.handovers || []"
          ><el-table-column prop="taskId" label="任务编号" min-width="220" /><el-table-column
            label="主责员工"
            ><template #default="{ row }">{{ person(row.assigneeId) }}</template></el-table-column
          ><el-table-column label="下派负责人"
            ><template #default="{ row }">{{ person(row.dispatcherId) }}</template></el-table-column
          ><el-table-column label="操作"
            ><template #default="{ row }"
              ><el-button
                text
                @click="
                  handover?.open({
                    id: row.taskId,
                    version: row.version,
                    dispatcherId: row.dispatcherId,
                    reviewerId: row.reviewerId,
                    summaryLeaderId: row.summaryLeaderId
                  })
                "
                >交接管理责任</el-button
              ></template
            ></el-table-column
          ></el-table
        ><WorkManagementHandover ref="handover" :users="data.users" @changed="load"
      /></el-tab-pane>
      <el-tab-pane v-if="data.canConfigureGlobal" label="任务推送与日终"
        ><el-alert
          title="配置微信和邮件通道后，下派时可选择推送；日终汇总可单独启用。外部通道仅发送提醒和状态数量，详细内容请登录系统查看。"
          type="warning"
          :closable="false"
        />
        <el-form label-width="150px" class="grant-form"
          ><el-form-item label="启用日终"><el-switch v-model="rule.enabled" /></el-form-item
          ><el-form-item label="生成时间"
            ><el-time-select
              v-model="rule.dailyTime"
              start="00:00"
              step="00:15"
              end="23:45" /></el-form-item
          ><el-form-item label="时区"><el-input v-model="rule.timeZone" /></el-form-item
          ><el-form-item label="工作日"
            ><WorkChoicePicker
              v-model="days"
              title="选择工作日"
              :options="weekdayOptions"
              multiple /></el-form-item
          ><el-form-item label="额外工作日期"
            ><el-input
              v-model="rule.includedDates"
              placeholder="例如 2026-10-31，多个日期用英文逗号分隔" /></el-form-item
          ><el-form-item label="不生成日期"
            ><el-input
              v-model="rule.excludedDates"
              placeholder="休息日或例外日期，格式 yyyy-MM-dd" /></el-form-item
          ><el-form-item label="员工接收范围"
            ><el-select v-model="rule.employeeAudience"
              ><el-option label="有进行中任务或当天变化" value="ActiveOrChanged" /><el-option
                label="仅当天已完成任务员工"
                value="CompletedToday" /></el-select></el-form-item
          ><el-form-item label="推送通道"
            ><el-checkbox-group v-model="channels"
              ><el-checkbox value="Inbox">站内</el-checkbox
              ><el-checkbox value="Email">邮件</el-checkbox
              ><el-checkbox value="WeChat">微信</el-checkbox></el-checkbox-group
            ></el-form-item
          ><el-form-item label="重启补发窗口"
            ><el-input-number v-model="rule.catchUpMinutes" :min="1" :max="1440" />
            分钟</el-form-item
          ><el-button type="primary" @click="saveRule">保存推送设置</el-button></el-form
        >
      </el-tab-pane>
      <el-tab-pane v-if="data.canConfigureGlobal" label="投递状态"
        ><div v-if="data.health" class="toolbar"
          ><el-tag>待处理事件 {{ data.health.pendingEvents }}</el-tag
          ><el-tag>待投递 {{ data.health.pendingDeliveries }}</el-tag
          ><el-tag type="danger">失败 {{ data.health.failedDeliveries }}</el-tag
          ><el-tag type="warning">待核实 {{ data.health.unknownDeliveries }}</el-tag
          ><span>最近日报 {{ workDate(data.health.lastDigestAtUtc) }}</span
          ><span
            >已归档附件 {{ (data.health.registeredFileBytes / 1024 / 1024).toFixed(1) }} MB</span
          ></div
        ><el-table :data="data.deliveries"
          ><el-table-column prop="channel" label="通道" /><el-table-column label="视角"
            ><template #default="{ row }">{{
              row.perspective === 'Leader' ? '领导' : '员工'
            }}</template></el-table-column
          ><el-table-column prop="status" label="状态" /><el-table-column
            prop="error"
            label="异常"
            min-width="250"
          /><el-table-column label="生成时间"
            ><template #default="{ row }">{{
              workDate(row.createdAtUtc)
            }}</template></el-table-column
          ><el-table-column label="操作"
            ><template #default="{ row }"
              ><el-button v-if="row.status === 'Failed'" text @click="retry(row.id)"
                >重试明确失败的投递</el-button
              ></template
            ></el-table-column
          ></el-table
        ></el-tab-pane
      >
    </el-tabs>
  </div>
</template>
<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import WorkManagementHandover from '../components/WorkManagementHandover.vue'
  import WorkChoicePicker from '@/components/business/work-choice-picker/index.vue'
  import WorkPersonPicker from '../components/WorkPersonPicker.vue'
  import { workGroupChoices } from '../components/work-choices'
  const handover = ref<InstanceType<typeof WorkManagementHandover>>()
  import {
    workApi,
    workDate,
    type WorkAdministration,
    type WorkGrant,
    type WorkRule
  } from '@/api/work-tasks'
  const loading = ref(false)
  const data = ref<WorkAdministration>()
  const group = reactive({
    id: undefined as string | undefined,
    name: '',
    parentId: null as string | null,
    leaderId: null as string | null,
    enabled: true
  })
  const member = reactive({ groupId: '', userId: '', enabled: true })
  const grant = reactive<WorkGrant>({
    userId: '',
    role: 'worker',
    scope: 'Self',
    targetId: null,
    enabled: true,
    expiresAtUtc: null
  })
  const roles: Record<string, string> = {
    worker: '执行员工',
    dispatcher: '派发主管',
    supervisor: '任务查看（只读）',
    'work-admin': '工作任务管理员'
  }
  const scopes: Record<string, string> = {
    Self: '本人',
    User: '指定人员',
    Group: '本组',
    GroupTree: '含下级组',
    All: '全模块'
  }
  const rule = reactive<WorkRule>({
    includedDates: '',
    excludedDates: '',
    enabled: false,
    timeZone: 'Asia/Shanghai',
    dailyTime: '17:00',
    weekDays: '1,2,3,4,5',
    employeeAudience: 'ActiveOrChanged',
    channels: 'Inbox',
    catchUpMinutes: 120
  })
  const weekdayOptions = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map(
    (label, index) => ({ value: String(index), label })
  )
  const days = ref(['1', '2', '3', '4', '5'])
  const channels = ref(['Inbox'])
  const person = (id?: string) => data.value?.users.find((x) => x.userId === id)?.name || id || '—'
  const groupName = (id?: string) => data.value?.groups.find((x) => x.id === id)?.name || id || '—'
  async function load() {
    loading.value = true
    try {
      data.value = await workApi.admin()
      if (data.value.rule) {
        Object.assign(rule, data.value.rule)
        days.value = rule.weekDays.split(',')
        channels.value = rule.channels.split(',')
      }
    } finally {
      loading.value = false
    }
  }
  async function save(kind: string, value: unknown) {
    await workApi.saveAdmin(kind, value)
    ElMessage.success('设置已保存')
    await load()
  }
  function resetGroup() {
    Object.assign(group, { id: undefined, name: '', parentId: null, leaderId: null, enabled: true })
  }
  async function saveGroup() {
    await save('groups', group)
    resetGroup()
  }
  function roleChanged() {
    if (grant.role !== 'worker' && grant.scope === 'Self') grant.scope = 'Group'
  }
  async function saveRule() {
    rule.weekDays = days.value.join(',')
    rule.channels = Array.from(new Set([...channels.value, 'Inbox'])).join(',')
    await save('notification-rule', rule)
  }
  async function retry(id: string) {
    await workApi.retryDelivery(id)
    ElMessage.success('已重新进入队列')
    await load()
  }
  onMounted(load)
</script>
<style scoped lang="scss">
  .settings {
    padding: 20px;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin: 16px 0;
  }

  .toolbar h2 {
    margin-right: auto;
  }

  .grant-form {
    max-width: 700px;
    margin: 20px 0;
  }

  .grant-form .el-select {
    width: 100%;
  }
</style>
