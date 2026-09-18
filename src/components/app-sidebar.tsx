import {
  BookOpen,
  Building2,
  Clock,
  LayoutDashboard,
  MonitorPlay,
  Settings,
  Star,
  Users,
} from 'lucide-react'
import { Link, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { TeamSwitcher } from '@/components/org/team-switcher'
import { UserMenu } from '@/components/org/user-menu'
import { APP_VERSION } from '@/config/app'
import { useTeamSlug } from '@/hooks/use-current-team'
import { teamScopedPath } from '@/lib/team-context'

/**
 * 侧边栏导航分为两层（v0.5.0 起团队身份进入 URL）：
 *
 * - **团队作用域**（GENERAL_ITEMS）：URL 形如 `/t/{slug}/workbooks`，
 *   `to` 写路由模式，渲染时用当前团队 slug 填充 params；
 * - **跨团队管理页**（SETTINGS_ITEMS）：URL 不带 slug（对齐 pg-explorer 的 /admin/*），
 *   团队管理、用户管理、系统设置本就跨越单个团队。
 */

/** 团队作用域路由模式前缀（导航条目据此推导站内相对路径） */
const TEAM_SCOPE_PATTERN = '/t/$teamSlug'

const GENERAL_ITEMS = [
  { to: '/t/$teamSlug', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/t/$teamSlug/favorites', labelKey: 'nav.favorites', icon: Star },
  { to: '/t/$teamSlug/recents', labelKey: 'nav.recents', icon: Clock },
  { to: '/t/$teamSlug/workbooks', labelKey: 'nav.workbooks', icon: BookOpen },
  { to: '/t/$teamSlug/views', labelKey: 'nav.views', icon: MonitorPlay },
] as const

const SETTINGS_ITEMS = [
  { to: '/users', labelKey: 'nav.users', icon: Users },
  { to: '/teams', labelKey: 'nav.teams', icon: Building2 },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
] as const

/** 把 `/t/$teamSlug/flows/foc` 还原成站内相对路径 `/flows/foc`（首页为 ''） */
function teamRelative(pattern: string): string {
  return pattern.slice(TEAM_SCOPE_PATTERN.length)
}

/**
 * 团队作用域导航：slug 缺失（用户尚无任何团队）时渲染为禁用项，
 * 避免拼出 `/t//workbooks` 这类无效链接。
 */
function TeamNavList({
  items,
  teamSlug,
}: {
  items: typeof GENERAL_ITEMS
  teamSlug: string | null
}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon
        const relative = teamRelative(item.to)
        const resolved = teamSlug ? teamScopedPath(teamSlug, relative) : null
        const isActive =
          resolved !== null &&
          (relative === '' ? pathname === resolved : pathname.startsWith(resolved))

        if (!teamSlug) {
          return (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton disabled tooltip={t('nav.noTeamAvailable')}>
                <Icon />
                <span>{t(item.labelKey)}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        }

        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton asChild isActive={isActive} tooltip={t(item.labelKey)}>
              <Link to={item.to} params={{ teamSlug }}>
                <Icon />
                <span>{t(item.labelKey)}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

/** 跨团队管理页导航（无 slug） */
function NavList({ items }: { items: typeof SETTINGS_ITEMS }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon
        const isActive = pathname.startsWith(item.to)
        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton asChild isActive={isActive} tooltip={t(item.labelKey)}>
              <Link to={item.to}>
                <Icon />
                <span>{t(item.labelKey)}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

export function AppSidebar() {
  const { t } = useTranslation()
  // 当前团队 slug 来自 URL（/t/{slug}/...）；管理页回退 activeTeamId
  const teamSlug = useTeamSlug()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* 左上角：Team 切换器（点击弹出当前用户可用的团队；系统管理员可新建/管理） */}
        <TeamSwitcher />
        <div className="hidden truncate px-2 pb-1 text-[11px] text-muted-foreground/80 group-data-[collapsible=icon]:hidden">
          shadcn-admin · v{APP_VERSION}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.general')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <TeamNavList items={GENERAL_ITEMS} teamSlug={teamSlug} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.settings')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavList items={SETTINGS_ITEMS} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {/* 底部：当前用户（用户位于 Team 之上，可切换身份） */}
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
