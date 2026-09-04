import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Check, ChevronsUpDown, Plus, ShieldAlert } from 'lucide-react'
import { Link } from '@tanstack/react-router'

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
import { useOrgStore } from '@/stores/org-store'
import { cn } from '@/lib/utils'

/**
 * 侧边栏顶部 Team 切换器（左上角）：
 * - 点击弹出当前用户所属的全部团队，切换 activeTeamId（团队作用域数据随之切换）
 * - 系统管理员额外提供「创建团队」与「Manage teams」入口
 */
export function TeamSwitcher() {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  const teams = useOrgStore((s) => s.teams)
  const members = useOrgStore((s) => s.members)
  const currentUserId = useOrgStore((s) => s.currentUserId)
  const activeTeamId = useOrgStore((s) => s.activeTeamId)
  const setActiveTeam = useOrgStore((s) => s.setActiveTeam)
  const currentUser = useOrgStore((s) =>
    s.users.find((u) => u.id === s.currentUserId),
  )
  const isSuperAdmin = currentUser?.isSystemAdmin === true

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const myTeams = teams.filter((team) =>
    members.some((m) => m.userId === currentUserId && m.teamId === team.id),
  )
  const activeTeam = myTeams.find((t) => t.id === activeTeamId) ?? myTeams[0] ?? null

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

  const sortedTeams = [
    ...myTeams.filter((team) => team.id !== activeTeam.id),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const listTeams = [activeTeam, ...sortedTeams]

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
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{activeTeam.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeTeam.description || t('nav.noDescription')}
                </span>
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
            {listTeams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => {
                  setActiveTeam(team.id)
                  setDropdownOpen(false)
                }}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border bg-background">
                  <TeamLogo logo={team.logo} className="size-4 shrink-0" />
                </div>
                <span className="flex-1 truncate">{team.name}</span>
                {team.id === activeTeam.id && (
                  <Check className="size-4 text-primary" />
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
