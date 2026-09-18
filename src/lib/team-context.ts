import { useOrgStore, type OrgTeam } from '@/stores/org-store'

/**
 * 团队 URL 上下文解析层 —— 前端团队身份的唯一事实来源
 * （对齐 pg-explorer 的 lib/team-context.ts）。
 *
 * 路由约定（v0.5.0 起）：
 *   /t/{slug}/...   —— 团队作用域页面（dashboard / favorites / recents / workbooks / views / flows）
 *   /users /teams /settings —— 跨团队管理页，**不带** slug（对标 pg-explorer 的 /admin/*）
 *   /             —— 重定向到当前团队的 /t/{slug}
 *
 * 为什么以 URL 为权威：此前团队身份只存在 store + localStorage 里，
 * 多个团队的同一个页面共用一条 URL，导致分享链接丢失团队、同浏览器多标签页
 * 无法并存两个团队。URL 带上 slug 后，刷新、分享、多标签页、前后退都天然按团队隔离。
 *
 * 本文件的纯函数不读 window、不读 store，便于复用与测试；
 * 命令式读取统一走 activeTeamSlug()，React 侧统一走 hooks（见 hooks/use-current-team.ts）。
 */

/** 团队作用域 URL 的一级路径段：/t/{slug} */
export const TEAM_PATH_SEGMENT = 't'

/**
 * 从 pathname 解析团队 slug。
 * - `/t/acme-hq/views` → `acme-hq`
 * - `/users`、`/`、`/t`（无 slug）→ null
 */
export function parseTeamSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/t\/([^/?#]+)/)
  if (!match || !match[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    // 非法百分号编码：按原样使用，交由 slug 匹配环节判定为「站点不存在」
    return match[1]
  }
}

export function findTeamBySlug(
  teams: readonly OrgTeam[],
  slug: string | null | undefined,
): OrgTeam | undefined {
  if (!slug) return undefined
  return teams.find((t) => t.slug === slug)
}

/** 团队 slug + 站内路径 → 团队作用域路径（如 teamScopedPath('acme-hq', '/views')） */
export function teamScopedPath(slug: string, path = ''): string {
  const normalized = !path || path === '/' ? '' : path.startsWith('/') ? path : `/${path}`
  return `/${TEAM_PATH_SEGMENT}/${slug}${normalized}`
}

/**
 * 纯函数：根据 pathname + teams 解析当前团队。
 * URL 中的 slug 优先；非团队作用域路径（/users、/teams、/settings 等）回退 activeTeamId。
 */
export function resolveCurrentTeam(
  pathname: string,
  teams: readonly OrgTeam[],
  activeTeamId: number | null,
): OrgTeam | null {
  const bySlug = findTeamBySlug(teams, parseTeamSlugFromPath(pathname))
  if (bySlug) return bySlug
  if (activeTeamId !== null) {
    const active = teams.find((t) => t.id === activeTeamId)
    if (active) return active
  }
  return null
}

/**
 * 去掉 /t/{slug} 前缀，返回团队内的相对路径。
 * - `/t/acme-hq`            → ''（团队首页）
 * - `/t/acme-hq/workbooks`  → '/workbooks'
 * - `/users`（管理页）      → ''
 * 用于切换团队时保留同级子路径。
 */
export function stripTeamPrefix(pathname: string): string {
  const match = pathname.match(/^\/t\/[^/?#]+(\/.*)?$/)
  return match?.[1] ?? ''
}

/** 当前用户是否为该团队成员（团队作用域页面的准入条件） */
export function isUserMemberOfTeam(
  members: ReadonlyArray<{ userId: number; teamId: number }>,
  userId: number | null,
  teamId: number,
): boolean {
  if (userId === null) return false
  return members.some((m) => m.userId === userId && m.teamId === teamId)
}

/** 当前用户的默认团队（无默认时取首个成员关系对应的团队） */
export function userDefaultTeam(
  teams: readonly OrgTeam[],
  members: ReadonlyArray<{ userId: number; teamId: number; isDefault: boolean }>,
  userId: number | null,
): OrgTeam | null {
  if (userId === null) return null
  const mine = members.filter((m) => m.userId === userId)
  if (mine.length === 0) return null
  const preferred = mine.find((m) => m.isDefault) ?? mine[0]!
  return teams.find((t) => t.id === preferred.teamId) ?? null
}

/**
 * 命令式读取当前应使用的团队 slug（供 beforeLoad / 重定向桩使用）。
 *
 * 优先取 URL 中已存在且合法的 slug；否则回退 activeTeamId 对应的团队，
 * 再退到列表首个团队。返回 null 表示当前用户尚无任何团队。
 */
export function activeTeamSlug(): string | null {
  const { teams, activeTeamId } = useOrgStore.getState()
  if (teams.length === 0) return null

  if (typeof window !== 'undefined') {
    const slug = parseTeamSlugFromPath(window.location.pathname)
    if (slug && teams.some((t) => t.slug === slug)) return slug
  }

  const active = teams.find((t) => t.id === activeTeamId)
  return active?.slug ?? teams[0]!.slug
}
