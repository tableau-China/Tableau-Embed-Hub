import { createFileRoute, redirect } from '@tanstack/react-router'

import { activeTeamSlug } from '@/lib/team-context'

/**
 * 根路径 `/` —— 重定向到当前团队的团队作用域首页 `/t/{slug}`。
 *
 * v0.5.0 起团队身份进入 URL：所有工作区页面都挂在 /t/{slug} 下，
 * `/` 只是入口，不再直接渲染 dashboard。
 * 当前用户尚无任何团队时改跳 /teams（管理员可在此创建团队）。
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const teamSlug = activeTeamSlug()
    if (!teamSlug) throw redirect({ to: '/teams', replace: true })
    throw redirect({ to: '/t/$teamSlug', params: { teamSlug }, replace: true })
  },
})
