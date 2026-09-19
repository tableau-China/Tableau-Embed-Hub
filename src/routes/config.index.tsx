import { createFileRoute, redirect } from '@tanstack/react-router'

import { canAccessRoute } from '@/lib/permissions'
import { activeTeamSlug } from '@/lib/team-context'

/**
 * /config 根路径：落到第一个有权访问的配置页（目前只有 SMTP）。
 *
 * 分支首页不写死跳某一页：配置页可以分别授权，写死跳某一页会让「只被授权另一页」的用户
 * 一进 /config 就撞上「无权访问」兜底页。一个都没授权时退到团队首页（至少是 required 页）。
 *
 * 这里用命令式 `canAccessRoute`（beforeLoad 里不能调 hook），与渲染层的判定同源。
 */
export const Route = createFileRoute('/config/')({
  beforeLoad: () => {
    if (canAccessRoute('page.config.smtp')) {
      throw redirect({ to: '/config/smtp', replace: true })
    }
    const teamSlug = activeTeamSlug()
    if (!teamSlug) throw redirect({ to: '/teams', replace: true })
    throw redirect({ to: '/t/$teamSlug', params: { teamSlug }, replace: true })
  },
})
