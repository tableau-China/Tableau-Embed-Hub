import { useCallback, useMemo } from 'react'
import { useRouterState } from '@tanstack/react-router'

import {
  type ActorContext,
  type CatalogEntry,
  type PermissionKey,
  type RoleGrants,
} from '@/config/permissions'
import { useCurrentTeam } from '@/hooks/use-current-team'
import { actorCan, routeEntryForPathname } from '@/lib/permissions'
import { userMemberRole, useOrgStore } from '@/stores/org-store'
import { usePermissionStore } from '@/stores/permission-store'

/**
 * 权限读取的 React 入口（对齐 hooks/use-current-team.ts 的写法）：
 * 组件与守卫都从这里取，不直接读 store，保证「同一份求值逻辑」。
 */

/** 授权矩阵（订阅，权限页改动后所有消费方实时重算） */
export function usePermissionGrants(): RoleGrants {
  return usePermissionStore((s) => s.grants)
}

/**
 * 当前身份：全局身份 + **当前团队里的岗位**。
 * 岗位随 URL 团队变化 —— 同一个人在 A 团队是 team-admin、在 B 团队是 viewer，
 * 因此团队作用域页面的可见性天然按团队区分。
 */
export function useActor(): ActorContext {
  const currentUserId = useOrgStore((s) => s.currentUserId)
  const users = useOrgStore((s) => s.users)
  const members = useOrgStore((s) => s.members)
  const team = useCurrentTeam()

  return useMemo(() => {
    const user = users.find((u) => u.id === currentUserId)
    return {
      isSystemAdmin: user?.isSystemAdmin ?? false,
      teamRole:
        team && currentUserId !== null
          ? userMemberRole(members, currentUserId, team.id)
          : null,
    }
  }, [users, currentUserId, members, team])
}

/**
 * 准入判定函数：`const can = useCan(); can('page.workbooks')`
 * 路由键与（将来的）动作键共用同一个入口 —— 按钮权限落地时无需新增 hook。
 */
export function useCan(): (key: PermissionKey) => boolean {
  const grants = usePermissionGrants()
  const actor = useActor()
  return useCallback((key: PermissionKey) => actorCan(grants, actor, key), [grants, actor])
}

export interface RouteAccess {
  /** 当前路径命中的路由目录条目；未登记的路由为 null（不受权限约束） */
  entry: CatalogEntry | null
  allowed: boolean
  actor: ActorContext
}

/** 当前路由的准入结果（守卫组件用） */
export function useRouteAccess(): RouteAccess {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const can = useCan()
  const actor = useActor()
  return useMemo(() => {
    const entry = routeEntryForPathname(pathname)
    return { entry, allowed: entry ? can(entry.key) : true, actor }
  }, [pathname, can, actor])
}
