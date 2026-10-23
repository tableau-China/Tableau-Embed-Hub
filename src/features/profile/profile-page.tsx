import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import {
  Building2,
  KeyRound,
  LogIn,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

import { ActionButtons } from '@/components/action-bar'
import { FormField, type FieldIssue } from '@/components/form-field'
import { PageContainer } from '@/components/page-container'
import { InlinePasswordForm, UsernameForm } from '@/components/org/account-dialogs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useFormTouch } from '@/hooks/use-form-touch'
import { cn } from '@/lib/utils'
import {
  TEAM_ROLE_LABEL_KEYS,
  USER_STATUS_LABEL_KEYS,
  useOrgStore,
  userMemberships,
} from '@/stores/org-store'

/**
 * 个人资料页 `/profile`（跨团队页面，无 slug）—— **左下角用户菜单的唯一账号入口**。
 *
 * ## 版面（v0.14.8 收尾）
 *
 *  1. **身份横幅**：头像 + 显示名称 + 角色/状态徽标。只留「我是谁」这一句，
 *     username / email 不再重复 —— 它们在下面的表单里各占一行，重复一遍只会让
 *     读者在两处之间来回确认「哪个是权威值」。
 *  2. **Your details**：一张卡，四行表单（统一 `layout="field"` 节奏）——
 *     username（只读 + 「更改登录名」按钮）→ display name（可改）→ email（可改）→
 *     password（输入框 + 「Change password」按钮）。保存条作用于 display name / email。
 *  3. **团队归属**：只读徽标列表。
 *
 * 字段校验与 `/users`、`org-store` 同一套规则（姓名必填 / 邮箱格式 / 邮箱唯一）；
 * 登录名与口令的表单复用 `account-dialogs.tsx` 的 `UsernameForm` / `InlinePasswordForm`。
 */

/** 表单字段（决定 useFormTouch 的字段联合类型） */
type ProfileField = 'name' | 'email'

/** Your details 里可折叠的两项：登录名 / 口令（display name 与 email 是常驻输入框） */
type EditableRow = 'username'

export function ProfilePage() {
  const { t } = useTranslation()
  const users = useOrgStore((s) => s.users)
  const members = useOrgStore((s) => s.members)
  const teams = useOrgStore((s) => s.teams)
  const currentUserId = useOrgStore((s) => s.currentUserId)
  const updateUser = useOrgStore((s) => s.updateUser)
  const form = useFormTouch<ProfileField>()

  /** 当前展开的是哪一行：null = 全部收起（默认） */
  const [editing, setEditing] = useState<EditableRow | null>(null)

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
  const roleLabel = currentUser.isSystemAdmin
    ? t('users.roleSuperAdmin')
    : t('users.roleMember')

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

  /** 改登录名表单的底部工具条：取消 = 收起（不落库），保存 = 交给表单自己的 submit */
  const renderUsernameFooter = (submit: () => void) => (
    <ActionButtons
      cancelLabel={t('common.cancel')}
      onCancel={() => setEditing(null)}
      confirmLabel={t('common.save')}
      onConfirm={submit}
    />
  )

  const handleDiscard = () => {
    setDraft({ id: currentUser.id, name: currentUser.name, email: currentUser.email })
    form.reset()
  }

  return (
    <PageContainer>
      {/* ── 1. 身份横幅：一眼确认「这是不是我」 ───────────────────────── */}
      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-14 shrink-0 rounded-xl">
            <AvatarFallback className="rounded-xl text-lg">
              {currentUser.initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold" data-profile="display-name">
                {currentUser.name}
              </h2>
              {currentUser.isSystemAdmin && (
                <Badge className="gap-1">
                  <ShieldCheck className="size-3" />
                  {roleLabel}
                </Badge>
              )}
              <Badge variant={currentUser.status === 'active' ? 'secondary' : 'outline'}>
                {t(USER_STATUS_LABEL_KEYS[currentUser.status])}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {t('profile.avatarHint')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Your details：四行表单，统一 field 布局 ───────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-4" />
            {t('profile.detailsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex max-w-3xl flex-col gap-5">
          {/* (1) 登录名：账号主键，只读。改登录名是敏感动作（要当前口令），
              点按钮后在下方展开表单，而不是给一个看起来能改的输入框。 */}
          <div className="flex flex-col gap-3">
            <FormField
              id="profile-username"
              layout="field"
              label={t('users.username')}
              hint={t('profile.usernameHint')}
            >
              <div className="flex items-center gap-2">
                <Input
                  id="profile-username"
                  value={currentUser.username}
                  readOnly
                  disabled
                  className="font-mono"
                  data-user-menu="username"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setEditing(editing === 'username' ? null : 'username')}
                  data-profile-action="edit-username"
                >
                  <LogIn className="size-4" />
                  {t('profile.changeUsername')}
                </Button>
              </div>
            </FormField>

            {editing === 'username' && (
              <div data-profile-row="username">
                <UsernameForm
                  key={currentUser.id}
                  user={currentUser}
                  onDone={() => setEditing(null)}
                  footer={renderUsernameFooter}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* (2) 显示名称：可改 */}
          <FormField
            id="profile-name"
            layout="field"
            label={t('profile.displayName')}
            hint={t('profile.displayNameHint')}
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

          {/* (3) 邮箱：可改 */}
          <FormField
            id="profile-email"
            layout="field"
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

          {/* (4) 保存 / 放弃：作用于上面两个可编辑字段 */}
          <div className="flex flex-wrap items-center justify-between gap-2 pl-24 sm:pl-32">
            {/* 未保存改动只在真的有改动时提示，避免页面一进来就挂着一条无意义的黄字 */}
            <span
              className={cn(
                'text-xs',
                dirty ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
              )}
              data-profile="dirty-state"
            >
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

          <Separator />

          {/* (5) 口令：与上面四行同一套「标签 + 控件」节奏，右边显示最近修改时间 */}
          <section data-profile-row="password" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <KeyRound className="size-4" />
                {t('profile.changePasswordTitle')}
              </span>
              {/* 口令只报状态，不回显：时间戳或「未设置」—— 口令本身不进前端状态 */}
              <span className="text-muted-foreground text-xs" data-user-menu="password-state">
                {currentUser.passwordUpdatedAt
                  ? t('profile.passwordUpdatedAt', {
                      time: new Date(currentUser.passwordUpdatedAt).toLocaleString(),
                    })
                  : t('profile.passwordNotSet')}
              </span>
            </div>
            <div className="pl-24 sm:pl-32">
              <InlinePasswordForm
                key={currentUser.id}
                user={currentUser}
                footer={() => null}
              />
            </div>
          </section>
        </CardContent>
      </Card>

      {/* ── 3. 团队归属：只读徽标列表 ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4" />
            {t('profile.teams')}
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </PageContainer>
  )
}
