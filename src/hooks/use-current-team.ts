import { useMemo } from 'react'
import { useRouterState } from '@tanstack/react-router'

import { resolveCurrentTeam } from '@/lib/team-context'
import { useOrgStore, type OrgTeam } from '@/stores/org-store'

/**
 * 当前 URL 对应的团队（React 侧读取入口）。
 *
 * URL 中的 /t/{slug} 优先，跨团队管理页（/users、/teams、/settings）回退 activeTeamId。
 * 订阅 pathname + org store，因此切换团队（URL 变）与切换用户（activeTeamId 变）都会重算。
 */
export function useCurrentTeam(): OrgTeam | null {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const teams = useOrgStore((s) => s.teams)
  const activeTeamId = useOrgStore((s) => s.activeTeamId)

  return useMemo(
    () => resolveCurrentTeam(pathname, teams, activeTeamId),
    [pathname, teams, activeTeamId],
  )
}

/**
 * 当前团队 slug —— 侧边栏等导航前缀的唯一来源。
 * 返回 null 表示用户尚无任何团队（此时团队作用域链接不可用）。
 */
export function useTeamSlug(): string | null {
  return useCurrentTeam()?.slug ?? null
}
