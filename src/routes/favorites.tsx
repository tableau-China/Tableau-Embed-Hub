import { createFileRoute, redirect } from '@tanstack/react-router'

import { activeTeamSlug } from '@/lib/team-context'

/**
 * 旧路径兼容桩：/favorites → /t/{slug}/favorites
 *
 * v0.5.0 起团队身份进入 URL，旧的书签/外链在这里一次性重定向到团队作用域路径，
 * 重定向用的是当前 activeTeamId 对应的团队（URL 里已有合法 slug 时优先沿用该 slug）。
 */
export const Route = createFileRoute('/favorites')({
  beforeLoad: () => {
    const teamSlug = activeTeamSlug()
    if (!teamSlug) throw redirect({ to: '/teams', replace: true })
    throw redirect({ to: '/t/$teamSlug/favorites', params: { teamSlug }, replace: true })
  },
})
