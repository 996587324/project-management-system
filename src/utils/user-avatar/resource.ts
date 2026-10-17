import { readonly, ref } from 'vue'
import defaultAvatar from '@/assets/images/user/avatar.webp'
import { getApiUrl } from '@/utils/runtime-config'

const source = ref(defaultAvatar)
export const avatarSrc = readonly(source)
let identity = ''
let generation = 0
let objectUrl = ''
let request: AbortController | undefined

function replaceSource(url: string, owned = false) {
  const previous = objectUrl
  objectUrl = owned ? url : ''
  source.value = url
  if (previous) URL.revokeObjectURL(previous)
}

export function clearAvatar() {
  identity = ''
  generation++
  request?.abort()
  request = undefined
  replaceSource(defaultAvatar)
}

export function avatarLoadError() {
  clearAvatar()
}

/** 只请求自己的头像；账号切换、退出后丢弃上一账号的迟到响应。 */
export async function loadAvatar(userId: string, token: string, version?: string | null) {
  if (!userId || !token || !version) {
    clearAvatar()
    return
  }
  const nextIdentity = JSON.stringify([userId, token, version])
  if (identity === nextIdentity) return
  const previousOwner = identity ? JSON.parse(identity).slice(0, 2).join('\n') : ''
  identity = nextIdentity
  const current = ++generation
  request?.abort()
  const controller = new AbortController()
  request = controller
  const timeout = setTimeout(() => controller.abort(), 15_000)
  if (previousOwner !== [userId, token].join('\n')) replaceSource(defaultAvatar)
  try {
    const response = await fetch(
      getApiUrl(`/api/user-profile/avatar?v=${encodeURIComponent(version)}`),
      {
        headers: { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` },
        cache: 'no-store',
        signal: controller.signal
      }
    )
    if (!response.ok || response.status === 204) throw new Error('头像不可用')
    if (!response.headers.get('content-type')?.startsWith('image/png'))
      throw new Error('头像格式无效')
    const blob = await response.blob()
    if (!blob.size || blob.size > 2 * 1024 * 1024) throw new Error('头像大小无效')
    if (current !== generation) return
    replaceSource(URL.createObjectURL(blob), true)
  } catch {
    if (current === generation) {
      identity = '' // 网络恢复后允许重试同一个版本。
      replaceSource(defaultAvatar)
    }
  } finally {
    clearTimeout(timeout)
    if (current === generation) request = undefined
  }
}
