import {
  ACTION_CATALOG,
  ROUTE_CATALOG,
  applicableRoles,
  matchesGrant,
  type ActorContext,
  type CatalogEntry,
  type PermissionKey,
  type RoleGrants,
  type RoleKey,
  type RouteScope,
} from '@/config/permissions'
import { resolveCurrentTeam } from '@/lib/team-context'
import { userMemberRole, useOrgStore } from '@/stores/org-store'
import { usePermissionStore } from '@/stores/permission-store'

/**
 * 权限求值层（纯函数 + 命令式读取）—— 与 lib/team-context.ts 同构：
 * 纯函数不读 window、不读 store，React 侧统一走 hooks/use-permissions.ts。
 *
 * 求值链：授权矩阵 + 角色 → 命中判定
 *   rolesForScope(scope, actor) → hasAnyPermission(grants, roles, key)
 */

/* ============================== 授权命中 ============================== */

/** 单个角色的授权列表是否命中权限键 */
export function hasPermission(grants: readonly string[], key: string): boolean {
  return grants.some((g) => matchesGrant(g, key))
}

/** 角色集合中任一角色命中即可（当前实现每个场景只产出 1 个角色，保留多角色扩展位） */
export function hasAnyPermission(
  grantsByRole: RoleGrants,
  roles: readonly RoleKey[],
  key: string,
): boolean {
  return roles.some((role) => hasPermission(grantsByRole[role] ?? [], key))
}

/** 是否由通配（而非逐条勾选）命中 —— 权限页据此区分「已勾选」与「由通配继承」 */
export function matchingWildcard(grants: readonly string[], key: string): string | null {
  return grants.find((g) => g !== key && matchesGrant(g, key)) ?? null
}

/** 角色授权的通配项（权限页在列头以可删除的标签展示） */
export function wildcardsOf(grants: readonly string[]): string[] {
  return grants.filter((g) => g.includes('*'))
}

/* ============================== 作用域求值 ============================== */

/**
 * 一次访问由哪些角色决定：
 *   - 系统管理员 → 恒定 `system-admin`（该角色恒为 `*`，全放行）；
 *   - 团队作用域页面 → **该用户在当前团队里的岗位**（同一个人在不同团队角色不同，
 *     因此 FOC 可以「在 A 团队能看、在 B 团队看不到」）；
 *   - 跨团队管理页 → 全局身份（`member`）。
 * 非团队成员访问团队页面时无角色 → 无权限（实际在此之前已被团队的成员校验拦下）。
 */
export function rolesForScope(scope: RouteScope, actor: ActorContext): readonly RoleKey[] {
  if (actor.isSystemAdmin) return ['system-admin']
  if (scope === 'global') return ['member']
  return actor.teamRole ? [actor.teamRole] : []
}

/**
 * 权限键属于哪个作用域：路由键看自身，动作键看它的 owner 页面
 * （动作权限的求值场景必须与其所在页面一致，否则同一页的按钮与页面会按不同角色判定）。
 */
export function scopeOfPermission(key: PermissionKey): RouteScope {
  const route = ROUTE_CATALOG.find((e) => e.key === key)
  if (route) return route.scope
  const action = ACTION_CATALOG.find((a) => a.key === key)
  const owner = action ? ROUTE_CATALOG.find((e) => e.key === action.owner) : undefined
  return owner?.scope ?? 'global'
}

/** 给定身份 + 授权矩阵，是否可访问某权限键（路由键与动作键通用） */
export function actorCan(grants: RoleGrants, actor: ActorContext, key: PermissionKey): boolean {
  return hasAnyPermission(grants, rolesForScope(scopeOfPermission(key), actor), key)
}

/* ============================== pathname → 路由条目 ============================== */

/** 去掉末尾斜杠（`/users/` → `/users`）；根路径保持 `/` */
export function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.replace(/\/+$/, '')
  return pathname
}

/**
 * 把当前 pathname 还原成「路由模式」，用于与 ROUTE_CATALOG.to 精确比对：
 *   `/t/acme-hq/workbooks` → `/t/$teamSlug/workbooks`
 *   `/t/acme-hq`           → `/t/$teamSlug`
 *   `/users`               → `/users`
 * slug 段的正则与 lib/team-context.ts 的 parseTeamSlugFromPath 同形（此处不 import 它，
 * 是为了让本文件保持「不依赖 store」的可测试性 —— 那边 import 了 zustand store）。
 */
export function routePatternForPathname(pathname: string): string {
  const clean = normalizePathname(pathname)
  const match = clean.match(/^\/t\/[^/?#]+(\/.*)?$/)
  return match ? `/t/$teamSlug${match[1] ?? ''}` : clean
}

/** 当前路径命中的路由目录条目；未登记（如 404 路径）返回 null（不受权限约束） */
export function routeEntryForPathname(pathname: string): CatalogEntry | null {
  const pattern = routePatternForPathname(pathname)
  return ROUTE_CATALOG.find((e) => e.to === pattern) ?? null
}

/* ============================== 命令式读取（beforeLoad / 重定向桩用） ============================== */

/** 当前身份与当前团队岗位（React 侧请用 hooks/use-permissions.ts 的 useActor） */
export function currentActor(): ActorContext {
  const { users, teams, members, currentUserId, activeTeamId } = useOrgStore.getState()
  const user = users.find((u) => u.id === currentUserId)
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const team = resolveCurrentTeam(pathname, teams, activeTeamId)
  return {
    isSystemAdmin: user?.isSystemAdmin ?? false,
    teamRole:
      team && currentUserId !== null
        ? userMemberRole(members, currentUserId, team.id)
        : null,
  }
}

/** 命令式准入判断（供 beforeLoad 使用；返回 false 的页面在渲染层会给出兜底页） */
export function canAccessRoute(key: PermissionKey): boolean {
  return actorCan(usePermissionStore.getState().grants, currentActor(), key)
}

/* ============================== 权限页辅助 ============================== */

/**
 * 是否没有任何「该路由的适用角色」能访问它 —— 新页面 fail-closed 后最常见的状态，
 * 权限页对这类行打「未授权」标记并提示一键补齐默认授权。
 */
export function isUngranted(grants: RoleGrants, key: string): boolean {
  const entry = ROUTE_CATALOG.find((e) => e.key === key)
  if (!entry) return false
  return !applicableRoles(entry).some((role) => hasPermission(grants[role] ?? [], key))
}
