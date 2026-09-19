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

/** 单个表单字段：标签 + 控件 + 一行说明/错误 */
export function FormField({
  id,
  label,
  hint,
  issue,
  className,
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

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
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
