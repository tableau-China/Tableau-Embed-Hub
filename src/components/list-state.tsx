import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2, SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 列表异步状态外壳（**全站共用**：加载 / 失败 / 空）
 *
 * 存在的理由：每个列表页都要写「转圈 → 出错给重试 → 没数据给一句话」，而这三段的
 * 观感与可访问性最容易各写各的（有人给 spinner、有人给骨架屏；有人给重试按钮、
 * 有人只报错）。抽成一处后，新增页面只需把查询状态交进来。
 *
 * 三条约束：
 *  1. **只认 TanStack Query 的 status**（'pending' | 'error' | 'success'）—— 传别家的
 *     状态枚举进来会让"加载中"判定出现第二套口径；
 *  2. **empty 只表示「未筛选时一条都没有」**。被筛选筛空是**第三种**空态，文案不同
 *     （要说清是筛选造成的，并给"重置筛选"出口），由页面自己渲染 —— 别塞进来，
 *     否则「重置筛选」按钮会出现在"数据源本来就是空"的场景里（点了也没用）；
 *  3. **不接收 error 对象**：错误详情（Tableau 的状态码/文案）只有页面知道该怎么解释，
 *     这里只负责"出错了 + 要不要重试"。
 *
 * 与 guard-card.tsx 的分工：GuardCard 是**整页**的无权限/未找到兜底（带页面外壳），
 * 这里只管卡片内部的一块列表区域。
 */
export interface ListStateProps {
  status: 'pending' | 'error' | 'success'
  /** 未筛选时是否一条数据都没有 */
  isEmpty?: boolean
  /** 空态文案（默认「Nothing to show」）；筛选空态不要用它 */
  emptyMessage?: ReactNode
  /** 失败标题（默认「Failed to load」） */
  errorTitle?: ReactNode
  /** 失败说明（把 error.message / 排错提示写在这里） */
  errorHint?: ReactNode
  onRetry?: () => void
  retryLabel?: string
  /** 加载态的外层高度（默认 py-10） */
  loadingClassName?: string
  /**
   * 列表内容。**可选**：只有 status='success' 且非空时才渲染，
   * 加载/失败/空三个分支都用不到它（预览页正是靠这一点展示四种状态）。
   */
  children?: ReactNode
}

export function ListState({
  status,
  isEmpty = false,
  emptyMessage,
  errorTitle,
  errorHint,
  onRetry,
  retryLabel,
  loadingClassName,
  children,
}: ListStateProps) {
  const { t } = useTranslation()

  if (status === 'pending') {
    return (
      <div
        data-list-state="loading"
        className={cn('flex items-center justify-center py-10', loadingClassName)}
      >
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">{t('listState.loading')}</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div
        data-list-state="error"
        className="flex flex-col items-center gap-2 py-10 text-center"
      >
        <AlertCircle className="size-6 text-destructive" aria-hidden />
        <p className="font-medium text-destructive">{errorTitle ?? t('listState.error')}</p>
        {errorHint && <p className="max-w-md text-sm text-muted-foreground">{errorHint}</p>}
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel ?? t('listState.retry')}
          </Button>
        )}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div
        data-list-state="empty"
        className="flex flex-col items-center gap-2 py-10 text-center"
      >
        <SearchX className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{emptyMessage ?? t('listState.empty')}</p>
      </div>
    )
  }

  return <>{children}</>
}
