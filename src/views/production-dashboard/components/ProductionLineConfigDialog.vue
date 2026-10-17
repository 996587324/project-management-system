<template>
  <div v-if="modelValue" class="line-config-mask" @click.self="closeDialog">
    <section class="line-config-dialog" role="dialog" aria-modal="true" aria-label="线体配置">
      <header class="line-config-dialog__header">
        <div><span>LINE CONFIGURATION</span><h2>线体配置</h2></div>
        <button type="button" aria-label="关闭" @click="closeDialog">×</button>
      </header>

      <div class="line-config-dialog__body">
        <p class="line-config-dialog__hint">
          可维护线体编码、名称、区域、主题色和启用状态。修改编码时会同步迁移关联配置。
        </p>

        <div class="line-config-list">
          <article v-for="line in lines" :key="line.id" class="line-config-item">
            <header class="line-config-item__header">
              <div>
                <i :style="{ backgroundColor: line.color }" />
                <b>{{ line.id }}</b>
                <span>{{ line.name }}</span>
              </div>
              <small>{{ line.robots.length }} 台机械手</small>
            </header>

            <form
              v-if="editingLineId === line.id"
              class="line-config-form"
              @submit.prevent="submitEdit"
            >
              <label class="line-config-field line-config-field--code">
                <span>线体编码</span>
                <input
                  v-model.trim="editForm.id"
                  maxlength="32"
                  autocomplete="off"
                  placeholder="例如 N1"
                />
              </label>
              <label class="line-config-field line-config-field--name">
                <span>线体名称</span>
                <input
                  v-model.trim="editForm.name"
                  maxlength="64"
                  autocomplete="off"
                  placeholder="例如 N1 检测线"
                />
              </label>
              <label class="line-config-field line-config-field--area">
                <span>所在区域</span>
                <input
                  v-model.trim="editForm.area"
                  maxlength="128"
                  autocomplete="off"
                  placeholder="例如 二层 B 区"
                />
              </label>
              <label class="line-config-field line-config-field--color">
                <span>主题颜色</span>
                <span class="line-color-control">
                  <input v-model="editForm.color" type="color" aria-label="选择主题颜色" />
                  <input
                    v-model.trim="editForm.color"
                    maxlength="7"
                    autocomplete="off"
                    aria-label="主题颜色值"
                  />
                </span>
              </label>
              <label class="line-config-field line-config-field--enabled">
                <span>看板状态</span>
                <span class="line-enabled-control">
                  <input v-model="editForm.enabled" type="checkbox" />
                  <i />
                  <em>{{ editForm.enabled ? '已启用' : '已停用' }}</em>
                </span>
              </label>

              <div class="line-config-form__actions">
                <button :disabled="savingLineId === line.id" type="submit">
                  {{ savingLineId === line.id ? '保存中...' : '保存修改' }}
                </button>
                <button
                  :disabled="savingLineId === line.id"
                  class="line-config-button--secondary"
                  type="button"
                  @click="cancelEdit"
                >
                  取消
                </button>
              </div>
            </form>

            <div v-else class="line-config-item__content">
              <dl>
                <div
                  ><dt>区域</dt><dd>{{ line.area || '未配置' }}</dd></div
                >
                <div
                  ><dt>主题色</dt><dd>{{ line.color }}</dd></div
                >
                <div
                  ><dt>状态</dt><dd>{{ line.enabled ? '已启用' : '已停用' }}</dd></div
                >
              </dl>
              <div class="line-config-item__actions">
                <button :disabled="Boolean(savingLineId)" type="button" @click="startEdit(line)">
                  编辑
                </button>
                <button
                  class="line-config-button--danger"
                  :disabled="lines.length === 1 || Boolean(savingLineId)"
                  type="button"
                  @click="removeLine(line)"
                >
                  删除
                </button>
              </div>
            </div>
          </article>
        </div>

        <section class="line-config-create">
          <header><span>NEW LINE</span><h3>新增线体</h3></header>
          <form class="line-config-form" @submit.prevent="submitCreate">
            <label class="line-config-field line-config-field--code">
              <span>线体编码</span>
              <input
                v-model.trim="createForm.id"
                maxlength="32"
                autocomplete="off"
                placeholder="例如 N1"
              />
            </label>
            <label class="line-config-field line-config-field--name">
              <span>线体名称</span>
              <input
                v-model.trim="createForm.name"
                maxlength="64"
                autocomplete="off"
                placeholder="例如 N1 检测线"
              />
            </label>
            <label class="line-config-field line-config-field--area">
              <span>所在区域</span>
              <input
                v-model.trim="createForm.area"
                maxlength="128"
                autocomplete="off"
                placeholder="例如 二层 B 区"
              />
            </label>
            <label class="line-config-field line-config-field--color">
              <span>主题颜色</span>
              <span class="line-color-control">
                <input v-model="createForm.color" type="color" aria-label="选择主题颜色" />
                <input
                  v-model.trim="createForm.color"
                  maxlength="7"
                  autocomplete="off"
                  aria-label="主题颜色值"
                />
              </span>
            </label>
            <label class="line-config-field line-config-field--enabled">
              <span>看板状态</span>
              <span class="line-enabled-control">
                <input v-model="createForm.enabled" type="checkbox" />
                <i />
                <em>{{ createForm.enabled ? '已启用' : '已停用' }}</em>
              </span>
            </label>

            <div class="line-config-form__actions">
              <button :disabled="creating" type="submit">
                {{ creating ? '正在创建...' : '新增线体' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import type {
    ProductionLineBoard,
    ProductionLineConfigDraft
  } from '@/views/production-dashboard/config/productionDashboard'

  const props = defineProps<{
    modelValue: boolean
    lines: ProductionLineBoard[]
    creating: boolean
    savingLineId: string
  }>()

  const emit = defineEmits<{
    (event: 'update:modelValue', value: boolean): void
    (event: 'add', draft: ProductionLineConfigDraft, completed: () => void): void
    (event: 'save', draft: ProductionLineConfigDraft, completed: () => void): void
    (event: 'remove', lineId: string): void
  }>()

  const emptyDraft = (): ProductionLineConfigDraft => ({
    id: '',
    name: '',
    area: '',
    color: '#55d5ff',
    enabled: true
  })
  const createForm = reactive<ProductionLineConfigDraft>(emptyDraft())
  const editForm = reactive<ProductionLineConfigDraft>(emptyDraft())
  const editingLineId = ref('')

  /** 验证线体基础信息，防止无效编码或颜色进入场景配置。 */
  const validate = (draft: ProductionLineConfigDraft, originalId?: string) => {
    if (!draft.id) return (ElMessage.warning('请填写线体编码'), false)
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(draft.id)) {
      ElMessage.warning('线体编码只能包含字母、数字、下划线和短横线')
      return false
    }
    if (
      props.lines.some(
        (line) =>
          line.id.toLowerCase() === draft.id.toLowerCase() &&
          line.id.toLowerCase() !== originalId?.toLowerCase()
      )
    ) {
      ElMessage.warning(`线体编码 ${draft.id} 已存在`)
      return false
    }
    if (!draft.name) return (ElMessage.warning('请填写线体名称'), false)
    if (!draft.area) return (ElMessage.warning('请填写所在区域'), false)
    if (
      originalId &&
      !draft.enabled &&
      !props.lines.some((line) => line.id !== originalId && line.enabled)
    ) {
      ElMessage.warning('至少需要保留一条启用的线体')
      return false
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(draft.color)) {
      ElMessage.warning('主题颜色必须是 #RRGGBB 格式')
      return false
    }
    return true
  }

  const resetCreateForm = () => Object.assign(createForm, emptyDraft())
  const cancelEdit = () => {
    if (props.savingLineId) return
    editingLineId.value = ''
    Object.assign(editForm, emptyDraft())
  }

  const startEdit = (line: ProductionLineBoard) => {
    editingLineId.value = line.id
    Object.assign(editForm, {
      originalId: line.id,
      id: line.id,
      name: line.name,
      area: line.area,
      color: line.color,
      enabled: line.enabled
    })
  }

  const submitCreate = () => {
    if (props.creating || !validate(createForm)) return
    emit('add', { ...createForm }, resetCreateForm)
  }

  const submitEdit = () => {
    if (props.savingLineId || !validate(editForm, editForm.originalId)) return
    emit('save', { ...editForm }, cancelEdit)
  }

  const removeLine = (line: ProductionLineBoard) => {
    if (line.enabled && !props.lines.some((item) => item.id !== line.id && item.enabled)) {
      ElMessage.warning('至少需要保留一条启用的线体')
      return
    }
    emit('remove', line.id)
  }

  const closeDialog = () => {
    if (props.creating || props.savingLineId) return
    emit('update:modelValue', false)
  }

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) cancelEdit()
    }
  )
</script>

<style lang="scss" scoped>
  .line-config-mask {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    padding: 12px;
    background: var(--pd-mask, rgb(1 8 15 / 72%));
    backdrop-filter: blur(3px);
  }

  .line-config-dialog {
    display: flex;
    flex-direction: column;
    width: min(820px, 100%);
    max-height: calc(100dvh - 24px);
    overflow: hidden;
    background: var(--pd-panel, #071a2a);
    border: 1px solid var(--pd-border, rgb(89 203 250 / 45%));
    border-radius: var(--pd-radius, 6px);
    box-shadow: var(--pd-shadow, 0 0 35px rgb(22 135 183 / 32%));
  }

  .line-config-dialog__header {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    padding: 15px 18px;
    border-bottom: 1px solid var(--pd-border, rgb(91 190 236 / 18%));
  }

  .line-config-dialog__header span,
  .line-config-create header span {
    font-size: 10px;
    color: var(--pd-primary, #54d5ff);
    letter-spacing: 1px;
  }

  .line-config-dialog__header h2,
  .line-config-create h3 {
    margin: 3px 0 0;
    font-size: 18px;
    color: var(--pd-text, #eefaff);
  }

  .line-config-dialog__header > button {
    width: 32px;
    height: 32px;
    padding: 0;
    font-size: 24px;
    color: var(--pd-muted, #8cb1c5);
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .line-config-dialog__body {
    min-height: 0;
    padding: 14px 18px 18px;
    overflow: auto;
  }

  .line-config-dialog__hint {
    margin: 0 0 12px;
    font-size: 11px;
    color: var(--pd-muted, #7a9aae);
  }

  .line-config-list {
    display: grid;
    gap: 9px;
  }

  .line-config-item,
  .line-config-create {
    background: var(--pd-panel, #091f30);
    border: 1px solid var(--pd-border, rgb(90 151 182 / 20%));
    border-radius: var(--pd-radius, 5px);
  }

  .line-config-item__header {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    min-height: 42px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--pd-border, rgb(90 151 182 / 13%));
  }

  .line-config-item__header > div {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  .line-config-item__header i {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .line-config-item__header b {
    flex: 0 0 auto;
    font-size: 12px;
    color: var(--pd-text, #dff5ff);
  }

  .line-config-item__header span {
    overflow: hidden;
    font-size: 12px;
    color: var(--pd-text, #a4c3d3);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .line-config-item__header small {
    flex: 0 0 auto;
    font-size: 10px;
    color: var(--pd-muted, #6f91a5);
  }

  .line-config-item__content {
    display: flex;
    gap: 14px;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
  }

  .line-config-item__content dl {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(3, minmax(100px, 1fr));
    gap: 10px;
    min-width: 0;
    margin: 0;
  }

  .line-config-item__content dl div {
    min-width: 0;
  }

  .line-config-item__content dt {
    font-size: 9px;
    color: var(--pd-muted, #62869a);
  }

  .line-config-item__content dd {
    margin: 3px 0 0;
    overflow: hidden;
    font-size: 11px;
    color: var(--pd-text, #c6e0eb);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .line-config-form {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 11px;
    padding: 12px;
  }

  .line-config-field {
    display: grid;
    gap: 5px;
    align-content: start;
    min-width: 0;
  }

  .line-config-field--code {
    grid-column: span 4;
  }

  .line-config-field--name {
    grid-column: span 8;
  }

  .line-config-field--area {
    grid-column: span 5;
  }

  .line-config-field--color {
    grid-column: span 4;
  }

  .line-config-field--enabled {
    grid-column: span 3;
  }

  .line-config-field > span:first-child {
    font-size: 10px;
    color: var(--pd-muted, #789aac);
  }

  .line-config-field > input,
  .line-color-control > input:last-child {
    min-width: 0;
    height: 34px;
    padding: 0 9px;
    color: var(--pd-text, #e3f4fb);
    background: var(--pd-panel, #0c2639);
    border: 1px solid var(--pd-border, rgb(95 193 239 / 30%));
    border-radius: var(--pd-radius, 3px);
    outline: 0;
  }

  .line-config-field input:focus {
    border-color: var(--pd-border, #5ad6ff);
  }

  .line-color-control {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr);
    gap: 6px;
    min-width: 0;
  }

  .line-color-control > input[type='color'] {
    width: 38px;
    height: 34px;
    padding: 3px;
    cursor: pointer;
    background: var(--pd-panel, #0c2639);
    border: 1px solid var(--pd-border, rgb(95 193 239 / 30%));
    border-radius: var(--pd-radius, 3px);
  }

  .line-enabled-control {
    position: relative;
    display: flex;
    gap: 8px;
    align-items: center;
    height: 34px;
  }

  .line-enabled-control input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  .line-enabled-control i {
    position: relative;
    flex: 0 0 auto;
    width: 34px;
    height: 18px;
    cursor: pointer;
    background: var(--pd-muted, #395467);
    border-radius: 9px;
  }

  .line-enabled-control i::after {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    content: '';
    background: var(--pd-button-text, #c9d9e1);
    border-radius: 50%;
    transition: transform 0.18s ease;
  }

  .line-enabled-control input:checked + i {
    background: var(--pd-success, #2ebd8c);
  }

  .line-enabled-control input:checked + i::after {
    transform: translateX(16px);
  }

  .line-enabled-control em {
    font-size: 11px;
    font-style: normal;
    color: var(--pd-text, #b4ceda);
  }

  .line-config-form__actions {
    display: flex;
    grid-column: 1 / -1;
    gap: 8px;
    justify-content: flex-end;
  }

  .line-config-form__actions button,
  .line-config-item__actions button {
    min-height: 30px;
    padding: 0 13px;
    font-size: 11px;
    font-weight: 700;
    color: var(--pd-button-text, #062035);
    cursor: pointer;
    background: var(--pd-primary, #65d7fb);
    border: 1px solid var(--pd-border, #4ac7f1);
    border-radius: var(--pd-radius, 3px);
  }

  .line-config-item__actions {
    display: flex;
    flex: 0 0 auto;
    gap: 7px;
  }

  .line-config-form__actions .line-config-button--secondary {
    color: var(--pd-text, #9fc0cf);
    background: transparent;
  }

  .line-config-item__actions .line-config-button--danger {
    color: var(--pd-danger, #ee8290);
    background: transparent;
    border-color: var(--pd-danger, rgb(238 130 144 / 55%));
  }

  .line-config-form__actions button:disabled,
  .line-config-item__actions button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .line-config-create {
    margin-top: 14px;
    border-color: var(--pd-border, rgb(84 213 255 / 35%));
  }

  .line-config-create header {
    padding: 11px 12px 0;
  }

  .line-config-create h3 {
    font-size: 14px;
  }

  @media (width <= 680px) {
    .line-config-mask {
      padding: 8px;
    }

    .line-config-dialog {
      max-height: calc(100dvh - 16px);
    }

    .line-config-dialog__body {
      padding: 12px;
    }

    .line-config-field--code,
    .line-config-field--name,
    .line-config-field--area,
    .line-config-field--color {
      grid-column: span 6;
    }

    .line-config-field--enabled {
      grid-column: 1 / -1;
    }

    .line-config-item__content {
      flex-direction: column;
      align-items: flex-end;
    }

    .line-config-item__content dl,
    .line-config-item__actions {
      width: 100%;
    }

    .line-config-item__actions {
      justify-content: flex-end;
    }
  }

  @media (width <= 440px) {
    .line-config-dialog__header {
      padding: 12px;
    }

    .line-config-form {
      gap: 9px;
      padding: 10px;
    }

    .line-config-field--code,
    .line-config-field--name,
    .line-config-field--area,
    .line-config-field--color,
    .line-config-field--enabled {
      grid-column: 1 / -1;
    }

    .line-config-item__header {
      flex-direction: column;
      gap: 4px;
      align-items: flex-start;
    }

    .line-config-item__content dl {
      grid-template-columns: 1fr;
    }
  }
</style>
