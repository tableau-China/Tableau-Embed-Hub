import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronsUpDown, RefreshCcw } from 'lucide-react'

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
import { userMemberships, useOrgStore } from '@/stores/org-store'

/**
 * 侧边栏底部用户菜单（用户在 Team 之上）：
 * - 展示当前登录用户与其全局身份（系统管理员 / 成员）
 * - 演示环境内置「以其他用户身份查看」：切换后其所属团队随之成为可切换范围
 */
export function UserMenu() {
  const { t } = useTranslation()
  const users = useOrgStore((s) => s.users)
  const members = useOrgStore((s) => s.members)
  const currentUserId = useOrgStore((s) => s.currentUserId)
  const setCurrentUser = useOrgStore((s) => s.setCurrentUser)

  const currentUser = users.find((u) => u.id === currentUserId) ?? null
  if (!currentUser) return null

  const others = users.filter((u) => u.id !== currentUser.id)
  const roleLabel = currentUser.isSystemAdmin
    ? t('users.roleSuperAdmin')
    : t('users.roleMember')

  const handleSwitch = (userId: number) => {
    setCurrentUser(userId)
    const mine = userMemberships(members, userId)
    if (mine.length === 0) {
      toast.warning(t('users.noTeamsWarning'))
    } else {
      toast.success(t('users.switchedTo', { name: users.find((u) => u.id === userId)?.name ?? '' }))
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
            {others.length > 0 && (
              <>
                <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RefreshCcw className="size-3" />
                  {t('users.switchUser')}
                </DropdownMenuLabel>
                {others.map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => handleSwitch(user.id)}
                    className="gap-2 p-2"
                  >
                    <Avatar className="size-6 rounded-md">
                      <AvatarFallback className="rounded-md text-[10px]">
                        {user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.isSystemAdmin
                        ? t('users.roleSuperAdmin')
                        : t('users.roleMember')}
                    </span>
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
