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

/** 新建 / 编辑全局用户对话框（用户位于 Team 之上：创建后可在 Teams 中分配成员关系） */
export function UserFormDialog({ user, open, onOpenChange }: UserFormDialogProps) {
  const { t } = useTranslation()
  const users = useOrgStore((s) => s.users)
  const addUser = useOrgStore((s) => s.addUser)
  const updateUser = useOrgStore((s) => s.updateUser)

  const editing = user !== undefined
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<UserStatus>('active')
  const [isSystemAdmin, setIsSystemAdmin] = useState(false)

  // 打开（或切换编辑目标）时把表单恢复为该用户的值。
  // 用渲染期派生（React 官方 "adjusting state when props change" 模式）替代 effect 内 setState：
  // 行为等价（每次打开都重置），但不触发级联渲染，也不再违反 react-hooks/set-state-in-effect。
  const [syncedFrom, setSyncedFrom] = useState<{ open: boolean; user?: OrgUser } | null>(null)
  if (syncedFrom === null || syncedFrom.open !== open || syncedFrom.user !== user) {
    setSyncedFrom({ open, user })
    if (open) {
      setName(user?.name ?? '')
      setEmail(user?.email ?? '')
      setStatus(user?.status ?? 'active')
      setIsSystemAdmin(user?.isSystemAdmin ?? false)
    }
  }

  const handleSubmit = () => {
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
    const duplicated = users.some(
      (existing) =>
        existing.id !== user?.id &&
        existing.email.toLowerCase() === trimmedEmail.toLowerCase(),
    )
    if (duplicated) {
      toast.error(t('users.emailTaken'))
      return
    }
    if (editing && user) {
      updateUser(user.id, {
        name: trimmedName,
        email: trimmedEmail,
        isSystemAdmin,
        status,
      })
      toast.success(t('users.updated'))
    } else {
      addUser({ name: trimmedName, email: trimmedEmail, isSystemAdmin, status })
      toast.success(t('users.created'))
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? t('users.editUser') : t('users.newUser')}
          </DialogTitle>
          <DialogDescription>{t('users.formHint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
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
          <DialogDescription>{t('users.teamsHint')}</DialogDescription>
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
                      title={t('users.removeTeam')}
                      onClick={() => {
                        removeMember(team.id, user.id)
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
