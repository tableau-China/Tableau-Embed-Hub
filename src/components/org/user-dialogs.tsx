import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Star, Trash2 } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ActionBar, ActionButtons } from '@/components/action-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useSidebar } from '@/components/ui/sidebar'
import { TeamLogo } from '@/components/org/team-logo'
import {
  TEAM_ROLES,
  TEAM_ROLE_LABEL_KEYS,
  USER_STATUSES,
  USER_STATUS_LABEL_KEYS,
  useOrgStore,
  usernameIssue,
  type OrgUser,
  type TeamRole,
  type UserStatus,
} from '@/stores/org-store'

/* ============================== User form ============================== */

interface UserFormDialogProps {
  /** 传入 user = 编辑模式；不传 = 新建 */
  user?: OrgUser
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 新建 / 编辑全局用户对话框。
 *
 * 新建与编辑的字段刻意不同：
 *   - 新建：**登录名** + 姓名 + 邮箱 + **初始口令** + 状态 + 是否系统管理员。
 *     登录名与口令在建号时是必须的 —— 账号本来就是靠它们登录的，
 *     建一个没有登录名、没有口令的账号没有意义；
 *   - 编辑：只有姓名 / 邮箱 / 状态 / 是否系统管理员。**登录名与口令都不在这里改**：
 *     登录名是账号的主键口径（登录、日志、按录入人隔离的业务归属都认它，改一次全漂），
 *     口令则走独立的「重置口令」入口（管理员重置不需要旧口令）。
 *
 * 演示态的口令**不会被保存**（见 `stores/org-store.ts` 的 `passwordUpdatedAt` 说明）：
 * 这里收集它是为了让表单形状与真实后端一致 —— 接后端时把 `addUser` 换成
 * `POST /api/users`（入参带上 `password`）即可，本文件无需改动。
 */
export function UserFormDialog({ user, open, onOpenChange }: UserFormDialogProps) {
  const { t } = useTranslation()
  const users = useOrgStore((s) => s.users)
  const addUser = useOrgStore((s) => s.addUser)
  const activeTeamId = useOrgStore((s) => s.activeTeamId)
  const activeTeam = useOrgStore((s) =>
    s.teams.find((team) => team.id === s.activeTeamId),
  )
  const currentUserId = useOrgStore((s) => s.currentUserId)
  const updateUser = useOrgStore((s) => s.updateUser)

  const editing = user !== undefined
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<UserStatus>('active')
  const [isSystemAdmin, setIsSystemAdmin] = useState(false)

  // 打开（或切换编辑目标）时把表单恢复为该用户的值。
  // 用渲染期派生（React 官方 "adjusting state when props change" 模式）替代 effect 内 setState：
  // 行为等价（每次打开都重置），但不触发级联渲染，也不再违反 react-hooks/set-state-in-effect。
  const [syncedFrom, setSyncedFrom] = useState<{ open: boolean; user?: OrgUser } | null>(null)
  if (syncedFrom === null || syncedFrom.open !== open || syncedFrom.user !== user) {
    setSyncedFrom({ open, user })
    if (open) {
      setUsername(user?.username ?? '')
      setName(user?.name ?? '')
      setEmail(user?.email ?? '')
      setPassword('')
      setStatus(user?.status ?? 'active')
      setIsSystemAdmin(user?.isSystemAdmin ?? false)
    }
  }

  /** 新建时的登录名校验结果（编辑态登录名不可改，无需校验） */
  const usernameProblem = editing ? null : usernameIssue(username, users)

  const handleSubmit = () => {
    const trimmedUsername = username.trim()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    if (!trimmedName) {
      toast.error(t('users.nameRequired'))
      return
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      toast.error(t('users.emailInvalid'))
      return
    }
    if (editing && user) {
      // 表单里的状态下拉与列表里的冻结按钮走同一条规则：不能把自己或最后一名可用管理员冻结
      // （否则会当场失去管理入口 —— 演示态没有后台可以救回来）
      if (status === 'disabled' && user.status === 'active') {
        if (user.id === currentUserId) {
          toast.error(t('users.cannotFreezeSelf'))
          return
        }
        if (user.isSystemAdmin) {
          const otherActiveAdmins = users.filter(
            (u) => u.isSystemAdmin && u.status === 'active' && u.id !== user.id,
          )
          if (otherActiveAdmins.length === 0) {
            toast.error(t('users.cannotFreezeLastAdmin'))
            return
          }
        }
      }
      updateUser(user.id, {
        name: trimmedName,
        email: trimmedEmail,
        isSystemAdmin,
        status,
      })
      toast.success(t('users.updated'))
      onOpenChange(false)
      return
    }
    // 下面三道都只是前端先拦一道、省一次往返；真实系统里**服务端必须再判一次** ——
    // 登录名有 UNIQUE 约束、口令有长度下限，前端算出来的东西不能当校验依据。
    if (usernameProblem === 'empty') {
      toast.error(t('users.usernameRequired'))
      return
    }
    if (usernameProblem === 'charset') {
      toast.error(t('users.usernameInvalid'))
      return
    }
    if (usernameProblem === 'taken') {
      toast.error(t('users.usernameTaken'))
      return
    }
    if (password.length < 8) {
      toast.error(t('users.passwordTooShort'))
      return
    }
    try {
      // 归属不变量：新用户默认加入**当前团队**（岗位 viewer）。
      // 一个团队都没有时 store 返回 null —— 这时不能创建用户，否则会多出一个无家可归的账号。
      const created = addUser({
        username: trimmedUsername,
        name: trimmedName,
        email: trimmedEmail,
        isSystemAdmin,
        status,
        teamId: activeTeamId ?? undefined,
      })
      if (!created) {
        toast.error(t('users.noTeamAvailable'))
        return
      }
    } catch (error) {
      // store 里也做了唯一性兜底（大小写不敏感）。走到这里说明上面那道漏了 ——
      // 原样把原因抛出来，不要静默吞掉（吞掉就会表现成「点了创建，什么都没发生」）。
      toast.error(error instanceof Error ? error.message : t('users.usernameTaken'))
      return
    }
    toast.success(t('users.created'))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? t('users.editUser') : t('users.newUser')}
          </DialogTitle>
          <DialogDescription>
            {editing ? (
              t('users.editPasswordHint')
            ) : (
              <>
                {t('users.formHint')}
                {activeTeam && (
                  <span className="mt-1 block">
                    {t('users.currentTeamHint', { team: activeTeam.name })}
                  </span>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="user-username">{t('users.username')}</Label>
            <Input
              id="user-username"
              value={username}
              disabled={editing}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('users.usernamePlaceholder')}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-name">{t('users.name')}</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('users.namePlaceholder')}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-email">{t('users.email')}</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('users.emailPlaceholder')}
            />
          </div>
          {!editing && (
            <div className="grid gap-2">
              <Label htmlFor="user-password">{t('users.password')}</Label>
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('users.passwordPlaceholder')}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">{t('users.passwordHint')}</p>
            </div>
          )}
          <div className="grid gap-2">
            <Label>{t('users.statusLabel')}</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as UserStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(USER_STATUS_LABEL_KEYS[s])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">{t('users.roleSuperAdmin')}</div>
              <div className="text-xs text-muted-foreground">
                {t('users.superAdminHint')}
              </div>
            </div>
            <Switch
              checked={isSystemAdmin}
              onCheckedChange={setIsSystemAdmin}
            />
          </div>
        </div>
        <DialogFooter>
          <ActionButtons
            cancelLabel={t('common.cancel')}
            onCancel={() => onOpenChange(false)}
            confirmLabel={editing ? t('common.save') : t('common.create')}
            onConfirm={handleSubmit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ============================== User ↔ teams ============================== */

interface UserTeamsDialogProps {
  user: OrgUser
  /** 是否允许调整（仅系统管理员；调用方控制） */
  canEdit: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 用户团队分配对话框：Users 位于 Teams 之上，一个用户可属于多个团队并各自持有岗位 */
export function UserTeamsDialog({
  user,
  canEdit,
  open,
  onOpenChange,
}: UserTeamsDialogProps) {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  const teams = useOrgStore((s) => s.teams)
  const members = useOrgStore((s) => s.members)
  const addMember = useOrgStore((s) => s.addMember)
  const updateMember = useOrgStore((s) => s.updateMember)
  const removeMember = useOrgStore((s) => s.removeMember)

  const [newTeamId, setNewTeamId] = useState('')
  const [newRole, setNewRole] = useState<TeamRole>('viewer')

  const rows = useMemo(
    () => members.filter((m) => m.userId === user.id),
    [members, user.id],
  )
  const candidates = useMemo(
    () => teams.filter((team) => !rows.some((m) => m.teamId === team.id)),
    [teams, rows],
  )

  const handleAdd = () => {
    const teamId = Number(newTeamId)
    if (!Number.isInteger(teamId)) {
      toast.error(t('teams.selectTeamRequired'))
      return
    }
    addMember(teamId, user.id, newRole)
    toast.success(t('teams.memberAdded'))
    setNewTeamId('')
    setNewRole('viewer')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Avatar className="size-6 rounded-md">
              <AvatarFallback className="text-[10px]">{user.initials}</AvatarFallback>
            </Avatar>
            {t('users.teamsTitle', { user: user.name })}
          </DialogTitle>
          <DialogDescription>
            {t('users.teamsHint')}{' '}
            <span className="text-muted-foreground">
              {t('users.mustBelongToTeam')}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
          {rows.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('users.noTeamsAssigned')}
            </p>
          )}
          {rows.map((row) => {
            const team = teams.find((x) => x.id === row.teamId)
            if (!team) return null
            const isDefault = row.isDefault
            return (
              <div
                key={row.id}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                  <TeamLogo logo={team.logo} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {team.name}
                    {isDefault && (
                      <Star
                        className="ml-1.5 inline size-3.5 fill-amber-400 text-amber-400"
                        aria-label={t('teams.defaultTeam')}
                      />
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {team.description || ' '}
                  </div>
                </div>
                <Badge
                  variant={
                    row.role === 'team-admin'
                      ? 'default'
                      : row.role === 'analyst'
                        ? 'secondary'
                        : 'outline'
                  }
                  className="hidden shrink-0 sm:inline-flex"
                >
                  {t(TEAM_ROLE_LABEL_KEYS[row.role])}
                </Badge>
                {canEdit ? (
                  <>
                    <Select
                      value={row.role}
                      onValueChange={(role) => {
                        updateMember(team.id, user.id, {
                          role: role as TeamRole,
                        })
                        toast.success(t('teams.memberUpdated'))
                      }}
                    >
                      <SelectTrigger
                        aria-label={t('teams.memberRole')}
                        className="h-8 w-28"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent side={isMobile ? 'bottom' : 'right'}>
                        {TEAM_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {t(TEAM_ROLE_LABEL_KEYS[role])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground"
                      aria-label={
                        isDefault
                          ? t('teams.defaultTeam')
                          : t('teams.setDefaultTeam')
                      }
                      title={
                        isDefault
                          ? t('teams.defaultTeam')
                          : t('teams.setDefaultTeam')
                      }
                      disabled={isDefault}
                      onClick={() => {
                        updateMember(team.id, user.id, { isDefault: true })
                        toast.success(t('teams.memberUpdated'))
                      }}
                    >
                      <Star
                        className={
                          isDefault
                            ? 'size-4 fill-amber-400 text-amber-400'
                            : 'size-4'
                        }
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={t('users.removeTeam')}
                      title={
                        // 归属不变量：这是该用户唯一的团队 —— 移除会让他没有归属，只能先加别的团队
                        rows.length <= 1
                          ? t('users.lastTeamBlocked')
                          : t('users.removeTeam')
                      }
                      disabled={rows.length <= 1}
                      onClick={() => {
                        if (!removeMember(team.id, user.id)) {
                          toast.error(t('users.lastTeamBlocked'))
                          return
                        }
                        toast.success(t('users.removedFromTeam', { team: team.name }))
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                ) : (
                  <Badge
                    variant={
                      row.role === 'team-admin'
                        ? 'default'
                        : row.role === 'analyst'
                          ? 'secondary'
                          : 'outline'
                    }
                    className="shrink-0 sm:hidden"
                  >
                    {t(TEAM_ROLE_LABEL_KEYS[row.role])}
                  </Badge>
                )}
              </div>
            )
          })}
        </div>

        {canEdit && candidates.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <div className="text-xs font-medium text-muted-foreground">
              {t('users.addMembershipHint')}
            </div>
            <ActionBar>
              <Select value={newTeamId} onValueChange={setNewTeamId}>
                <SelectTrigger className="h-8 w-full sm:w-64">
                  <SelectValue placeholder={t('teams.selectTeam')} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((team) => (
                    <SelectItem key={team.id} value={String(team.id)}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={newRole}
                onValueChange={(role) => setNewRole(role as TeamRole)}
              >
                <SelectTrigger
                  aria-label={t('teams.memberRole')}
                  className="h-8 w-28"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(TEAM_ROLE_LABEL_KEYS[role])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleAdd}>
                {t('common.add')}
              </Button>
            </ActionBar>
          </div>
        )}

        <DialogFooter>
          <ActionButtons
            confirmLabel={t('common.close')}
            confirmVariant="outline"
            onConfirm={() => onOpenChange(false)}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
