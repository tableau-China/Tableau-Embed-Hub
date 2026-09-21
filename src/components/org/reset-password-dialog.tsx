import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'

import { ActionButtons } from '@/components/action-bar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrgStore, type OrgUser } from '@/stores/org-store'

interface ResetPasswordDialogProps {
  user: OrgUser
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 重置口令对话框（管理员操作）。
 *
 * 三件事是刻意的：
 *  1. **不需要旧口令** —— 管理员重置不是「改密」，是「这个人进不来了，给他换一把钥匙」。
 *     要求旧口令等于要求管理员知道对方的私人口令，那就不是重置了。
 *     本人自助改密是另一个接口（要校验旧口令），不要合并成一个；
 *  2. **两次输入 + 最短长度** —— 口令在界面上不可见，敲错一个字符的后果是本人登录不上，
 *     而管理员无法自查（页面对任何人都永不回显口令）；长度下限与后端保持一致；
 *  3. **明说会话会失效** —— 真实系统里改口令即让旧会话作废（本模板接后端时，
 *     服务端拦截器每次请求都核对账号，改密立即生效）。不写清楚，管理员会以为
 *     「我改完了但你那边还登着」。
 *
 * **口令不进前端状态**：演示态的 `setUserPassword()` 只记录一个时间戳，不保存口令本身 ——
 * 把明文口令写进 localStorage 是最容易被抄进真实项目的一段坏示范。
 * 接后端时把该动作换成 `PUT /api/users/{id}/password` 即可，本文件无需改动。
 */
export function ResetPasswordDialog({ user, open, onOpenChange }: ResetPasswordDialogProps) {
  const { t } = useTranslation()
  const setUserPassword = useOrgStore((s) => s.setUserPassword)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  // 每次打开都把上一次的输入清掉：口令留在输入框里、下一次误点确认，是个真实的误操作路径
  const [syncedFor, setSyncedFor] = useState<number | null>(null)
  if (open && syncedFor !== user.id) {
    setSyncedFor(user.id)
    setPassword('')
    setConfirm('')
  }
  if (!open && syncedFor !== null) {
    setSyncedFor(null)
  }

  const handleSubmit = () => {
    if (password.length < 8) {
      toast.error(t('users.passwordTooShort'))
      return
    }
    if (password !== confirm) {
      toast.error(t('users.passwordMismatch'))
      return
    }
    setUserPassword(user.id)
    toast.success(t('users.resetDone'))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            {t('users.resetPasswordTitle')}
          </DialogTitle>
          <DialogDescription>{t('users.resetPasswordHint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {t('users.resetPasswordConfirm', { name: user.name })}
          </p>
          <div className="grid gap-2">
            <Label htmlFor="reset-password">{t('users.newPassword')}</Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('users.passwordPlaceholder')}
              autoComplete="new-password"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reset-password-confirm">{t('users.confirmPassword')}</Label>
            <Input
              id="reset-password-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t('users.passwordPlaceholder')}
              autoComplete="new-password"
            />
          </div>
        </div>
        <DialogFooter>
          <ActionButtons
            cancelLabel={t('common.cancel')}
            onCancel={() => onOpenChange(false)}
            confirmLabel={t('users.resetPassword')}
            onConfirm={handleSubmit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
