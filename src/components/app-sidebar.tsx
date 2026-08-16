import {
  BookOpen,
  ChevronsUpDown,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

const GENERAL_ITEMS = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/favorites', labelKey: 'nav.favorites', icon: Star },
  { to: '/recents', labelKey: 'nav.recents', icon: Clock },
  { to: '/workbooks', labelKey: 'nav.workbooks', icon: BookOpen },
  { to: '/views', labelKey: 'nav.views', icon: MonitorPlay },
] as const

const SETTINGS_ITEMS = [
  { to: '/users', labelKey: 'nav.users', icon: Users },
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                {/* 站点 Logo：与浏览器 favicon 同一张图（Tableau 图标） */}
                <img
                  src="/favicon.ico"
                  alt="shadcn-admin"
                  className="size-8 shrink-0 rounded-lg"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">shadcn-admin</span>
                  <span className="truncate text-xs opacity-60">v0.2.1</span>
                </div>
                <Badge variant="secondary">en</Badge>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">AD</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Admin</span>
                    <span className="truncate text-xs">{t('header.role')}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                sideOffset={4}
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">AD</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">Admin</span>
                      <span className="truncate text-xs">admin@example.com</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>{t('header.account')}</DropdownMenuItem>
                <DropdownMenuItem>{t('header.signOut')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
