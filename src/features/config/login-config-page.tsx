import { useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Info,
  KeyRound,
  RotateCcw,
} from 'lucide-react'

import { ActionButtons } from '@/components/action-bar'
import { OAUTH_ICONS } from '@/features/login/brand-icons'
import { FormField, FormGrid, type FieldIssue } from '@/components/form-field'
import { NoteCallout } from '@/components/note-callout'
import { PageContainer } from '@/components/page-container'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useFormTouch } from '@/hooks/use-form-touch'
import {
  DEFAULT_LOGIN_TEMPLATE,
  LOGIN_TEMPLATES,
  OAUTH_FIELD_LABEL_KEYS,
  OAUTH_PROVIDERS,
  loginErrors,
  loginFieldIssues,
  loginStatus,
  loginWarnings,
  normalizeLoginConfig,
  resolveHeroImageUrl,
  sameLoginConfig,
  validateLoginConfig,
  type LoginCheck,
  type LoginConfig,
  type LoginField,
  type LoginTemplateId,
  type OAuthProviderConfig,
  type OAuthProviderField,
  type OAuthProviderId,
} from '@/lib/login'
import { cn } from '@/lib/utils'
import { useConfigStore } from '@/stores/config-store'

/**
 * 登录页配置 `/config/login`（跨团队页面，无 slug；默认只有系统管理员可见）。
 *
 * 管两件事（与 `src/lib/login.ts` 的目录一一对应）：
 *   1. **登录样式**：三选一（居中卡片 / 左图右栏 / 全屏背景），改的是 `/login` 渲染哪套版面；
 *   2. **第三方联合登录**：GitHub / Google 的**公开**参数（Client ID / 授权端点 / 回调 / scope）。
 *
 * ## 这一页刻意不做的事
 *
 * - **不收 Client Secret**：纯前端模板里它必然随 bundle 发给所有人，收了就是安全剧场；
 *   授权码换 token 必须由后端完成（契约见 docs/login-setup.md）；
 * - **不做「预览即真登录」**：预览按钮只是新开一个 `/login` 标签页；
 * - **不让样式/图片的改动被 OAuth 的 warning 拦住**：error 才拦保存（授权端点非 https、
 *   回调地址形态非法、宣传图地址解析不了），「Client ID 还没填」只是 warning —— 否则
 *   只想换个版式的用户会被迫先编一个 Client ID 才能保存。
 *
 * 与 SMTP 配置页同构：草稿态 + 实时预检 + 字段级 issue + 保存/放弃 + 重置二次确认。
 */

/** 状态 → 文案 key（走常量表而不是拼字符串：拼字符串的 key 检索不到，也躲得过漏键检查） */
const STATUS_LABEL_KEYS = {
  pristine: 'loginConfig.status.pristine',
  ready: 'loginConfig.status.ready',
  incomplete: 'loginConfig.status.incomplete',
} as const

const STATUS_VARIANTS = {
  pristine: 'outline',
  ready: 'default',
  incomplete: 'secondary',
} as const

/** 预检项 → 图标与配色（与 /config/smtp 的三态观感一致） */
const LEVEL_STYLES = {
  pass: { Icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-500' },
  warning: { Icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-500' },
  error: { Icon: AlertCircle, className: 'text-destructive' },
} as const

/**
 * 表单控件 id：`login-<provider>-<kebab-field>`（如 `login-github-authorize-url`）。
 *
 * 两处约定：点号不能进 DOM id；字段名在 id 里转 kebab-case ——
 * 外部脚本与 CSS 选择器按惯例写小写连字符，id 里留驼峰会让它们反复踩空。
 */
function inputId(provider: OAuthProviderId, field: OAuthProviderField): string {
  return 'login-' + provider + '-' + field.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
}

/** 预检项的 field 形式（`<provider>.<field>`），供 issueFor 查表 */
function providerField(id: OAuthProviderId, field: OAuthProviderField): LoginField {
  return (id + '.' + field) as LoginField
}

/** 预检行左侧的「字段」标签：宣传图直接用标签文案，provider 行是「品牌名 · 字段名」 */
function checkLabel(check: LoginCheck, t: TFunction): string {
  if (!check.id.includes('.')) return t('loginConfig.heroLabel')
  const dot = check.id.indexOf('.')
  const providerId = check.id.slice(0, dot)
  const field = check.id.slice(dot + 1)
  const meta = OAUTH_PROVIDERS.find((p) => p.id === providerId)
  if (!meta) return check.id
  if (field === 'enabled') return meta.name
  return meta.name + ' · ' + t(OAUTH_FIELD_LABEL_KEYS[field as OAuthProviderField])
}

/**
 * 样式缩略图（纯 CSS 线框，不是真截图）。
 *
 * 用线框而不是截图：截图要跟着 UI 改版一起重拍，而线框只表达「版面形状」这一件事 ——
 * 这正是用户在三个样式之间做选择时看的唯一信息。
 */
function TemplateWireframe({ id }: { id: LoginTemplateId }) {
  const block = 'bg-muted-foreground/30 rounded-sm'

  if (id === 'split-hero') {
    return (
      <div className="flex h-16 w-full overflow-hidden rounded-md border">
        <div className="bg-muted-foreground/40 h-full w-2/3" />
        <div className="flex h-full w-1/3 items-center justify-center p-1.5">
          <div className={cn('h-6 w-full', block)} />
        </div>
      </div>
    )
  }

  if (id === 'fullscreen-card') {
    return (
      <div className="bg-muted-foreground/25 flex h-16 w-full items-center justify-center rounded-md border">
        <div className={cn('h-7 w-12', block)} />
      </div>
    )
  }

  return (
    <div className="flex h-16 w-full items-center justify-center rounded-md border">
      <div className={cn('h-7 w-12', block)} />
    </div>
  )
}

export function LoginConfigPage() {
  const { t, i18n } = useTranslation()
  const login = useConfigStore((s) => s.login)
  const loginUpdatedAt = useConfigStore((s) => s.loginUpdatedAt)
  const saveLogin = useConfigStore((s) => s.saveLogin)
  const resetLogin = useConfigStore((s) => s.resetLogin)

  /** 草稿态：改动先落在这里，点保存才进 store（与 SMTP 页同一套交互） */
  const [draft, setDraft] = useState<LoginConfig>(() => normalizeLoginConfig(login))
  const [resetOpen, setResetOpen] = useState(false)
  /** 字段级校验的显示时机：碰过才报、点了保存才全报（见 hooks/use-form-touch.ts） */
  const form = useFormTouch<LoginField>()

  const checks = useMemo(() => validateLoginConfig(draft), [draft])
  const errors = loginErrors(checks)
  const status = loginStatus(draft)
  const issues = loginFieldIssues(checks)
  const dirty = !sameLoginConfig(draft, login)

  const issueFor = (field: LoginField): FieldIssue | null => {
    if (!form.shows(field)) return null
    const check = issues[field]
    if (!check || check.level === 'pass') return null
    return { level: check.level, message: t(check.messageKey, check.params) }
  }

  const patchProvider = (id: OAuthProviderId, partial: Partial<OAuthProviderConfig>) => {
    setDraft((d) => ({
      ...d,
      providers: { ...d.providers, [id]: { ...d.providers[id], ...partial } },
    }))
  }

  const handleSave = () => {
    form.submit()
    // 保存前统一归一化（trim / 丢未知键），并用**归一化后**的配置重新预检：
    // 否则会出现「按草稿判无错、存进去的值却被 trim 成空」这类不一致
    const normalized = normalizeLoginConfig(draft)
    const freshChecks = validateLoginConfig(normalized)
    const freshErrors = loginErrors(freshChecks)
    if (freshErrors.length > 0) {
      toast.error(t('loginConfig.saveBlocked', { count: freshErrors.length }))
      return
    }
    saveLogin(normalized)
    setDraft(normalized)
    form.reset()
    const freshWarnings = loginWarnings(freshChecks)
    toast.success(
      freshWarnings.length > 0
        ? t('loginConfig.savedWithWarnings', { count: freshWarnings.length })
        : t('loginConfig.saved'),
    )
  }

  const handleDiscard = () => {
    setDraft(normalizeLoginConfig(login))
    form.reset()
  }

  const handleReset = () => {
    resetLogin()
    setDraft(normalizeLoginConfig())
    form.reset()
    setResetOpen(false)
    toast.success(t('loginConfig.resetDone'))
  }

  return (
    <PageContainer>
      {/* ============================ 登录样式 + 宣传图 ============================ */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4" />
                {t('loginConfig.title')}
              </CardTitle>
              <CardDescription>{t('loginConfig.subtitle')}</CardDescription>
            </div>
            <Badge variant={STATUS_VARIANTS[status]} data-login-status={status}>
              {t(STATUS_LABEL_KEYS[status])}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t('loginConfig.styleTitle')}</span>
              <span className="text-muted-foreground text-xs">{t('loginConfig.styleSubtitle')}</span>
            </div>
            {/* 用 aria-pressed 的可选卡片表达单选：比原生 radio 更容易做「线框 + 文案」的整块点击区 */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {LOGIN_TEMPLATES.map((meta) => {
                const active = draft.template === meta.id
                return (
                  <button
                    key={meta.id}
                    type="button"
                    aria-pressed={active}
                    data-login-template-option={meta.id}
                    onClick={() => setDraft((d) => ({ ...d, template: meta.id }))}
                    className={cn(
                      'flex flex-col gap-3 rounded-lg border p-3 text-left transition-colors',
                      active ? 'border-primary ring-primary/30 ring-2' : 'hover:bg-muted/50',
                    )}
                  >
                    <TemplateWireframe id={meta.id} />
                    <span className="flex flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {t(meta.nameKey)}
                        {meta.id === DEFAULT_LOGIN_TEMPLATE && (
                          <Badge variant="outline">{t('loginConfig.styleDefault')}</Badge>
                        )}
                      </span>
                      <span className="text-muted-foreground text-xs">{t(meta.descriptionKey)}</span>
                      {meta.usesHeroImage && (
                        <span className="text-muted-foreground text-[11px]">
                          {t('loginConfig.styleUsesHero')}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t('loginConfig.heroTitle')}</span>
              {/* 长段落用 max-w-prose：卡片铺满宽度，但每行 60–75 字符才好读 */}
              <p className="text-muted-foreground max-w-prose text-xs">
                {t('loginConfig.heroSubtitle')}
              </p>
            </div>
            <FormGrid columns={1}>
              <FormField
                id="login-hero-image"
                label={t('loginConfig.heroLabel')}
                issue={issueFor('heroImageUrl')}
              >
                <Input
                  value={draft.heroImageUrl}
                  onChange={(e) => setDraft((d) => ({ ...d, heroImageUrl: e.target.value }))}
                  onBlur={() => form.touch('heroImageUrl')}
                  placeholder={t('loginConfig.heroPlaceholder')}
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
            </FormGrid>
            <div className="flex flex-wrap items-center gap-3">
              {/* 实时缩略图：地址写错立刻能看出来（远程图挂掉时浏览器显示破图，本身就是有效反馈） */}
              <img
                data-login-hero-preview
                src={resolveHeroImageUrl(draft)}
                alt=""
                aria-hidden="true"
                className="h-16 w-24 rounded-md border object-cover"
              />
              {draft.heroImageUrl === '' && (
                <Badge variant="outline">{t('loginConfig.heroBuiltIn')}</Badge>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span>{dirty ? t('loginConfig.unsaved') : t('loginConfig.noChanges')}</span>
              {errors.length > 0 && (
                <span className="text-destructive">
                  {t('loginConfig.saveBlocked', { count: errors.length })}
                </span>
              )}
              {loginUpdatedAt !== null && (
                <span>
                  {t('loginConfig.lastSaved', {
                    time: new Date(loginUpdatedAt).toLocaleString(i18n.language),
                  })}
                </span>
              )}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {/* 新开标签页预览真实页面（配置页自己不是登录页，改完必须能一眼看到效果） */}
              <Button asChild variant="outline">
                <a href="/login" target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  {t('loginConfig.preview')}
                </a>
              </Button>
              <ActionButtons
                cancelLabel={t('common.discard')}
                onCancel={handleDiscard}
                cancelDisabled={!dirty}
                confirmLabel={t('common.save')}
                onConfirm={handleSave}
                // 刻意**不**因为「有校验错误」而禁用：置灰会让用户点不动、也看不到哪里错了。
                // 点保存即统一揭示所有字段错误并弹提示（见 hooks/use-form-touch.ts 的说明）。
                confirmDisabled={!dirty}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================ 第三方联合登录 ============================ */}
      <Card>
        <CardHeader>
          <CardTitle>{t('loginConfig.providersTitle')}</CardTitle>
          <CardDescription>{t('loginConfig.providersSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <NoteCallout title={t('loginConfig.notWired')} />

          {OAUTH_PROVIDERS.map((meta) => {
            const provider = draft.providers[meta.id]
            const Icon = OAUTH_ICONS[meta.id]
            const switchId = 'login-provider-' + meta.id + '-enabled'
            return (
              <div key={meta.id} className="flex flex-col gap-4 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4" />
                    <span className="text-sm font-medium">{meta.name}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {meta.id}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={switchId} className="text-muted-foreground text-xs">
                      {t('loginConfig.enabled')}
                    </Label>
                    <Switch
                      id={switchId}
                      data-login-provider-enable={meta.id}
                      checked={provider.enabled}
                      onCheckedChange={(checked) => patchProvider(meta.id, { enabled: checked })}
                    />
                  </div>
                </div>

                <FormGrid columns={2}>
                  <FormField
                    id={inputId(meta.id, 'clientId')}
                    label={t('loginConfig.clientId')}
                    hint={t('loginConfig.clientIdHint')}
                    issue={issueFor(providerField(meta.id, 'clientId'))}
                  >
                    <Input
                      value={provider.clientId}
                      onChange={(e) => patchProvider(meta.id, { clientId: e.target.value })}
                      onBlur={() => form.touch(providerField(meta.id, 'clientId'))}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </FormField>

                  <FormField
                    id={inputId(meta.id, 'authorizeUrl')}
                    label={t('loginConfig.authorizeUrl')}
                    hint={t('loginConfig.authorizeUrlHint')}
                    issue={issueFor(providerField(meta.id, 'authorizeUrl'))}
                  >
                    <Input
                      value={provider.authorizeUrl}
                      onChange={(e) => patchProvider(meta.id, { authorizeUrl: e.target.value })}
                      onBlur={() => form.touch(providerField(meta.id, 'authorizeUrl'))}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </FormField>

                  <FormField
                    id={inputId(meta.id, 'redirectUri')}
                    label={t('loginConfig.redirectUri')}
                    hint={t('loginConfig.redirectUriHint')}
                    issue={issueFor(providerField(meta.id, 'redirectUri'))}
                  >
                    <Input
                      value={provider.redirectUri}
                      onChange={(e) => patchProvider(meta.id, { redirectUri: e.target.value })}
                      onBlur={() => form.touch(providerField(meta.id, 'redirectUri'))}
                      placeholder={'https://your-server.example.com/oauth/' + meta.id + '/callback'}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </FormField>

                  <FormField
                    id={inputId(meta.id, 'scopes')}
                    label={t('loginConfig.scopes')}
                    hint={t('loginConfig.scopesHint')}
                    issue={issueFor(providerField(meta.id, 'scopes'))}
                  >
                    <Input
                      value={provider.scopes}
                      onChange={(e) => patchProvider(meta.id, { scopes: e.target.value })}
                      onBlur={() => form.touch(providerField(meta.id, 'scopes'))}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </FormField>
                </FormGrid>
              </div>
            )
          })}

          <NoteCallout tone="warning" title={t('loginConfig.secretTitle')}>
            <p className="text-muted-foreground max-w-prose">{t('loginConfig.secretBody')}</p>
          </NoteCallout>
        </CardContent>
      </Card>

      {/* ============================ 预检清单 ============================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="size-4" />
            {t('loginConfig.checkTitle')}
          </CardTitle>
          <CardDescription>{t('loginConfig.checkSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2" data-login-checks>
            {checks.map((check) => {
              const { Icon, className } = LEVEL_STYLES[check.level]
              return (
                <li key={check.id} className="flex items-start gap-2 text-sm" data-login-check={check.id}>
                  <Icon className={cn('mt-0.5 size-4 shrink-0', className)} />
                  <span className="min-w-0 flex-1">
                    <span className="text-muted-foreground mr-2 font-mono text-xs">
                      {checkLabel(check, t)}
                    </span>
                    {t(check.messageKey, check.params)}
                  </span>
                </li>
              )
            })}
          </ul>

          <NoteCallout title={t('loginConfig.pageNoteTitle')}>
            <p className="text-muted-foreground max-w-prose">{t('loginConfig.pageNote')}</p>
          </NoteCallout>
        </CardContent>
      </Card>

      {/* ============================ 危险操作 ============================ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive text-base">{t('loginConfig.reset')}</CardTitle>
          <CardDescription>{t('loginConfig.resetBody')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive w-fit"
            data-login-action="reset"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw className="size-4" />
            {t('loginConfig.reset')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('loginConfig.resetTitle')}</DialogTitle>
            <DialogDescription>{t('loginConfig.resetBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <ActionButtons
              cancelLabel={t('common.cancel')}
              onCancel={() => setResetOpen(false)}
              confirmLabel={t('loginConfig.resetConfirm')}
              onConfirm={handleReset}
              confirmVariant="destructive"
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
