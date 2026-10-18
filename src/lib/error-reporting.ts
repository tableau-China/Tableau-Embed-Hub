/**
 * 错误上报出口（运维闭环里的「发现」环节）。
 *
 * 设计目标：**纯静态、零后端也能用**，接后端/收集端点时只改一个环境变量。
 *
 * 行为：
 * - 开发构建（`import.meta.env.DEV`）：只写 `logger`（全局唯一 console 出口），
 *   方便本地看堆栈；**不**发网络请求，避免开发噪声。
 * - 生产构建：向构建期注入的 `VITE_ERROR_REPORT_URL` 发送 JSON；
 *   留空 = 静默跳过（模板默认情形，不打扰使用者）。
 * - 去重限流：同一 fingerprint（source + message + 堆栈头几行）在 10s 内只发一次；
 *   被限流时**返回第一次上报的 errorId**，保证界面上用户复制的 ID 一定能被查到。
 * - 任何内部失败（序列化 / sendBeacon / fetch）都**静默吞掉**，绝不反向抛错，
 *   否则错误上报本身会变成新的错误来源。
 *
 * 不引入任何依赖：sendBeacon / fetch / crypto.getRandomValues / navigator 都是浏览器原生 API。
 *
 * 隐私约定：只带 `location.pathname`（**不带 query/hash**，防止把 token、邮箱等写进日志）；
 * context 里的字段由调用方负责，禁止放凭据、密码、完整 URL 里的敏感参数。
 */

import { APP_VERSION } from '@/config/app'
import { logger } from '@/lib/logger'

/** 附加上下文：只放可 JSON 序列化的短字段（source / route / filename…） */
export type ErrorContext = Record<string, unknown>

/** 发送给收集端点的负载（字段形状固定，接入方按此解析） */
export interface ErrorReport {
  /** 短随机 ID，同时展示在错误页上，用户反馈时只需这一个值 */
  errorId: string
  /** 错误消息（截断到 1000 字符） */
  message: string
  /** 堆栈（截断到 4000 字符；非 Error 对象为 null） */
  stack: string | null
  /** 出错路由，仅 pathname（不含 query/hash） */
  route: string
  /** 构建期版本号，来自 src/config/app.ts 的 APP_VERSION（与 package.json 同步） */
  version: string
  /** 浏览器 UA（截断到 500 字符，便于区分内核） */
  userAgent: string
  /** ISO 8601 时间戳 */
  timestamp: string
  /** 调用方附加信息（来源、组件栈、文件行号等） */
  context: ErrorContext
}

/** 同 fingerprint 的限流窗口（毫秒） */
const DEDUPE_WINDOW_MS = 10_000
/** 最多记住多少个 fingerprint（防止长时间运行的页面无限增长） */
const MAX_TRACKED_FINGERPRINTS = 50
/** 堆栈与消息上限（控制请求体积，也避免超长路径把收集端打爆） */
const MAX_STACK_CHARS = 4_000
const MAX_MESSAGE_CHARS = 1_000

/** 收集端点：构建期由 VITE_ERROR_REPORT_URL 注入；空串 = 不上报 */
const REPORT_URL = ((import.meta.env.VITE_ERROR_REPORT_URL as string | undefined) ?? '').trim()

interface RecentFingerprint {
  errorId: string
  sentAt: number
}

/** fingerprint → 最近一次上报（含 errorId，用于限流时复用 ID） */
const recentFingerprints = new Map<string, RecentFingerprint>()

/** 短随机错误 ID，如 `E-1A2B3C4D5E`：base36、大写、可手抄 */
function createErrorId(): string {
  const bytes = new Uint8Array(5)
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes)
  } else {
    // 极老浏览器 / 非安全上下文兜底（随机性够生成 ID 即可，不做安全用途）
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  const raw = Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('')
  return `E-${raw.toUpperCase()}`
}

/** 把任意抛出的值归一成 message + stack（Error / string / 其它对象） */
function normalizeError(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || 'Unknown error',
      stack: error.stack ?? null,
    }
  }
  if (typeof error === 'string') return { message: error, stack: null }
  try {
    const json = JSON.stringify(error)
    return { message: json === undefined ? String(error) : json, stack: null }
  } catch {
    return { message: Object.prototype.toString.call(error), stack: null }
  }
}

/**
 * fingerprint：source + message + 堆栈前 4 行。
 * 不用完整堆栈是为了让「同一处代码反复报错」能命中限流，
 * 又不会因为行号内的随机值导致永远不命中。
 */
function fingerprintOf(message: string, stack: string | null, source: string): string {
  const stackHead = stack ? stack.split('\n').slice(0, 4).join('\n') : ''
  return `${source}\u0000${message}\u0000${stackHead}`
}

function rememberFingerprint(key: string, errorId: string, now: number): void {
  recentFingerprints.set(key, { errorId, sentAt: now })
  if (recentFingerprints.size <= MAX_TRACKED_FINGERPRINTS) return
  // 先删过期项，仍超限就按插入顺序删最旧的
  for (const [k, v] of recentFingerprints) {
    if (now - v.sentAt >= DEDUPE_WINDOW_MS) recentFingerprints.delete(k)
  }
  while (recentFingerprints.size > MAX_TRACKED_FINGERPRINTS) {
    const oldest = recentFingerprints.keys().next()
    if (oldest.done) break
    recentFingerprints.delete(oldest.value)
  }
}

/** 当前路由：只取 pathname，刻意丢弃 query / hash（可能含 token） */
function currentRoute(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname || '/'
}

/** context 清洗：去掉函数/undefined，长字符串与嵌套对象截断，环形引用降级为占位符 */
function sanitizeContext(context: ErrorContext | undefined): ErrorContext {
  const out: ErrorContext = {}
  if (!context) return out
  for (const [key, value] of Object.entries(context)) {
    if (key.length > 64) continue
    if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) continue
    if (typeof value === 'string') {
      out[key] = value.length > 1_000 ? `${value.slice(0, 1_000)}…` : value
      continue
    }
    try {
      const json = JSON.stringify(value)
      if (json === undefined) continue
      out[key] = json.length > 1_000 ? `${json.slice(0, 1_000)}…` : (JSON.parse(json) as unknown)
    } catch {
      out[key] = '[unserializable]'
    }
  }
  return out
}

/**
 * 上报体的 Content-Type。
 *
 * 为什么不是 application/json：`sendBeacon` 在跨域时按 CORS 模式发请求，
 * 而 `application/json` 属于「非 CORS-safelisted」类型 → 先发 OPTIONS 预检；
 * beacon 预检带 credentials，收集端点若返回 `Access-Control-Allow-Origin: *` 会直接失败
 * （实测：sendBeacon 返回 true 但请求从未到达，静默丢失——比报错更糟）。
 * 用 `text/plain;charset=UTF-8`（CORS-safelisted）不触发预检，beacon 能可靠送达；
 * body 仍然是 JSON 文本。**收集端请忽略 Content-Type、按 JSON 解析 body**
 * （Sentry 的 envelope 端点也是 text/plain，同理）。
 */
const REPORT_CONTENT_TYPE = 'text/plain;charset=UTF-8'

/** 真正发送：优先 sendBeacon（页面卸载时也可靠），失败回退 fetch + keepalive；全程静默 */
function sendReport(payload: ErrorReport): void {
  let body: string
  try {
    body = JSON.stringify(payload)
  } catch {
    return
  }

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: REPORT_CONTENT_TYPE })
      if (navigator.sendBeacon(REPORT_URL, blob)) return
    }
  } catch {
    // 继续走 fetch 回退
  }

  try {
    void fetch(REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': REPORT_CONTENT_TYPE },
      body,
      keepalive: true,
      mode: 'cors',
      credentials: 'omit',
    }).catch(() => {
      // 静默：收集端点不可用时不能影响用户
    })
  } catch {
    // 静默
  }
}

/**
 * 上报一个错误，返回可展示给用户的 errorId。
 *
 * @param error 捕获到的任意值（Error / Promise rejection 原因 / window.error 的 message）
 * @param context 附加信息，约定至少带 `source`：
 *   - `route-error`（路由 errorComponent）
 *   - `error-boundary`（全局渲染错误边界）
 *   - `window.onerror` / `unhandledrejection`（main.tsx 安装的全局监听）
 */
export function reportError(error: unknown, context: ErrorContext = {}): string {
  const { message, stack } = normalizeError(error)
  const source = typeof context.source === 'string' ? context.source : 'unknown'
  const now = Date.now()
  const key = fingerprintOf(message.slice(0, MAX_MESSAGE_CHARS), stack, source)

  const previous = recentFingerprints.get(key)
  if (previous && now - previous.sentAt < DEDUPE_WINDOW_MS) {
    // 限流窗口内重复：复用第一次的 ID，让用户复制的 ID 与已上报记录一致
    return previous.errorId
  }

  const errorId = createErrorId()
  rememberFingerprint(key, errorId, now)

  const report: ErrorReport = {
    errorId,
    message: message.slice(0, MAX_MESSAGE_CHARS),
    stack: stack ? stack.slice(0, MAX_STACK_CHARS) : null,
    route: currentRoute(),
    version: APP_VERSION,
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent.slice(0, 500),
    timestamp: new Date(now).toISOString(),
    context: sanitizeContext(context),
  }

  if (import.meta.env.DEV) {
    // 开发期只输出诊断信息；生产构建里这段会被摇掉（logger 本身也是 dev-only）
    logger.error(`[error-reporting] ${errorId}`, error, report)
    return errorId
  }

  // 生产未配置收集端点：默认静默跳过（模板开箱即用，不产生外部请求）
  if (!REPORT_URL) return errorId

  sendReport(report)
  return errorId
}

/** 标签页级安装标记：HMR 重新执行模块时不会重复注册监听 */
const INSTALLED_FLAG = '__shadcnAdminErrorReportingInstalled'

/**
 * 安装全局兜底监听（`window.onerror` / `unhandledrejection`）。
 *
 * 组件树内的错误由 ErrorBoundary / RouteErrorFallback 上报；这里只兜住
 * 「不在 React 渲染路径上」的异常（事件回调、异步 promise、第三方脚本）。
 * 幂等：重复调用无副作用（HMR / StrictMode 安全）。
 */
export function installGlobalErrorReporting(): void {
  if (typeof window === 'undefined') return
  const flags = window as unknown as Record<string, boolean | undefined>
  if (flags[INSTALLED_FLAG]) return
  flags[INSTALLED_FLAG] = true

  window.addEventListener('error', (event) => {
    // 没有 event.error 时（跨域脚本只给 message）用 message 包一层
    reportError(event.error ?? event.message, {
      source: 'window.onerror',
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason ?? 'Unhandled promise rejection', {
      source: 'unhandledrejection',
    })
  })
}
