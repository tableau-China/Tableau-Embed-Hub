import { queryOptions } from '@tanstack/react-query'

import { TABLEAU_CONFIG } from '@/config/tableau'
import { createTableauJwt } from '@/lib/tableau-jwt'
import { queryClient } from '@/lib/query-client'

export interface TableauWorkbook {
  id: string
  name: string
  contentUrl: string
  projectName?: string
  updatedAt?: string
  showTabs?: boolean
  /** 默认视图 ID（Tableau 中打开工作簿时默认展示的视图） */
  defaultViewId?: string
}

export interface TableauView {
  id: string
  name: string
  contentUrl: string
}

interface CachedAuth {
  token: string
  siteId: string
}

/** Tableau REST 错误（带 HTTP 状态码，供调用方按状态分类处理） */
export class TableauApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'TableauApiError'
    this.status = status
  }
}

/**
 * 认证（signin）阶段错误：与业务请求错误区分开。
 * 认证是共享资源——signin 失败（限流/凭据问题）时，任何业务查询的重试
 * 都只会放大对 signin 端点的压力（重试风暴），因此业务层对这类错误一律不重试。
 */
export class TableauAuthError extends TableauApiError {}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

/* ==================== 认证：REST 令牌即一条 Query ==================== */

const authQueryKey = ['tableau', 'auth'] as const

/** 用 JWT 换取 REST API access token（POST /auth/signin）—— 认证查询的 queryFn */
async function signIn(): Promise<CachedAuth> {
  const jwt = await createTableauJwt(['tableau:content:read', 'tableau:views:*', 'tableau:workbooks:*'])
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
      `Tableau signin failed: ${res.status} ${(await safeText(res)).slice(0, 200)}`,
      res.status,
    )
  }
  const data = (await res.json()) as {
    credentials?: { token?: string; site?: { id?: string } }
  }
  const token = data.credentials?.token
  const siteId = data.credentials?.site?.id
  if (!token || !siteId) {
    throw new TableauAuthError('Tableau signin response missing token/siteId', res.status)
  }
  return { token, siteId }
}

/**
 * 获取 REST 访问令牌 —— 统一走 Query 缓存层（替代旧模块级 authCache）：
 * - staleTime = 令牌有效期(5 分钟) − 1 分钟余量：窗口内并发调用共享同一令牌（single-flight）
 * - gcTime = Infinity：应用存活期间不回收
 * - 令牌意外提前失效由 apiRequest 的 401 → invalidate → 重试 闭环兜底，
 *   不再依赖「掐时间判断过期」。
 */
export async function getAccessToken(): Promise<CachedAuth> {
  try {
    return await queryClient.fetchQuery({
      queryKey: authQueryKey,
      queryFn: signIn,
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
      void queryClient.removeQueries({ queryKey: authQueryKey })
    }
    throw err
  }
}

/** 作废认证缓存：令牌 401 后调用，下一次 getAccessToken 会重新登录 */
function invalidateAuth(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: authQueryKey })
}

/**
 * 带认证头的 REST 请求：401 → 作废认证缓存 → 重新登录 → 重试一次。
 * 比「提前 30 秒判断过期」更可靠：即使时钟偏差或密钥轮换导致令牌提前失效也能自愈。
 */
async function apiRequest<T>(
  path: string,
  headers: Record<string, string>,
  parse: (res: Response) => Promise<T>,
  attempt = 0,
): Promise<T> {
  const { token } = await getAccessToken()
  const res = await fetch(
    `${TABLEAU_CONFIG.apiBaseUrl}/api/${TABLEAU_CONFIG.apiVersion}${path}`,
    { headers: { ...headers, 'X-Tableau-Auth': token } },
  )
  if (res.status === 401 && attempt === 0) {
    await invalidateAuth()
    return apiRequest(path, headers, parse, attempt + 1)
  }
  if (!res.ok) {
    throw new TableauApiError(
      `Tableau API ${path} failed: ${res.status} ${(await safeText(res)).slice(0, 200)}`,
      res.status,
    )
  }
  return parse(res)
}

function apiGet<T>(path: string): Promise<T> {
  return apiRequest(path, { Accept: 'application/json' }, (res) => res.json() as Promise<T>)
}

/** 站点内 workbooks 列表 */
export async function fetchWorkbooks(): Promise<TableauWorkbook[]> {
  const { siteId } = await getAccessToken()
  // ⚠️ fields 参数不能用 projectName（Tableau 会 400 拒绝整个请求，error 409004）；
  // 项目名在响应里以 location.name（部分版本 project.name）返回。
  // 项目限制：REST API 不受已连接应用"访问级别"约束（该限制仅作用于嵌入），
  // 也没有项目级 JWT claim，故在应用侧用 filter=projectName:eq:... 实现同等限制。
  const filter = TABLEAU_CONFIG.restrictedProjectName
    ? `&filter=projectName:eq:${encodeURIComponent(TABLEAU_CONFIG.restrictedProjectName)}`
    : ''
  const data = await apiGet<{
    workbooks?: { workbook?: Array<Record<string, unknown>> }
  }>(
    `/sites/${siteId}/workbooks?fields=id,name,contentUrl,updatedAt,showTabs,defaultViewId${filter}`,
  )
  const rows = data.workbooks?.workbook ?? []
  return rows.map((w) => {
    const location = (w.location ?? w.project ?? {}) as Record<string, unknown>
    return {
      id: String(w.id ?? ''),
      name: String(w.name ?? ''),
      contentUrl: String(w.contentUrl ?? ''),
      projectName: location.name ? String(location.name) : undefined,
      updatedAt: w.updatedAt ? String(w.updatedAt) : undefined,
      // Tableau 以字符串 "true"/"false" 返回布尔字段，需按字符串比较
      showTabs: w.showTabs === 'true' || w.showTabs === true,
      defaultViewId: w.defaultViewId ? String(w.defaultViewId) : undefined,
    }
  })
}

/** 某个 workbook 的 views 列表 */
export async function fetchWorkbookViews(workbookId: string): Promise<TableauView[]> {
  const { siteId } = await getAccessToken()
  const data = await apiGet<{ views?: { view?: Array<Record<string, unknown>> } }>(
    `/sites/${siteId}/workbooks/${workbookId}/views?fields=id,name,contentUrl`,
  )
  const rows = data.views?.view ?? []
  return rows.map((v) => ({
    id: String(v.id ?? ''),
    name: String(v.name ?? ''),
    contentUrl: String(v.contentUrl ?? ''),
  }))
}

export interface TableauViewDetail {
  id: string
  name: string
  /** 视图 contentUrl（"{wbContentUrl}/sheets/{viewUrlName}"） */
  contentUrl: string
  /** 视图 URL 名称（Tableau URL 路径片段，URL 安全） */
  viewUrlName?: string
  /** 所属工作簿 UUID */
  workbookId: string
  /** 所属工作簿 contentUrl（视图 contentUrl 首段，URL 安全） */
  workbookContentUrl?: string
}

/**
 * 按视图 UUID 查询视图详情（GET /views/{viewId}）。
 * 用于 /views?view=<uuid> 单参数打开：返回视图及其所属工作簿信息，
 * 无需前端再传 workbook id。
 */
export async function fetchViewDetail(viewId: string): Promise<TableauViewDetail | null> {
  const { siteId } = await getAccessToken()
  try {
    // 不带 fields：需同时取 workbook / viewUrlName / contentUrl（fields 白名单不含全部所需字段）
    const data = await apiGet<{ view?: Record<string, unknown> }>(
      `/sites/${siteId}/views/${viewId}`,
    )
    const v = data.view
    if (!v?.id || !v?.name) return null
    const wb = (v.workbook ?? {}) as Record<string, unknown>
    const contentUrl = String(v.contentUrl ?? '')
    return {
      id: String(v.id),
      name: String(v.name),
      contentUrl,
      viewUrlName: v.viewUrlName ? String(v.viewUrlName) : undefined,
      workbookId: wb.id ? String(wb.id) : '',
      workbookContentUrl: contentUrl.split('/')[0] || undefined,
    }
  } catch {
    return null
  }
}

/* ==================== 预览图（previewImage）：blob 也是 Query ==================== */

/**
 * 预览图请求并发上限：Tableau 的 /image 端点是服务端实时渲染，
 * 无节制并发会让请求排队、延迟相互放大（实测 12 并发平均 2.6s/张、最慢 6.4s），
 * 高负载下还会触发瞬时失败。这里是旧 thumbnail-cache 同款信号量防护
 * （迁移到 Query 层时不应丢弃：Query 的同 key 去重解决不了「不同 key 的并发洪峰」）。
 */
const PREVIEW_CONCURRENCY = 3

function createLimiter(max: number) {
  let active = 0
  const queue: Array<() => void> = []
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve))
    active++
    try {
      return await task()
    } finally {
      active--
      queue.shift()?.()
    }
  }
}

const limitPreviewRequests = createLimiter(PREVIEW_CONCURRENCY)

/**
 * 预览图持久缓存（Cache API，24 小时 TTL）：
 * /image 响应不带任何缓存头（实测 cache-control: null，仅 vary: Origin），
 * 浏览器 HTTP 缓存失效 → 每次刷新都全量重拉（1~6 秒/张）。
 * 预览图内容在 24 小时内视为不变，应用层手动缓存，刷新秒开。
 * Cache API 不可用（隐私模式等）时静默降级为直连。
 */
const PREVIEW_CACHE_NAME = 'tableau-previews-v1'
const PREVIEW_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * workbook / view 预览图 blob（带 X-Tableau-Auth 认证头，经 /tableau-proxy 同源代理）。
 * 走 blob 而非 <img src>：浏览器 img 无法携带认证头。
 * 端点与老项目 pg-explorer 一致：
 * - workbook: /workbooks/{id}/previewImage?maxAge=60
 * - view:     /views/{id}/image?maxAge=60&resolution=high（previewImage 在 Cloud 返回 404，用导出端点）
 * 注意：不能发送 Accept: image/png（Tableau 网关返回 406），依赖默认 Accept。
 */
async function fetchPreviewImageBlob(
  kind: 'workbook' | 'view',
  id: string,
): Promise<Blob | null> {
  const { siteId } = await getAccessToken()
  const path =
    kind === 'workbook'
      ? `/sites/${siteId}/workbooks/${id}/previewImage?maxAge=60`
      : `/sites/${siteId}/views/${id}/image?maxAge=60&resolution=high`

  return limitPreviewRequests(async () => {
    const cacheKey = `${TABLEAU_CONFIG.serverUrl}/api/${TABLEAU_CONFIG.apiVersion}${path}`

    let cache: Cache | null = null
    try {
      cache = await caches.open(PREVIEW_CACHE_NAME)
    } catch {
      // Cache API 不可用：降级为直连
    }

    if (cache) {
      try {
        const hit = await cache.match(cacheKey)
        if (hit) {
          const cachedAt = Number(hit.headers.get('x-cached-at') ?? '0')
          if (Date.now() - cachedAt < PREVIEW_CACHE_TTL_MS) return hit.blob()
          await cache.delete(cacheKey)
        }
      } catch {
        cache = null
      }
    }

    try {
      const blob = await apiRequest(path, {}, (res) => res.blob())
      if (cache) {
        try {
          // 写入不阻塞返回；缓存键带 siteId，天然按站点隔离
          void cache.put(
            cacheKey,
            new Response(blob, {
              headers: {
                'Content-Type': blob.type || 'image/png',
                'X-Cached-At': String(Date.now()),
              },
            }),
          )
        } catch {
          // 缓存写入失败不影响本次展示
        }
      }
      return blob
    } catch (err) {
      // 404 = 该视图无预览图：返回 null（占位图），不重试也不缓存；
      // 其余错误抛给 Query 按 retry 策略处理（仅瞬时故障重试 1 次）。
      if (err instanceof TableauApiError && err.status === 404) return null
      throw err
    }
  })
}

/**
 * 预览图重试策略：仅瞬时故障（网络错误 / 5xx / 429）重试 1 次，固定短延迟；
 * 4xx 属确定性失败（404 已在 queryFn 内转 null），重试只会放大服务端压力。
 */
function previewRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  // 认证错误：signin 是共享资源，业务查询重试只会放大 signin 压力 → 不重试
  if (error instanceof TableauAuthError) return false
  // 4xx（除 429）确定性失败 → 不重试；仅瞬时故障（网络 / 5xx / 429）重试 1 次
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

/**
 * 预览图查询选项：blob 视为不可变资源（staleTime Infinity）；
 * gcTime 10 分钟 —— 无订阅者后自动回收（容量管理替代旧模块级 previewBlobCache Map）。
 */
export function previewImageQueryOptions(kind: 'workbook' | 'view', id: string) {
  return queryOptions<Blob | null>({
    queryKey: ['tableau', 'preview-image', kind, id],
    queryFn: () => fetchPreviewImageBlob(kind, id),
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: previewRetry,
    retryDelay: 1500,
  })
}

/**
 * 按名称解析视图预览图（favorites/recents 只存名称，无 ID）：
 * workbooks 列表 → 按名称找 workbook id → views 列表 → 按名称找 view id → previewImage。
 * 列表数据本身是 Query（共享缓存），本查询只做解析编排（替代旧 resolvedPreviewCache Map）。
 */
export function resolvedViewPreviewQueryOptions(workbookName: string, viewName: string) {
  return queryOptions<Blob | null>({
    queryKey: ['tableau', 'resolved-preview', workbookName, viewName],
    queryFn: async () => {
      const workbooks = await fetchWorkbooks()
      const wb = workbooks.find((w) => w.name === workbookName)
      if (!wb) return null
      const views = await fetchWorkbookViews(wb.id)
      const vw = views.find((v) => v.name === viewName)
      if (!vw) return null
      return fetchPreviewImageBlob('view', vw.id)
    },
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: previewRetry,
    retryDelay: 1500,
  })
}
