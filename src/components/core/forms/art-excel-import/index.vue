<!-- 导入 Excel/CSV 文件 -->
<template>
  <div class="inline-block">
    <ElUpload
      :auto-upload="false"
      accept=".xlsx, .xls, .csv"
      :show-file-list="false"
      @change="handleFileChange"
    >
      <ElButton type="primary" v-ripple>
        <slot>{{ $t('systemPages.import.defaultText') }}</slot>
      </ElButton>
    </ElUpload>
  </div>
</template>

<script setup lang="ts">
  import * as XLSX from 'xlsx'
  import type { UploadFile } from 'element-plus'

  defineOptions({ name: 'ArtExcelImport' })

  // Excel/CSV 导入工具函数
  async function importExcel(file: File): Promise<Array<Record<string, unknown>>> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const isCsv = file.name.toLowerCase().endsWith('.csv')
          const workbook = XLSX.read(data, { type: isCsv ? 'string' : 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          const results = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
          resolve(results as Array<Record<string, unknown>>)
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = (error) => reject(error)
      if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file, 'utf-8')
      } else {
        reader.readAsArrayBuffer(file)
      }
    })
  }

  // 定义 emits
  const emit = defineEmits<{
    'import-success': [data: Array<Record<string, unknown>>]
    'import-error': [error: Error]
  }>()

  // 处理文件导入
  const handleFileChange = async (uploadFile: UploadFile) => {
    try {
      if (!uploadFile.raw) return
      const results = await importExcel(uploadFile.raw)
      emit('import-success', results)
    } catch (error) {
      emit('import-error', error as Error)
    }
  }
</script>
