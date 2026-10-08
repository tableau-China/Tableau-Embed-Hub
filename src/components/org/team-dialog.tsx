import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ActionButtons } from '@/components/action-bar'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { TEAM_LOGO_OPTIONS } from '@/components/org/team-logo'
import {
  isDefaultTeam,
  sanitizeTeamSlug,
  teamSlugIssue,
  useOrgStore,
  type OrgTeam,
} from '@/stores/org-store'
import { cn } from '@/lib/utils'

interface TeamDialogProps {
  /** 传入 team = 编辑模式；不传 = 新建 */
  team?: OrgTeam
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 新建 / 编辑团队对话框（仅系统管理员可操作，调用方控制入口可见性）。
 * 字段：名称 / **slug** / 描述 / Logo 图标。
 *
 * `slug` 由用户在**新建时手工输入**，仅允许英文、数字、下划线（会实时过滤非法字符），
 * 落库后**不可修改**（它是团队的稳定标识，见 OrgTeam.slug）。因此不随 `name` 变化 ——
 * 名称可以是中文，slug 必须保持 ASCII，避免出现在 URL 里被转义成乱码。
 */
export function TeamDialog({ team, open, onOpenChange }: TeamDialogProps) {
  const { t } = useTranslation()
  const teams = useOrgStore((s) => s.teams)
  const createTeam = useOrgStore((s) => s.createTeam)
  const updateTeam = useOrgStore((s) => s.updateTeam)
  const setTeamSuspended = useOrgStore((s) => s.setTeamSuspended)

  const editing = team !== undefined
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState('building2')
  const [suspended, setSuspended] = useState(false)

  // 打开（或切换编辑目标）时把表单恢复为该团队的值。
  // 用渲染期派生（React 官方 "adjusting state when props change" 模式）替代 effect 内 setState：
  // 行为等价（每次打开都重置），但不触发级联渲染，也不再违反 react-hooks/set-state-in-effect。
  const [syncedFrom, setSyncedFrom] = useState<{ open: boolean; team?: OrgTeam } | null>(null)
  if (syncedFrom === null || syncedFrom.open !== open || syncedFrom.team !== team) {
    setSyncedFrom({ open, team })
    if (open) {
      setName(team?.name ?? '')
      setSlug(team?.slug ?? '')
      setDescription(team?.description ?? '')
      setLogo(team?.logo ?? 'building2')
      setSuspended(team?.suspended ?? false)
    }
  }

  /** 新建时的 slug 校验结果（编辑态 slug 不可改，无需校验） */
  const slugIssue = editing ? null : teamSlugIssue(slug, teams)
  /** 默认团队不可冻结：开关置灰并说明原因（store 同样兜底；已冻结的老数据仍可解冻） */
  const suspendLocked = editing && team ? isDefaultTeam(teams, team.id) && !suspended : false
  /** 仅在用户已输入（非空）且与既有团队重复时标红，避免一打开弹窗就报错 */
  const slugTaken = slug !== '' && slugIssue === 'taken'

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(t('teams.nameRequired'))
      return
    }
    const duplicated = teams.some(
      (existing) =>
        existing.id !== team?.id &&
        existing.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicated) {
      toast.error(t('teams.nameTaken'))
      return
    }
    if (editing && team) {
      updateTeam(team.id, { name: trimmed, description, logo })
      // 冻结状态变化走 setTeamSuspended：它会顺带重算 activeTeamId，
      // 避免有人「停在一个刚被冻结、自己又进不去的团队」
      if (suspended !== team.suspended) setTeamSuspended(team.id, suspended)
      toast.success(t('teams.updated'))
    } else {
      if (slugIssue !== null) {
        toast.error(
          slugIssue === 'empty'
            ? t('teams.slugRequired')
            : slugIssue === 'charset'
              ? t('teams.slugInvalid')
              : t('teams.slugTaken'),
        )
        return
      }
      createTeam({ name: trimmed, slug, description, logo })
      toast.success(t('teams.created'))
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? t('teams.editTeam') : t('teams.newTeam')}
          </DialogTitle>
          <DialogDescription>{t('teams.dialogHint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="team-name">{t('teams.name')}</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('teams.namePlaceholder')}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="team-slug">{t('teams.slugLabel')}</Label>
            <Input
              id="team-slug"
              value={slug}
              // 实时过滤：中文/空格/连字符等非法字符直接打不进去（不会等到提交才报错）
              onChange={(e) => setSlug(sanitizeTeamSlug(e.target.value))}
              placeholder={t('teams.slugPlaceholder')}
              disabled={editing}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              aria-invalid={slugTaken}
              aria-describedby="team-slug-hint"
            />
            <p
              id="team-slug-hint"
              className={cn(
                'text-xs',
                slugTaken ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {editing
                ? t('teams.slugLocked')
                : slugTaken
                  ? t('teams.slugTaken')
                  : t('teams.slugHint')}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="team-description">{t('teams.description')}</Label>
            <Textarea
              id="team-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('teams.descriptionPlaceholder')}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t('teams.logo')}</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {TEAM_LOGO_OPTIONS.map(({ key, Icon }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={logo === key}
                  title={key}
                  onClick={() => setLogo(key)}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    logo === key &&
                      'border-primary text-primary ring-1 ring-primary',
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>
          {editing && (
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{t('teams.suspendField')}</div>
                <div className="text-xs text-muted-foreground">
                  {suspendLocked
                    ? t('teams.suspendDefaultBlockedHint')
                    : t('teams.suspendFieldHint')}
                </div>
              </div>
              <Switch
                checked={suspended}
                onCheckedChange={setSuspended}
                disabled={suspendLocked}
              />
            </div>
          )}
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
