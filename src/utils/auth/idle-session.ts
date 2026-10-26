export const IDLE_TIMEOUT_MS = 20 * 60_000
export const IDLE_WARNING_MS = 60_000
const SYNC_INTERVAL_MS = 15_000

export interface SessionActivity {
  sessionId: string
  serverTimeUtc: string
  expiresAtUtc: string
  idleTimeoutSeconds: number
  token?: string
  portalToken?: string
}

export interface SavedActivity {
  lastActivity: number
  expired?: boolean
}

export interface IdleSessionEnvironment {
  initialDeadline?: number
  now(): number
  load(): SavedActivity | undefined
  save(value: SavedActivity): void
  sync(idleMilliseconds?: number): Promise<SessionActivity>
  credentials(value: SessionActivity): void
  display(seconds: number, warning: boolean): void
  expire(reason: 'idle' | 'invalid'): void
}

/** 会话状态与 UI 分离，便于用虚拟时间验证 20 分钟边界及休眠恢复。 */
export class IdleSession {
  private lastActivity = 0
  private acknowledgedActivity = 0
  private serverDeadline = 0
  private lastSync = Number.NEGATIVE_INFINITY
  private pendingActivity = 0
  private initialized = false
  private busy = false
  private stopped = false
  private readonly fallbackDeadline: number

  constructor(
    private readonly sessionId: string,
    private readonly environment: IdleSessionEnvironment
  ) {
    const saved = environment.load()
    const lastActivity =
      saved && Number.isFinite(saved.lastActivity) ? saved.lastActivity : environment.now()
    this.fallbackDeadline = Math.min(
      environment.initialDeadline || Infinity,
      lastActivity + IDLE_TIMEOUT_MS
    )
  }

  stop() {
    this.stopped = true
  }

  async start() {
    await this.synchronize()
  }

  /** 页面关闭或切后台时，用 keepalive 补发节流窗口内的最后一次操作。 */
  pendingIdleMilliseconds() {
    const age = this.environment.now() - this.lastActivity
    return !this.stopped &&
      this.initialized &&
      age >= 0 &&
      age < IDLE_TIMEOUT_MS &&
      this.lastActivity > this.acknowledgedActivity + 1000
      ? age
      : undefined
  }

  /** 只由可信的人机交互触发，自动请求、聚焦和数据刷新不调用此方法。 */
  activity() {
    if (this.stopped) return
    const now = this.environment.now()
    if (!this.initialized) {
      this.pendingActivity = now
      return
    }
    this.mergeSavedActivity()
    if (this.stopped) return
    // 休眠恢复后的第一个点击不能覆盖已经到期的时间。
    if (now >= this.deadline()) {
      void this.synchronize()
      return
    }
    if (now - this.lastActivity < 1000) return
    this.lastActivity = now
    this.environment.save({ lastActivity: now })
    this.render()
    if (now - this.lastSync >= SYNC_INTERVAL_MS || this.serverDeadline - now <= 90_000)
      void this.synchronize()
  }

  async tick() {
    if (this.stopped) return
    this.mergeSavedActivity()
    if (this.stopped) return
    this.render()
    if (
      (this.initialized && this.environment.now() >= this.deadline()) ||
      this.environment.now() - this.lastSync >= SYNC_INTERVAL_MS
    )
      await this.synchronize()
  }

  private mergeSavedActivity() {
    const saved = this.environment.load()
    if (saved?.expired) {
      this.finish('invalid')
      return
    }
    if (
      saved &&
      Number.isFinite(saved.lastActivity) &&
      saved.lastActivity <= this.environment.now()
    )
      this.lastActivity = Math.max(this.lastActivity, saved.lastActivity)
  }

  private deadline() {
    if (!this.initialized) return this.fallbackDeadline
    return Math.max(
      this.serverDeadline,
      this.lastActivity ? this.lastActivity + IDLE_TIMEOUT_MS : 0
    )
  }

  private render() {
    const remaining = this.deadline() - this.environment.now()
    this.environment.display(
      Math.max(0, Math.ceil(remaining / 1000)),
      remaining > 0 && remaining <= IDLE_WARNING_MS
    )
  }

  private finish(reason: 'idle' | 'invalid') {
    if (this.stopped) return
    this.stopped = true
    this.environment.save({ lastActivity: this.lastActivity, expired: true })
    this.environment.display(0, false)
    this.environment.expire(reason)
  }

  private async synchronize() {
    if (this.stopped || this.busy) return
    this.busy = true
    this.mergeSavedActivity()
    if (this.stopped) {
      this.busy = false
      return
    }
    const now = this.environment.now()
    const sentActivity = this.lastActivity
    // 已到期只查询其他 A/B 页面是否续期，不用恢复后的交互重新激活会话。
    const age = now - sentActivity
    const renew =
      this.initialized &&
      age >= 0 &&
      age < IDLE_TIMEOUT_MS &&
      sentActivity > this.acknowledgedActivity + 1000
    try {
      const result = await this.environment.sync(renew ? age : undefined)
      if (this.stopped) return
      if (result.sessionId !== this.sessionId) {
        this.finish('invalid')
        return
      }
      const remaining = Date.parse(result.expiresAtUtc) - Date.parse(result.serverTimeUtc)
      if (!Number.isFinite(remaining) || result.idleTimeoutSeconds !== IDLE_TIMEOUT_MS / 1000)
        throw new Error('无效的会话时间')
      // 按服务器的剩余时间计算，并保守扣除请求耗时，避免客户端时区和时钟差异。
      this.serverDeadline = now + Math.min(IDLE_TIMEOUT_MS, remaining)
      if (!this.initialized) {
        this.initialized = true
        this.acknowledgedActivity = this.serverDeadline - IDLE_TIMEOUT_MS
        this.lastActivity = Math.max(this.lastActivity, this.acknowledgedActivity)
        if (this.pendingActivity && this.pendingActivity < this.serverDeadline) {
          this.lastActivity = Math.max(this.lastActivity, this.pendingActivity)
          this.environment.save({ lastActivity: this.lastActivity })
        }
        this.pendingActivity = 0
      }
      this.acknowledgedActivity = Math.max(
        this.acknowledgedActivity,
        this.serverDeadline - IDLE_TIMEOUT_MS,
        renew ? sentActivity : 0
      )
      this.environment.credentials(result)
      this.lastSync = this.environment.now()
      this.render()
      if (this.environment.now() >= this.deadline()) this.finish('idle')
    } catch (error) {
      if (this.stopped) return
      this.lastSync = this.environment.now()
      const status = (error as { status?: number }).status
      if (status === 401 || status === 403)
        this.finish(
          this.initialized && this.environment.now() >= this.deadline() ? 'idle' : 'invalid'
        )
      else if (this.environment.now() >= this.deadline()) this.finish('idle')
    } finally {
      this.busy = false
    }
  }
}
