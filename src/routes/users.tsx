import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Ban,
  CircleCheck,
  Info,
  KeyRound,
  Pencil,
  Plus,
  SearchX,
  ShieldCheck,
  Star,
  Trash2,
  Users,
} from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ActionButtons } from '@/components/action-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FilterBar, FilterSearch, FilterSelect } from '@/components/filter-bar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TeamLogo } from '@/components/org/team-logo'
import { ResetPasswordDialog } from '@/components/org/reset-password-dialog'
import { UserFormDialog, UserTeamsDialog } from '@/components/org/user-dialogs'
import { useListFilters } from '@/hooks/use-list-filters'
import {
  TEAM_ROLE_LABEL_KEYS,
  USER_STATUSES,
  USER_STATUS_LABEL_KEYS,
  sortTeamsById,
  useOrgStore,
  type OrgUser,
  type UserStatus,
} from '@/stores/org-store'

export const Route = createFileRoute('/users')({
  component: UsersPage,
})

function statusBadgeVariant(status: UserStatus) {
  return status === 'active' ? ('default' as const) : ('outline' as const)
}

/* ============================== 筛选 ============================== */

/** 状态筛选：'all' = 不筛；其余取值与 `OrgUser.status` 同源（加了新状态这里自动多一项） */
type StatusFilter = 'all' | UserStatus

interface UserFilterValues extends Record<string, string> {
  /** 登录名关键词（大小写不敏感的包含匹配） */
  q: string
  status: StatusFilter
  /** 团队 id 的字符串形式；'all' = 不筛 */
  team: string
}

/**
 * 筛选默认值（**同时是「重置」的目标值**）—— 三条筛选的初始态与「未筛选」的定义都在这里，
 * 页面其余部分不再重复判断「空串算不算在筛」。
 */
const USER_FILTER_DEFAULTS: UserFilterValues = { q: '', status: 'all', team: 'all' }

/**
 * 全局用户管理页：用户位于 Team 之上 ——
 * 每个用户可属于多个团队（各自持有团队岗位），可被提升为系统管理员。
 * 系统管理员可增删改；其它用户只读浏览。
 *
 * 本页演示态的账号来自 `stores/org-store.ts`（localStorage）。接后端时把该 store 的
 * `users` / `addUser` / `updateUser` / `deleteUser` / `setUserPassword` 换成接口调用即可，
 * **本文件一行都不用改**（数据形状保持不变）—— 列与动作就是按真实账号表的字段定的：
 *   `username`（登录名，唯一且不可改）/ `name`（展示名）/ `email` / `status` / `isSystemAdmin`。
 */
function UsersPage() {
  const { t } = useTranslation()
  const users = useOrgStore((s) => s.users)
  const teams = useOrgStore((s) => s.teams)
  const members = useOrgStore((s) => s.members)
  const currentUserId = useOrgStore((s) => s.currentUserId)
  const deleteUser = useOrgStore((s) => s.deleteUser)
  const freezeUser = useOrgStore((s) => s.freezeUser)
  const currentUser = users.find((u) => u.id === currentUserId)
  const isSuperAdmin = currentUser?.isSystemAdmin === true

  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null)
  const [teamsUser, setTeamsUser] = useState<OrgUser | null>(null)
  const [passwordUser, setPasswordUser] = useState<OrgUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<OrgUser | null>(null)

  const filters = useListFilters(USER_FILTER_DEFAULTS)
  const { q, status: statusFilter, team: teamFilter } = filters.values

  const membershipsOf = (userId: number) =>
    members
      .filter((m) => m.userId === userId)
      .map((m) => ({ ...m, team: teams.find((team) => team.id === m.teamId) }))
      .filter((m) => m.team !== undefined)

  /* ------------------------------ 筛选 ------------------------------ */

  /**
   * 筛选口径（**唯一的一处**，别在渲染里再判一次）：
   *   - 关键词：登录名包含匹配，大小写不敏感、去首尾空格（登录名本身就是大小写不敏感的账号口径）。
   *     只搜 `username`：它是账号的主键口径，与展示名 `name` 刻意分开（见 org-rules.md）；
   *     要连展示名/邮箱一起搜，只需在这一行加 `|| user.name` —— 控件不用动。
   *   - 状态：精确匹配 `active` / `disabled`。
   *   - 团队：**成员关系命中**（该用户属于这个团队，不区分岗位，也不看是不是默认团队）。
   *
   * 放在 `useMemo` 里：一次输入只过滤一遍，而不是每次渲染（含每个弹窗开关）都重算。
   */
  const visibleUsers = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const teamId = teamFilter === 'all' ? null : Number(teamFilter)

    return users.filter((user) => {
      if (needle !== '' && !user.username.toLowerCase().includes(needle)) return false
      if (statusFilter !== 'all' && user.status !== statusFilter) return false
      if (teamId !== null && !members.some((m) => m.userId === user.id && m.teamId === teamId)) {
        return false
      }
      return true
    })
  }, [users, members, q, statusFilter, teamFilter])

  /** 状态选项与徽章同源（`USER_STATUS_LABEL_KEYS`）—— 加了新状态这里自动出现 */
  const statusOptions = USER_STATUSES.map((value) => ({
    value,
    label: t(USER_STATUS_LABEL_KEYS[value]),
  }))

  /** 团队选项按创建次序（与 /teams 一致），带团队 Logo */
  const teamOptions = sortTeamsById(teams).map((team) => ({
    value: String(team.id),
    label: team.name,
    icon: <TeamLogo logo={team.logo} className="size-3.5 text-muted-foreground" />,
  }))

  /**
   * 两道闸在这里只是不让用户白点一下弹窗；**真正的判据在服务端**
   * （`UserRepository` / `UserApi` 会再判一次「至少保留一名管理员」与「不能删自己」）。
   * 演示态没有服务端，所以这两条就是唯一的一道 —— 接后端后建议保留（省一次往返）。
   */
  /** 冻结 / 解冻用户：冻结后无法登录（store 里也拦一道，见 setCurrentUser） */
  const handleToggleFreeze = (user: OrgUser) => {
    const frozen = user.status === 'active'
    if (!freezeUser(user.id, frozen)) {
      toast.error(
        user.id === currentUserId
          ? t('users.cannotFreezeSelf')
          : t('users.cannotFreezeLastAdmin'),
      )
      return
    }
    toast.success(
      frozen
        ? t('users.frozenToast', { name: user.name })
        : t('users.unfrozenToast', { name: user.name }),
    )
  }

  const handleDelete = () => {
    if (!deletingUser) return
    if (deletingUser.id === currentUserId) {
      toast.error(t('users.cannotDeleteSelf'))
      setDeletingUser(null)
      return
    }
    if (deletingUser.isSystemAdmin) {
      const superAdmins = users.filter((u) => u.isSystemAdmin)
      if (superAdmins.length <= 1) {
        toast.error(t('users.cannotDeleteLastAdmin'))
        setDeletingUser(null)
        return
      }
    }
    deleteUser(deletingUser.id)
    toast.success(t('users.deleted', { name: deletingUser.name }))
    setDeletingUser(null)
  }

  // 表头列数：管理员多一个操作列（空态行的 colSpan 要跟着走，否则会串列）
  const columnCount = isSuperAdmin ? 7 : 6

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle>{t('users.title')}</CardTitle>
              <CardDescription>{t('users.subtitle')}</CardDescription>
            </div>
            {isSuperAdmin && (
              <Button
                className="shrink-0"
                onClick={() => {
                  setEditingUser(null)
                  setFormOpen(true)
                }}
              >
                <Plus />
                {t('users.newUser')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isSuperAdmin && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>{t('users.readOnlyHint')}</span>
            </div>
          )}
          {/*
            筛选栏（公共件 components/filter-bar.tsx）：
            「一个用户都没有」时不渲染 —— 没有数据可筛，摆一排控件只会让人以为坏了。
            筛选生效时右侧自动出现「Showing X of Y」与「重置筛选」。
          */}
          {users.length > 0 && (
            <FilterBar
              className="mb-4"
              activeCount={filters.activeCount}
              onReset={filters.reset}
              shown={visibleUsers.length}
              total={users.length}
            >
              <FilterSearch
                id="user-filter-search"
                value={q}
                onChange={(value) => filters.set('q', value)}
                placeholder={t('users.searchPlaceholder')}
              />
              <FilterSelect
                id="user-filter-status"
                label={t('users.status')}
                value={statusFilter}
                onChange={(value) => filters.set('status', value as StatusFilter)}
                options={statusOptions}
              />
              <FilterSelect
                id="user-filter-team"
                label={t('users.filterTeam')}
                value={teamFilter}
                onChange={(value) => filters.set('team', value)}
                options={teamOptions}
              />
            </FilterBar>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('users.name')}</TableHead>
                <TableHead>{t('users.username')}</TableHead>
                <TableHead>{t('users.email')}</TableHead>
                <TableHead>{t('users.status')}</TableHead>
                <TableHead>{t('users.role')}</TableHead>
                <TableHead>{t('users.teams')}</TableHead>
                {isSuperAdmin && <TableHead className="w-40" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 && (
                <TableRow data-user-empty="none">
                  <TableCell
                    colSpan={columnCount}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {/*
                      两种空态含义不同，不能都写成「No users yet」：
                      非系统管理员看不到账号列表（真实系统里接口会回 403），
                      说「还没有用户」会让人以为库里真的没人。
                    */}
                    {isSuperAdmin ? t('users.empty') : t('users.noPermission')}
                  </TableCell>
                </TableRow>
              )}
              {/*
                第三种空态：**有账号，只是被筛掉了**。必须与「还没有用户」区分开，
                否则用户会以为数据没了 —— 所以这里给出「重置筛选」的直接出口。
              */}
              {users.length > 0 && visibleUsers.length === 0 && (
                <TableRow data-user-empty="filtered">
                  <TableCell colSpan={columnCount} className="py-8">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <SearchX className="size-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {t('users.noMatch')}
                      </span>
                      <Button variant="outline" size="sm" onClick={filters.reset} data-user-empty-reset="">
                        {t('filters.clearAll')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {visibleUsers.map((user) => {
                const userTeams = membershipsOf(user.id)
                return (
                  <TableRow key={user.id} data-user-row={user.username}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback>{user.initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name}</span>
                        {user.id === currentUserId && (
                          <Badge variant="outline">{t('users.you')}</Badge>
                        )}
                      </div>
                    </TableCell>
                    {/* 登录名：账号的主键口径，与展示名分开显示（等宽字体，便于对照日志） */}
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {user.username}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusBadgeVariant(user.status)}
                        title={
                          user.status === 'disabled'
                            ? t('users.frozenHint')
                            : undefined
                        }
                      >
                        {t(USER_STATUS_LABEL_KEYS[user.status])}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.isSystemAdmin ? (
                        <Badge variant="default" className="gap-1">
                          <ShieldCheck className="size-3" />
                          {t('users.roleSuperAdmin')}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {t('users.roleMember')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-md flex-wrap gap-1">
                        {userTeams.length === 0 && (
                          <span className="text-sm text-muted-foreground">
                            {t('users.noTeamsAssigned')}
                          </span>
                        )}
                        {userTeams.map((row) => (
                          <Badge
                            key={row.id}
                            variant="secondary"
                            className="max-w-full gap-1 font-normal"
                          >
                            <TeamLogo logo={row.team!.logo} className="size-3 shrink-0" />
                            <span className="truncate">
                              {t(TEAM_ROLE_LABEL_KEYS[row.role])} · {row.team!.name}
                            </span>
                            {row.isDefault && (
                              <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
                            )}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t('users.edit')}
                            title={t('users.edit')}
                            onClick={() => {
                              setEditingUser(user)
                              setFormOpen(true)
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          {/*
                            重置口令是**独立入口**，不塞进编辑表单：
                            两者语义不同 —— 改资料不需要旧口令、也不该顺带改口令；
                            而管理员重置口令是「这个人进不来了，给他换一把钥匙」。
                          */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t('users.resetPassword')}
                            title={t('users.resetPassword')}
                            onClick={() => setPasswordUser(user)}
                          >
                            <KeyRound className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={
                              user.status === 'disabled'
                                ? 'size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400'
                                : 'size-8 text-muted-foreground'
                            }
                            aria-label={
                              user.status === 'disabled'
                                ? t('users.unfreeze')
                                : t('users.freeze')
                            }
                            title={
                              user.status === 'disabled'
                                ? t('users.unfreeze')
                                : t('users.freeze')
                            }
                            onClick={() => handleToggleFreeze(user)}
                          >
                            {user.status === 'disabled' ? (
                              <CircleCheck className="size-4" />
                            ) : (
                              <Ban className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t('users.manageTeams')}
                            title={t('users.manageTeams')}
                            onClick={() => setTeamsUser(user)}
                          >
                            <Users className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label={t('users.delete')}
                            title={t('users.delete')}
                            onClick={() => setDeletingUser(user)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 新建 / 编辑用户 */}
      <UserFormDialog
        user={editingUser ?? undefined}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      {/* 重置口令（管理员操作，不需要旧口令） */}
      {passwordUser && (
        <ResetPasswordDialog
          user={passwordUser}
          open
          onOpenChange={(open) => {
            if (!open) setPasswordUser(null)
          }}
        />
      )}
      {/* 用户 ↔ 团队分配 */}
      {teamsUser && (
        <UserTeamsDialog
          user={teamsUser}
          canEdit={isSuperAdmin}
          open
          onOpenChange={(open) => {
            if (!open) setTeamsUser(null)
          }}
        />
      )}
      {/* 删除确认 */}
      <Dialog
        open={deletingUser !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingUser(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('users.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('users.deleteConfirm', {
                name: deletingUser?.name ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <ActionButtons
              cancelLabel={t('common.cancel')}
              onCancel={() => setDeletingUser(null)}
              confirmLabel={t('users.delete')}
              confirmVariant="destructive"
              onConfirm={handleDelete}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
