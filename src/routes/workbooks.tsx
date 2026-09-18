import { createFileRoute, redirect } from '@tanstack/react-router'

import { activeTeamSlug } from '@/lib/team-context'

/**
 * 旧路径兼容桩：/workbooks → /t/{slug}/workbooks
 */
export const Route = createFileRoute('/workbooks')({
  beforeLoad: () => {
    const teamSlug = activeTeamSlug()
    if (!teamSlug) throw redirect({ to: '/teams', replace: true })
    throw redirect({ to: '/t/$teamSlug/workbooks', params: { teamSlug }, replace: true })
  },
})
