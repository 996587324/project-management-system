<template>
  <el-dialog v-model="visible" title="工艺参数配置" width="min(1050px, 95vw)" destroy-on-close>
    <el-form label-width="120px">
      <el-row :gutter="16">
        <el-col :span="12"
          ><el-form-item label="字段编码"
            ><el-input v-model.trim="field.code" maxlength="64" /></el-form-item
        ></el-col>
        <el-col :span="12"
          ><el-form-item label="Key 名称"
            ><el-input v-model.trim="field.name" maxlength="128" /></el-form-item
        ></el-col>
      </el-row>
      <el-tabs>
        <el-tab-pane label="数据与展示">
          <el-form-item label="数据类型">
            <el-radio-group v-model="fixed"
              ><el-radio :value="false">绑定字段</el-radio
              ><el-radio :value="true">固定文本</el-radio></el-radio-group
            >
          </el-form-item>
          <el-form-item label="Value 来源">
            <el-input v-if="fixed" v-model="field.fixedText" placeholder="工艺设定值或文字说明" />
            <SourceBindingEditor
              v-else
              v-model="field.source"
              :process-line-id="processLineId"
              :allowed-devices="allowedDevices"
              @field="applyMapping"
            />
          </el-form-item>
          <el-row :gutter="16">
            <el-col :span="12"
              ><el-form-item label="单位"
                ><el-input v-model="field.unit" maxlength="32" /></el-form-item
            ></el-col>
            <el-col :span="12"
              ><el-form-item label="显示小数位"
                ><el-input-number v-model="field.precision" :min="0" :max="12" /></el-form-item
            ></el-col>
          </el-row>
        </el-tab-pane>
        <el-tab-pane label="mXparser 公式">
          <el-alert
            title="x 为当前原始值。支持 mXparser 数学函数、条件、求和等，不限四则运算。公式在后端执行，不执行脚本。"
            :closable="false"
          />
          <el-form-item label="公式"
            ><el-input
              v-model="field.formula"
              type="textarea"
              :rows="3"
              placeholder="例如 if(x > 100, sqrt(x), x / 10)；留空直接显示原值"
          /></el-form-item>
          <el-form-item label="采样时重算"
            ><el-switch v-model="field.recalculateEverySample" /><span class="tip"
              >随机公式可开启；否则仅输入或配置变化时计算</span
            ></el-form-item
          >
          <el-form-item label="自定义函数"
            ><el-input
              v-model="functionsText"
              type="textarea"
              :rows="3"
              placeholder="每行一个，例如 f(a)=a^2+1"
          /></el-form-item>
          <el-form-item label="数学常量"
            ><el-input
              v-model="constantsText"
              type="textarea"
              :rows="2"
              placeholder='JSON，例如 {"target":100}'
          /></el-form-item>
          <div v-for="(binding, name) in field.variables" :key="name" class="variable-row">
            <el-tag>{{ name }}</el-tag
            ><SourceBindingEditor
              v-model="field.variables[name]"
              :process-line-id="processLineId"
              :allowed-devices="allowedDevices"
            /><el-button link type="danger" @click="removeVariable(String(name))">移除</el-button>
          </div>
          <el-form-item label="新增变量"
            ><el-input
              v-model.trim="variableName"
              placeholder="英文变量名，例如 actual"
            /><el-button @click="addVariable">添加</el-button></el-form-item
          >
          <el-form-item label="测试变量值"
            ><el-input
              v-model="testValues"
              type="textarea"
              :rows="2"
              placeholder='{"x":25,"actual":80}'
          /></el-form-item>
          <el-form-item
            ><el-button :loading="previewing" @click="preview">检查并试算</el-button
            ><span class="tip">{{ previewResult }}</span></el-form-item
          >
        </el-tab-pane>
        <el-tab-pane label="上下限与历史">
          <el-alert
            title="圆点按展示值判断：超限红色、正常绿色，无范围或无效值灰色。变化阈值不影响实时显示。"
            :closable="false"
          />
          <el-form-item label="下限"
            ><el-input-number
              v-model="field.lowerLimit"
              :controls="false"
              placeholder="可不填"
            /><el-button link @click="field.lowerLimit = null">清空</el-button></el-form-item
          >
          <el-form-item label="上限"
            ><el-input-number
              v-model="field.upperLimit"
              :controls="false"
              placeholder="可不填"
            /><el-button link @click="field.upperLimit = null">清空</el-button></el-form-item
          >
          <el-form-item label="比较小数位"
            ><el-input-number v-model="field.comparisonPrecision" :min="0" :max="12"
          /></el-form-item>
          <el-form-item label="曲线采样"
            ><el-switch v-model="field.trendEnabled" /><span class="tip"
              >后台连续采样，不依赖网页打开</span
            ></el-form-item
          >
          <el-form-item label="变化追溯"><el-switch v-model="field.traceEnabled" /></el-form-item>
          <el-form-item label="追溯原始值"
            ><el-switch v-model="field.traceRawValue" /><span class="tip"
              >关闭时按计算后的展示值追溯</span
            ></el-form-item
          >
          <el-form-item label="变化阈值"
            ><el-input-number v-model="field.changeThreshold" :min="0" :controls="false" /><span
              class="tip"
              >0：变化就记录；数值差达到阈值才记录</span
            ></el-form-item
          >
        </el-tab-pane>
        <el-tab-pane label="微信推送">
          <el-form-item label="开启推送"><el-switch v-model="field.pushEnabled" /></el-form-item>
          <el-form-item label="触发条件"
            ><el-checkbox v-model="field.pushOnChange">变化达到阈值</el-checkbox
            ><el-checkbox v-model="field.pushOnLimit">超出上下限</el-checkbox
            ><el-checkbox v-model="field.pushOnRecovery">恢复正常</el-checkbox></el-form-item
          >
          <el-form-item label="指定接收人"
            ><el-select v-model="field.recipientUserIds" multiple filterable style="width: 100%">
              <el-option
                v-for="user in recipients"
                :key="user.userId"
                :value="user.userId"
                :disabled="!user.selectable"
                :label="`${user.userName} · ${user.status}`"
              /> </el-select
          ></el-form-item>
          <el-alert
            title="推送进入现有微信聚合队列，同一接收人合并发送。发送频率在工艺看板全局设置中配置，与旧设备卡片共享。"
            :closable="false"
          />
        </el-tab-pane>
      </el-tabs>
    </el-form>
    <template #footer
      ><el-button @click="visible = false">取消</el-button
      ><el-button type="primary" @click="save">应用到卡片</el-button></template
    >
  </el-dialog>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import {
    emptyBinding,
    emptyField,
    processApi,
    type ProcessField,
    type SourceField,
    type SourceBinding
  } from '@/api/process-board'
  import SourceBindingEditor from './SourceBindingEditor.vue'

  const visible = defineModel<boolean>({ required: true })
  const props = defineProps<{
    value: ProcessField
    processLineId?: number
    allowedDevices?: SourceBinding[]
  }>()
  const emit = defineEmits<{ save: [value: ProcessField] }>()
  const field = ref(emptyField())
  const fixed = ref(false)
  const functionsText = ref('')
  const constantsText = ref('{}')
  const variableName = ref('')
  const testValues = ref('{"x":25}')
  const previewing = ref(false)
  const previewResult = ref('')
  const recipients = ref<Awaited<ReturnType<typeof processApi.recipients>>>([])

  watch(visible, async (open) => {
    if (!open) return
    field.value = JSON.parse(JSON.stringify(props.value))
    fixed.value = field.value.fixedText != null
    functionsText.value = field.value.functions.join('\n')
    constantsText.value = JSON.stringify(field.value.constants)
    previewResult.value = ''
    recipients.value = await processApi.recipients()
  })

  function applyMapping(value: SourceField) {
    if (!field.value.name) field.value.name = value.fieldName
    if (!field.value.unit) field.value.unit = value.unit || ''
    if (value.decimals != null) field.value.precision = value.decimals
  }

  function addVariable() {
    const name = variableName.value
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || name === 'x' || name in field.value.variables) {
      ElMessage.warning('请输入不重复的英文变量名，x 已保留')
      return
    }
    field.value.variables[name] = emptyBinding()
    variableName.value = ''
  }

  function removeVariable(name: string) {
    delete field.value.variables[name]
  }

  function syncFormula() {
    const constants: unknown = JSON.parse(constantsText.value)
    if (
      !constants ||
      Array.isArray(constants) ||
      typeof constants !== 'object' ||
      Object.values(constants).some((value) => typeof value !== 'number' || !Number.isFinite(value))
    ) {
      throw new Error('常量必须是变量名与有限数值组成的 JSON 对象')
    }
    field.value.constants = constants as Record<string, number>
    field.value.functions = functionsText.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  async function preview() {
    previewing.value = true
    try {
      syncFormula()
      const result = await processApi.preview({
        formula: field.value.formula,
        variables: JSON.parse(testValues.value),
        constants: field.value.constants,
        functions: field.value.functions
      })
      previewResult.value = result.success
        ? `计算结果：${result.value}`
        : result.error || '计算失败'
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '试算失败')
    } finally {
      previewing.value = false
    }
  }

  function save() {
    try {
      syncFormula()
      if (!field.value.code || !field.value.name) throw new Error('请填写字段编码和名称')
      field.value.fixedText = fixed.value ? field.value.fixedText || '' : null
      emit('save', JSON.parse(JSON.stringify(field.value)))
      visible.value = false
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '字段配置无效')
    }
  }
</script>

<style scoped lang="scss">
  .tip {
    margin-left: 12px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .el-alert {
    margin-bottom: 20px;
  }

  .variable-row {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
  }
</style>
