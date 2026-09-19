import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Building2, ShieldX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouteAccess } from '@/hooks/use-permissions'
import { useTeamSlug } from '@/hooks/use-current-team'

/**
 * 路由准入（route guard）：
 *
 * - `GuardCard` —— 兜底页统一外壳（团队页与权限页共用，保证观感一致）；
 * - `RouteForbidden` —— 「当前角色无权访问该页面」的兜底页，带出口；
 * - `GlobalRouteGate` —— 跨团队页面（/users、/teams、/permissions、/profile、/config/smtp）的统一准入。
 *   放在 __root.tsx 里包住 <Outlet/>，新增管理页**无需**各自写守卫。
 *
 * 团队作用域页面（/t/{slug}/...）的准入在 routes/t.$teamSlug.tsx 里做：
 * 那里能先判「团队是否存在 / 是否成员」，顺序反了会把「不是成员」显示成「无权限」。
 *
 * 注意：这是**前端可见性控制**（导航过滤 + 直达拦截），不是安全边界。
 * 接后端后接口必须自行校验权限，见 stores/permission-store.ts 的说明。
 */

/** 兜底页统一外壳 */
export function GuardCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {icon}
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-center gap-2">{children}</CardContent>
      </Card>
    </div>
  )
}

/** 角色无权访问该页面：给出回到团队首页 / 团队列表的出口 */
export function RouteForbidden({
  labelKey,
  teamSlug,
}: {
  /** 该页面的 i18n 标题 key（复用导航文案） */
  labelKey: string
  teamSlug?: string | null
}) {
  const { t } = useTranslation()

  return (
    <GuardCard
      icon={<ShieldX className="size-6" />}
      title={t('routeAccess.title')}
      description={t('routeAccess.message', { page: t(labelKey) })}
    >
      {teamSlug ? (
        <Button asChild>
          <Link to="/t/$teamSlug" params={{ teamSlug }}>
            {t('routeAccess.backToTeam')}
          </Link>
        </Button>
      ) : (
        <Button asChild>
          <Link to="/">{t('routeAccess.backHome')}</Link>
        </Button>
      )}
      <Button asChild variant="ghost">
        <Link to="/teams">
          <Building2 className="size-4" />
          {t('routeAccess.manageTeams')}
        </Link>
      </Button>
    </GuardCard>
  )
}

/**
 * 跨团队管理页准入：仅对 `scope === 'global'` 的路径生效（团队路径交给团队布局路由）。
 * 未登记的路由（404 等）一律放行，由各自的路由处理。
 */
export function GlobalRouteGate({ children }: { children: ReactNode }) {
  const { entry, allowed } = useRouteAccess()
  const teamSlug = useTeamSlug()

  if (!entry || entry.scope !== 'global' || allowed) return <>{children}</>
  return <RouteForbidden labelKey={entry.labelKey} teamSlug={teamSlug} />
}
