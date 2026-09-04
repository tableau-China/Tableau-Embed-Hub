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

const GENERAL_ITEMS = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/favorites', labelKey: 'nav.favorites', icon: Star },
  { to: '/recents', labelKey: 'nav.recents', icon: Clock },
  { to: '/workbooks', labelKey: 'nav.workbooks', icon: BookOpen },
  { to: '/views', labelKey: 'nav.views', icon: MonitorPlay },
] as const

const SETTINGS_ITEMS = [
  { to: '/users', labelKey: 'nav.users', icon: Users },
  { to: '/teams', labelKey: 'nav.teams', icon: Building2 },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
] as const

function NavList({
  items,
}: {
  items: ReadonlyArray<{ to: string; labelKey: string; icon: typeof LayoutDashboard }>
}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon
        const isActive = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
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
            <NavList items={GENERAL_ITEMS} />
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
