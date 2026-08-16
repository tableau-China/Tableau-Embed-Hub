import { TABLEAU_CONFIG } from '@/config/tableau'
import { createTableauJwt } from '@/lib/tableau-jwt'

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
  expiresAt: number
}

let authCache: CachedAuth | null = null

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

/** 用 JWT 换取 REST API access token（POST /auth/signin） */
async function getAccessToken(): Promise<CachedAuth> {
  if (authCache && authCache.expiresAt > Date.now() + 30_000) return authCache

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
    throw new Error(`Tableau signin failed: ${res.status} ${(await safeText(res)).slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    credentials?: { token?: string; site?: { id?: string } }
  }
  const token = data.credentials?.token
  const siteId = data.credentials?.site?.id
  if (!token || !siteId) {
    throw new Error('Tableau signin response missing token/siteId')
  }
  authCache = { token, siteId, expiresAt: Date.now() + 4 * 60_000 }
  return authCache
}

async function apiGet<T>(path: string): Promise<T> {
  const { token } = await getAccessToken()
  const res = await fetch(
    `${TABLEAU_CONFIG.apiBaseUrl}/api/${TABLEAU_CONFIG.apiVersion}${path}`,
    {
      headers: { 'X-Tableau-Auth': token, Accept: 'application/json' },
    },
  )
  if (!res.ok) {
    throw new Error(`Tableau API ${path} failed: ${res.status} ${(await safeText(res)).slice(0, 200)}`)
  }
  return (await res.json()) as T
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

// ==================== 预览图（previewImage） ====================

// 预览图 blob 缓存：`${kind}:${id}` -> blob
const previewBlobCache = new Map<string, Blob>()
// 名称解析缓存：`${workbookName}/${viewName}` -> blob
const resolvedPreviewCache = new Map<string, Blob | null>()

/**
 * 获取 workbook / view 的预览图 blob（带 X-Tableau-Auth 认证头，经 /tableau-proxy 同源代理）。
 * 走 blob 而非 <img src>：浏览器 img 无法携带认证头。
 * 端点与老项目 pg-explorer 一致：
 * - workbook: /workbooks/{id}/previewImage?maxAge=60
 * - view:     /views/{id}/image?maxAge=60&resolution=high（previewImage 在 Cloud 返回 404，用导出端点）
 * 注意：不能发送 Accept: image/png（Tableau 网关返回 406），依赖默认 Accept。
 */
export async function getPreviewImageBlob(
  kind: 'workbook' | 'view',
  id: string,
): Promise<Blob | null> {
  const cacheKey = `${kind}:${id}`
  if (previewBlobCache.has(cacheKey)) return previewBlobCache.get(cacheKey)!
  try {
    const { token, siteId } = await getAccessToken()
    const path =
      kind === 'workbook'
        ? `/sites/${siteId}/workbooks/${id}/previewImage?maxAge=60`
        : `/sites/${siteId}/views/${id}/image?maxAge=60&resolution=high`
    const res = await fetch(`${TABLEAU_CONFIG.apiBaseUrl}/api/${TABLEAU_CONFIG.apiVersion}${path}`, {
      headers: { 'X-Tableau-Auth': token },
    })
    if (!res.ok) return null
    const blob = await res.blob()
    previewBlobCache.set(cacheKey, blob)
    return blob
  } catch {
    return null
  }
}

/**
 * 通过 workbook/view 名称解析真实预览图（favorites/recents 只存名称，无 ID）。
 * 步骤：workbooks 列表 → 按名称找 workbook id → views 列表 → 按名称找 view id → previewImage。
 * 模块级缓存，同一视图只解析一次。
 */
export async function resolveViewPreviewBlob(
  workbookName: string,
  viewName: string,
): Promise<Blob | null> {
  const key = `${workbookName}/${viewName}`
  if (resolvedPreviewCache.has(key)) return resolvedPreviewCache.get(key)!
  try {
    const workbooks = await fetchWorkbooks()
    const wb = workbooks.find((w) => w.name === workbookName)
    if (!wb) return null
    const views = await fetchWorkbookViews(wb.id)
    const vw = views.find((v) => v.name === viewName)
    if (!vw) return null
    const blob = await getPreviewImageBlob('view', vw.id)
    resolvedPreviewCache.set(key, blob)
    return blob
  } catch {
    resolvedPreviewCache.set(key, null)
    return null
  }
}
