import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { ChevronsUpDown, CircleHelp, RefreshCcw, UserRound } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
} from '@/components/ui/sidebar'
import { useCurrentTeam } from '@/hooks/use-current-team'
import { useCan } from '@/hooks/use-permissions'
import { userDefaultTeam } from '@/lib/team-context'
import { userMemberships, useOrgStore } from '@/stores/org-store'

/**
 * 侧边栏底部用户菜单（用户在 Team 之上）：
 * - 展示当前登录用户与其全局身份（系统管理员 / 成员）
 * - **个人资料入口**：`/profile`（v0.7.0 起从 /settings 改名而来；该页 navHidden，不占侧边栏）
 * - **帮助入口**：`/help`（v0.14.4 起从侧边栏 Config 分组移来，紧跟在 Profile 下面）
 *   v0.14.2 起下拉里**只留入口，不再平铺账号摘要**：用户点开后进入个人资料页，
 *   在那里看完整用户详情、改显示名称、改登录名、改口令（见 features/profile/profile-page.tsx）。
 *   理由：下拉是把「我」（换身份）与「我的账号」两件事混在一起的窄容器，口令状态这类信息
 *   塞在里面既挤又难读，还把两个敏感表单的触发点藏在了浮层里。
 * - 演示环境内置「以其他用户身份查看」：切换后其所属团队随之成为可切换范围
 */
export function UserMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const users = useOrgStore((s) => s.users)
  const teams = useOrgStore((s) => s.teams)
  const members = useOrgStore((s) => s.members)
  const currentUserId = useOrgStore((s) => s.currentUserId)
  const setCurrentUser = useOrgStore((s) => s.setCurrentUser)
  // 当前 URL 指向的团队（切换身份后据此判断是否需要换团队）
  const urlTeam = useCurrentTeam()
  // 个人资料页的准入：入口在这里而不在侧边栏，但仍按同一套权限判定（无权则不显示入口）
  const can = useCan()

  const currentUser = users.find((u) => u.id === currentUserId) ?? null
  if (!currentUser) return null

  const others = users.filter((u) => u.id !== currentUser.id)
  const roleLabel = currentUser.isSystemAdmin
    ? t('users.roleSuperAdmin')
    : t('users.roleMember')

  const handleSwitch = (userId: number) => {
    // 冻结（status: disabled）的账号无法登录 —— store 会拒绝，这里给出原因提示
    if (!setCurrentUser(userId)) {
      const frozenName = users.find((u) => u.id === userId)?.name ?? ''
      toast.error(t('users.frozenCannotLogin', { name: frozenName }))
      return
    }
    const nextMemberships = userMemberships(members, userId)
    const switchedName = users.find((u) => u.id === userId)?.name ?? ''

    if (nextMemberships.length === 0) {
      toast.warning(t('users.noTeamsWarning'))
      void navigate({ to: '/teams', replace: true })
      return
    }

    toast.success(t('users.switchedTo', { name: switchedName }))

    // 用户位于 Team 之上：新身份若不属于当前 URL 的团队，跳到其默认团队，
    // 否则会停在 /t/{别人的团队} 的无权限兜底页（URL 是团队身份的权威来源）。
    const stillMember =
      urlTeam !== null && nextMemberships.some((m) => m.teamId === urlTeam.id)
    if (!stillMember) {
      const target = userDefaultTeam(teams, members, userId)
      if (target) {
        void navigate({
          to: '/t/$teamSlug',
          params: { teamSlug: target.slug },
          replace: true,
        })
      }
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {currentUser.initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{currentUser.name}</span>
                <span className="truncate text-xs">{roleLabel}</span>
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
                  <AvatarFallback className="rounded-lg">
                    {currentUser.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{currentUser.name}</span>
                  <span className="truncate text-xs">{currentUser.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* 个人资料：唯一的账号入口。详情、改显示名称、改登录名、改口令都在那一页里，
                下拉本身不再展开任何账号摘要（见文件头注释）。 */}
            {can('page.profile') && (
              <DropdownMenuItem asChild>
                <Link to="/profile" className="gap-2 p-2" data-user-menu="profile">
                  <UserRound className="size-4" />
                  <span className="flex-1 truncate">{t('profile.title')}</span>
                </Link>
              </DropdownMenuItem>
            )}
            {/* 帮助：v0.14.4 起从侧边栏 Config 分组移到这里（Profile 下面）——
                说明书是「给用户本人看的东西」，与账号入口同属个人层，不占侧边栏 */}
            {can('page.help') && (
              <DropdownMenuItem asChild>
                <Link to="/help" className="gap-2 p-2" data-user-menu="help">
                  <CircleHelp className="size-4" />
                  <span className="flex-1 truncate">{t('nav.help')}</span>
                </Link>
              </DropdownMenuItem>
            )}
            {(can('page.profile') || can('page.help')) && <DropdownMenuSeparator />}
            {others.length > 0 && (
              <>
                <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RefreshCcw className="size-3" />
                  {t('users.switchUser')}
                </DropdownMenuLabel>
                {others.map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    disabled={user.status !== 'active'}
                    title={
                      user.status !== 'active' ? t('users.frozenHint') : undefined
                    }
                    onClick={() => handleSwitch(user.id)}
                    className="gap-2 p-2"
                  >
                    <Avatar className="size-6 rounded-md">
                      <AvatarFallback className="rounded-md text-[10px]">
                        {user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{user.name}</span>
                    {user.status !== 'active' ? (
                      <span className="shrink-0 rounded-md border border-rose-400/40 bg-rose-400/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
                        {t('users.frozen')}
                      </span>
                    ) : (
                      <span className="truncate text-xs text-muted-foreground">
                        {user.isSystemAdmin
                          ? t('users.roleSuperAdmin')
                          : t('users.roleMember')}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <div className="px-3 py-1.5 text-xs text-muted-foreground">
              {t('users.switchHint')}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
