import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Building2, ShieldAlert } from 'lucide-react'

import { GuardCard, RouteForbidden } from '@/components/route-guard'
import { Button } from '@/components/ui/button'
import { useRouteAccess } from '@/hooks/use-permissions'
import { activeTeamSlug, isUserMemberOfTeam } from '@/lib/team-context'
import { useOrgStore } from '@/stores/org-store'

/**
 * 团队作用域布局路由 `/t/$teamSlug`（对齐 pg-explorer 的 t/$teamSlug/route.tsx）。
 *
 * 职责：
 * 1. 用 URL 里的 slug 校验团队是否存在 —— URL 是团队身份的权威来源；
 * 2. 合法且当前用户属于该团队时，把 store 的 activeTeamId 同步过来
 *    （view-store 的团队分区、/teams 的当前团队标记依赖它）；
 * 3. slug 不存在 / 非成员 / **当前角色无权访问该页面**时给出可操作的兜底页，
 *    而不是渲染半截页面。
 *
 * 校验顺序不可调换：先「团队存在」→ 再「是否成员」→ 最后「岗位是否有权访问该页面」。
 * 把权限检查提前会把「不是这个团队的人」显示成「无权限」，既误导用户也丢掉了加入团队的出口。
 *
 * 与 pg-explorer 的差异：本项目的团队数据来自 zustand + localStorage（同步可得），
 * 因此不需要 slug→team 的异步拉取与竞态防护（对方的 mountedRef / 过期响应丢弃逻辑）。
 */
export const Route = createFileRoute('/t/$teamSlug')({
  component: TeamScopedLayout,
})

function TeamScopedLayout() {
  const { teamSlug } = Route.useParams()
  const teams = useOrgStore((s) => s.teams)
  const members = useOrgStore((s) => s.members)
  const currentUserId = useOrgStore((s) => s.currentUserId)
  const activeTeamId = useOrgStore((s) => s.activeTeamId)
  const setActiveTeam = useOrgStore((s) => s.setActiveTeam)
  // 当前路径的权限条目与准入结果（团队页按「当前团队里的岗位」求值，见 config/permissions.ts）
  const { entry, allowed } = useRouteAccess()

  const team = teams.find((t) => t.slug === teamSlug) ?? null
  const isMember = team !== null && isUserMemberOfTeam(members, currentUserId, team.id)

  // URL → store 单向同步：仅在 slug 合法、用户属于该团队、且值确实变化时改写 activeTeamId
  //（避免每次进入团队路由都触发一次 persist 写盘）。
  // effect 依赖里的 team 是 store 数组中的稳定引用，setActiveTeam 也是稳定引用，
  // 因此这里不会因为 store 更新而反复触发。
  useEffect(() => {
    if (team && isMember && activeTeamId !== team.id) setActiveTeam(team.id)
  }, [team, isMember, activeTeamId, setActiveTeam])

  if (!team) return <TeamNotFound slug={teamSlug} />
  if (!isMember) return <TeamNoAccess name={team.name} />
  if (entry && !allowed) return <RouteForbidden labelKey={entry.labelKey} teamSlug={teamSlug} />

  return <Outlet />
}

/** slug 不匹配任何团队：链接失效 / 团队被重命名或删除 */
function TeamNotFound({ slug }: { slug: string }) {
  const { t } = useTranslation()

  return (
    <GuardCard
      icon={<AlertTriangle className="size-6" />}
      title={t('teamRoute.notFoundTitle')}
      description={t('teamRoute.notFoundMessage', { slug })}
    >
      <Button asChild variant="outline">
        <Link to="/">{t('teamRoute.backHome')}</Link>
      </Button>
      <Button asChild variant="ghost">
        <Link to="/teams">
          <Building2 className="size-4" />
          {t('teamRoute.manageTeams')}
        </Link>
      </Button>
    </GuardCard>
  )
}

/** 团队存在但当前用户不是成员：给出回到自己团队的出口 */
function TeamNoAccess({ name }: { name: string }) {
  const { t } = useTranslation()
  const fallbackSlug = activeTeamSlug()

  return (
    <GuardCard
      icon={<ShieldAlert className="size-6" />}
      title={t('teamRoute.noAccessTitle')}
      description={t('teamRoute.noAccessMessage', { name })}
    >
      {fallbackSlug ? (
        <Button asChild>
          <Link to="/t/$teamSlug" params={{ teamSlug: fallbackSlug }}>
            {t('teamRoute.switchToMyTeam')}
          </Link>
        </Button>
      ) : (
        <Button asChild>
          <Link to="/teams">{t('teamRoute.manageTeams')}</Link>
        </Button>
      )}
    </GuardCard>
  )
}
