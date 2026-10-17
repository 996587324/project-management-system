<template>
  <ElDialog
    v-model="visible"
    title="更换头像"
    width="min(94vw, 560px)"
    destroy-on-close
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    @closed="clearSelection"
  >
    <div class="avatar-editor">
      <input
        ref="fileInput"
        class="file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        @change="selectFile"
      />
      <ElButton :disabled="saving" @click="fileInput?.click()">选择图片</ElButton>
      <p class="hint">支持 JPG、PNG、WebP，最大 2MB。拖动、缩放后点击“生成预览”。</p>
      <div v-if="sourceUrl" class="crop-area">
        <ImgCutter
          ref="cutter"
          :is-modal="false"
          :show-choose-btn="false"
          :box-width="cropWidth"
          :box-height="300"
          :cut-width="200"
          :cut-height="200"
          rate="1:1"
          :size-change="false"
          :preview-mode="false"
          :cross-origin="false"
          file-type="png"
          @cut-down="receiveCrop"
          @on-image-load-error="imageLoadError"
        >
          <template #choose><span /></template>
          <template #confirm><ElButton type="primary">生成预览</ElButton></template>
          <template #cancel><span /></template>
        </ImgCutter>
      </div>
      <div v-if="previewUrl" class="preview">
        <img :src="previewUrl" alt="头像保存预览" />
        <span>保存后 A/B 共用此头像</span>
      </div>
    </div>
    <template #footer>
      <ElButton :disabled="saving" @click="visible = false">取消</ElButton>
      <ElButton type="primary" :disabled="!croppedFile" :loading="saving" @click="save"
        >保存头像</ElButton
      >
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
  import { useWindowSize } from '@vueuse/core'
  import ImgCutter from 'vue-img-cutter'
  import 'vue-img-cutter/vue-img-cutter.css'
  import { ElMessage } from 'element-plus'
  import { useUserStore } from '@/store/modules/user'
  import { requestAvatarMetadata } from '@/api/user-profile'

  const visible = defineModel<boolean>({ default: false })
  const store = useUserStore()
  const { width } = useWindowSize()
  const cropWidth = computed(() => Math.max(220, Math.min(480, width.value - 80)))
  const fileInput = ref<HTMLInputElement>()
  const cutter = ref<{ handleOpen: (image: { name: string; src: string }) => void }>()
  const sourceUrl = ref('')
  const previewUrl = ref('')
  const croppedFile = ref<File>()
  const saving = ref(false)
  let selection = 0
  let uploadRequest: AbortController | undefined
  const maximumBytes = 2 * 1024 * 1024

  function clearSelection() {
    selection++
    if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    sourceUrl.value = ''
    previewUrl.value = ''
    croppedFile.value = undefined
    if (fileInput.value) fileInput.value.value = ''
  }

  async function selectFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    clearSelection()
    const current = selection
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > maximumBytes ||
      !file.size
    ) {
      ElMessage.warning('请选择不超过 2MB 的 JPG、PNG 或 WebP 图片')
      return
    }
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.src = url
    try {
      await image.decode()
      if (current !== selection) return
      if (
        image.width < 16 ||
        image.height < 16 ||
        image.width > 4096 ||
        image.height > 4096 ||
        image.width * image.height > 8_000_000
      ) {
        throw new Error('图片尺寸须为 16～4096 像素，且总像素不能超过 800 万')
      }
      sourceUrl.value = url
      await nextTick()
      if (current === selection) cutter.value?.handleOpen({ name: file.name, src: url })
    } catch (error) {
      if (current === selection)
        ElMessage.error(error instanceof Error ? error.message : '图片无法读取')
    } finally {
      if (sourceUrl.value !== url) URL.revokeObjectURL(url)
    }
  }

  function receiveCrop(result: { blob: Blob }) {
    if (!result.blob || result.blob.size > maximumBytes) {
      ElMessage.warning('裁剪结果超过 2MB，请缩小图片后重试')
      return
    }
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    croppedFile.value = new File([result.blob], 'avatar.png', { type: 'image/png' })
    previewUrl.value = URL.createObjectURL(result.blob)
  }

  function imageLoadError() {
    clearSelection()
    ElMessage.error('图片无法加载，请重新选择')
  }

  async function save() {
    if (!croppedFile.value || saving.value) return
    const token = store.accessToken
    const userId = store.info.userId
    uploadRequest = new AbortController()
    saving.value = true
    try {
      const metadata = await requestAvatarMetadata(
        token,
        'upload',
        croppedFile.value,
        uploadRequest.signal
      )
      if (store.accessToken !== token || store.info.userId !== userId || !store.isLogin) return
      store.setAvatar(metadata)
      ElMessage.success('头像已更新')
      visible.value = false
    } catch (error) {
      if (store.accessToken === token)
        ElMessage.error(error instanceof Error ? error.message : '头像保存失败')
    } finally {
      saving.value = false
      uploadRequest = undefined
    }
  }

  onBeforeUnmount(() => {
    uploadRequest?.abort()
    clearSelection()
  })
</script>

<style scoped>
  .avatar-editor {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .file-input {
    display: none;
  }
  .hint {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.6;
    margin: 0;
  }
  .crop-area {
    max-width: 100%;
    overflow: hidden;
  }
  .preview {
    display: flex;
    align-items: center;
    gap: 16px;
    color: var(--el-text-color-secondary);
  }
  .preview img {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
  }
</style>
