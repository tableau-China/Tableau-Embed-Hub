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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSidebar } from '@/components/ui/sidebar'
import { TeamLogo } from '@/components/org/team-logo'
import {
  TEAM_ROLES,
  TEAM_ROLE_LABEL_KEYS,
  useOrgStore,
  type OrgTeam,
  type TeamRole,
} from '@/stores/org-store'

interface TeamMembersDialogProps {
  team: OrgTeam
  /** 是否允许增删改成员（系统管理员入口由调用方决定） */
  canEdit: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 成员管理对话框：查看/添加/移除成员、调整团队岗位、设置默认团队 */
export function TeamMembersDialog({
  team,
  canEdit,
  open,
  onOpenChange,
}: TeamMembersDialogProps) {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  const users = useOrgStore((s) => s.users)
  const members = useOrgStore((s) => s.members)
  const addMember = useOrgStore((s) => s.addMember)
  const updateMember = useOrgStore((s) => s.updateMember)
  const removeMember = useOrgStore((s) => s.removeMember)

  const [newUserId, setNewUserId] = useState('')
  const [newRole, setNewRole] = useState<TeamRole>('viewer')

  const rows = useMemo(
    () => members.filter((m) => m.teamId === team.id),
    [members, team.id],
  )
  const candidates = useMemo(
    () => users.filter((u) => !rows.some((m) => m.userId === u.id)),
    [users, rows],
  )

  const handleAdd = () => {
    const userId = Number(newUserId)
    if (!Number.isInteger(userId)) {
      toast.error(t('teams.selectUserRequired'))
      return
    }
    addMember(team.id, userId, newRole)
    toast.success(t('teams.memberAdded'))
    setNewUserId('')
    setNewRole('viewer')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md border bg-background">
              <TeamLogo logo={team.logo} className="size-4" />
            </span>
            {t('teams.membersTitle', { team: team.name })}
          </DialogTitle>
          <DialogDescription>{t('teams.membersHint')}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
          {rows.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('teams.noMembers')}
            </p>
          )}
          {rows.map((row) => {
            const user = users.find((u) => u.id === row.userId)
            if (!user) return null
            const isDefault = row.isDefault
            return (
              <div
                key={row.id}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="text-xs">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {user.name}
                    {isDefault && (
                      <Star
                        className="ml-1.5 inline size-3.5 fill-amber-400 text-amber-400"
                        aria-label={t('teams.defaultTeam')}
                      />
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {user.email}
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
                        updateMember(team.id, row.userId, {
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
                        updateMember(team.id, row.userId, { isDefault: true })
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
                      aria-label={t('teams.removeMember')}
                      title={t('teams.removeMember')}
                      onClick={() => {
                        removeMember(team.id, row.userId)
                        toast.success(t('teams.memberRemoved'))
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
              {t('teams.addMemberHint')}
            </div>
            <ActionBar>
              <Select value={newUserId} onValueChange={setNewUserId}>
                <SelectTrigger className="h-8 w-full sm:w-64">
                  <SelectValue placeholder={t('teams.selectUser')} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} · {u.email}
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
