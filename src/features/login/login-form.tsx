import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { FormField, type FieldIssue } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useFormTouch } from '@/hooks/use-form-touch'
import { OAUTH_PROVIDERS, type LoginConfig } from '@/lib/login'
import { cn } from '@/lib/utils'

import { OAUTH_ICONS } from './brand-icons'
import { BrandMark } from './brand-mark'

/**
 * 登录表单（三个样式模板共用的**唯一**一份登录内容）。
 *
 * 样式模板只负责摆放它（居中 / 左图右栏 / 全屏背景），表单本身不重复实现 ——
 * 否则每加一个样式就要把校验、按钮态、第三方入口再抄一遍。
 *
 * ## 当前是「UI 模板」阶段（见 docs/login-setup.md）
 *
 * - 提交**不做鉴权**：点「登录」只提示「尚未接入鉴权后端」，不会跳转、也不会伪造一个会话
 *   （纯前端伪造登录态是安全剧场，本项目明确不做）；
 * - 验证码**只是占位**：不生成、不校验（服务端校验才是唯一有意义的做法）；
 * - 第三方登录**只做入口**：按配置里的启用状态显示，点击提示尚未接入（不拼接 OAuth 跳转链接）。
 *
 * 接后端时要改的只有本文件的 handleSubmit / 验证码区 / 第三方按钮三处，其余不用动。
 */
export function LoginForm({ config, className }: { config: LoginConfig; className?: string }) {
  const { t } = useTranslation()
  const form = useFormTouch<'username' | 'password'>()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState('')

  const enabledProviders = OAUTH_PROVIDERS.filter((meta) => config.providers[meta.id].enabled)

  const usernameIssue: FieldIssue | null =
    username.trim() === '' ? { level: 'error', message: t('login.usernameRequired') } : null
  const passwordIssue: FieldIssue | null =
    password === '' ? { level: 'error', message: t('login.passwordRequired') } : null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    form.submit()
    if (usernameIssue || passwordIssue) return
    // 没有鉴权后端：如实说明，而不是假装登录成功
    toast.info(t('login.uiOnly'))
  }

  return (
    <Card className={cn('w-full', className)} data-login-form>
      <CardHeader className="gap-2">
        <BrandMark className="mb-1" />
        <CardTitle className="text-xl">{t('login.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
          <FormField
            id="login-username"
            label={t('login.username')}
            issue={form.shows('username') ? usernameIssue : null}
          >
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => form.touch('username')}
              autoComplete="username"
              placeholder={t('login.usernamePlaceholder')}
            />
          </FormField>

          <FormField
            id="login-password"
            label={t('login.password')}
            issue={form.shows('password') ? passwordIssue : null}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => form.touch('password')}
              autoComplete="current-password"
              placeholder={t('login.passwordPlaceholder')}
            />
          </FormField>

          {/* 验证码：复合控件（输入框 + 占位图形），所以 injectProps={false}，id/aria 自己接线 */}
          <FormField id="login-captcha" label={t('login.captcha')} injectProps={false}>
            <div className="flex items-center gap-2">
              <Input
                id="login-captcha"
                aria-describedby="login-captcha-message"
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                autoComplete="off"
                placeholder={t('login.captchaPlaceholder')}
              />
              <span
                data-captcha-placeholder
                aria-hidden="true"
                className="bg-muted/40 text-muted-foreground flex h-9 w-24 shrink-0 items-center justify-center rounded-md border border-dashed text-[10px] font-medium tracking-widest select-none"
              >
                {t('login.captchaImageLabel')}
              </span>
            </div>
          </FormField>

          <Button type="submit" className="mt-1 w-full">
            {t('login.submit')}
          </Button>
        </form>

        {enabledProviders.length > 0 ? (
          <div className="mt-5 grid gap-3">
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs">{t('login.orContinueWith')}</span>
              <Separator className="flex-1" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {enabledProviders.map((meta) => {
                const Icon = OAUTH_ICONS[meta.id]
                return (
                  <Button
                    key={meta.id}
                    type="button"
                    variant="outline"
                    data-login-provider={meta.id}
                    onClick={() => toast.info(t('login.providerNotWired', { provider: meta.name }))}
                  >
                    <Icon className="size-4" />
                    {meta.name}
                  </Button>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground mt-5 text-center text-xs">{t('login.noProviders')}</p>
        )}

        <div className="mt-5 grid gap-2">
          <Button asChild variant="link" className="text-muted-foreground h-auto p-0 text-xs">
            <Link to="/">{t('login.continueAnyway')}</Link>
          </Button>
          <p className="text-muted-foreground text-center text-[11px]">{t('login.footerNote')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
