<template>
  <div class="keys" v-loading="loading"
    ><h2>个人 MCP 连接</h2
    ><el-alert
      title="凭证以创建人的身份访问工作任务。勾选团队查看后，客户端可读取该人员当前授权范围内的任务；明文只显示一次，请妥善保存。"
      type="info"
      :closable="false"
    />
    <el-form label-width="110px" class="key-form"
      ><el-form-item label="MCP 地址"
        ><el-input :model-value="endpoint" readonly /><el-button text @click="copy(endpoint)"
          >复制地址</el-button
        ></el-form-item
      ><el-form-item label="客户端名称"
        ><el-input
          v-model="form.label"
          maxlength="80"
          placeholder="便于单独撤销，例如个人工作助手" /></el-form-item
      ><el-form-item label="有效天数"
        ><el-input-number v-model="form.days" :min="1" :max="90" /></el-form-item
      ><el-form-item label="允许能力"
        ><el-checkbox-group v-model="scopes"
          ><el-checkbox value="read" disabled>读取本人任务</el-checkbox
          ><el-checkbox v-if="canTeam" value="team_read">按授权范围查看团队任务</el-checkbox
          ><el-checkbox v-if="canDispatch" value="dispatch">创建和下派工作任务</el-checkbox
          ><el-checkbox v-if="canWork" value="assess">评估与承诺排期</el-checkbox
          ><el-checkbox v-if="canWork" value="report">提交进展</el-checkbox
          ><el-checkbox v-if="canWork" value="upload">上传文件</el-checkbox
          ><el-checkbox v-if="canWork" value="submit">成果草稿及正式提交</el-checkbox
          ><el-checkbox value="download">读取附件内容</el-checkbox></el-checkbox-group
        ></el-form-item
      ><el-alert
        v-if="scopes.includes('submit')"
        title="允许正式提交后，客户端可以代表你提交成果。请在实际客户端确认本次内容；验收仍按任务规则处理。"
        type="warning"
        :closable="false"
      /><el-alert
        v-if="scopes.includes('dispatch')"
        title="客户端可在你的授权范围内创建草稿并下派，请确认任务内容后再正式下派。"
        type="warning"
        :closable="false"
      /><el-button type="primary" @click="create">创建个人凭证</el-button></el-form
    >
    <p
      >团队查看范围由工作设置中的有效授权决定，授权变更后立即生效。已有凭证不会自动获得团队查看能力，需要时请重新创建并更新客户端。</p
    >
    <p
      >支持自定义请求头的客户端：设置 Authorization: Bearer
      你的个人凭证。此凭证属于本系统，不是模型平台密钥。仅支持 OAuth
      登录的客户端需要相应授权适配。</p
    ><p
      >上传需要客户端读取真实文件；可使用受控 HTTPS
      上传或小文件工具。凭证失效不会影响已保留的历史汇报。</p
    >
    <el-table :data="keys"
      ><el-table-column prop="label" label="客户端" /><el-table-column
        prop="scopes"
        label="允许操作"
        min-width="220"
      /><el-table-column label="有效至"
        ><template #default="{ row }">{{ workDate(row.expiresAtUtc) }}</template></el-table-column
      ><el-table-column label="最近使用"
        ><template #default="{ row }">{{ workDate(row.lastUsedAtUtc) }}</template></el-table-column
      ><el-table-column label="操作"
        ><template #default="{ row }"
          ><el-tag v-if="row.revokedAtUtc">已撤销</el-tag
          ><el-button v-else type="danger" text @click="revoke(row.id)">撤销</el-button></template
        ></el-table-column
      ></el-table
    >
    <h3>最近的个人 MCP 调用</h3><el-button text @click="load">刷新记录</el-button>
    <el-table :data="activity"
      ><el-table-column label="时间"
        ><template #default="{ row }">{{ workDate(row.createdAtUtc) }}</template></el-table-column
      ><el-table-column label="客户端"
        ><template #default="{ row }">{{
          keys.find((x) => x.id === usage(row.summary).keyId)?.label || '历史凭证'
        }}</template></el-table-column
      ><el-table-column label="工具"
        ><template #default="{ row }">{{ usage(row.summary).tool }}</template></el-table-column
      ><el-table-column label="结果"
        ><template #default="{ row }">{{
          usage(row.summary).success ? '成功' : '拒绝或参数无效'
        }}</template></el-table-column
      ></el-table
    >
    <el-dialog
      v-model="secretVisible"
      title="请保存个人凭证，仅本次显示"
      width="min(650px,95vw)"
      :close-on-click-modal="false"
      @closed="secret = ''"
      ><el-input :model-value="secret" type="password" show-password readonly /><el-button
        type="primary"
        @click="copy(secret)"
        >复制凭证</el-button
      ><p>关闭后无法再次读取明文。需要更换时，创建新凭证、更新客户端，再撤销旧凭证。</p></el-dialog
    >
  </div>
</template>
<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { workApi, workDate, type WorkKey } from '@/api/work-tasks'
  import { getApiUrl } from '@/utils/runtime-config'
  const loading = ref(false)
  const canTeam = ref(false)
  const canWork = ref(false)
  const canDispatch = ref(false)
  const keys = ref<WorkKey[]>([])
  const activity = ref<{ id: string; createdAtUtc: string; summary: string }[]>([])
  function usage(summary: string): { keyId?: string; tool?: string; success?: boolean } {
    try {
      return JSON.parse(summary)
    } catch {
      return {}
    }
  }
  const form = reactive({ label: '', days: 30 })
  const scopes = ref(['read', 'assess', 'report', 'upload'])
  const secret = ref('')
  const secretVisible = ref(false)
  const endpoint = new URL(getApiUrl('/mcp/work-tasks'), window.location.origin).toString()
  async function load() {
    loading.value = true
    try {
      const [keyRows, history, bootstrap] = await Promise.all([
        workApi.keys(),
        workApi.keyActivity(),
        workApi.bootstrap()
      ])
      keys.value = keyRows
      activity.value = history
      canTeam.value = bootstrap.canTeam
      canWork.value = !!bootstrap.canWork
      canDispatch.value = bootstrap.canDispatch
      if (!canWork.value)
        scopes.value = scopes.value.filter(
          (item) => !['assess', 'report', 'upload', 'submit'].includes(item)
        )
      if (!canTeam.value) scopes.value = scopes.value.filter((item) => item !== 'team_read')
      if (!canDispatch.value) scopes.value = scopes.value.filter((item) => item !== 'dispatch')
    } finally {
      loading.value = false
    }
  }
  async function create() {
    loading.value = true
    try {
      const result = await workApi.createKey({
        ...form,
        scopes: Array.from(new Set(['read', ...scopes.value])).join(',')
      })
      secret.value = result.secret
      secretVisible.value = true
      await load()
    } finally {
      loading.value = false
    }
  }
  async function revoke(id: string) {
    await ElMessageBox.confirm('撤销后，使用该凭证的客户端将立即停止访问。', '撤销个人凭证')
    await workApi.revokeKey(id)
    await load()
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      ElMessage.success('已复制')
    } catch {
      ElMessage.warning('无法自动复制，请手动选择复制')
    }
  }
  onMounted(load)
</script>
<style scoped lang="scss">
  .keys {
    padding: 20px;
  }

  .key-form {
    max-width: 800px;
    margin: 20px 0;
  }

  .key-form .el-button {
    margin: 12px 0;
  }
</style>
