import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * 表单通用件（FormGrid / FormField）—— 一个表单字段所需的样板在这里收口：
 *
 *   Label htmlFor + 控件 id、错误态的 aria-invalid、说明/错误的 aria-describedby、
 *   说明与错误共用一行位置（有错显错、无错显说明）、以及**可读宽度上限**。
 *
 * 用法（字段控件自己写在 FormField 里，`id` 由 FormField 注入，不必写两遍）：
 *
 * ```tsx
 * <FormGrid columns={2}>
 *   <FormField id="smtp-host" label={t('smtp.host')} hint={t('smtp.hostHint')} issue={hostIssue}>
 *     <Input value={draft.host} onChange={...} />
 *   </FormField>
 *   <FormField id="smtp-port" label={t('smtp.port')} className="md:col-span-1">
 *     <Input type="number" value={draft.port} onChange={...} />
 *   </FormField>
 * </FormGrid>
 * ```
 *
 * 约定：**只补空缺**。调用方若显式传了 `id` / `aria-invalid`（例如 Select 的 trigger），
 * 以调用方为准，不会被悄悄覆盖。
 */

/** 字段级问题：与 SMTP 预检清单同一套三态（error 拦保存 / warning 放行但提示） */
export interface FieldIssue {
  level: 'error' | 'warning'
  /** 已翻译好的文案（翻译在页面里做，本组件不碰 i18n） */
  message: string
}

/** 表单栅格：按列排布字段，并把整体宽度收在可读范围内（默认 768px） */
export function FormGrid({
  columns = 2,
  className,
  children,
}: {
  /** 1 = 单列；2 = sm 起两列；3 = sm 两列 / lg 三列；6 = md 起六列（配合 md:col-span-* 做不等宽行） */
  columns?: 1 | 2 | 3 | 6
  /** 需要覆盖默认宽度上限（如整行表格类输入）时传 max-w-none */
  className?: string
  children: ReactNode
}) {
  const cols = {
    1: 'grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    6: 'md:grid-cols-6',
  }[columns]

  return <div className={cn('grid max-w-3xl gap-4', cols, className)}>{children}</div>
}

/**
 * 单个表单字段：标签 + 控件 + 一行说明/错误。
 *
 * `layout="field"` 是设置页用的紧凑表单行：**标签与控件同一行**（标签在左、固定宽度），
 * **说明文字挂在控件下方**（与控件左边缘对齐）。相比「说明在左、控件在右」，
 * 说明不会再和输入框抢横向空间，长说明也不会把控件挤窄；相比 `inline`，
 * 它多了「说明 + 错误」的独立挂载位，不会让提示漂在行间。
 */
export function FormField({
  id,
  label,
  hint,
  issue,
  className,
  layout = 'stacked',
  injectProps = true,
  children,
}: {
  /** 控件 id：同时用作 label 的 htmlFor 与说明/错误的 id 前缀 */
  id: string
  label: string
  /** 常态说明（无 issue 时显示）；传 undefined 则不显示说明行 */
  hint?: ReactNode
  /** 当前问题：error 红字、warning 琥珀字；有值时取代 hint */
  issue?: FieldIssue | null
  className?: string
  /**
   * stacked = 标签在上、控件在下（默认，适合弹窗等窄容器）
   * inline  = 标签在左、控件在右（同一行，固定标签宽）
   * field   = 设置页紧凑行：标签与控件同一行，说明/错误挂在控件下方
   */
  layout?: 'stacked' | 'inline' | 'field'
  /**
   * 是否把 id / aria-* 注入到 children：默认 true（适配 `<Input>`、`<Textarea>` 这类
   * 会把 props 透传到真实 DOM 的控件）。复合控件（Select / InputGroup）传 false 自行接线。
   */
  injectProps?: boolean
  /** 控件本身（Input / Textarea / Select …） */
  children: ReactNode
}) {
  const message = issue ? issue.message : hint
  const messageId = `${id}-message`
  const control = injectProps
    ? withControlProps(children, {
        id,
        'aria-invalid': issue?.level === 'error' ? true : undefined,
        'aria-describedby': message === undefined || message === null ? undefined : messageId,
      })
    : children

  if (layout === 'field') {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div className={cn('flex items-center gap-3', label.trim() === '' && 'gap-0')}>
          {label.trim() !== '' && (
            <Label htmlFor={id} className="w-24 shrink-0 text-sm font-medium sm:w-32">
              {label}
            </Label>
          )}
          <div className="min-w-0 flex-1">{control}</div>
        </div>
        {/* 说明 / 错误统一挂在控件下方，与输入框左边缘对齐 */}
        {message !== undefined && message !== null && (
          <p
            id={messageId}
            data-field-message={id}
            data-field-level={issue ? issue.level : 'hint'}
            className={cn(
              'text-xs',
              label.trim() !== '' && 'pl-24 sm:pl-32',
              issue
                ? issue.level === 'error'
                  ? 'text-destructive'
                  : 'text-amber-600 dark:text-amber-500'
                : 'text-muted-foreground',
            )}
          >
            {message}
          </p>
        )}
      </div>
    )
  }

  if (layout === 'inline') {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div className="flex items-center gap-3">
          <Label htmlFor={id} className="w-32 shrink-0 sm:w-40">
            {label}
          </Label>
          <div className="min-w-0 flex-1">{control}</div>
        </div>
        {message !== undefined && message !== null && (
          <p
            id={messageId}
            data-field-message={id}
            data-field-level={issue ? issue.level : 'hint'}
            className={cn(
              'pl-32 text-xs sm:pl-40',
              issue
                ? issue.level === 'error'
                  ? 'text-destructive'
                  : 'text-amber-600 dark:text-amber-500'
                : 'text-muted-foreground',
            )}
          >
            {message}
          </p>
        )}
      </div>
    )
  }

  const hasLabel = label.trim() !== ''

  return (
    <div className={cn('grid gap-2', className)}>
      {hasLabel && <Label htmlFor={id}>{label}</Label>}
      {control}
      {message !== undefined && message !== null && (
        <p
          id={messageId}
          // 测试钩子：`[data-field-message="<id>"][data-field-level="error"]`
          // （check-smtp.mjs 用它断言字段级错误；泛型属性对任何使用 FormField 的表单都可用）
          data-field-message={id}
          data-field-level={issue ? issue.level : 'hint'}
          className={cn(
            'text-xs',
            issue
              ? issue.level === 'error'
                ? 'text-destructive'
                : 'text-amber-600 dark:text-amber-500'
              : 'text-muted-foreground',
          )}
        >
          {message}
        </p>
      )}
    </div>
  )
}

/**
 * 给控件补上缺失的 a11y 属性：**只补空缺** —— 调用方写死的 id / aria-* 一律尊重，不覆盖。
 *
 * 复合控件（Radix `Select` 的 Root、`InputGroup` 等）自己不落 DOM，把 id 塞给它们会丢在
 * 上下文层里，还会造成「Label 的 htmlFor 指向不存在的 id」。这类字段传 `injectProps={false}`，
 * 由调用方把 id / aria 显式写到真正的 DOM 节点上（见 /config/smtp 的加密方式下拉与密码输入框）。
 */
function withControlProps(
  children: ReactNode,
  injected: Record<string, unknown>,
): ReactNode {
  if (!isValidElement(children)) return children
  const element = children as ReactElement<Record<string, unknown>>
  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(injected)) {
    if (value !== undefined && element.props[key] === undefined) patch[key] = value
  }
  return cloneElement(element, patch)
}
