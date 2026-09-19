import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowUpRight, Building2, Languages, UserRound } from 'lucide-react'

import { ActionButtons } from '@/components/action-bar'
import { FormField, FormGrid, type FieldIssue } from '@/components/form-field'
import { PageContainer } from '@/components/page-container'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useFormTouch } from '@/hooks/use-form-touch'
import { TEAM_ROLE_LABEL_KEYS, useOrgStore, userMemberships } from '@/stores/org-store'

/**
 * 个人资料页 `/profile`（跨团队页面，无 slug）—— **左下角用户菜单的入口**（v0.7.0 起）。
 *
 * 与旧 `/settings` 的关系：旧页是「Profile + General」两个 Tab 的演示表单，输入框不接数据
 * （填了什么都不落库）。本页把它收敛成**真正的个人资料**：
 *   - 表单直接绑定当前登录用户（org-store），保存后侧边栏头像与缩写同步更新；
 *   - 校验规则与 `/users` 的用户弹窗一致（姓名必填 / 邮箱格式 / 邮箱不可与他人重复）；
 *   - 去掉「Workspace name」这类与个人无关的假字段 —— 组织级设置属于 `/config`、`/teams`、`/users`。
 *
 * 入口在左下角用户菜单而不是侧边栏：它是「我自己的账号」，不是组织管理面。
 * 但仍登记在 ROUTE_CATALOG（`navHidden: true`），因此守卫与权限矩阵照常生效。
 *
 * 版面复用通用件（与其他页面宽度一致）：`<PageContainer>` 铺满内容区、
 * 字段用 `<FormGrid>` + `<FormField>`（自带 label/aria/说明行）、校验时机交给 `useFormTouch`。
 */

/** 表单字段（决定 useFormTouch 的字段联合类型） */
type ProfileField = 'name' | 'email'

export function ProfilePage() {
  const { t } = useTranslation()
  const users = useOrgStore((s) => s.users)
  const members = useOrgStore((s) => s.members)
  const teams = useOrgStore((s) => s.teams)
  const currentUserId = useOrgStore((s) => s.currentUserId)
  const updateUser = useOrgStore((s) => s.updateUser)
  const form = useFormTouch<ProfileField>()

  const currentUser = users.find((u) => u.id === currentUserId) ?? null

  /**
   * 表单草稿：始终跟随当前身份（用户菜单可切换身份，切换后表单要对齐到新用户）。
   * 用渲染期派生（React 官方 "adjusting state when props change" 模式）替代 effect 内 setState：
   * 行为等价但不触发级联渲染 —— 与 components/org/user-dialogs.tsx 同一写法。
   */
  const [draft, setDraft] = useState<{ id: number; name: string; email: string } | null>(null)
  if (currentUser && (draft === null || draft.id !== currentUser.id)) {
    setDraft({ id: currentUser.id, name: currentUser.name, email: currentUser.email })
  }

  if (!currentUser || !draft) return null

  const name = draft.name.trim()
  const email = draft.email.trim()

  const nameIssue: FieldIssue | null =
    name === '' ? { level: 'error', message: t('users.nameRequired') } : null
  const emailIssue: FieldIssue | null =
    email === '' || !email.includes('@')
      ? { level: 'error', message: t('users.emailInvalid') }
      : users.some(
            (u) => u.id !== currentUser.id && u.email.toLowerCase() === email.toLowerCase(),
          )
        ? { level: 'error', message: t('users.emailTaken') }
        : null

  const dirty = name !== currentUser.name || email !== currentUser.email
  const myMemberships = userMemberships(members, currentUser.id)

  const handleSave = () => {
    form.submit()
    if (nameIssue !== null || emailIssue !== null) {
      toast.error(t('profile.fixErrors'))
      return
    }
    updateUser(currentUser.id, { name, email })
    form.reset()
    toast.success(t('profile.saved'))
  }

  const handleDiscard = () => {
    setDraft({ id: currentUser.id, name: currentUser.name, email: currentUser.email })
    form.reset()
  }

  return (
    <PageContainer>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-4" />
            {t('profile.title')}
          </CardTitle>
          <CardDescription>{t('profile.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Avatar className="size-12 rounded-lg">
              <AvatarFallback className="rounded-lg text-base">
                {currentUser.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{currentUser.name}</span>
              <span className="text-muted-foreground text-xs">{t('profile.avatarHint')}</span>
            </div>
          </div>

          <Separator />

          <FormGrid columns={2}>
            <FormField
              id="profile-name"
              label={t('profile.displayName')}
              issue={form.shows('name') ? nameIssue : null}
            >
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                onBlur={() => form.touch('name')}
                placeholder={t('profile.displayNamePlaceholder')}
                autoComplete="name"
              />
            </FormField>

            <FormField
              id="profile-email"
              label={t('profile.email')}
              hint={t('profile.emailHint')}
              issue={form.shows('email') ? emailIssue : null}
            >
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                onBlur={() => form.touch('email')}
                placeholder={t('profile.emailPlaceholder')}
                autoComplete="email"
              />
            </FormField>
          </FormGrid>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 未保存改动只在真的有改动时提示，避免页面一进来就挂着一条无意义的黄字 */}
            <span className="text-muted-foreground text-xs">
              {dirty ? t('profile.unsaved') : t('profile.noChanges')}
            </span>
            <ActionButtons
              cancelLabel={t('common.discard')}
              onCancel={handleDiscard}
              cancelDisabled={!dirty}
              confirmLabel={t('common.save')}
              onConfirm={handleSave}
              // 同 /config/smtp：不因校验错误置灰（否则点不动也看不到哪里错了），
              // 只在「没有改动」时禁用；点击后统一揭示所有字段错误。
              confirmDisabled={!dirty}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.accountTitle')}</CardTitle>
          <CardDescription>{t('profile.accountSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">{t('profile.role')}</span>
            <Badge variant={currentUser.isSystemAdmin ? 'default' : 'secondary'}>
              {currentUser.isSystemAdmin ? t('users.roleSuperAdmin') : t('users.roleMember')}
            </Badge>
            <span className="text-muted-foreground ml-2 text-sm">{t('profile.language')}</span>
            <span className="flex items-center gap-1.5 text-sm">
              <Languages className="text-muted-foreground size-3.5" />
              {t('profile.languageHint')}
            </span>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Building2 className="size-3.5" />
              {t('profile.teams')}
            </span>
            {myMemberships.length === 0 ? (
              <span className="text-muted-foreground text-sm">{t('users.noTeamsAssigned')}</span>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {myMemberships.map((m) => {
                  const team = teams.find((x) => x.id === m.teamId)
                  if (!team) return null
                  return (
                    <li key={m.id}>
                      <Badge variant="outline" className="gap-1.5">
                        {team.name}
                        <span className="text-muted-foreground">
                          · {t(TEAM_ROLE_LABEL_KEYS[m.role])}
                        </span>
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
            <span className="text-muted-foreground text-xs">{t('profile.teamsHint')}</span>
          </div>

          {/* 演示环境只有「系统管理员 → /users」这一条改别人资料的路径，点到为止 */}
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link to="/users">
              {t('profile.manageUsers')}
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
