import { queryOptions } from '@tanstack/react-query'

import { TABLEAU_CONFIG } from '@/config/tableau'
import {
  apiGet,
  apiRequest,
  getAccessToken,
  tableauRetry,
  TableauApiError,
  TableauAuthError,
} from '@/lib/tableau-rest'

/**
 * 本模块固定使用传输层的 **content 能力域**（工作簿/视图/预览图；scope 与 0.7.0 起完全一致）。
 * 站点用户与定时计划的 REST 调用分别在 lib/tableau-users-api.ts / lib/tableau-tasks-api.ts，
 * 各自用自己的能力域令牌 —— 理由见 lib/tableau-rest.ts 顶部。
 */
const SCOPE = 'content' as const

// 错误类型 0.13 迁到传输层：这里转出以保持既有引用（route 层曾直接 import 这两个名字）
export { TableauApiError, TableauAuthError }

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

/* ==================== 认证与请求：统一在传输层 ==================== */
/* signIn / getAccessToken / apiRequest / 分页都搬到了 lib/tableau-rest.ts，
   本模块只保留内容域的业务方法（下面每个 apiGet/apiRequest 调用都带 SCOPE = 'content'）。 */

/** 站点内 workbooks 列表 */
export async function fetchWorkbooks(): Promise<TableauWorkbook[]> {
  const { siteId } = await getAccessToken(SCOPE)
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
    SCOPE,
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

/**
 * workbooks 列表查询选项。
 *
 * 0.13 起从 workbooks 页内联的 useQuery 抽出来：定时计划页要用同一份列表把
 * workbookId 解析成名字，两处若各写一个 queryKey，就会出现"同一份数据缓存两份"
 * （而且两边的 retry / staleTime 迟早不一致）—— 共用这个 queryOptions 即同一份缓存。
 */
export function workbooksQueryOptions() {
  return queryOptions({
    queryKey: ['tableau', 'workbooks'] as const,
    queryFn: fetchWorkbooks,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

/** 单个 workbook 的引用（把 id 解析成名字时用） */
export interface TableauWorkbookRef {
  id: string
  name: string
  projectName?: string
}

/**
 * 按 id 取单个 workbook（名字 + 所属项目）。
 *
 * 为什么不用 workbooks 列表来解析名字：列表带**项目过滤**（VITE_TABLEAU_PROJECT，
 * 那是内容页的浏览偏好），而提取刷新任务可以指向任意项目的内容 ——
 * 实测演示站点上的第一个任务指向的 workbook 就在 Samples 之外，
 * 拿过滤后的列表去查必然查不到（页面只能退化成显示 uuid）。
 * 按 id 逐个取还顺带把请求量绑在"本页显示多少行"上，而不是站点内容总量上。
 *
 * 404（已删除 / 无权访问）返回 null：页面回落到显示 id，而不是整页报错。
 */
export async function fetchWorkbookRef(workbookId: string): Promise<TableauWorkbookRef | null> {
  const { siteId } = await getAccessToken(SCOPE)
  try {
    const data = await apiGet<{ workbook?: Record<string, unknown> }>(
      SCOPE,
      `/sites/${siteId}/workbooks/${workbookId}`,
    )
    const workbook = data.workbook
    if (!workbook?.id) return null
    const project = (workbook.project ?? workbook.location ?? {}) as Record<string, unknown>
    return {
      id: String(workbook.id),
      name: String(workbook.name ?? ''),
      projectName: project.name ? String(project.name) : undefined,
    }
  } catch (err) {
    if (err instanceof TableauApiError && err.status === 404) return null
    throw err
  }
}

/**
 * 单个 workbook 查询（queryKey 按 id 分开）：
 * 同一个 workbook 出现在多个任务里时只请求一次，缓存 10 分钟。
 */
export function workbookRefQueryOptions(workbookId: string) {
  return queryOptions({
    queryKey: ['tableau', 'workbook-ref', workbookId] as const,
    queryFn: () => fetchWorkbookRef(workbookId),
    staleTime: 10 * 60_000,
    retry: tableauRetry,
  })
}

/** 某个 workbook 的 views 列表 */
export async function fetchWorkbookViews(workbookId: string): Promise<TableauView[]> {
  const { siteId } = await getAccessToken(SCOPE)
  const data = await apiGet<{ views?: { view?: Array<Record<string, unknown>> } }>(
    SCOPE,
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
  const { siteId } = await getAccessToken(SCOPE)
  try {
    // 不带 fields：需同时取 workbook / viewUrlName / contentUrl（fields 白名单不含全部所需字段）
    const data = await apiGet<{ view?: Record<string, unknown> }>(
      SCOPE,
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
  const { siteId } = await getAccessToken(SCOPE)
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
      const blob = await apiRequest(SCOPE, path, {}, (res) => res.blob())
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

/* 重试策略 0.13 起统一到传输层（tableauRetry）：原先只有预览图查询带策略，
   现在三个能力域共用一份，避免各写一遍再各自漂移。预览图仍多一个固定 1.5s 延迟。 */

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
    retry: tableauRetry,
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
    retry: tableauRetry,
    retryDelay: 1500,
  })
}
