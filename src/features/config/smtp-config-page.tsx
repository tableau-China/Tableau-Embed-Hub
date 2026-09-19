import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Mail,
  RotateCcw,
  Server,
} from 'lucide-react'

import { ActionButtons } from '@/components/action-bar'
import { useFormTouch } from '@/hooks/use-form-touch'
import { FormField, FormGrid, type FieldIssue } from '@/components/form-field'
import { NoteCallout } from '@/components/note-callout'
import { PageContainer } from '@/components/page-container'
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
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DEFAULT_SMTP_CONFIG,
  ENCRYPTION_LABEL_PREFIX,
  SMTP_ENCRYPTION_PORTS,
  SMTP_ENCRYPTIONS,
  SMTP_PRESETS,
  encryptionLabelKey,
  normalizeSmtpConfig,
  presetForHost,
  smtpErrors,
  smtpFieldIssues,
  smtpStatus,
  smtpWarnings,
  validateSmtpConfig,
  type SmtpCheck,
  type SmtpConfig,
  type SmtpEncryption,
  type SmtpField,
} from '@/lib/smtp'
import { useConfigStore } from '@/stores/config-store'

/**
 * SMTP 配置页 `/config/smtp`（跨团队页面，无 slug；默认只有系统管理员可见）。
 *
 * 参考实现是 pg-explorer 的 `frontend/src/features/configuration/smtp-config-form.tsx`
 * + `server-nest/src/configuration/configuration.controller.ts`，本页保留了它的字段模型与
 * 「配置 + 测试 + 服务商参考」三段结构，但改掉了其中几处不符合最佳实践的做法：
 *
 * | pg-explorer 的做法 | 本页的做法 |
 * | --- | --- |
 * | `secure: boolean` 单开关 | 三态加密方式（none / STARTTLS / SSL）—— 布尔开关表达不了 STARTTLS |
 * | `alert()` / 无字段级校验 | 字段级 inline 错误 + 实时预检清单 + sonner toast + Dialog 二次确认 |
 * | 表单硬编码中文 | 全量 i18n（en-US，后续扩展其它语言） |
 * | `<label>` 无 htmlFor | `Label htmlFor` + `Input id` + `aria-invalid` + `autoComplete` |
 * | 保存必须重填密码 | 密码留空 = 保持原密码；另有「清除密码」 |
 * | 密码加密后落库（服务端） | 纯前端模板**不落盘**密码（见「凭据」卡片的说明） |
 * | 配置保存才生效 | 保存前可「放弃改动」回到已保存状态，保存按钮在无改动时禁用 |
 *
 * 与后端的边界：本模板没有后端，浏览器也开不了 TCP 连接，因此「预检」只做**配置层面**的校验；
 * 真实握手（EHLO → STARTTLS → AUTH → QUIT）必须放在服务端，落地方式见页面上的说明与
 * `src/stores/config-store.ts` 的文件头注释。
 */

/** 表单草稿：port 用字符串态（允许清空与中间态），保存时再归一化成数字 */
interface SmtpDraft {
  host: string
  port: string
  encryption: SmtpEncryption
  username: string
  fromEmail: string
  fromName: string
}

function toDraft(config: SmtpConfig): SmtpDraft {
  return { ...config, port: String(config.port) }
}

function toConfig(draft: SmtpDraft): SmtpConfig {
  const port = draft.port.trim() === '' ? 0 : Number(draft.port)
  return { ...draft, port: Number.isFinite(port) ? port : 0 }
}

/** 预检项 → 图标与配色（pass / warning / error 三态） */
const LEVEL_STYLES = {
  pass: { Icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-500' },
  warning: { Icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-500' },
  error: { Icon: AlertCircle, className: 'text-destructive' },
} as const

export function SmtpConfigPage() {
  const { t, i18n } = useTranslation()
  const smtp = useConfigStore((s) => s.smtp)
  const smtpUpdatedAt = useConfigStore((s) => s.smtpUpdatedAt)
  const storedPassword = useConfigStore((s) => s.smtpPassword)
  const saveSmtp = useConfigStore((s) => s.saveSmtp)
  const clearSmtpPassword = useConfigStore((s) => s.clearSmtpPassword)
  const resetSmtp = useConfigStore((s) => s.resetSmtp)

  const [draft, setDraft] = useState<SmtpDraft>(() => toDraft(smtp))
  /** 新输入的密码（留空 = 保持已保存的那个）；与 store 里的密码分开，避免中途污染已保存状态 */
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  /** 字段级校验的显示时机：碰过才报、点了保存才全报（见 hooks/use-form-touch.ts） */
  const form = useFormTouch<SmtpField>()

  const config = toConfig(draft)
  const hasPassword = password !== '' || storedPassword !== ''
  const checks = validateSmtpConfig({ config, hasPassword })
  const errors = smtpErrors(checks)
  const warnings = smtpWarnings(checks)
  const status = smtpStatus({ config, hasPassword })
  const issues = smtpFieldIssues(checks)

  const dirty =
    (['host', 'port', 'encryption', 'username', 'fromEmail', 'fromName'] as const).some(
      (key) => config[key] !== smtp[key],
    ) || password !== ''

  /**
   * 字段级问题（交给 <FormField> 渲染）：只在「碰过该字段」或「点过保存」后才显示，
   * 避免一进页面满屏红字。pass 级的检查项不产生条目。
   */
  const issueFor = (field: SmtpField): FieldIssue | null => {
    if (!form.shows(field)) return null
    const check = issues[field]
    if (!check || check.level === 'pass') return null
    return { level: check.level, message: checkMessage(check) }
  }

  const patch = (partial: Partial<SmtpDraft>) => setDraft((d) => ({ ...d, ...partial }))
  const touch = form.touch

  /** 服务商预设：只回填连接参数，不动用户名/发件人（那些是账号信息，不是服务商信息） */
  const applyPreset = (host: string, port: number, encryption: SmtpEncryption) => {
    patch({ host, port: String(port), encryption })
    toast.info(t('smtp.presetApplied', { host }))
  }

  /** 切换加密方式：端口仍等于「旧方式的惯用端口」时才跟随，用户手工改过就不动 */
  const changeEncryption = (encryption: SmtpEncryption) => {
    const wasDefaultPort = draft.port.trim() === String(SMTP_ENCRYPTION_PORTS[draft.encryption])
    patch({
      encryption,
      ...(wasDefaultPort ? { port: String(SMTP_ENCRYPTION_PORTS[encryption]) } : {}),
    })
  }

  const handleSave = () => {
    form.submit()
    if (errors.length > 0) {
      toast.error(t('smtp.saveBlocked', { count: errors.length }))
      return
    }
    // 密码留空 = 保持已保存的密码（password === undefined），非空 = 覆盖
    saveSmtp(normalizeSmtpConfig(config), password === '' ? undefined : password)
    setDraft(toDraft(normalizeSmtpConfig(config)))
    setPassword('')
    form.reset()
    toast.success(
      warnings.length > 0
        ? t('smtp.savedWithWarnings', { count: warnings.length })
        : t('smtp.saved'),
    )
  }

  const handleDiscard = () => {
    setDraft(toDraft(smtp))
    setPassword('')
    form.reset()
  }

  const handleReset = () => {
    resetSmtp()
    setDraft(toDraft(DEFAULT_SMTP_CONFIG))
    setPassword('')
    form.reset()
    setResetOpen(false)
    toast.success(t('smtp.resetDone'))
  }

  /** 预检项 → 文案：params 里的 `mode` 是 i18n key（加密方式），先翻译再插值 */
  const checkMessage = (check: SmtpCheck): string => {
    const params: Record<string, string | number> = { ...check.params }
    if (typeof params.mode === 'string' && params.mode.startsWith(ENCRYPTION_LABEL_PREFIX)) {
      params.mode = t(params.mode)
    }
    return t(check.messageKey, params)
  }

  const statusVariant = status === 'ready' ? 'default' : status === 'empty' ? 'outline' : 'secondary'

  return (
    // 页面铺满内容区（与 /users、/teams 等页面一致）；窄栏加在内容块上：
    // 表单用 <FormGrid>（默认 768px），长段落用 max-w-prose —— 见 components/page-container.tsx 的说明
    <PageContainer>
      {/* ============================ 连接配置 ============================ */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <Server className="size-4" />
                {t('smtp.serverTitle')}
              </CardTitle>
              <CardDescription>{t('smtp.serverSubtitle')}</CardDescription>
            </div>
            <Badge variant={statusVariant} data-smtp-status={status}>
              {t(`smtp.status.${status}`)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* —— 服务商预设：一键回填 host/port/encryption，比让人照抄表格可靠 —— */}
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-sm font-medium">{t('smtp.preset')}</span>
            <div className="flex flex-wrap gap-2">
              {SMTP_PRESETS.map((preset) => {
                const active = presetForHost(draft.host)?.id === preset.id
                return (
                  <Button
                    key={preset.id}
                    type="button"
                    size="sm"
                    variant={active ? 'secondary' : 'outline'}
                    data-smtp-preset={preset.id}
                    onClick={() => applyPreset(preset.host, preset.port, preset.encryption)}
                  >
                    {preset.name}
                  </Button>
                )
              })}
            </div>
            <span className="text-muted-foreground text-xs">{t('smtp.presetHint')}</span>
          </div>

          <Separator />

          {/* 6 列栅格：host 占 3、port 占 1、加密方式占 2（窄栏下约为 352 / 107 / 229 px） */}
          <FormGrid columns={6}>
            {/* —— host / port / encryption —— */}
            <FormField
              id="smtp-host"
              className="md:col-span-3"
              label={t('smtp.host')}
              hint={t('smtp.hostHint')}
              issue={issueFor('host')}
            >
              <Input
                value={draft.host}
                onChange={(e) => patch({ host: e.target.value })}
                onBlur={() => touch('host')}
                placeholder="smtp.example.com"
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>

            <FormField
              id="smtp-port"
              className="md:col-span-1"
              label={t('smtp.port')}
              hint={t('smtp.portHint')}
              issue={issueFor('port')}
            >
              <Input
                type="number"
                min={1}
                max={65535}
                value={draft.port}
                onChange={(e) => patch({ port: e.target.value })}
                onBlur={() => touch('port')}
                placeholder="587"
              />
            </FormField>

            <FormField
              id="smtp-encryption"
              className="md:col-span-2"
              label={t('smtp.encryption')}
              hint={t('smtp.encryptionHint')}
              issue={issueFor('encryption')}
              injectProps={false}
            >
              <Select
                value={draft.encryption}
                onValueChange={(value) => {
                  changeEncryption(value as SmtpEncryption)
                  touch('encryption')
                }}
              >
                {/* 复合控件：id 与 aria 必须落在真正的 DOM 节点（Trigger）上，FormField 不会代劳 */}
                <SelectTrigger
                  id="smtp-encryption"
                  className="w-full"
                  aria-invalid={issueFor('encryption')?.level === 'error'}
                  aria-describedby="smtp-encryption-message"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SMTP_ENCRYPTIONS.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {t(encryptionLabelKey(mode))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </FormGrid>

          <Separator />

          {/* —— 认证与发件人 —— */}
          <FormGrid columns={2}>
            <FormField
              id="smtp-username"
              label={t('smtp.username')}
              hint={t('smtp.usernameHint')}
              issue={issueFor('username')}
            >
              <Input
                value={draft.username}
                onChange={(e) => patch({ username: e.target.value })}
                onBlur={() => touch('username')}
                placeholder="noreply@example.com"
                autoComplete="username"
                spellCheck={false}
              />
            </FormField>

            {/* 密码是复合控件（InputGroup + 「已保存」徽章 + 清除按钮），其 id/aria 由这里手工接线 */}
            <div className="grid gap-2">
              <Label htmlFor="smtp-password">{t('smtp.password')}</Label>
              <InputGroup>
                <InputGroupInput
                  id="smtp-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => touch('password')}
                  placeholder={
                    storedPassword !== ''
                      ? t('smtp.passwordPlaceholderKeep')
                      : t('smtp.passwordPlaceholderNew')
                  }
                  aria-invalid={issueFor('password')?.level === 'error'}
                  aria-describedby={storedPassword === '' ? 'smtp-password-message' : undefined}
                  autoComplete="new-password"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t('smtp.hidePassword') : t('smtp.showPassword')}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              {storedPassword !== '' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <KeyRound className="size-3" />
                    {t('smtp.passwordStored')}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground h-6 px-2 text-xs"
                    data-smtp-action="clear-password"
                    onClick={() => {
                      clearSmtpPassword()
                      setPassword('')
                      toast.success(t('smtp.passwordCleared'))
                    }}
                  >
                    {t('smtp.clearPassword')}
                  </Button>
                </div>
              ) : (
                // 与 <FormField> 的说明行保持同样的 id 约定（`<id>-message`），供 aria-describedby 指向
                <p
                  id="smtp-password-message"
                  className={
                    issueFor('password') === null
                      ? 'text-muted-foreground text-xs'
                      : issueFor('password')?.level === 'error'
                        ? 'text-destructive text-xs'
                        : 'text-amber-600 text-xs dark:text-amber-500'
                  }
                >
                  {issueFor('password')?.message ?? t('smtp.passwordHint')}
                </p>
              )}
            </div>

            <FormField
              id="smtp-from"
              label={t('smtp.fromEmail')}
              hint={t('smtp.fromEmailHint')}
              issue={issueFor('fromEmail')}
            >
              <Input
                type="email"
                value={draft.fromEmail}
                onChange={(e) => patch({ fromEmail: e.target.value })}
                onBlur={() => touch('fromEmail')}
                placeholder="noreply@example.com"
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>

            <FormField
              id="smtp-from-name"
              label={t('smtp.fromName')}
              hint={t('smtp.fromNameHint')}
            >
              <Input
                value={draft.fromName}
                onChange={(e) => patch({ fromName: e.target.value })}
                placeholder={t('smtp.fromNamePlaceholder')}
                spellCheck={false}
              />
            </FormField>
          </FormGrid>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span>{dirty ? t('smtp.unsaved') : t('smtp.noChanges')}</span>
              {errors.length > 0 && (
                <span className="text-destructive">{t('smtp.errorCount', { count: errors.length })}</span>
              )}
              {smtpUpdatedAt !== null && (
                <span>
                  {t('smtp.lastSaved', {
                    time: new Date(smtpUpdatedAt).toLocaleString(i18n.language),
                  })}
                </span>
              )}
            </span>
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
        </CardContent>
      </Card>

      {/* ============================ 预检清单 ============================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="size-4" />
            {t('smtp.checkTitle')}
          </CardTitle>
          <CardDescription>{t('smtp.checkSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2" data-smtp-checks>
            {checks.map((check) => {
              const { Icon, className } = LEVEL_STYLES[check.level]
              return (
                <li key={check.id} className="flex items-start gap-2 text-sm">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} />
                  <span className="min-w-0 flex-1">
                    <span className="text-muted-foreground mr-2 font-mono text-xs">
                      {t(`smtp.checkLabel.${check.id}`)}
                    </span>
                    {checkMessage(check)}
                  </span>
                </li>
              )
            })}
          </ul>

          <NoteCallout title={t('smtp.localCheckNoteTitle')}>
            {/* max-w-prose：长段落限制每行字数（卡片本身仍铺满宽度） */}
            <p className="text-muted-foreground max-w-prose">{t('smtp.localCheckNote')}</p>
            {/* 窄视口下换行（break-all）而不是横向滚动：这句是给人读的提示，不是要精确复制的代码 */}
            <code className="text-muted-foreground bg-background/60 rounded px-2 py-1 font-mono break-all">
              {t('smtp.serverSideSnippet')}
            </code>
          </NoteCallout>

          <NoteCallout tone="warning" title={t('smtp.secretNoteTitle')}>
            <p className="text-muted-foreground max-w-prose">{t('smtp.secretNote')}</p>
          </NoteCallout>
        </CardContent>
      </Card>

      {/* ============================ 服务商参考 ============================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            {t('smtp.referenceTitle')}
          </CardTitle>
          <CardDescription>{t('smtp.referenceSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* TableHead / TableCell 默认 whitespace-nowrap：凭据说明那段长文案必须**显式放开换行**，
              否则表格的自然宽度会顶穿容器（= 整页横向滚动条）。列宽按窄栏（内容宽 720px）分配。 */}
          <div className="min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* 服务商名最长 25 字符（Microsoft 365 / Outlook）：w-48 让它在宽屏单行显示；
                      whitespace-normal 是窄屏兜底，避免又变成「表格顶宽整页」 */}
                  <TableHead className="w-48 whitespace-normal">
                    {t('smtp.referenceProvider')}
                  </TableHead>
                  <TableHead className="w-40">{t('smtp.host')}</TableHead>
                  <TableHead className="w-14 text-right">{t('smtp.port')}</TableHead>
                  <TableHead className="w-24">{t('smtp.encryption')}</TableHead>
                  <TableHead className="whitespace-normal">{t('smtp.referenceCredential')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SMTP_PRESETS.map((preset) => (
                  <TableRow key={preset.id}>
                    <TableCell className="font-medium whitespace-normal">{preset.name}</TableCell>
                    <TableCell className="font-mono text-xs">{preset.host}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{preset.port}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {t(encryptionLabelKey(preset.encryption))}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-normal">
                      {t(preset.hintKey)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ============================ 危险操作 ============================ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive text-base">{t('smtp.resetTitle')}</CardTitle>
          <CardDescription>{t('smtp.resetHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive w-fit"
            data-smtp-action="reset"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw className="size-4" />
            {t('smtp.resetAction')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('smtp.resetDialogTitle')}</DialogTitle>
            <DialogDescription>{t('smtp.resetDialogMessage')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <ActionButtons
              cancelLabel={t('common.cancel')}
              onCancel={() => setResetOpen(false)}
              confirmLabel={t('smtp.resetConfirm')}
              onConfirm={handleReset}
              confirmVariant="destructive"
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
