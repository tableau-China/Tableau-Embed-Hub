import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import {
  ChevronsUpDown,
  IdCard,
  KeyRound,
  LogIn,
  RefreshCcw,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
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
import { ChangePasswordDialog, ChangeUsernameDialog } from '@/components/org/account-dialogs'
import { useCurrentTeam } from '@/hooks/use-current-team'
import { useCan } from '@/hooks/use-permissions'
import { userDefaultTeam } from '@/lib/team-context'
import { userMemberships, useOrgStore } from '@/stores/org-store'

/**
 * 侧边栏底部用户菜单（用户在 Team 之上）：
 * - 展示当前登录用户与其全局身份（系统管理员 / 成员）
 * - **个人资料入口**：/profile（v0.7.0 起从 /settings 改名而来；该页 navHidden，不占侧边栏）
 * - **个人信息**（v0.14.0 起）：登录名 / 显示名 / 角色 / 邮箱 / 口令状态的只读摘要，
 *   外加「修改登录名」与「修改口令」两个自助入口（都要先校验当前口令）
 * - 演示环境内置「以其他用户身份查看」：切换后其所属团队随之成为可切换范围
 *
 * 口令在这里**只显示状态、永不回显**：`passwordUpdatedAt` 时间戳或「未设置」，
 * 口令本身不进前端状态（见 `stores/org-store.ts` 的 `OrgUser.passwordUpdatedAt` 注释）。
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
  // 「个人信息」区块的两个自助弹窗（同一时刻只开一个）
  const [dialog, setDialog] = useState<'username' | 'password' | null>(null)

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
            {/* 个人资料：入口在用户菜单里（该页 navHidden，不占侧边栏） */}
            {can('page.profile') && (
              <>
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="gap-2 p-2" data-user-menu="profile">
                    <UserRound className="size-4" />
                    <span className="flex-1 truncate">{t('nav.profile')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {/* 个人信息：只读摘要 + 两个自助入口（登录名 / 口令）。
                刻意做成非交互的 label 而不是按钮 —— 它交代「我是谁、我的口令上次什么时候动过」，
                要点的是下面两个动作。 */}
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <IdCard className="size-3" />
              {t('profile.personalInfo')}
            </DropdownMenuLabel>
            <div className="flex flex-col gap-1 px-1.5 pb-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t('users.username')}</span>
                <span className="truncate font-mono font-medium" data-user-menu="username">
                  {currentUser.username}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t('users.name')}</span>
                <span className="truncate font-medium">{currentUser.name}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t('profile.role')}</span>
                <span className="flex items-center gap-1 truncate font-medium">
                  {currentUser.isSystemAdmin && <ShieldCheck className="size-3" />}
                  {roleLabel}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t('users.password')}</span>
                {/* 口令只报状态，不回显：时间戳或「未设置」—— 口令本身不进前端状态 */}
                <span className="truncate font-medium" data-user-menu="password-state">
                  {currentUser.passwordUpdatedAt
                    ? new Date(currentUser.passwordUpdatedAt).toLocaleString()
                    : t('profile.passwordNotSet')}
                </span>
              </div>
            </div>
            <DropdownMenuItem
              onClick={() => setDialog('username')}
              className="gap-2 p-2"
              data-user-menu="change-username"
            >
              <LogIn className="size-4" />
              <span className="flex-1 truncate">{t('profile.changeUsername')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDialog('password')}
              className="gap-2 p-2"
              data-user-menu="change-password"
            >
              <KeyRound className="size-4" />
              <span className="flex-1 truncate">{t('profile.changePassword')}</span>
            </DropdownMenuItem>
            {others.length > 0 && (
              <>
                <DropdownMenuSeparator />
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
      {/* 两个自助弹窗挂在菜单外：下拉关闭不影响它们（Radix Dialog 是独立 portal） */}
      <ChangeUsernameDialog
        user={currentUser}
        open={dialog === 'username'}
        onOpenChange={(open) => setDialog(open ? 'username' : null)}
      />
      <ChangePasswordDialog
        user={currentUser}
        open={dialog === 'password'}
        onOpenChange={(open) => setDialog(open ? 'password' : null)}
      />
    </SidebarMenu>
  )
}
