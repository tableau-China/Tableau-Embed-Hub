import type { ReactNode } from 'react'

import type { FieldIssue } from '@/components/form-field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * 「纸上语言」的表单字段（登录页专用，唯一使用方是 `login-form.tsx`）。
 *
 * 设计稿把输入框画成**只有一条下划线**：没有盒子、没有圆角；聚焦时下划线从左向右长出来
 * （设计稿 `.f .grow` 的 `scaleX(0→1)`，450ms），右端那颗 5px 方块同时变强调色。
 * 标签用 mono 小字、大写、宽字距 —— 制图标注的观感。
 *
 * 为什么不在后台通用件（`components/form-field.tsx`）里加开关：那是另一套语言
 * （Label + 盒子 + `text-destructive` 说明行），服务的是后台表单；登录页是**裸布局**页面，
 * 不参与后台表单约定。两套语言各自收口，比在一个组件里塞 `variant` 更好读。
 *
 * 仍然是 shadcn `Input` 承载体（保留 `data-slot="input"`、disabled / aria 行为），
 * 只用 `cn` 把盒子那一套（圆角、四边框、ring、固定高度）覆盖掉 —— 覆盖清单集中在下面一处。
 */
export function PaperField({
  id,
  label,
  issue,
  type = 'text',
  value,
  onChange,
  onBlur,
  autoComplete,
  placeholder,
  suffix,
}: {
  id: string
  label: string
  /** 字段级问题（与后台表单同一套 `FieldIssue` 三态） */
  issue?: FieldIssue | null
  type?: 'text' | 'password'
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  autoComplete?: string
  placeholder?: string
  /** 输入框右侧的附加块（如验证码的占位图形）；有值时不参与下划线宽度 */
  suffix?: ReactNode
}) {
  const messageId = `${id}-message`

  return (
    <div className="group grid gap-[7px]">
      <label
        htmlFor={id}
        className="text-muted-foreground font-mono text-[9.5px] tracking-[0.2em] uppercase"
      >
        {label}
      </label>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Input
            id={id}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            autoComplete={autoComplete}
            placeholder={placeholder}
            aria-invalid={issue?.level === 'error' ? true : undefined}
            aria-describedby={issue ? messageId : undefined}
            className={cn(
              // 盒子 → 下划线：圆角、四边框、固定高度、内阴影全部交还给设计稿的取值
              'h-auto rounded-none border-0 border-b border-login-line bg-transparent px-0.5 pt-[9px] pb-[10px]',
              'text-[15px] tracking-[0.02em] shadow-none md:text-[15px]',
              'placeholder:text-muted-foreground',
              // 聚焦不画 ring（强调交给下面那条会长出来的线）
              'focus-visible:border-login-line focus-visible:ring-0',
              'aria-invalid:ring-0 dark:bg-transparent',
            )}
          />
          {/* 聚焦时长出来的强调线（设计稿 .grow） */}
          <span
            aria-hidden="true"
            className="bg-login-accent absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 transition-transform duration-[450ms] ease-[cubic-bezier(.22,.61,.36,1)] group-focus-within:scale-x-100 motion-reduce:transition-none"
          />
          {/* 右端方块标记（设计稿 .mark）：聚焦变强调色 */}
          <span
            aria-hidden="true"
            className="bg-login-line-strong group-focus-within:bg-login-accent absolute right-0 bottom-[9px] size-[5px] transition-colors duration-300 motion-reduce:transition-none"
          />
        </div>
        {suffix}
      </div>

      {issue && (
        <p
          id={messageId}
          // 与后台表单同一个测试钩子口径：`[data-field-message="<id>"][data-field-level="error"]`
          data-field-message={id}
          data-field-level={issue.level}
          className="text-login-warn font-mono text-[11px] tracking-[0.04em]"
        >
          {issue.message}
        </p>
      )}
    </div>
  )
}
