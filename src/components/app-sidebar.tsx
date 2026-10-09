import { Link, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  Blocks,
  BookOpen,
  Building2,
  CalendarClock,
  CircleHelp,
  Clock,
  KeyRound,
  LayoutDashboard,
  Mail,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Star,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'

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
import { APP_NAME, APP_VERSION } from '@/config/app'
import { ROUTE_CATALOG, ROUTE_ENTRIES, type NavGroup, type RouteKey } from '@/config/permissions'
import { useTeamSlug } from '@/hooks/use-current-team'
import { useCan } from '@/hooks/use-permissions'
import { teamScopedPath } from '@/lib/team-context'

/**
 * 侧边栏导航（v0.6.0 起由权限目录驱动）：
 *
 * 条目**不再硬编码在本文件**，而是从 `src/config/permissions.ts` 的 ROUTE_CATALOG 派生 ——
 * 新增页面只登记一行，侧边栏入口 / 路由守卫 / 权限页勾选行三处同时生效。
 *
 * 两层结构不变（v0.5.0 起团队身份进入 URL）：
 * - **团队作用域**（scope: 'team'）：URL 形如 `/t/{slug}/workbooks`，`to` 写路由模式，
 *   渲染时用当前团队 slug 填充 params；
 * - **跨团队页**（scope: 'global'）：URL 不带 slug（对齐 pg-explorer 的 /admin/*）。
 *
 * 权限：按 `useCan()` 过滤（当前角色无权访问的条目不渲染）；
 * 例外 —— 用户尚无任何团队时，团队条目**全部**渲染为禁用项（提示先加入团队），
 * 否则新用户会看到一个空侧边栏、不知道发生了什么。
 */

type CatalogEntry = (typeof ROUTE_CATALOG)[number]
type TeamEntry = Extract<CatalogEntry, { scope: 'team' }>
type GlobalEntry = Extract<CatalogEntry, { scope: 'global' }>

/** 分组渲染顺序：与权限页的分组顺序一致 */
const NAV_GROUPS: { group: NavGroup; scope: 'team' | 'global'; labelKey: string }[] = [
  { group: 'general', scope: 'team', labelKey: 'nav.general' },
  // AI 分组排在团队工作区之后、组织管理之前：它是能力展示，不是管理面
  { group: 'ai', scope: 'global', labelKey: 'nav.aiGroup' },
  { group: 'settings', scope: 'global', labelKey: 'nav.settings' },
  { group: 'config', scope: 'global', labelKey: 'nav.config' },
]

/**
 * `navHidden` 的条目（如 Profile：入口在左下角用户菜单）不进侧边栏，但仍在权限体系内。
 * 读可选字段要走 `ROUTE_ENTRIES`（接口视图）—— `as const` 的字面量联合里，
 * 未声明 `navHidden` 的条目没有该字段，直接读会 tsc 报错。
 */
const NAV_VISIBLE_KEYS = new Set(
  ROUTE_ENTRIES.filter((e) => !e.navHidden).map((e) => e.key),
)

/** 按作用域切分目录（类型谓词让 Link 的 to/params 保持字面量联合，params 仍受类型检查） */
const TEAM_NAV = ROUTE_CATALOG.filter(
  (e): e is TeamEntry => e.scope === 'team' && NAV_VISIBLE_KEYS.has(e.key),
)
const GLOBAL_NAV = ROUTE_CATALOG.filter(
  (e): e is GlobalEntry => e.scope === 'global' && NAV_VISIBLE_KEYS.has(e.key),
)

/**
 * 路由权限键 → 图标。`Record<RouteKey, …>` 让 TS 强制每个新页面在此表态：
 * 在 ROUTE_CATALOG 里加了页面却忘配图标，tsc 直接报错（好过运行时出现空白图标）。
 */
const ICONS: Record<RouteKey, LucideIcon> = {
  'page.dashboard': LayoutDashboard,
  'page.favorites': Star,
  'page.recents': Clock,
  'page.workbooks': BookOpen,
  'page.views': MonitorPlay,
  // 站点级管理：用户与角色用「人 + 齿轮」，计划用「日历 + 时钟」——避免与工作簿/视图类图标混淆
  'page.tableau.users': UserCog,
  'page.tableau.schedules': CalendarClock,
  'page.ai': Sparkles,
  'page.users': Users,
  'page.teams': Building2,
  'page.profile': UserRound,
  'page.help': CircleHelp,
  'page.components': Blocks,
  'page.config.smtp': Mail,
  'page.config.login': KeyRound,
  'page.permissions': ShieldCheck,
}

/** 团队作用域路由模式前缀（导航条目据此推导站内相对路径） */
const TEAM_SCOPE_PATTERN = '/t/$teamSlug'

/** 把 `/t/$teamSlug/workbooks` 还原成站内相对路径 `/workbooks`（团队首页为 ''） */
function teamRelative(pattern: string): string {
  return pattern.slice(TEAM_SCOPE_PATTERN.length)
}

/**
 * 团队作用域导航：slug 缺失（用户尚无任何团队）时渲染为禁用项，
 * 避免拼出 `/t//workbooks` 这类无效链接。
 */
function TeamNavList({ items, teamSlug }: { items: TeamEntry[]; teamSlug: string | null }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = ICONS[item.key]
        const relative = teamRelative(item.to)
        const resolved = teamSlug ? teamScopedPath(teamSlug, relative) : null
        const isActive =
          resolved !== null &&
          (relative === '' ? pathname === resolved : pathname.startsWith(resolved))

        if (!teamSlug) {
          return (
            <SidebarMenuItem key={item.key}>
              <SidebarMenuButton disabled tooltip={t('nav.noTeamAvailable')}>
                <Icon />
                <span>{t(item.labelKey)}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        }

        return (
          <SidebarMenuItem key={item.key}>
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
function GlobalNavList({ items }: { items: GlobalEntry[] }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = ICONS[item.key]
        const isActive = pathname.startsWith(item.to)
        return (
          <SidebarMenuItem key={item.key}>
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
  // 当前身份（全局身份 + 当前团队岗位）在各页面上的准入判定
  const can = useCan()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* 左上角：Team 切换器（点击弹出当前用户可用的团队；系统管理员可新建/管理） */}
        <TeamSwitcher />
        <div className="hidden truncate px-2 pb-1 text-[11px] text-muted-foreground/80 group-data-[collapsible=icon]:hidden">
          {APP_NAME} · v{APP_VERSION}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((nav) => {
          if (nav.scope === 'team') {
            const items = TEAM_NAV.filter((e) => e.group === nav.group)
            // 无当前团队时团队条目不做权限过滤（统一渲染为禁用项），避免新手看到空菜单
            const visible = teamSlug === null ? items : items.filter((e) => can(e.key))
            if (visible.length === 0) return null
            return (
              <SidebarGroup key={nav.group}>
                <SidebarGroupLabel>{t(nav.labelKey)}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <TeamNavList items={visible} teamSlug={teamSlug} />
                </SidebarGroupContent>
              </SidebarGroup>
            )
          }

          const visible = GLOBAL_NAV.filter((e) => e.group === nav.group && can(e.key))
          if (visible.length === 0) return null
          return (
            <SidebarGroup key={nav.group}>
              <SidebarGroupLabel>{t(nav.labelKey)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <GlobalNavList items={visible} />
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarFooter>
        {/* 底部：当前用户（用户位于 Team 之上，可切换身份） */}
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
