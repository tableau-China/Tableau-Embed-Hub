import { createFileRoute, redirect } from '@tanstack/react-router'

import { activeTeamSlug } from '@/lib/team-context'

/**
 * 旧路径兼容桩：/views?workbook=&view= → /t/{slug}/views?workbook=&view=
 *
 * search 参数（workbook / view）原样带到目标路由 —— 视图链接是分享出去最多的
 * 一类 URL，丢掉参数等于丢掉用户要看的那张图。
 */
export const Route = createFileRoute('/views')({
  validateSearch: (search: Record<string, unknown>) => ({
    workbook: typeof search.workbook === 'string' ? search.workbook : undefined,
    view: typeof search.view === 'string' ? search.view : undefined,
  }),
  beforeLoad: ({ search }) => {
    const teamSlug = activeTeamSlug()
    if (!teamSlug) throw redirect({ to: '/teams', replace: true })
    throw redirect({
      to: '/t/$teamSlug/views',
      params: { teamSlug },
      search,
      replace: true,
    })
  },
})
