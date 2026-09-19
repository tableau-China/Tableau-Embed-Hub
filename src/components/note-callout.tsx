import type { ReactNode } from 'react'
import { Info, ShieldAlert } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * 提示块（NoteCallout）—— 页面里的「说明 / 注意事项」统一用它的观感。
 *
 * 两种语气：
 *   info    —— 中性说明（灰底 + Info 图标），例如「这一页的检查在浏览器里跑」
 *   warning —— 需要留意的边界 / 风险（灰底 + 警示图标 + destructive 标题），例如「密码不落盘」
 *
 * 长段落请只包一层：`<NoteCallout ...><p className="text-muted-foreground max-w-prose">…</p></NoteCallout>`
 * —— 提示块本身跟随卡片铺满宽度，正文用 `max-w-prose` 控制每行字数。
 */
export function NoteCallout({
  tone = 'info',
  title,
  icon,
  className,
  children,
}: {
  tone?: 'info' | 'warning'
  title: ReactNode
  /** 自定义图标（不传则按 tone 取默认图标） */
  icon?: ReactNode
  className?: string
  children?: ReactNode
}) {
  const Icon = tone === 'warning' ? ShieldAlert : Info

  return (
    <div
      className={cn(
        'bg-muted/40 flex flex-col gap-2 rounded-lg border p-3 text-xs',
        className,
      )}
      data-note-tone={tone}
    >
      <span
        className={cn(
          'flex items-center gap-1.5 font-medium',
          tone === 'warning' && 'text-destructive',
        )}
      >
        {icon ?? <Icon className="size-3.5 shrink-0" />}
        {title}
      </span>
      {children}
    </div>
  )
}
