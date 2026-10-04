import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Building2,
  Check,
  ChevronsUpDown,
  PauseCircle,
  Plus,
  ShieldAlert,
  Star,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { TeamLogo } from '@/components/org/team-logo'
import { TeamDialog } from '@/components/org/team-dialog'
import { useCurrentTeam } from '@/hooks/use-current-team'
import { stripTeamPrefix } from '@/lib/team-context'
import { canEnterTeam, sortTeamsById, useOrgStore } from '@/stores/org-store'
import { cn } from '@/lib/utils'

/**
 * 侧边栏顶部 Team 切换器（左上角）：
 * - 点击弹出当前用户所属的全部团队，切换团队 = 切换 /t/{slug} 路由前缀
 * - 系统管理员额外提供「创建团队」与「Manage teams」入口
 */
export function TeamSwitcher() {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const teams = useOrgStore((s) => s.teams)
  const members = useOrgStore((s) => s.members)
  const currentUserId = useOrgStore((s) => s.currentUserId)
  const setActiveTeam = useOrgStore((s) => s.setActiveTeam)
  // 当前团队以 URL 为准（/t/{slug}/...），管理页回退 activeTeamId
  const urlTeam = useCurrentTeam()
  const currentUser = useOrgStore((s) =>
    s.users.find((u) => u.id === s.currentUserId),
  )
  const isSuperAdmin = currentUser?.isSystemAdmin === true

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  // 当前用户可进入的团队：按创建次序（id 升序）展示。
  // 冻结团队（suspended）只有系统管理员能看到并进入 —— 普通成员的列表里直接不出现。
  const myTeams = sortTeamsById(
    teams.filter(
      (team) =>
        members.some((m) => m.userId === currentUserId && m.teamId === team.id) &&
        canEnterTeam(team, currentUser),
    ),
  )
  // URL 里的团队必须是「我的团队」之一才用于高亮，否则退回首个可用团队
  const activeTeam =
    myTeams.find((t) => t.id === urlTeam?.id) ?? myTeams[0] ?? null

  /**
   * 切换团队：URL 前缀随团队改变（团队作用域数据随之切换）。
   * 若当前已在某个团队的同级页面内，保留该子路径 —— 所有团队共用同一套页面，
   * 切团队相当于「换个站点看同一个页面」；跨团队页面（/users、/teams、/config/smtp 等）则回到团队首页。
   */
  const switchTeam = (teamSlug: string, teamId: number) => {
    // 冻结团队对非管理员会被 store 拒绝 —— 不跳转，避免把用户带进打不开的 URL
    if (!setActiveTeam(teamId)) {
      toast.error(t('teams.suspendHint'))
      return
    }
    navigate({ href: `/t/${teamSlug}${stripTeamPrefix(pathname)}`, replace: true })
  }

  // 当前用户的默认团队（用户切到其他 team 时会被选中的那个）
  const defaultTeamId =
    currentUserId === null
      ? null
      : (members.find((m) => m.userId === currentUserId && m.isDefault)?.teamId ??
        null)

  // 当前用户尚未加入任何团队
  if (activeTeam === null) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          {isSuperAdmin ? (
            <>
              <SidebarMenuButton size="lg" onClick={() => setCreateOpen(true)}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Plus className="size-4" />
                </div>
                <div className="grid flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {t('nav.createTeam')}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t('nav.gettingStarted')}
                  </span>
                </div>
              </SidebarMenuButton>
              <TeamDialog open={createOpen} onOpenChange={setCreateOpen} />
            </>
          ) : (
            <SidebarMenuButton size="lg" disabled>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary/40 text-sidebar-primary-foreground/70">
                <ShieldAlert className="size-4" />
              </div>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold text-muted-foreground">
                  {t('nav.noTeamAvailable')}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {t('nav.contactAdmin')}
                </span>
              </div>
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className={cn(
                'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground',
              )}
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <TeamLogo logo={activeTeam.logo} className="size-4" />
              </div>
              {/* 仅显示团队名称（不放 default 星标、不显示说明），保证标题完整可读 */}
              <div className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
                {activeTeam.name}
              </div>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t('nav.switchTeam')}
            </DropdownMenuLabel>
            {myTeams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => {
                  switchTeam(team.slug, team.id)
                  setDropdownOpen(false)
                }}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border bg-background">
                  <TeamLogo logo={team.logo} className="size-4 shrink-0" />
                </div>
                <span className="flex-1 truncate">{team.name}</span>
                {team.suspended && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-400/40 bg-rose-400/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300"
                    title={t('teams.suspendHint')}
                  >
                    <PauseCircle className="size-2.5" />
                    {t('teams.suspended')}
                  </span>
                )}
                {team.id === defaultTeamId && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                    title={t('teams.defaultTeam')}
                  >
                    <Star className="size-2.5 fill-amber-400 text-amber-400" />
                    {t('teams.myDefaultLabel')}
                  </span>
                )}
                {team.id === activeTeam.id && (
                  <Check className="size-4 shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            {isSuperAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 p-2"
                  onClick={() => {
                    setDropdownOpen(false)
                    setCreateOpen(true)
                  }}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Plus className="size-4" />
                  </div>
                  <span className="flex-1 truncate font-medium">
                    {t('nav.createTeam')}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="gap-2 p-2">
                  <Link to="/teams">
                    <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                      <Building2 className="size-4" />
                    </div>
                    <span className="flex-1 truncate font-medium">
                      {t('nav.manageTeams')}
                    </span>
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <TeamDialog open={createOpen} onOpenChange={setCreateOpen} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
