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

/** 将已授权请求得到的文件交由浏览器保存，适用于 HTTP/IP 部署场景。 */
const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob)
  triggerNativeDownload(objectUrl, fileName)
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
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

const createAuthorizationHeaders = (accessToken?: string) => {
  const headers = new Headers()
  if (accessToken) {
    headers.set(
      'Authorization',
      accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`
    )
  }
  return headers
}

/**
 * HTTP 环境不支持 File System Access API，直接使用链接下载也无法附加 JWT。
 * 因此先通过 Fetch 完成授权请求，再将响应文件交给原生下载器保存。
 */
const downloadAuthorizedBlob = async (
  url: string,
  fileName: string,
  headers: Headers,
  withCredentials: boolean
) => {
  const response = await fetch(url, {
    headers,
    credentials: withCredentials ? 'include' : 'same-origin'
  })
  if (!response.ok) throw new Error(await readErrorMessage(response))

  const blob = await response.blob()
  if (!blob.size) throw new Error('下载文件为空')
  triggerBlobDownload(blob, fileName)
  return 'completed' as const
}

/**
 * 在支持 File System Access API 的安全环境中将响应流直接写入磁盘。
 * 普通 HTTP/IP 环境会使用带 JWT 的 Fetch 下载，避免原生链接因未携带授权而被拒绝。
 */
export async function downloadResponseStream({
  url,
  fileName,
  contentType,
  accessToken,
  withCredentials = false
}: StreamDownloadOptions): Promise<StreamDownloadResult> {
  const downloadWindow = window as StreamDownloadWindow
  const headers = createAuthorizationHeaders(accessToken)
  if (!window.isSecureContext || !downloadWindow.showSaveFilePicker) {
    return downloadAuthorizedBlob(url, fileName, headers, withCredentials)
  }

  let handle: StreamFileHandle
  try {
    handle = await downloadWindow.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: contentType === 'text/csv' ? 'CSV 数据文件' : 'Excel 工作簿',
          accept: { [contentType]: contentType === 'text/csv' ? ['.csv'] : ['.xlsx'] }
        }
      ]
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    throw error
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
