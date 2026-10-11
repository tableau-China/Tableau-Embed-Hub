import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { FieldIssue } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { useFormTouch } from '@/hooks/use-form-touch'
import { OAUTH_PROVIDERS, type LoginConfig } from '@/lib/login'
import { cn } from '@/lib/utils'

import { OAUTH_ICONS } from './brand-icons'
import { BrandMark } from './brand-mark'
import { PaperField } from './paper-field'

/**
 * 登录表单（三套摆放模板共用的**唯一**一份登录内容）。
 *
 * 样式模板只负责摆放它（居中 / 左图右栏 / 全屏背景），表单本身不重复实现 ——
 * 否则每加一个样式就要把校验、按钮态、第三方入口再抄一遍。
 *
 * ## 表单语言：设计稿的「纸上语言」（2026-10-11）
 *
 * 外观对齐设计稿 `sandbox/design/order-center-login-breakthrough.html`：无卡片盒子、
 * 标签用 mono 小字大写、输入框只有下划线（见 `paper-field.tsx`）、主按钮薄荷强调色、
 * 第三方入口用两根发丝夹住一行小字。**三套模板共用这一套语言**，差异只剩背景
 * （宣传图 / 纯纸）—— 这正是「一份内容 + 多套摆放」的落点。
 *
 * `surface` 只表达一件事：表单落在**纸面**上，还是落在**图**上。
 * 设计稿的「全屏」摆放给表单加了一层半透明面板（`.auth` 的 panel 分支），因为背景是图，
 * 纯文字压上去对比度不可控；居中与左图右栏两种摆放则不需要面板。
 *
 * ## 当前是「UI 模板」阶段（见 docs/login-setup.md）
 *
 * - 提交**不做鉴权**：点「Sign in」只提示「尚未接入鉴权后端」，不会跳转、也不会伪造一个会话
 *   （纯前端伪造登录态是安全剧场，本模板明确不做）；
 * - 验证码**只是占位**：不生成、不校验（服务端校验才是唯一有意义的做法）；
 * - 第三方登录**只做入口**：按配置里的启用状态显示，点击提示尚未接入（不拼接 OAuth 跳转链接）。
 *
 * 接后端时要改的只有本文件的 handleSubmit / 验证码区 / 第三方按钮三处，其余不用动。
 */
export type LoginFormSurface = 'bare' | 'panel'

export function LoginForm({
  config,
  className,
  surface = 'bare',
}: {
  config: LoginConfig
  className?: string
  /** `bare` = 直接落在纸面上；`panel` = 落在宣传图上时垫一层半透明面板 */
  surface?: LoginFormSurface
}) {
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
    <div
      data-login-form
      className={cn(
        // 设计稿 .auth：宽度 min(100%,340px)
        'w-full max-w-[340px]',
        surface === 'panel' &&
          'border-login-line bg-background/75 rounded-[2px] border p-6 shadow-[0_20px_44px_-30px_rgba(27,35,44,0.45)] backdrop-blur-[10px] backdrop-saturate-150 sm:p-7',
        className,
      )}
    >
      {/* 注意：这里**不能**用 <header> 语义标签 —— `check:login` 的「裸布局」判据是
          「/login 页面上 header 元素数为 0」（它据此断言没有 App shell 顶栏），
          表单标题块用 <div> 即可，h1 才是真正的 landmark。 */}
      <div className="mb-6 grid gap-2">
        <BrandMark className="mb-1" />
        {/* 设计稿 .tagline：标题 + 一条向右渐隐的发丝线 */}
        <h1 className="flex items-center gap-3">
          <span className="text-[19px] leading-none tracking-[0.14em] sm:text-[21px]">{t('login.title')}</span>
          <span
            aria-hidden="true"
            className="from-login-line-strong h-px flex-1 bg-gradient-to-r to-transparent"
          />
        </h1>
      </div>

      <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
        <PaperField
          id="login-username"
          label={t('login.username')}
          value={username}
          onChange={setUsername}
          onBlur={() => form.touch('username')}
          issue={form.shows('username') ? usernameIssue : null}
          autoComplete="username"
          placeholder={t('login.usernamePlaceholder')}
        />

        <PaperField
          id="login-password"
          label={t('login.password')}
          type="password"
          value={password}
          onChange={setPassword}
          onBlur={() => form.touch('password')}
          issue={form.shows('password') ? passwordIssue : null}
          autoComplete="current-password"
          placeholder={t('login.passwordPlaceholder')}
        />

        {/* 验证码：复合控件（输入框 + 占位图形），图形走 PaperField 的 suffix */}
        <PaperField
          id="login-captcha"
          label={t('login.captcha')}
          value={captcha}
          onChange={setCaptcha}
          placeholder={t('login.captchaPlaceholder')}
          autoComplete="off"
          suffix={
            <span
              data-captcha-placeholder
              aria-hidden="true"
              className="border-login-line text-muted-foreground flex h-[34px] w-24 shrink-0 items-center justify-center rounded-[2px] border border-dashed font-mono text-[10px] tracking-[0.2em] select-none"
            >
              {t('login.captchaImageLabel')}
            </span>
          }
        />

        <Button
          type="submit"
          className={cn(
            'border-login-accent bg-login-accent text-login-accent-foreground relative overflow-hidden',
            'h-auto w-full rounded-[2px] py-3 text-[11px] tracking-[0.28em] uppercase',
            'hover:bg-login-accent font-mono hover:brightness-[1.08]',
            'hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--login-accent)_18%,transparent)]',
          )}
        >
          {/* 悬停扫光（设计稿 .submit::after）：纯装饰 */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-[110%] bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 ease-out group-hover/button:translate-x-[110%] motion-reduce:transition-none"
          />
          {t('login.submit')}
        </Button>

        {/* 设计稿 .plug：按钮下方一条渐隐的强调线 */}
        <span aria-hidden="true" className="from-login-accent h-px bg-gradient-to-r to-transparent" />
      </form>

      {enabledProviders.length > 0 ? (
        <div className="mt-6 grid gap-3">
          <p className="text-muted-foreground flex items-center gap-2.5 font-mono text-[9.5px] tracking-[0.2em] uppercase">
            <span aria-hidden="true" className="bg-login-line h-px flex-1" />
            <span>{t('login.orContinueWith')}</span>
            <span aria-hidden="true" className="bg-login-line h-px flex-1" />
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {enabledProviders.map((meta) => {
              const Icon = OAUTH_ICONS[meta.id]
              return (
                <Button
                  key={meta.id}
                  type="button"
                  variant="outline"
                  data-login-provider={meta.id}
                  onClick={() => toast.info(t('login.providerNotWired', { provider: meta.name }))}
                  className={cn(
                    'border-login-line text-muted-foreground h-auto rounded-[2px] py-2.5',
                    'font-mono text-[10px] tracking-[0.1em] uppercase',
                    'hover:border-login-accent hover:bg-login-accent/10 hover:text-login-accent',
                    'dark:border-login-line dark:bg-transparent',
                  )}
                >
                  <Icon className="size-3.5" />
                  {meta.name}
                </Button>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground mt-6 text-center font-mono text-[10px] tracking-[0.14em]">
          {t('login.noProviders')}
        </p>
      )}

      <div className="mt-6 grid gap-2">
        <Button asChild variant="link" className="text-muted-foreground h-auto p-0 font-mono text-[10px] tracking-[0.1em] uppercase">
          <Link to="/">{t('login.continueAnyway')}</Link>
        </Button>
        <p className="text-muted-foreground text-center font-mono text-[10px] tracking-[0.04em]">
          {t('login.footerNote')}
        </p>
      </div>
    </div>
  )
}
