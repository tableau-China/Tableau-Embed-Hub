import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * 页面根容器（**所有页面统一用它**）
 *
 * 定义页面级的纵向节奏（`gap-6`），并作为「页面宽度约定」的唯一落点：
 *
 * - **页面铺满内容区** —— 与 /users、/teams 等页面一致，**不要**在这里加 `max-w-*`：
 *   一旦某个页面self缩成窄栏，同一套导航下就会出现两种页面宽度（用户会立刻看出来）。
 * - **窄栏加在「内容块」上** —— 表单用 `<FormGrid>`（默认 max-w-3xl），
 *   键值摘要用 `<DescriptionList>`，长段落用 `max-w-prose`。
 *   输入框/段落有可读宽度上限，卡片与页面本身仍然对齐。
 *
 * 新增页面时第一个写的元素就是它 —— 这样「页面宽度」不再依赖每个页面的记忆。
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn('flex flex-col gap-6', className)}>{children}</div>
}
