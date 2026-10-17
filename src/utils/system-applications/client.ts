import CryptoJS from 'crypto-js'
import { ref } from 'vue'
import { getApiUrl } from '@/utils/runtime-config'

export type ApplicationCode = 'A' | 'B'
export interface ApplicationInfo {
  appCode: ApplicationCode
  displayName: string
  entryUrl: string
  homePath: string
  enabled: boolean
  sort: number
}

let tokenReader: () => string = () => ''
let currentCode: ApplicationCode = import.meta.env.VITE_APP_CODE === 'B' ? 'B' : 'A'
let applicationName =
  readCachedApplicationName() || (currentCode === 'B' ? '正在加载…' : '智能制造管理系统')
export const applicationDisplayName = ref(applicationName)
export const applicationHomePath = ref(currentCode === 'B' ? '/workbench' : '/')
let requestController = new AbortController()
let nameRevision = 0
let entryInformationRequest: Promise<ApplicationEntryInformation> | undefined

export interface ApplicationEntryInformation {
  appCode: ApplicationCode
  portalUrl: string
  displayName: string
}

function readCachedApplicationName() {
  try {
    return typeof window === 'undefined'
      ? ''
      : window.localStorage.getItem(applicationStorageKey('display-name'))?.trim() || ''
  } catch {
    return ''
  }
}

export function configureApplicationClient(code: ApplicationCode, reader: () => string) {
  currentCode = code
  tokenReader = reader
}

export function applicationStorageKey(key: string, code: ApplicationCode = currentCode) {
  return `calmadmin:${code}:${key}`
}

export function getApplicationCode(): ApplicationCode {
  return currentCode
}

export function setApplicationName(name: string) {
  name = name.trim()
  if (!name) return
  const previousName = applicationName
  applicationName = name
  applicationDisplayName.value = name
  nameRevision += 1
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(applicationStorageKey('display-name'), name)
  } catch {
    // 浏览器禁用本地存储时，仍正常显示后端配置名称。
  }
  if (typeof document !== 'undefined') {
    const previousSuffix = ` - ${previousName}`
    document.title = document.title.endsWith(previousSuffix)
      ? `${document.title.slice(0, -previousSuffix.length)} - ${name}`
      : name
  }
  window.dispatchEvent(new CustomEvent('application-name-changed', { detail: name }))
}

/** 启动、登录入口共享一次公开名称查询；不等待它完成才初始化路由。 */
export function loadApplicationEntryInformation() {
  if (entryInformationRequest) return entryInformationRequest
  const code = currentCode
  const revision = nameRevision
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  entryInformationRequest = applicationRequest<ApplicationEntryInformation>(
    `/api/system-applications/entry-information?appCode=${code}`,
    undefined,
    '',
    { cache: 'no-store', signal: controller.signal }
  )
    .then((entry) => {
      if (entry.appCode === code && currentCode === code && nameRevision === revision)
        setApplicationName(entry.displayName)
      return entry
    })
    .finally(() => {
      clearTimeout(timeout)
      entryInformationRequest = undefined
    })
  return entryInformationRequest
}

export function getApplicationName() {
  return applicationName
}

export function cancelApplicationRequests() {
  requestController.abort()
  requestController = new AbortController()
}

export function getApplicationRequestSignal() {
  return requestController.signal
}

export function getTokenPurpose(token: string) {
  try {
    const raw = token.replace(/^Bearer\s+/i, '').split('.')[1]
    return JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))).TokenPurpose as string
  } catch {
    return ''
  }
}

/** 接口对象统一转成 camelCase；保留 SourcePath 和 JSON 值映射等字符串内容原样。 */
export function normalizeObject<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((item) => normalizeObject(item)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.charAt(0).toLowerCase() + key.slice(1),
        ['rawValue', 'currentValue', 'displayValue'].includes(
          key.charAt(0).toLowerCase() + key.slice(1)
        )
          ? item
          : normalizeObject(item)
      ])
    ) as T
  }
  return value as T
}

export async function applicationRequest<T>(
  path: string,
  data?: unknown,
  token = tokenReader(),
  options: Pick<RequestInit, 'cache' | 'signal'> = {}
) {
  const response = await fetch(getApiUrl(path), {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token.replace(/^Bearer\s+/i, '')}` } : {}),
      ...(data === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: options.signal ?? requestController.signal,
    cache: options.cache
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.code !== 200) {
    const error = new Error(
      payload.msg || (response.status === 401 ? '登录已过期，请重新登录' : '请求失败')
    )
    Object.assign(error, { status: response.status })
    throw error
  }
  return normalizeObject<T>(payload.data)
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** 内网 HTTP 地址也可生成 S256，不依赖只在安全上下文可用的 crypto.subtle。 */
export function createEntryProof(code: ApplicationCode) {
  const verifier = randomToken()
  const state = randomToken()
  const challenge = CryptoJS.SHA256(verifier)
    .toString(CryptoJS.enc.Base64)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  sessionStorage.setItem(
    applicationStorageKey('entry-proof', code),
    JSON.stringify({ verifier, state, time: Date.now() })
  )
  return { state, challenge }
}

export function takeEntryProof(code: ApplicationCode, state: string) {
  const key = applicationStorageKey('entry-proof', code)
  const raw = sessionStorage.getItem(key)
  sessionStorage.removeItem(key)
  if (!raw) throw new Error('缺少进入系统的验证信息，请从控制台重新进入')
  const proof = JSON.parse(raw) as { verifier: string; state: string; time: number }
  // 用户在统一登录页面可能需要输入密码；本地 proof 保留 20 分钟，服务器票据仍只有 60 秒。
  if (proof.state !== state || Date.now() - proof.time > 20 * 60_000)
    throw new Error('进入系统验证已过期')
  return proof.verifier
}

export function withHashQuery(url: string, values: Record<string, string>) {
  const target = new URL(url, location.href)
  const [route, query] = target.hash.replace(/^#/, '').split('?')
  const parameters = new URLSearchParams(query)
  Object.entries(values).forEach(([key, value]) => parameters.set(key, value))
  target.hash = `${route || '/auth/entry'}?${parameters}`
  return target.href
}
