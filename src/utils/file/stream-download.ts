export type StreamDownloadResult = 'completed' | 'started' | 'cancelled'

interface StreamDownloadOptions {
  url: string
  fileName: string
  contentType: string
  accessToken?: string
  withCredentials?: boolean
}

interface StreamFileHandle {
  createWritable: () => Promise<WritableStream<Uint8Array>>
}

interface StreamDownloadWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string
    types: Array<{
      description: string
      accept: Record<string, string[]>
    }>
  }) => Promise<StreamFileHandle>
}

const triggerNativeDownload = (url: string, fileName: string) => {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

const readErrorMessage = async (response: Response) => {
  const content = await response.text()
  if (!content) return `下载失败（HTTP ${response.status}）`

  try {
    const body = JSON.parse(content) as { msg?: string; message?: string }
    return body.msg || body.message || `下载失败（HTTP ${response.status}）`
  } catch {
    return content
  }
}

/**
 * 在支持 File System Access API 的安全环境中将响应流直接写入磁盘。
 * 普通 HTTP 或不支持该 API 的浏览器交给原生下载器处理，避免在 JS 内存中拼接 Blob。
 */
export async function downloadResponseStream({
  url,
  fileName,
  contentType,
  accessToken,
  withCredentials = false
}: StreamDownloadOptions): Promise<StreamDownloadResult> {
  const downloadWindow = window as StreamDownloadWindow
  if (!window.isSecureContext || !downloadWindow.showSaveFilePicker) {
    triggerNativeDownload(url, fileName)
    return 'started'
  }

  let handle: StreamFileHandle
  try {
    handle = await downloadWindow.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: 'Excel 工作簿',
          accept: { [contentType]: ['.xlsx'] }
        }
      ]
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    throw error
  }

  const headers = new Headers()
  if (accessToken) {
    headers.set(
      'Authorization',
      accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`
    )
  }
  const response = await fetch(url, {
    headers,
    credentials: withCredentials ? 'include' : 'same-origin'
  })
  if (!response.ok) throw new Error(await readErrorMessage(response))
  if (!response.body) throw new Error('浏览器未返回可读取的下载流')

  const writable = await handle.createWritable()
  await response.body.pipeTo(writable)
  return 'completed'
}
