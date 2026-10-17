import { getApiUrl } from '@/utils/runtime-config'

export interface AvatarMetadata {
  avatar: string | null
  avatarVersion: string | null
}

/** Token 只通过请求头传输；头像地址不携带登录凭据。 */
export async function requestAvatarMetadata(
  token: string,
  action: 'info' | 'upload' | 'reset',
  file?: File,
  signal?: AbortSignal
): Promise<AvatarMetadata> {
  const body = file ? new FormData() : undefined
  if (file) body!.append('file', file)
  const suffix = action === 'upload' ? '' : `/${action}`
  const controller = new AbortController()
  const cancel = () => controller.abort()
  if (signal?.aborted) cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  const timeout = setTimeout(cancel, 15_000)
  try {
    const response = await fetch(getApiUrl(`/api/user-profile/avatar${suffix}`), {
      method: action === 'info' ? 'GET' : 'POST',
      headers: { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` },
      body,
      cache: 'no-store',
      signal: controller.signal
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || result?.code !== 200) {
      throw new Error(result?.message || result?.msg || `头像操作失败（${response.status}）`)
    }
    return result.data
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}
