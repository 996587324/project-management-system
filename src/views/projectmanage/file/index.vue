<template>
  <div class="file-page">
    <div class="file-layout" :class="{ 'is-folder-collapsed': folderCollapsed }">
      <aside class="folder-pane">
        <ElCard shadow="never" class="folder-card">
          <template #header>
            <div class="folder-card-header">
              <span>项目文件</span>
              <ElTooltip content="收起项目树" placement="top">
                <ElButton circle text @click="toggleFolderPane">
                  <ElIcon><Fold /></ElIcon>
                </ElButton>
              </ElTooltip>
            </div>
          </template>

          <ElTree
            :data="folderTree"
            node-key="value"
            default-expand-all
            highlight-current
            @node-click="handleFolderClick"
          />
        </ElCard>
      </aside>

      <main class="table-pane">
        <ElCard shadow="never" class="art-table-card">
          <ArtTableHeader
            v-model:columns="columnChecks"
            v-model:showSearchBar="showSearchBar"
            :loading="loading"
            @refresh="refreshData"
          >
            <template #left>
              <ElSpace wrap>
                <ElTooltip :content="folderCollapsed ? '展开项目树' : '收起项目树'" placement="top">
                  <ElButton circle @click="toggleFolderPane">
                    <ElIcon>
                      <Expand v-if="folderCollapsed" />
                      <Fold v-else />
                    </ElIcon>
                  </ElButton>
                </ElTooltip>
                <ElSelect
                  v-model="filters.projectId"
                  clearable
                  filterable
                  placeholder="选择项目"
                  style="width: 220px"
                  @change="handleSearch"
                >
                  <ElOption
                    v-for="item in projects"
                    :key="item.id"
                    :label="item.projectName"
                    :value="item.id"
                  />
                </ElSelect>
                <ElInput
                  v-model="filters.fileName"
                  clearable
                  placeholder="文件名称"
                  @keyup.enter="handleSearch"
                />
                <ElUpload
                  v-auth="'Upload'"
                  :http-request="handleUpload"
                  :show-file-list="false"
                  multiple
                >
                  <ElButton type="primary" :disabled="!filters.projectId">上传文件</ElButton>
                </ElUpload>
                <ElButton @click="handleSearch">查询</ElButton>
              </ElSpace>
            </template>
          </ArtTableHeader>

          <ArtTable
            :loading="loading"
            :data="data"
            :columns="columns"
            :pagination="pagination"
            @pagination:size-change="handleSizeChange"
            @pagination:current-change="handleCurrentChange"
          />
        </ElCard>
      </main>
    </div>

    <ElDialog
      v-model="preview.visible"
      :title="preview.title"
      width="86vw"
      top="4vh"
      destroy-on-close
      class="file-preview-dialog"
      @closed="resetPreview"
    >
      <div v-loading="preview.loading" class="preview-body">
        <iframe
          v-if="preview.kind === 'pdf'"
          class="pdf-frame"
          :src="preview.url"
          title="PDF preview"
        />

        <div v-else-if="preview.kind === 'word'" class="word-preview">
          <div v-html="preview.html" />
        </div>

        <div v-else-if="preview.kind === 'sheet'" class="sheet-preview">
          <ElTabs v-model="preview.activeSheet" class="sheet-tabs">
            <ElTabPane
              v-for="sheet in preview.sheets"
              :key="sheet.name"
              :label="sheet.name"
              :name="sheet.name"
            />
          </ElTabs>

          <div class="sheet-table-wrap">
            <table v-if="currentSheetRows.length" class="sheet-table">
              <tbody>
                <tr v-for="(row, rowIndex) in currentSheetRows" :key="rowIndex">
                  <component
                    :is="rowIndex === 0 ? 'th' : 'td'"
                    v-for="(cell, cellIndex) in row"
                    :key="cellIndex"
                  >
                    {{ cell }}
                  </component>
                </tr>
              </tbody>
            </table>
            <ElEmpty v-else description="文件中没有可预览的数据" />
          </div>

          <p v-if="currentSheetTotalRows > previewLimit" class="preview-tip">
            当前仅展示前 {{ previewLimit }} 行，完整内容请下载查看。
          </p>
        </div>

        <ElEmpty v-else :description="preview.message || '暂不支持该文件在线预览'">
          <ElButton v-auth="'Download'" type="primary" @click="openDownload(preview.row)"
            >下载文件</ElButton
          >
        </ElEmpty>
      </div>

      <template #footer>
        <ElButton @click="preview.visible = false">关闭</ElButton>
        <ElButton v-auth="'Download'" type="primary" @click="openDownload(preview.row)"
          >下载</ElButton
        >
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, h, onMounted, reactive, ref } from 'vue'
  import * as XLSX from 'xlsx'
  import { Expand, Fold } from '@element-plus/icons-vue'
  import {
    deleteProjectFile,
    fetchFilePage,
    fetchProjectFileCounts,
    fetchProjectList,
    getProjectFileDownloadUrl,
    getProjectFilePreviewUrl,
    uploadProjectFile
  } from '@/api/project-manage'
  import { useTable } from '@/hooks/core/useTable'
  import ArtButtonMore, { ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import { ElMessage, ElMessageBox, ElTag, type UploadRequestOptions } from 'element-plus'

  defineOptions({ name: 'ProjectFile' })

  type FileItem = Api.ProjectManage.FileItem
  type PreviewKind = 'pdf' | 'word' | 'sheet' | 'unsupported'
  type SheetPreview = {
    name: string
    rows: string[][]
    totalRows: number
  }
  type FolderTreeNode = {
    label: string
    value: string
    projectId?: number
    children?: FolderTreeNode[]
  }

  const previewLimit = 200
  const projects = ref<Api.ProjectManage.ProjectItem[]>([])
  const folderCollapsed = ref(false)
  const showSearchBar = ref(false)
  const filters = reactive<Api.ProjectManage.FileQueryParams>({
    projectId: undefined,
    folderType: undefined,
    fileName: undefined
  })

  const folderTree = computed<FolderTreeNode[]>(() => [
    {
      label: `全部项目（${projects.value.length}）`,
      value: 'all-projects',
      children: projects.value.map((project) => ({
        label: `${project.projectName}（${project.fileCount || 0}）`,
        value: `project-${project.id}`,
        projectId: project.id
      }))
    }
  ])

  const projectNameMap = computed(() =>
    projects.value.reduce<Record<string, string>>((map, project) => {
      map[String(project.id)] = project.projectName
      return map
    }, {})
  )

  const preview = reactive<{
    visible: boolean
    loading: boolean
    title: string
    kind: PreviewKind
    url: string
    html: string
    message: string
    activeSheet: string
    sheets: SheetPreview[]
    row?: FileItem
  }>({
    visible: false,
    loading: false,
    title: '',
    kind: 'unsupported',
    url: '',
    html: '',
    message: '',
    activeSheet: '',
    sheets: [],
    row: undefined
  })

  const currentSheet = computed(() =>
    preview.sheets.find((item) => item.name === preview.activeSheet)
  )
  const currentSheetRows = computed(() => currentSheet.value?.rows ?? [])
  const currentSheetTotalRows = computed(() => currentSheet.value?.totalRows ?? 0)

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    searchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData,
    refreshRemove
  } = useTable({
    core: {
      apiFn: fetchFilePage,
      apiParams: { current: 1, size: 20 },
      columnsFactory: () => [
        { prop: 'fileName', label: '文件名称', minWidth: 220, showOverflowTooltip: true },
        {
          prop: 'folderType',
          label: '阶段分类',
          width: 110,
          formatter: (row: FileItem) => h(ElTag, { effect: 'plain' }, () => row.folderType)
        },
        { prop: 'fileSuffix', label: '后缀', width: 80 },
        {
          prop: 'fileSize',
          label: '大小',
          width: 110,
          formatter: (row: FileItem) => `${Number(row.fileSize || 0).toFixed(2)} KB`
        },
        {
          prop: 'projectId',
          label: '所属项目',
          minWidth: 140,
          showOverflowTooltip: true,
          formatter: (row: FileItem) => projectNameMap.value[String(row.projectId)] || row.projectId
        },
        { prop: 'taskId', label: '任务ID', width: 90 },
        { prop: 'createTime', label: '上传时间', width: 170 },
        {
          prop: 'operation',
          label: '操作',
          width: 110,
          fixed: 'right',
          formatter: (row: FileItem) =>
            h(ArtButtonMore, {
              list: [
                { key: 'preview', label: '预览', icon: 'ri:eye-line', auth: 'Preview' },
                { key: 'download', label: '下载', icon: 'ri:download-2-line', auth: 'Download' },
                {
                  key: 'delete',
                  label: '删除',
                  icon: 'ri:delete-bin-4-line',
                  color: '#f56c6c',
                  auth: 'Delete'
                }
              ],
              onClick: (item: ButtonMoreItem) => handleAction(item, row)
            })
        }
      ]
    }
  })

  const loadProjects = async () => {
    const projectList = await fetchProjectList()
    const fileCounts = await fetchProjectFileCounts(
      projectList.map((project) => project.projectName)
    )
    projects.value = projectList.map((project) => ({
      ...project,
      fileCount: fileCounts[project.projectName] ?? 0
    }))
    handleSearch()
  }

  const handleFolderClick = (node: FolderTreeNode) => {
    filters.projectId = node.projectId
    filters.folderType = undefined
    handleSearch()
  }

  const handleSearch = () => {
    Object.assign(searchParams, filters)
    getData()
  }

  const toggleFolderPane = () => {
    folderCollapsed.value = !folderCollapsed.value
  }

  const handleUpload = async (options: UploadRequestOptions) => {
    if (!filters.projectId) {
      ElMessage.warning('请先选择项目')
      options.onError(
        new Error('Please select a project first') as Parameters<typeof options.onError>[0]
      )
      return
    }

    try {
      const currentProject = projects.value.find((project) => project.id === filters.projectId)
      if (!currentProject) {
        ElMessage.warning('请先选择项目')
        options.onError(
          new Error('Please select a project first') as Parameters<typeof options.onError>[0]
        )
        return
      }

      const formData = new FormData()
      formData.append('file', options.file)
      formData.append('projectId', String(filters.projectId))
      formData.append('projectName', currentProject.projectName)
      formData.append('taskId', String(filters.taskId ?? 0))
      formData.append('folderType', filters.folderType || '项目文件')
      formData.append('uploadUserId', '1')

      await uploadProjectFile(formData)
      ElMessage.success('上传成功，同名文件会自动替换')
      options.onSuccess({})
      await loadProjects()
    } catch (error) {
      options.onError(error as Parameters<typeof options.onError>[0])
    }
  }

  const handleAction = async (item: ButtonMoreItem, row: FileItem) => {
    if (item.key === 'preview') {
      await openPreview(row)
      return
    }

    if (item.key === 'download') {
      openDownload(row)
      return
    }

    if (item.key === 'delete') {
      await ElMessageBox.confirm(`确定删除文件“${row.fileName}”吗？`, '删除确认', {
        type: 'warning'
      })
      await deleteProjectFile(row.id)
      ElMessage.success('删除成功')
      refreshRemove()
    }
  }

  const openPreview = async (row: FileItem) => {
    resetPreview()
    preview.visible = true
    preview.loading = true
    preview.title = row.fileName
    preview.row = row
    preview.url = getProjectFilePreviewUrl(row.id)

    try {
      const suffix = getFileSuffix(row)

      if (suffix === 'pdf') {
        preview.kind = 'pdf'
        return
      }

      if (suffix === 'docx') {
        preview.kind = 'word'
        await loadWordPreview(row)
        return
      }

      if (['xlsx', 'xls', 'csv'].includes(suffix)) {
        preview.kind = 'sheet'
        await loadSheetPreview(row)
        return
      }

      preview.kind = 'unsupported'
      preview.message =
        suffix === 'doc'
          ? '旧版 .doc 文件暂不支持直接解析，请转换为 .docx 后预览，或下载到本地查看。'
          : '该格式暂不支持在线预览，请下载后查看。'
    } catch (error) {
      preview.kind = 'unsupported'
      preview.message = '文件预览失败，请下载后查看。'
      console.error(error)
    } finally {
      preview.loading = false
    }
  }

  const loadWordPreview = async (row: FileItem) => {
    const mammoth = await import('mammoth/mammoth.browser')
    const arrayBuffer = await fetchFileBuffer(row)
    const result = await mammoth.convertToHtml({ arrayBuffer })
    preview.html = sanitizeHtml(result.value || '<p>该 Word 文件没有可预览内容。</p>')
  }

  const loadSheetPreview = async (row: FileItem) => {
    const suffix = getFileSuffix(row)
    const source = suffix === 'csv' ? await fetchFileText(row) : await fetchFileBuffer(row)
    const workbook = XLSX.read(source, { type: suffix === 'csv' ? 'string' : 'array' })

    preview.sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name]
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
      return {
        name,
        rows: normalizeSheetRows(rows).slice(0, previewLimit),
        totalRows: rows.length
      }
    })
    preview.activeSheet = preview.sheets[0]?.name || ''
  }

  const fetchFileBuffer = async (row: FileItem) => {
    const response = await fetch(getProjectFilePreviewUrl(row.id))
    if (!response.ok) throw new Error('Preview request failed')
    return response.arrayBuffer()
  }

  const fetchFileText = async (row: FileItem) => {
    const response = await fetch(getProjectFilePreviewUrl(row.id))
    if (!response.ok) throw new Error('Preview request failed')
    return response.text()
  }

  const normalizeSheetRows = (rows: string[][]) => {
    const maxColumns = Math.max(0, ...rows.map((row) => row.length))
    return rows.map((row) =>
      Array.from({ length: maxColumns }, (_, index) => String(row[index] ?? ''))
    )
  }

  const sanitizeHtml = (html: string) => {
    const documentFragment = new DOMParser().parseFromString(html, 'text/html')
    documentFragment
      .querySelectorAll('script, style, iframe, object, embed')
      .forEach((node) => node.remove())
    documentFragment.body.querySelectorAll('*').forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        if (/^on/i.test(attr.name) || /^javascript:/i.test(attr.value)) {
          node.removeAttribute(attr.name)
        }
      })
    })
    return documentFragment.body.innerHTML
  }

  const getFileSuffix = (row: FileItem) => {
    const suffix = row.fileSuffix || row.fileName.split('.').pop() || ''
    return suffix.replace(/^\./, '').toLowerCase()
  }

  const openDownload = (row?: FileItem) => {
    if (!row) return
    window.open(getProjectFileDownloadUrl(row.id), '_blank')
  }

  const resetPreview = () => {
    preview.loading = false
    preview.title = ''
    preview.kind = 'unsupported'
    preview.url = ''
    preview.html = ''
    preview.message = ''
    preview.activeSheet = ''
    preview.sheets = []
    preview.row = undefined
  }

  onMounted(loadProjects)
</script>

<style lang="scss" scoped>
  .file-page {
    .file-layout {
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr);
      gap: 12px;
      align-items: stretch;
      transition:
        grid-template-columns 0.2s ease,
        gap 0.2s ease;

      &.is-folder-collapsed {
        grid-template-columns: 0 minmax(0, 1fr);
        gap: 0;

        .folder-pane {
          pointer-events: none;
          opacity: 0;
        }
      }
    }

    .folder-pane,
    .table-pane {
      min-width: 0;
    }

    .folder-pane {
      overflow: hidden;
      transition: opacity 0.16s ease;
    }

    .folder-card {
      min-height: calc(100vh - 142px);
    }

    .folder-card-header {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      min-width: 0;
      font-weight: 600;
    }
  }

  @media (width <= 768px) {
    .file-page {
      .file-layout,
      .file-layout.is-folder-collapsed {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .file-layout.is-folder-collapsed .folder-pane {
        display: none;
      }
    }
  }

  .preview-body {
    min-height: 68vh;
  }

  .pdf-frame {
    width: 100%;
    height: 68vh;
    background: #fff;
    border: 1px solid var(--art-border-color);
    border-radius: 6px;
  }

  .word-preview {
    height: 68vh;
    padding: 24px 32px;
    overflow: auto;
    line-height: 1.75;
    color: var(--art-gray-900);
    background: #fff;
    border: 1px solid var(--art-border-color);
    border-radius: 6px;

    :deep(p) {
      margin: 0 0 12px;
    }

    :deep(table) {
      width: 100%;
      margin: 12px 0;
      border-collapse: collapse;
    }

    :deep(td),
    :deep(th) {
      padding: 8px;
      border: 1px solid #dcdfe6;
    }
  }

  .sheet-preview {
    display: flex;
    flex-direction: column;
    height: 68vh;
  }

  .sheet-tabs {
    flex: none;
  }

  .sheet-table-wrap {
    flex: 1;
    overflow: auto;
    background: #fff;
    border: 1px solid var(--art-border-color);
    border-radius: 6px;
  }

  .sheet-table {
    width: max-content;
    min-width: 100%;
    font-size: 13px;
    border-collapse: collapse;

    th,
    td {
      min-width: 120px;
      max-width: 260px;
      padding: 8px 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border-right: 1px solid #ebeef5;
      border-bottom: 1px solid #ebeef5;
    }

    th {
      position: sticky;
      top: 0;
      z-index: 1;
      font-weight: 600;
      background: #f5f7fa;
    }
  }

  .preview-tip {
    flex: none;
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--art-gray-600);
  }
</style>
