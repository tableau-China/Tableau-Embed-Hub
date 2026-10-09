import { queryOptions } from '@tanstack/react-query'

import {
  apiSend,
  fetchAllPages,
  getAccessToken,
  TABLEAU_PAGE_SIZE,
  tableauRetry,
  type TableauPage,
} from '@/lib/tableau-rest'

/**
 * Tableau **站点用户**（REST 能力域 `site-users`）。
 *
 * 数据源只有一个：Tableau Cloud 自己（GET /sites/{siteId}/users）。
 * 「同步」= 重新取一次这份列表 —— **不落到本地 org-store**：
 * localStorage 里那份是模板的演示账号数据，把真实站点用户镜像进去会产生两份真相、
 * 以及与 Tableau 之间的漂移（谁改了什么、以哪边为准）。Tableau 是唯一数据源。
 */

/** 列表查询键（变更角色后按它失效重取，页面无需自己拼 key） */
export const SITE_USERS_QUERY_KEY = ['tableau', 'site-users'] as const

export interface TableauSiteUser {
  id: string
  /** 登录名（邮箱或 SSO 用户名）—— 账号主键口径，不可改 */
  name: string
  /** 展示名；站点管理员无权通过 REST 改 fullName，因此只读展示 */
  fullName: string
  email?: string
  /** 站点角色原文（可能是本应用目录里没有的旧角色/Server 专有角色，展示时原样兜底） */
  siteRole: string
  /** TableauIDWithMFA / ServerDefault… */
  authSetting?: string
  lastLogin?: string
  locale?: string
  language?: string
  /** 身份域（如 TABID_WITH_MFA） */
  domain?: string
}

function parseSiteUser(raw: Record<string, unknown>): TableauSiteUser {
  const domain = (raw.domain ?? {}) as Record<string, unknown>
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    fullName: String(raw.fullName ?? raw.name ?? ''),
    email: raw.email ? String(raw.email) : undefined,
    siteRole: String(raw.siteRole ?? ''),
    authSetting: raw.authSetting ? String(raw.authSetting) : undefined,
    lastLogin: raw.lastLogin ? String(raw.lastLogin) : undefined,
    locale: raw.locale ? String(raw.locale) : undefined,
    language: raw.language ? String(raw.language) : undefined,
    domain: domain.name ? String(domain.name) : undefined,
  }
}

interface UsersBody {
  users?: { user?: Record<string, unknown>[] }
  pagination?: TableauPage<unknown>['pagination']
}

/**
 * 一次查询的完整快照：站点用户 + 「这张令牌代表谁」。
 *
 * 为什么把 signedInUserId 放进同一条查询：signin 响应里本来就带着 `credentials.user.id`，
 * 页面却需要它来判断"哪一行是我自己"（Tableau 禁止改自己的许可证角色）。
 * 单独发一条查询或写 useEffect 都会多一次异步路径（还有首次渲染拿不到值的空窗），
 * 而这条查询的 queryFn 里已经握着那份 auth 了 —— 顺手带出来即可。
 */
export interface SiteUsersSnapshot {
  users: TableauSiteUser[]
  /** 当前签发 JWT 的 Tableau 用户 id；响应缺该字段时为 undefined（页面退回按登录名匹配） */
  signedInUserId?: string
}

/** 站点全部用户（自动翻页） */
export async function fetchSiteUsers(): Promise<SiteUsersSnapshot> {
  const { siteId, userId } = await getAccessToken('site-users')
  const users = await fetchAllPages<TableauSiteUser>(
    'site-users',
    (page) => `/sites/${siteId}/users?pageSize=${TABLEAU_PAGE_SIZE}&pageNumber=${page}`,
    (body) => {
      const data = body as UsersBody
      return {
        rows: (data.users?.user ?? []).map(parseSiteUser),
        pagination: data.pagination,
      }
    },
  )
  return { users, signedInUserId: userId }
}

/**
 * 站点用户查询选项。
 *
 * staleTime 用全局默认（5 分钟）：站点用户的变更来自别处（Tableau 后台、其它管理员），
 * 本页只提供手动「同步」（refetch）—— 不做轮询（用户确认过的策略：
 * 轮询间隔是个固定阈值，不自行取值）。
 * signin 失败不重试的策略由 tableauRetry 统一兜住。
 */
export function siteUsersQueryOptions() {
  return queryOptions({
    queryKey: SITE_USERS_QUERY_KEY,
    queryFn: fetchSiteUsers,
    retry: tableauRetry,
  })
}

/**
 * 修改某用户的站点角色（PUT /sites/{siteId}/users/{userId}）。
 *
 * 契约要点（官方 "Update User"，2026-10 核对）：
 *   · 只有服务器管理员/站点管理员能调用；本应用用的是站点管理员账号签发的 JWT；
 *   · 请求体只带要改的字段（`{"user":{"siteRole":"..."}}`），其余字段不动；
 *   · **不能改自己的许可证角色**（服务端回 403/403009）—— 页面据此把"当前登录的
 *     Tableau 用户"那一行的改角色入口禁掉，省掉一次注定失败的往返；
 *   · 席位不足回 409/409014、组内最低角色冲突回 400/400012 —— 错误映射见 lib/tableau-site-roles.ts。
 *
 * 不在这里做乐观更新：站点角色是许可证相关属性，服务端可能因为席位拒绝，
 * 「先显示成功再回滚」会让管理员误以为已经改好。成功路径统一由失效列表查询来确认。
 */
export async function updateSiteUserRole(userId: string, siteRole: string): Promise<void> {
  const { siteId } = await getAccessToken('site-users')
  await apiSend('site-users', 'PUT', `/sites/${siteId}/users/${userId}`, {
    user: { siteRole },
  })
}

/** 兜底：某些部署下 signin 响应不含 user.id，页面用登录名再匹配一次 */
export function findSignedInUser(
  users: readonly TableauSiteUser[],
  signedInUserId: string | undefined,
  embedUser: string,
): TableauSiteUser | undefined {
  if (signedInUserId) {
    const byId = users.find((user) => user.id === signedInUserId)
    if (byId) return byId
  }
  return users.find((user) => user.name.toLowerCase() === embedUser.toLowerCase())
}
