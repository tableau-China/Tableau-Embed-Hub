import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import { Textarea } from '@/components/ui/textarea'
import { TEAM_LOGO_OPTIONS } from '@/components/org/team-logo'
import { slugify, useOrgStore, type OrgTeam } from '@/stores/org-store'
import { cn } from '@/lib/utils'

interface TeamDialogProps {
  /** 传入 team = 编辑模式；不传 = 新建 */
  team?: OrgTeam
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 新建 / 编辑团队对话框（仅系统管理员可操作，调用方控制入口可见性）。
 * 字段：名称 / 描述 / Logo 图标；slug 由名称自动生成（对齐 pg-explorer Team.slug 语义）。
 */
export function TeamDialog({ team, open, onOpenChange }: TeamDialogProps) {
  const { t } = useTranslation()
  const teams = useOrgStore((s) => s.teams)
  const createTeam = useOrgStore((s) => s.createTeam)
  const updateTeam = useOrgStore((s) => s.updateTeam)

  const editing = team !== undefined
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState('building2')

  useEffect(() => {
    if (!open) return
    setName(team?.name ?? '')
    setDescription(team?.description ?? '')
    setLogo(team?.logo ?? 'building2')
  }, [open, team])

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
      toast.success(t('teams.updated'))
    } else {
      createTeam({ name: trimmed, description, logo })
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
            {name.trim() !== '' && (
              <p className="text-xs text-muted-foreground">
                {t('teams.slugHint', { slug: slugify(name) })}
              </p>
            )}
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
        </div>
        <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit}>
            {editing ? t('common.save') : t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
