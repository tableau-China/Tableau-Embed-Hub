import { TABLEAU_CONFIG } from '@/config/tableau'
import { createTableauJwt, type TableauScope } from '@/lib/tableau-jwt'
import { queryClient } from '@/lib/query-client'

/**
 * Tableau REST 传输层 —— **所有 REST 调用的唯一出口**。
 *
 * 为什么从 `tableau-api.ts` 里抽出来：0.13 起 REST 的使用面从「内容只读」扩到了三个能力域，
 * 而每个域需要的 Connected App JWT scope 不同（scope 就是 Tableau 侧的授权边界）：
 *
 *   content    —— 工作簿 / 视图 / 预览图（既有能力，scope 一个没动）
 *   site-users —— 站点用户列表 + 修改站点角色：读与写都要 `tableau:users:*`
 *   site-tasks —— 提取刷新任务 / 后台作业 / 订阅计划：`tableau:tasks:read` + `tableau:jobs:read`
 *
 * 分域令牌的两个理由：
 *   1. **按需申请**：官方文档明确 "All subsequent REST API requests using the Tableau access token
 *      are then bounded by the scopes in the JWT" —— 给内容只读的请求签发一张能改用户角色的令牌，
 *      没有必要（范围越小，令牌意外外泄时的可操作面越小）。
 *   2. **互不拖累**：每个域一条认证 Query（queryKey 带域 id），single-flight 与过期/401 自愈
 *      各自独立；某个域限流失败不会把其它域的查询一起打成错误态。
 *
 * ⚠️ 这**不是**安全边界：纯前端把 Connected App 密钥内联进 bundle，拿得到产物的人本来就能
 * 自行签发任意 scope 的 JWT。分域只减少无谓暴露，不阻止伪造 —— 真正的边界在 Tableau 后台
 * （域名白名单 / 访问级别 / 密钥轮换）与「把签发搬到后端」，见 docs/tableau-setup.md。
 */

/* ============================== 错误 ============================== */

/** Tableau REST 错误（带 HTTP 状态码 + Tableau 错误码，供调用方按状态/错误码分类处理） */
export class TableauApiError extends Error {
  readonly status: number
  /** Tableau 业务错误码（如 400013 无效站点角色 / 409014 许可证不足）；错误体不是 Tableau JSON 时为 undefined */
  readonly code?: string
  /** Tableau 原始 detail。⚠️ 会被站点语言本地化（演示站点返回中文），只用于展示兜底与排查，不要拿它做判断 */
  readonly detail?: string

  constructor(message: string, status: number, options: { code?: string; detail?: string } = {}) {
    super(message)
    this.name = 'TableauApiError'
    this.status = status
    this.code = options.code
    this.detail = options.detail
  }
}

/**
 * 认证（signin）阶段错误：与业务请求错误区分开。
 * 认证是共享资源——signin 失败（限流/凭据问题）时，任何业务查询的重试
 * 都只会放大对 signin 端点的压力（重试风暴），因此业务层对这类错误一律不重试。
 */
export class TableauAuthError extends TableauApiError {}

/* ============================== 能力域 → scope ============================== */

/**
 * 能力域 id。**这就是 JWT 的 scope 分组键**，也是认证 Query 的缓存键后缀。
 *
 * 值写死在类型里（而不是从调用方传 scope 数组）：scope 属于「这一域的授权契约」，
 * 散落在各页面的 fetch 调用里迟早会漂移成三种不同写法。
 */
export type TableauScopeSetId = 'content' | 'site-users' | 'site-tasks'

/** 能力域 → 该域一次 signin 申请的 scope 集合（改动这里等于改动对 Tableau 的授权声明） */
export const TABLEAU_SCOPE_SETS: Record<TableauScopeSetId, readonly TableauScope[]> = {
  /**
   * 内容域：沿用 0.7.0 起的原样 scope —— 现有页面（workbooks / views / favorites / recents）
   * 的行为一行都没变。`tableau:workbooks:*` 与 `tableau:views:*` 是历史写法，
   * 本次**刻意不动**（动了就要回归嵌入与预览图整条链路）。
   */
  content: ['tableau:content:read', 'tableau:views:*', 'tableau:workbooks:*'],
  /**
   * 站点用户域：`tableau:users:*` 是官方文档承认的通配（get/list + add + delete + update）。
   * 为什么不用更细的 `tableau:users:update`：它是 API 3.27（2025-12）才加的，
   * 而本项目默认 API 版本是 3.23；实测 3.23 上通配可读可写、细粒度 scope 不存在。
   */
  'site-users': ['tableau:users:*'],
  /**
   * 定时计划域：任务列表与作业列表是两种 scope，缺一不可
   * （实测：只给 tasks:read 时 /jobs 返回 401002，只给 jobs:read 时 /tasks/extractRefreshes 返回 401002）。
   * 订阅计划（/subscriptions）实测同样由 `tableau:tasks:read` 覆盖。
   * 不用 `tableau:tasks:*`：本域只读，不需要 create/update/delete/run。
   * 也不用 `tableau:schedules:read`：Tableau Cloud 不提供 /schedules（实测 403 "此站点不支持管理员计划"）。
   */
  'site-tasks': ['tableau:tasks:read', 'tableau:jobs:read'],
}

/* ============================== 认证：REST 令牌即一条 Query ============================== */

interface CachedAuth {
  token: string
  siteId: string
  /** JWT `sub`（嵌入用户）对应的 Tableau 用户 id；响应缺该字段时为 undefined */
  userId?: string
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

function authQueryKey(scopeSetId: TableauScopeSetId) {
  return ['tableau', 'auth', scopeSetId] as const
}

/** 用 JWT 换取 REST API access token（POST /auth/signin）—— 某能力域认证查询的 queryFn */
async function signIn(scopeSetId: TableauScopeSetId): Promise<CachedAuth> {
  const jwt = await createTableauJwt(TABLEAU_SCOPE_SETS[scopeSetId])
  const res = await fetch(
    `${TABLEAU_CONFIG.apiBaseUrl}/api/${TABLEAU_CONFIG.apiVersion}/auth/signin`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        credentials: {
          jwt,
          site: { contentUrl: TABLEAU_CONFIG.siteContentUrl },
        },
      }),
    },
  )
  if (!res.ok) {
    throw new TableauAuthError(
      `Tableau signin failed (${scopeSetId}): ${res.status} ${(await safeText(res)).slice(0, 200)}`,
      res.status,
    )
  }
  const data = (await res.json()) as {
    credentials?: { token?: string; site?: { id?: string }; user?: { id?: string } }
  }
  const token = data.credentials?.token
  const siteId = data.credentials?.site?.id
  if (!token || !siteId) {
    throw new TableauAuthError('Tableau signin response missing token/siteId', res.status)
  }
  return { token, siteId, userId: data.credentials?.user?.id }
}

/**
 * 获取某能力域的 REST 访问令牌 —— 统一走 Query 缓存层（替代旧模块级 authCache）：
 * - staleTime = 令牌有效期(5 分钟) − 1 分钟余量：窗口内并发调用共享同一令牌（single-flight）
 * - gcTime = Infinity：应用存活期间不回收
 * - 令牌意外提前失效由 apiRequest 的 401 → invalidate → 重试 闭环兜底，
 *   不再依赖「掐时间判断过期」。
 */
export async function getAccessToken(scopeSetId: TableauScopeSetId): Promise<CachedAuth> {
  try {
    return await queryClient.fetchQuery({
      queryKey: authQueryKey(scopeSetId),
      queryFn: () => signIn(scopeSetId),
      staleTime: TABLEAU_CONFIG.tokenTtlSeconds * 1000 - 60_000,
      gcTime: Infinity,
      // signin 失败不自动重试：失败原因（限流/凭据）不会因立即重试而消失，
      // 且业务查询的 retry 会经 getAccessToken 再次触发 signin（single-flight 共享一次尝试），
      // 这里重试只会让「一次失败」变成「N 次对 signin 端点的冲击」。
      retry: false,
    })
  } catch (err) {
    // signin 失败：移除错误态缓存，让下一次调用（业务层重试 / 用户刷新）能重新发起登录，
    // 而不是让失败结果停留在缓存里阻塞所有后续请求。
    if (err instanceof TableauAuthError) {
      void queryClient.removeQueries({ queryKey: authQueryKey(scopeSetId) })
    }
    throw err
  }
}

/** 作废某能力域的认证缓存：令牌 401 后调用，下一次 getAccessToken 会重新登录 */
function invalidateAuth(scopeSetId: TableauScopeSetId): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: authQueryKey(scopeSetId) })
}

/* ============================== 请求 ============================== */

export interface TableauRequestInit {
  method?: string
  headers?: Record<string, string>
  body?: string
}

/** Tableau 的错误体形状（`{"error":{"summary","detail","code"}}`） */
interface TableauErrorBody {
  error?: { summary?: string; detail?: string; code?: string }
}

/**
 * 构造可分类的 REST 错误。
 * 只有 JSON 错误体才去解析业务码 —— 图片端点出错时响应体是二进制，硬解析会抛二次异常。
 */
async function toApiError(path: string, res: Response): Promise<TableauApiError> {
  let summary = ''
  let detail = ''
  let code: string | undefined
  if ((res.headers.get('content-type') ?? '').includes('json')) {
    try {
      const body = (await res.json()) as TableauErrorBody
      summary = body.error?.summary ?? ''
      detail = body.error?.detail ?? ''
      code = body.error?.code
    } catch {
      // 声称 JSON 实则不是：保持空值，下面用状态码兜底
    }
  }
  const head = `Tableau API ${path} failed: ${res.status}${code ? ` (${code})` : ''}`
  const message = summary || detail ? `${head} ${summary}${detail ? ` — ${detail.slice(0, 200)}` : ''}` : head
  return new TableauApiError(message, res.status, { code, detail })
}

/**
 * 带认证头的 REST 请求：401 → 作废认证缓存 → 重新登录 → 重试一次。
 * 比「提前 30 秒判断过期」更可靠：即使时钟偏差或密钥轮换导致令牌提前失效也能自愈。
 *
 * ⚠️ 重试只对 **401** 生效：写操作（PUT/POST）在 401 时尚未被服务端执行，重放是安全的；
 * 其它错误（含 5xx）一律不自动重放，避免把一次写变成两次。
 */
export async function apiRequest<T>(
  scopeSetId: TableauScopeSetId,
  path: string,
  init: TableauRequestInit,
  parse: (res: Response) => Promise<T>,
  attempt = 0,
): Promise<T> {
  const { token } = await getAccessToken(scopeSetId)
  const res = await fetch(
    `${TABLEAU_CONFIG.apiBaseUrl}/api/${TABLEAU_CONFIG.apiVersion}${path}`,
    { ...init, headers: { ...init.headers, 'X-Tableau-Auth': token } },
  )
  if (res.status === 401 && attempt === 0) {
    await invalidateAuth(scopeSetId)
    return apiRequest(scopeSetId, path, init, parse, attempt + 1)
  }
  if (!res.ok) {
    throw await toApiError(path, res)
  }
  return parse(res)
}

/** REST GET（默认带 `Accept: application/json`） */
export function apiGet<T>(scopeSetId: TableauScopeSetId, path: string): Promise<T> {
  return apiRequest(scopeSetId, path, { headers: { Accept: 'application/json' } }, (res) =>
    res.json() as Promise<T>,
  )
}

/**
 * REST 写请求（PUT / POST），JSON 请求体。
 *
 * 返回值是**响应文本**而不是解析后的对象：Tableau 有一半写方法回 200 + 空体、一半回 200 + 实体，
 * 调用方几乎都不看返回值（成功即由 Query 失效 + 重取确认），强行解析只会多一条失败路径。
 */
export function apiSend(
  scopeSetId: TableauScopeSetId,
  method: 'PUT' | 'POST',
  path: string,
  body: unknown,
): Promise<string> {
  return apiRequest(
    scopeSetId,
    path,
    {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    },
    (res) => safeText(res),
  )
}

/* ============================== 重试策略 ============================== */

/**
 * 业务查询的统一重试策略：仅瞬时故障（网络错误 / 5xx / 429）重试 1 次。
 *
 * 来自 tableau-api.ts 里原先只为预览图写的那份 —— 0.13 起所有能力域共用同一策略，
 * 免得三个模块各写一遍再各自漂移：
 *   · 认证错误不重试：signin 是共享资源，业务查询重试只会放大对 signin 端点的压力；
 *   · 4xx（除 429）属确定性失败：重试不会改变结果，只会把服务端压力乘以 2。
 */
export function tableauRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  if (error instanceof TableauAuthError) return false
  if (
    error instanceof TableauApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429
  ) {
    return false
  }
  return true
}

/* ============================== 分页 ============================== */

/**
 * 列表接口每页条数（Tableau 分页参数的默认值与上限：默认 100，最大 1000）。
 * 取默认值 100 是**用户确认过的阈值**（本项目约定：批量大小这类固定阈值不自行取值）。
 */
export const TABLEAU_PAGE_SIZE = 100

interface TableauPagination {
  pageNumber?: string
  pageSize?: string
  totalAvailable?: string
}

/** 单页响应：行 + 服务端回传的分页信息 */
export interface TableauPage<T> {
  rows: T[]
  pagination?: TableauPagination
}

/**
 * 翻页取全量。
 *
 * 终止条件只有两个，都是**服务端给的事实**，不设「最多 N 页」这种自造阈值：
 *   1. 某页返回 0 行 —— 服务端已无更多数据（也顺带保证 totalAvailable 失真时不会死循环）；
 *   2. 已取行数 ≥ totalAvailable。
 * 服务端没回分页信息时视为单页数据（不猜）。
 */
export async function fetchAllPages<T>(
  scopeSetId: TableauScopeSetId,
  buildPath: (page: number) => string,
  pick: (body: unknown) => TableauPage<T>,
): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; ; page += 1) {
    const { rows, pagination } = pick(await apiGet<unknown>(scopeSetId, buildPath(page)))
    out.push(...rows)
    if (rows.length === 0) break
    const total = Number(pagination?.totalAvailable)
    if (!Number.isFinite(total) || out.length >= total) break
  }
  return out
}
