import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * 键值摘要（DescriptionList）—— 「标签 + 值」型信息的通用呈现（关于页的开发者/版本、
 * 详情面板的元信息、配置摘要等都适用），省掉每个页面各写一遍 `<dl>` 与间距。
 *
 * 与表单栅格同一套宽度约定：**默认收在 768px**（值多为短文本，铺满整屏反而不好扫读），
 * 需要铺满时传 `className="max-w-none"`。
 */
export interface DescriptionItem {
  label: string
  /** 值可以是链接、徽章等任意节点 */
  value: ReactNode
  /** 值前面可选的小图标 */
  icon?: ReactNode
}

export function DescriptionList({
  items,
  columns = 2,
  className,
}: {
  items: readonly DescriptionItem[]
  /** 列数（sm 起生效；1 = 单列） */
  columns?: 1 | 2 | 3
  className?: string
}) {
  const cols = { 1: 'grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' }[columns]

  return (
    <dl className={cn('grid max-w-3xl gap-3', cols, className)}>
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">{item.label}</dt>
          <dd className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            {item.icon}
            {/* break-all：网址/版本这类无空格长串在窄列里换行，而不是把列顶宽 */}
            <span className="min-w-0 break-all">{item.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
