import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { Button, type ButtonProps } from '@/components/ui/button'

/**
 * 统一操作按钮（页面 / 弹窗通用，可反复使用）
 *
 * 约定：所有「保存 / 创建 / 取消 / 删除 / 关闭」类操作按钮一律经本文件渲染，
 * 保证位置与样式全局一致：
 * - ActionBar     —— 操作按钮容器：默认整体右对齐（sm 起水平排列靠右，窄屏纵向堆叠铺满）
 * - ActionButtons —— 标准「次要(取消) + 主操作」组合；主操作恒在最右，
 *                    删除类危险操作传 confirmVariant="destructive"，中性操作传 "outline"
 *
 * 使用示例（弹窗底部 / 页面表单底部）：
 *   <DialogFooter>
 *     <ActionButtons
 *       cancelLabel={t('common.cancel')} onCancel={() => onOpenChange(false)}
 *       confirmLabel={t('common.save')} onConfirm={handleSubmit}
 *     />
 *   </DialogFooter>
 */
export function ActionBar({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end',
        className,
      )}
    >
      {children}
    </div>
  )
}

export interface ActionButtonsProps {
  /** 次要按钮文案；不传则不渲染（单操作场景） */
  cancelLabel?: string
  onCancel?: () => void
  cancelDisabled?: boolean
  /** 主操作按钮文案（保存 / 创建 / 删除 / 关闭…） */
  confirmLabel: string
  onConfirm: () => void
  confirmDisabled?: boolean
  /** default=主要（保存/创建）；destructive=危险（删除）；outline=中性（关闭） */
  confirmVariant?: ButtonProps['variant']
  className?: string
}

/** 标准「取消 + 主操作」按钮对（主操作在最右，窄屏自动堆叠） */
export function ActionButtons({
  cancelLabel,
  onCancel,
  cancelDisabled = false,
  confirmLabel,
  onConfirm,
  confirmDisabled = false,
  confirmVariant = 'default',
  className,
}: ActionButtonsProps) {
  return (
    <ActionBar className={className}>
      {cancelLabel !== undefined && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={cancelDisabled}
        >
          {cancelLabel}
        </Button>
      )}
      <Button
        type="button"
        variant={confirmVariant}
        onClick={onConfirm}
        disabled={confirmDisabled}
      >
        {confirmLabel}
      </Button>
    </ActionBar>
  )
}
