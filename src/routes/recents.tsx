import { createFileRoute, redirect } from '@tanstack/react-router'

import { activeTeamSlug } from '@/lib/team-context'

/**
 * 旧路径兼容桩：/recents → /t/{slug}/recents
 *
 * 注意：最近浏览按团队隔离，重定向后展示的是当前团队的记录
 * （旧的无团队 URL 无法表达「哪个团队」，只能取当前团队语义）。
 */
export const Route = createFileRoute('/recents')({
  beforeLoad: () => {
    const teamSlug = activeTeamSlug()
    if (!teamSlug) throw redirect({ to: '/teams', replace: true })
    throw redirect({ to: '/t/$teamSlug/recents', params: { teamSlug }, replace: true })
  },
})
