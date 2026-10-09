/**
 * Tableau **定时计划 / 后台作业**的纯领域逻辑（无 React、无 fetch、无 store）。
 *
 * 页面（features/tableau/tableau-schedules-page.tsx）只做「取数 + 渲染」，所有判断都在这里：
 *   · Tableau 的 JSON 形状很松散（数字是字符串、字段可缺、Server 与 Cloud 结构不同）
 *     —— 解析必须容错，且**只认文档承诺的字段**；
 *   · 频率（frequencyDetails）要变成人话（"每天 23:30" / "每周四 17:05"）；
 *   · 作业状态/类型要映射成展示名（常量映射表：check-i18n-keys 只认字面量 key，不认模板拼接）。
 *
 * 数据类型来源（2026-10 核对官方引用页）：
 *   · 提取刷新任务 GET /sites/{id}/tasks/extractRefreshes —— Cloud 返回轻量 schedule
 *     （frequency + nextRunAt + frequencyDetails），**没有 schedule id**，所以任务与作业
 *     之间无法按 id 关联 —— 页面上是两个独立的表，不假装能连起来。
 *   · 订阅计划 GET /sites/{id}/subscriptions —— Cloud 返回内联 frequency 的 schedule，
 *     与提取任务的 schedule 同形，因此共用 parseSchedule。
 *   · 后台作业 GET /sites/{id}/jobs —— 行只有 id/status/时间/jobType，**没有对象名**；
 *     对象名要去 GET /sites/{id}/jobs/{job-id} 拿（页面按需展开时再取）。
 */

/* ============================== 频率（schedule） ============================== */

/** Tableau 的星期原文（frequencyDetails.intervals.interval[].weekDay） */
export const TABLEAU_WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

/** 星期序号（0 = 周日）→ 展示名 i18n key。与 Date#getDay 同序，做相对时间时不用换算 */
export const WEEKDAY_LABEL_KEYS: Record<number, string> = {
  0: 'tableauSchedules.weekday.sun',
  1: 'tableauSchedules.weekday.mon',
  2: 'tableauSchedules.weekday.tue',
  3: 'tableauSchedules.weekday.wed',
  4: 'tableauSchedules.weekday.thu',
  5: 'tableauSchedules.weekday.fri',
  6: 'tableauSchedules.weekday.sat',
}

export interface TaskSchedule {
  /** Tableau 原文频率：Daily / Weekly / Hourly / Monthly… */
  frequency?: string
  nextRunAt?: string
  /** 起始时刻 'HH:MM:SS' */
  start?: string
  end?: string
  /** 频率明细里出现的星期（原文，按 Tableau 顺序升序去重） */
  weekDays: string[]
  /** 频率明细里的间隔小时（{\"hours\":\"24\"}） */
  hours?: number
}

/**
 * 解析 schedule 节点（提取刷新任务与订阅计划同形）。
 *
 * 容错点：`intervals.interval` 在只有一个 interval 时可能是对象而不是数组
 * （XML→JSON 的老毛病），这里统一成数组再取字段。
 */
export function parseSchedule(raw: unknown): TaskSchedule {
  const node = (raw ?? {}) as Record<string, unknown>
  const details = (node.frequencyDetails ?? {}) as Record<string, unknown>
  const intervals = (details.intervals ?? {}) as Record<string, unknown>
  const list = toArray(intervals.interval)
  const weekDays: string[] = []
  let hours: number | undefined
  for (const item of list) {
    const entry = (item ?? {}) as Record<string, unknown>
    if (typeof entry.weekDay === 'string' && entry.weekDay !== '') weekDays.push(entry.weekDay)
    const h = Number(entry.hours)
    if (Number.isFinite(h) && h > 0) hours = h
  }
  return {
    frequency: text(node.frequency),
    nextRunAt: text(node.nextRunAt),
    start: text(details.start),
    end: text(details.end),
    weekDays: TABLEAU_WEEKDAYS.filter((day) => weekDays.includes(day)),
    hours,
  }
}

/** 把 'HH:MM:SS' 截成 'HH:MM'（展示用；Tableau 的时刻永远带秒） */
export function formatClock(value?: string): string | undefined {
  if (!value) return undefined
  const parts = value.split(':')
  if (parts.length < 2) return value
  return `${parts[0].padStart(2, '0')}:${parts[1]}`
}

/** 人话频率：页面据此选 i18n 模板（不在纯函数里拼句子，翻译才不会漏） */
export interface Cadence {
  kind: 'daily' | 'weekly' | 'hourly' | 'custom'
  /** 'HH:MM' */
  time?: string
  /** 0=周日 … 6=周六，升序 */
  weekDays: number[]
  /** 小时间隔（kind = hourly 时给出） */
  hours?: number
}

export function describeCadence(schedule: TaskSchedule): Cadence {
  const time = formatClock(schedule.start)
  const weekDays = schedule.weekDays
    .map((day) => TABLEAU_WEEKDAYS.indexOf(day as (typeof TABLEAU_WEEKDAYS)[number]))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)

  const frequency = (schedule.frequency ?? '').toLowerCase()
  if (frequency === 'daily') return { kind: 'daily', time, weekDays: [], hours: undefined }
  if (frequency === 'weekly') return { kind: 'weekly', time, weekDays, hours: undefined }
  if (frequency === 'hourly') return { kind: 'hourly', time, weekDays: [], hours: schedule.hours }
  // 没给 frequency（或给了没见过的值）时退回 interval 推断：24 小时 = 每天。
  // 刻意不猜别的：猜错会把"每小时"说成"每天"，比显示"自定义"更糟。
  if (schedule.hours === 24) return { kind: 'daily', time, weekDays: [], hours: undefined }
  return { kind: 'custom', time, weekDays, hours: schedule.hours }
}

/* ============================== 提取刷新任务 ============================== */

export interface ExtractRefreshTask {
  id: string
  /** Tableau 原文类型（RefreshExtractTask / RefreshExtract…） */
  type: string
  priority?: string
  /** 连续失败次数（0 = 最近一次成功；Tableau 自己累计，不是本应用算的） */
  consecutiveFailedCount: number
  workbookId?: string
  datasourceId?: string
  schedule: TaskSchedule
}

export function parseExtractRefreshTask(raw: unknown): ExtractRefreshTask {
  const node = (raw ?? {}) as Record<string, unknown>
  const extract = (node.extractRefresh ?? {}) as Record<string, unknown>
  const workbook = (extract.workbook ?? {}) as Record<string, unknown>
  const datasource = (extract.datasource ?? {}) as Record<string, unknown>
  const failed = Number(extract.consecutiveFailedCount)
  return {
    id: text(extract.id) ?? '',
    type: text(extract.type) ?? '',
    priority: text(extract.priority),
    consecutiveFailedCount: Number.isFinite(failed) ? failed : 0,
    workbookId: text(workbook.id),
    datasourceId: text(datasource.id),
    schedule: parseSchedule(extract.schedule),
  }
}

/* ============================== 订阅计划 ============================== */

export interface ExtractRefreshSubscription {
  id: string
  subject?: string
  message?: string
  /** 'true' / 'false'（Tableau 用字符串回布尔） */
  suspended: boolean
  contentId?: string
  /** Workbook / View … */
  contentType?: string
  /** 订阅接收人（登录名，通常是邮箱） */
  userName?: string
  schedule: TaskSchedule
}

export function parseSubscription(raw: unknown): ExtractRefreshSubscription {
  const node = (raw ?? {}) as Record<string, unknown>
  const content = (node.content ?? {}) as Record<string, unknown>
  const user = (node.user ?? {}) as Record<string, unknown>
  return {
    id: text(node.id) ?? '',
    subject: text(node.subject),
    message: text(node.message),
    suspended: node.suspended === true || node.suspended === 'true',
    contentId: text(content.id),
    contentType: text(content.type),
    userName: text(user.name),
    schedule: parseSchedule(node.schedule),
  }
}

/* ============================== 后台作业 ============================== */

export interface BackgroundJob {
  id: string
  /** Success / Failed / InProgress / Pending / Cancelled…（原文，展示与配色都走下面的映射） */
  status: string
  /** Cloud 回小写：run_flow / refresh_extracts / increment_extracts… */
  jobType: string
  createdAt?: string
  startedAt?: string
  endedAt?: string
  priority?: string
}

export function parseBackgroundJob(raw: unknown): BackgroundJob {
  const node = (raw ?? {}) as Record<string, unknown>
  return {
    id: text(node.id) ?? '',
    status: text(node.status) ?? '',
    jobType: text(node.jobType) ?? '',
    createdAt: text(node.createdAt),
    startedAt: text(node.startedAt),
    endedAt: text(node.endedAt),
    priority: text(node.priority),
  }
}

/** 作业状态等级（决定徽章配色）：只区分「成功 / 失败 / 进行中 / 其它」 */
export type JobStatusTier = 'success' | 'failed' | 'running' | 'neutral'

export function jobStatusTier(status: string): JobStatusTier {
  const value = status.toLowerCase()
  if (value === 'success') return 'success'
  if (value === 'failed') return 'failed'
  if (value === 'inprogress' || value === 'pending') return 'running'
  return 'neutral'
}

/** 状态 → 展示名 i18n key（原文按小写匹配；未知状态原样显示 Tableau 返回值） */
export const JOB_STATUS_LABEL_KEYS: Record<string, string> = {
  success: 'tableauSchedules.jobStatus.success',
  failed: 'tableauSchedules.jobStatus.failed',
  inprogress: 'tableauSchedules.jobStatus.inProgress',
  pending: 'tableauSchedules.jobStatus.pending',
  cancelled: 'tableauSchedules.jobStatus.cancelled',
}

export function jobStatusLabelKey(status: string): string | null {
  return JOB_STATUS_LABEL_KEYS[status.toLowerCase()] ?? null
}

/** 作业类型 → 展示名 i18n key（Cloud 的取值是小写下划线形式） */
export const JOB_TYPE_LABEL_KEYS: Record<string, string> = {
  run_flow: 'tableauSchedules.jobType.runFlow',
  refresh_extracts: 'tableauSchedules.jobType.refreshExtracts',
  increment_extracts: 'tableauSchedules.jobType.incrementExtracts',
  run_subscription: 'tableauSchedules.jobType.runSubscription',
}

export function jobTypeLabelKey(jobType: string): string | null {
  return JOB_TYPE_LABEL_KEYS[jobType.toLowerCase()] ?? null
}

/**
 * 作业按时间倒序（最近的在最前）。
 *
 * 列表接口按 createdAt **升序**返回（实测：4 条 run_flow 从 9/14 到 10/5），
 * 直接渲染会把最旧的一条放在最上面 —— 而"最近跑成什么样"才是看这一页的目的。
 * 排序只是展示口径：不过滤、不截断（截断窗口由 Tableau 决定，本应用不自加）。
 */
export function sortJobsNewestFirst(jobs: readonly BackgroundJob[]): BackgroundJob[] {
  return [...jobs].sort((a, b) => jobTimestamp(b) - jobTimestamp(a))
}

function jobTimestamp(job: BackgroundJob): number {
  const value = job.startedAt ?? job.createdAt
  const time = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(time) ? time : 0
}

/** 耗时（开始 → 结束）。缺任一端或时间倒挂都回 '—'，不猜。 */
export function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return '—'
  const ms = Date.parse(end) - Date.parse(start)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) return `${minutes}m ${String(totalSeconds % 60).padStart(2, '0')}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
}

/* ============================== 作业详情（按需展开才取） ============================== */

export interface BackgroundJobDetail {
  id: string
  /** 作业类型原文：RunFlow / RefreshExtract…（与列表里的 jobType 大小写不同，以 detail 为准展示） */
  type?: string
  progress?: string
  finishCode?: string
  createdAt?: string
  startedAt?: string
  completedAt?: string
  /** 作业对象类型（flow / workbook / datasource / view / metric） */
  objectKind?: string
  /** 作业对象名（Flow 名 / 工作簿名…）—— 列表行里拿不到，只有详情有 */
  objectName?: string
}

/**
 * 从作业详情的各种 `*JobType` 包装里取「作业对象」。
 *
 * 为什么不写死 `runFlowJobType.flow`：Tableau 每个作业类型一个包装键
 * （runFlowJobType / extractRefreshJobType / runSubscriptionJobType…），
 * 写死等于每支持一种作业就改一次解析。这里按「包装 → 已知对象键」两层扫，
 * 命中的第一个带 id 的对象即为目标；扫不到就返回空（页面显示 \"—\"）。
 */
const JOB_TARGET_KEYS = ['flow', 'workbook', 'datasource', 'view', 'metric', 'subscription'] as const

function extractJobTarget(job: Record<string, unknown>): { kind?: string; name?: string } {
  for (const wrapper of Object.values(job)) {
    if (!wrapper || typeof wrapper !== 'object' || Array.isArray(wrapper)) continue
    for (const key of JOB_TARGET_KEYS) {
      const target = (wrapper as Record<string, unknown>)[key]
      if (target && typeof target === 'object' && text((target as Record<string, unknown>).id)) {
        return { kind: key, name: text((target as Record<string, unknown>).name) }
      }
    }
  }
  return {}
}

export function parseJobDetail(raw: unknown): BackgroundJobDetail {
  const job = ((raw ?? {}) as Record<string, unknown>).job as Record<string, unknown> | undefined
  const node = job ?? {}
  const target = extractJobTarget(node)
  return {
    id: text(node.id) ?? '',
    type: text(node.type),
    progress: text(node.progress),
    finishCode: text(node.finishCode),
    createdAt: text(node.createdAt),
    startedAt: text(node.startedAt),
    completedAt: text(node.completedAt),
    objectKind: target.kind,
    objectName: target.name,
  }
}

/* ============================== 小工具 ============================== */

/** Tableau 的数字/布尔常以字符串返回；只把非空字符串当有效值 */
function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value === '' ? undefined : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

/** 单个 interval 时 Tableau 可能不包数组 */
function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  return value === undefined || value === null ? [] : [value]
}
