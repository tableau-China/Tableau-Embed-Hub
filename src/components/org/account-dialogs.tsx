import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { Eye, EyeOff, KeyRound, UserRound } from 'lucide-react'

import { ActionButtons } from '@/components/action-bar'
import { FormField, type FieldIssue } from '@/components/form-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Input } from '@/components/ui/input'
import { useFormTouch } from '@/hooks/use-form-touch'
import {
  useOrgStore,
  usernameIssue,
  type OrgUser,
} from '@/stores/org-store'

/**
 * 左下角「个人信息」的两个自助动作：**修改登录名** 与 **修改口令**。
 *
 * ## 为什么这两个动作单独一个文件、且不与 /users 的弹窗合并
 *
 * `/users` 的 `UserFormDialog` / `ResetPasswordDialog` 是**管理员**动作：
 *   - 编辑别人时**不给改登录名**（登录名是账号主键口径，改一次历史归属全漂，见 `OrgUser.username`）；
 *   - 重置口令**不需要旧口令**（「这个人进不来了，给他换把钥匙」）。
 * 本人自助是另一套语义：**要校验当前口令**才能动自己的身份字段。
 * 合到一起会让「谁能改什么」这件事在 UI 上说不清，所以拆开。
 *
 * ## 口令边界（与 reset-password-dialog.tsx 同一口径）
 *
 * 演示态**不保存口令**：`updateUser({ username })` 只动登录名，
 * `setOwnPassword()` 只记一个 `passwordUpdatedAt` 时间戳 —— 明文口令永远不进前端状态
 * （localStorage 里的口令是最容易被抄进真实项目的坏示范）。接后端时把这两个动作内部换成
 * `PUT /api/me/username`（`{ password }`）与 `PUT /api/me/password`（`{ old, new }`）即可，
 * 本文件的表单形状不用改。
 */

/** 登录名最短长度（与 org-store 的 USERNAME_PATTERN 下界一致） */
const USERNAME_MIN = 2
/** 登录名最长长度（同上，与 USERNAME_PATTERN 上界一致） */
const USERNAME_MAX = 64
/** 口令最短长度（与 /users 建号、管理员重置同一口径） */
const PASSWORD_MIN = 8

interface OwnAccountDialogProps {
  user: OrgUser
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 修改登录名（本人自助，需校验当前口令）。
 *
 * 界面上把「为什么还要口令」说清楚：登录名一改，已发出的会话与历史业务数据的归属都跟着漂，
 * 因此这一步等同于一次敏感操作重新认证，不能只靠「浏览器里还开着这个页面」就放行。
 */
export function ChangeUsernameDialog({
  user,
  open,
  onOpenChange,
}: OwnAccountDialogProps) {
  const { t } = useTranslation()
  const users = useOrgStore((s) => s.users)
  const updateUser = useOrgStore((s) => s.updateUser)
  const form = useFormTouch<'username' | 'password'>()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // 打开（或切换目标用户）时重置表单：与 user-dialogs.tsx / reset-password-dialog.tsx
  // 同一套「渲染期派生」写法（不触发级联渲染，也不违反 set-state-in-effect）。
  const [syncedFor, setSyncedFor] = useState<number | null>(null)
  if (open && syncedFor !== user.id) {
    setSyncedFor(user.id)
    setUsername('')
    setPassword('')
  }
  if (!open && syncedFor !== null) setSyncedFor(null)

  const trimmed = username.trim()
  // 排除自己：登录名唯一性是「与他人不重名」，自己保留原值不算占用
  const problem = usernameIssue(trimmed, users, user.id)
  const usernameIssue_: FieldIssue | null =
    trimmed === ''
      ? { level: 'error', message: t('users.usernameRequired') }
      : problem === 'charset'
        ? { level: 'error', message: t('users.usernameInvalid') }
        : problem === 'taken'
          ? { level: 'error', message: t('users.usernameTaken') }
          : null
  const passwordIssue: FieldIssue | null =
    password === ''
      ? { level: 'error', message: t('profile.currentPasswordRequired') }
      : null

  const handleSubmit = () => {
    form.submit()
    if (usernameIssue_ !== null || passwordIssue !== null) {
      toast.error(t('profile.fixErrors'))
      return
    }
    try {
      updateUser(user.id, { username: trimmed })
    } catch (error) {
      // store 里对登录名唯一性也兜了底（大小写不敏感）。走到这里说明上面那道漏了 ——
      // 原样把原因抛出来，不要静默吞掉（吞掉会表现成「点了保存，什么都没发生」）。
      toast.error(error instanceof Error ? error.message : t('users.usernameTaken'))
      return
    }
    form.reset()
    toast.success(t('profile.usernameSaved'))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="size-4" />
            {t('profile.changeUsernameTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('profile.changeUsernameHint')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField
            id="account-username"
            label={t('users.username')}
            hint={t('users.usernameInvalid')}
            issue={form.shows('username') ? usernameIssue_ : null}
          >
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => form.touch('username')}
              placeholder={user.username}
              autoComplete="username"
              spellCheck={false}
              minLength={USERNAME_MIN}
              maxLength={USERNAME_MAX}
            />
          </FormField>
          <FormField
            id="account-current-password"
            label={t('profile.currentPassword')}
            hint={t('profile.currentPasswordHint')}
            issue={form.shows('password') ? passwordIssue : null}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => form.touch('password')}
              placeholder={t('users.passwordPlaceholder')}
              autoComplete="current-password"
            />
          </FormField>
        </div>
        <DialogFooter>
          <ActionButtons
            cancelLabel={t('common.cancel')}
            onCancel={() => onOpenChange(false)}
            confirmLabel={t('common.save')}
            onConfirm={handleSubmit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 改密表单字段（决定 useFormTouch 的字段联合类型） */
type PasswordField = 'current' | 'next' | 'confirm'

/**
 * 修改口令（本人自助，需校验当前口令 + 新口令两次输入）。
 *
 * 界面上说清两件真实系统里成立、演示态做不到的事：
 *   1. **改密后旧会话失效** —— 演示态没有会话，这句话是给接后端的人留的行为说明；
 *   2. **口令不回显** —— 演示态只记 `passwordUpdatedAt`，任何人都（包括本人）看不到口令本身。
 * 新口令输入框右侧的眼睛按钮复用 /config/smtp 的做法（InputGroup + inline-end addon）。
 */
export function ChangePasswordDialog({
  user,
  open,
  onOpenChange,
}: OwnAccountDialogProps) {
  const { t } = useTranslation()
  const setOwnPassword = useOrgStore((s) => s.setOwnPassword)
  const form = useFormTouch<PasswordField>()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showNext, setShowNext] = useState(false)

  const [syncedFor, setSyncedFor] = useState<number | null>(null)
  if (open && syncedFor !== user.id) {
    setSyncedFor(user.id)
    setCurrent('')
    setNext('')
    setConfirm('')
  }
  if (!open && syncedFor !== null) setSyncedFor(null)

  const currentIssue: FieldIssue | null =
    current === '' ? { level: 'error', message: t('profile.currentPasswordRequired') } : null
  const nextIssue: FieldIssue | null =
    next.length > 0 && next.length < PASSWORD_MIN
      ? { level: 'error', message: t('users.passwordTooShort') }
      : next !== '' && next === current
        ? { level: 'warning', message: t('profile.passwordSameAsCurrent') }
        : null
  const confirmIssue: FieldIssue | null =
    next !== '' && confirm !== '' && confirm !== next
      ? { level: 'error', message: t('users.passwordMismatch') }
      : null

  const handleSubmit = () => {
    form.submit()
    if (current === '' || next.length < PASSWORD_MIN || next !== confirm) {
      toast.error(t('profile.fixErrors'))
      return
    }
    setOwnPassword(user.id)
    form.reset()
    toast.success(t('profile.passwordSaved'))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            {t('profile.changePasswordTitle')}
          </DialogTitle>
          <DialogDescription>{t('profile.changePasswordHint')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField
            id="account-password-current"
            label={t('profile.currentPassword')}
            hint={t('profile.currentPasswordHint')}
            issue={form.shows('current') ? currentIssue : null}
          >
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              onBlur={() => form.touch('current')}
              autoComplete="current-password"
            />
          </FormField>

          <FormField
            id="account-password-next"
            label={t('users.newPassword')}
            hint={t('profile.passwordMinHint', { count: PASSWORD_MIN })}
            issue={form.shows('next') ? nextIssue : null}
          >
            <InputGroup>
              <InputGroupInput
                id="account-password-next"
                type={showNext ? 'text' : 'password'}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                onBlur={() => form.touch('next')}
                autoComplete="new-password"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  onClick={() => setShowNext((v) => !v)}
                  aria-label={showNext ? t('smtp.hidePassword') : t('smtp.showPassword')}
                >
                  {showNext ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </FormField>

          <FormField
            id="account-password-confirm"
            label={t('users.confirmPassword')}
            hint={t('profile.passwordConfirmHint')}
            issue={form.shows('confirm') ? confirmIssue : null}
          >
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onBlur={() => form.touch('confirm')}
              autoComplete="new-password"
            />
          </FormField>
        </div>
        <DialogFooter>
          <ActionButtons
            cancelLabel={t('common.cancel')}
            onCancel={() => onOpenChange(false)}
            confirmLabel={t('common.save')}
            onConfirm={handleSubmit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
