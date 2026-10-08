import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Building2,
  Info,
  PauseCircle,
  Pencil,
  Play,
  Plus,
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
  isDefaultTeam,
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

  // 表格按创建次序（id 升序）展示
  const orderedTeams = sortTeamsById(teams)

  const handleDelete = () => {
    if (!deletingTeam) return
    const name = deletingTeam.name
    // 两类拒绝原因分开提示：默认团队不可删除 / 有人只属于这个团队（store 同样兜底）
    if (!deleteTeam(deletingTeam.id)) {
      toast.error(
        isDefaultTeam(teams, deletingTeam.id)
          ? t('teams.deleteDefaultBlocked')
          : t('teams.deleteBlocked'),
      )
      return
    }
    toast.success(t('teams.deleted', { name }))
    setDeletingTeam(null)
  }

  /** 冻结 / 解冻团队：冻结后除系统管理员外都进不来（成员自动回落到自己的其它团队） */
  const handleToggleSuspend = (team: OrgTeam) => {
    const next = !team.suspended
    // store 拒绝时（默认团队不可冻结）给出明确原因，不静默失败
    if (!setTeamSuspended(team.id, next)) {
      toast.error(t('teams.suspendDefaultBlocked'))
      return
    }
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
                const isSystemDefaultTeam = isDefaultTeam(teams, team.id)
                // 默认团队不可冻结；老数据里已被冻结的默认团队仍允许解冻
                const suspendLocked = isSystemDefaultTeam && !team.suspended
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
                          {isSystemDefaultTeam && (
                            <Badge
                              variant="outline"
                              className="gap-1"
                              title={t('teams.defaultTeamSystemHint')}
                            >
                              <Building2 className="size-3" />
                              {t('teams.defaultLabel')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    {/* 必须覆盖 TableCell 默认的 whitespace-nowrap：描述不换行会把表格撑出容器，
                        在 1152px 视口下实测溢出 35px（出现横向滚动条）。break-words 兜住超长单词 */}
                    <TableCell className="min-w-56 whitespace-normal">
                      <span className="block break-words text-sm text-muted-foreground">
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
                              suspendLocked
                                ? t('teams.suspendDefaultBlocked')
                                : team.suspended
                                  ? t('teams.resume')
                                  : t('teams.suspend')
                            }
                            title={
                              suspendLocked
                                ? t('teams.suspendDefaultBlocked')
                                : team.suspended
                                  ? t('teams.resume')
                                  : t('teams.suspend')
                            }
                            disabled={suspendLocked}
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
                            title={
                              isDefaultTeam(teams, team.id)
                                ? t('teams.deleteDefaultBlocked')
                                : t('teams.deleteTeam')
                            }
                            disabled={isDefaultTeam(teams, team.id)}
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
            {deletingTeam && isDefaultTeam(teams, deletingTeam.id) && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>{t('teams.deleteDefaultBlocked')}</span>
              </div>
            )}
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
