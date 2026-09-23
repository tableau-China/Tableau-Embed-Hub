import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Info,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  Star,
  Trash2,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { TeamDialog } from '@/components/org/team-dialog'
import { ActionButtons } from '@/components/action-bar'
import { TeamLogo } from '@/components/org/team-logo'
import { TeamMembersDialog } from '@/components/org/team-members-dialog'
import {
  orphanedUsersOfTeam,
  sortTeamsById,
  useOrgStore,
  type OrgTeam,
} from '@/stores/org-store'

export const Route = createFileRoute('/teams')({
  component: TeamsPage,
})

/**
 * 团队管理页（对齐 pg-explorer /admin/teams，无 department 管理）：
 * - 系统管理员：新建 / 编辑 / 删除团队，并为团队增删成员、调整岗位
 * - 其它用户：只读查看全部团队
 * 顶部左上角 TeamSwitcher 负责「切换当前团队」。
 */
function TeamsPage() {
  const { t } = useTranslation()
  const teams = useOrgStore((s) => s.teams)
  const members = useOrgStore((s) => s.members)
  const activeTeamId = useOrgStore((s) => s.activeTeamId)
  const deleteTeam = useOrgStore((s) => s.deleteTeam)
  const setTeamSuspended = useOrgStore((s) => s.setTeamSuspended)
  const currentUser = useOrgStore((s) =>
    s.users.find((u) => u.id === s.currentUserId),
  )
  const isSuperAdmin = currentUser?.isSystemAdmin === true

  const [formOpen, setFormOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<OrgTeam | null>(null)
  const [membersTeam, setMembersTeam] = useState<OrgTeam | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<OrgTeam | null>(null)

  const statsOf = (teamId: number) => {
    const rows = members.filter((m) => m.teamId === teamId)
    return {
      count: rows.length,
      admins: rows.filter((m) => m.role === 'team-admin').length,
    }
  }

  // 当前用户的默认团队（成员关系 isDefault）；表格按创建次序（id 升序）展示
  const orderedTeams = sortTeamsById(teams)
  const defaultTeamId = members.find(
    (m) => m.userId === currentUser?.id && m.isDefault,
  )?.teamId

  const handleDelete = () => {
    if (!deletingTeam) return
    const name = deletingTeam.name
    // 归属不变量：有人只属于这个团队时不允许删除（store 同样兜底），提示先安置这些人
    if (!deleteTeam(deletingTeam.id)) {
      toast.error(t('teams.deleteBlocked'))
      return
    }
    toast.success(t('teams.deleted', { name }))
    setDeletingTeam(null)
  }

  /** 冻结 / 解冻团队：冻结后除系统管理员外都进不来（成员自动回落到自己的其它团队） */
  const handleToggleSuspend = (team: OrgTeam) => {
    const next = !team.suspended
    setTeamSuspended(team.id, next)
    toast.success(
      next
        ? t('teams.suspendedToast', { name: team.name })
        : t('teams.resumedToast', { name: team.name }),
    )
  }

  /** 删除前提示里列出受影响人数（只属于该团队的成员） */
  const orphanCountOf = (teamId: number) =>
    orphanedUsersOfTeam(members, teamId).length

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle>{t('teams.title')}</CardTitle>
              <CardDescription>{t('teams.subtitle')}</CardDescription>
            </div>
            {isSuperAdmin && (
              <Button
                className="shrink-0"
                onClick={() => {
                  setEditingTeam(null)
                  setFormOpen(true)
                }}
              >
                <Plus />
                {t('teams.newTeam')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isSuperAdmin && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>{t('teams.readOnlyHint')}</span>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('teams.team')}</TableHead>
                <TableHead>{t('teams.description')}</TableHead>
                <TableHead>{t('teams.members')}</TableHead>
                {isSuperAdmin && <TableHead className="w-28" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {t('teams.empty')}
                  </TableCell>
                </TableRow>
              )}
              {orderedTeams.map((team) => {
                const stats = statsOf(team.id)
                const isDefault = team.id === defaultTeamId
                return (
                  <TableRow key={team.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
                          <TeamLogo logo={team.logo} className="size-4" />
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{team.name}</span>
                          {team.suspended && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-rose-400/50 bg-rose-400/10 text-rose-700 dark:text-rose-300"
                              title={t('teams.suspendHint')}
                            >
                              <PauseCircle className="size-3" />
                              {t('teams.suspended')}
                            </Badge>
                          )}
                          {isDefault && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-400/50 bg-amber-400/10 text-amber-700 dark:text-amber-400"
                              title={t('teams.defaultTeam')}
                            >
                              <Star className="size-3 fill-amber-400 text-amber-400" />
                              {t('teams.defaultLabel')}
                            </Badge>
                          )}
                          {team.id === activeTeamId && (
                            <Badge variant="secondary">
                              {t('teams.currentLabel')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-2 max-w-md text-sm text-muted-foreground">
                        {team.description || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="size-4" />
                        {t('teams.members', { count: stats.count })}
                        {stats.admins > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            {t('teams.admins', { count: stats.admins })}
                          </>
                        )}
                      </div>
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t('teams.editTeam')}
                            title={t('teams.editTeam')}
                            onClick={() => {
                              setEditingTeam(team)
                              setFormOpen(true)
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={
                              team.suspended
                                ? 'size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400'
                                : 'size-8 text-muted-foreground'
                            }
                            aria-label={
                              team.suspended ? t('teams.resume') : t('teams.suspend')
                            }
                            title={
                              team.suspended ? t('teams.resume') : t('teams.suspend')
                            }
                            onClick={() => handleToggleSuspend(team)}
                          >
                            {team.suspended ? (
                              <Play className="size-4" />
                            ) : (
                              <PauseCircle className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t('teams.manageMembers')}
                            title={t('teams.manageMembers')}
                            onClick={() => setMembersTeam(team)}
                          >
                            <Users className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label={t('teams.deleteTeam')}
                            title={t('teams.deleteTeam')}
                            onClick={() => setDeletingTeam(team)}
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

      {/* 新建 / 编辑团队 */}
      <TeamDialog
        key={editingTeam?.id ?? 'new'}
        team={editingTeam ?? undefined}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      {/* 团队成员管理 */}
      {membersTeam && (
        <TeamMembersDialog
          team={membersTeam}
          canEdit={isSuperAdmin}
          open
          onOpenChange={(open) => {
            if (!open) setMembersTeam(null)
          }}
        />
      )}
      {/* 删除确认 */}
      <Dialog
        open={deletingTeam !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingTeam(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('teams.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('teams.deleteConfirm', {
                name: deletingTeam?.name ?? '',
              })}
            </DialogDescription>
            {deletingTeam && orphanCountOf(deletingTeam.id) > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>
                  {t('teams.deleteBlockedHint', {
                    count: orphanCountOf(deletingTeam.id),
                  })}
                </span>
              </div>
            )}
          </DialogHeader>
          <DialogFooter>
            <ActionButtons
              cancelLabel={t('common.cancel')}
              onCancel={() => setDeletingTeam(null)}
              confirmLabel={t('teams.deleteTeam')}
              confirmVariant="destructive"
              onConfirm={handleDelete}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
