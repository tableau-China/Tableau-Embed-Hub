import { useState, type ReactNode } from 'react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFormTouch } from '@/hooks/use-form-touch'
import {
  useOrgStore,
  usernameIssue,
  type OrgUser,
} from '@/stores/org-store'

/**
 * 本人自助的两个账号动作：**修改登录名** 与 **修改口令**。
 *
 * ## 两个消费方，一套表单
 *
 *   - 左下角用户菜单（`user-menu.tsx`）：点进去就弹窗，是最短的路径；
 *   - 个人资料页 `/profile`（`features/profile/profile-page.tsx`）：账号卡里内联展开。
 *
 * 因此本文件把**表单**（`UsernameForm` / `PasswordForm`）与**弹窗外壳**
 * （`ChangeUsernameDialog` / `ChangePasswordDialog`）拆开：表单负责字段、校验与落库，
 * 弹窗只是包了一层 `Dialog`。两处入口共用同一份校验，不会出现「弹窗里拦得住、页面里拦不住」。
 *
 * ## 为什么这两个动作不与 /users 的弹窗合并
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

/**
 * 表单提交成功后的回调（弹窗用它关窗，页面用它收起内联表单）。
 */
interface AccountFormProps {
  user: OrgUser
  onDone?: () => void
  /**
   * 操作按钮的落点 —— 让**调用方**决定按钮长在哪：
   *   - 弹窗：`<DialogFooter>`（底部通栏那条，主按钮靠右）；
   *   - 个人资料页：表单卡片自己的底部工具条。
   * 校验与落库留在表单内，按钮只是把 `submit` 递出去，所以两处行为天然一致。
   */
  footer?: (submit: () => void) => ReactNode
}

/* ============================== 修改登录名 ============================== */

/**
 * 修改登录名（本人自助，需校验当前口令）。
 *
 * 界面上把「为什么还要口令」说清楚：登录名一改，已发出的会话与历史业务数据的归属都跟着漂，
 * 因此这一步等同于一次敏感操作重新认证，不能只靠「浏览器里还开着这个页面」就放行。
 */
export function UsernameForm({ user, onDone, footer }: AccountFormProps) {
  const { t } = useTranslation()
  const users = useOrgStore((s) => s.users)
  const updateUser = useOrgStore((s) => s.updateUser)
  const form = useFormTouch<'username' | 'password'>()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

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
    setUsername('')
    setPassword('')
    toast.success(t('profile.usernameSaved'))
    onDone?.()
  }

  return (
    <>
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
      {footer?.(handleSubmit)}
    </>
  )
}

/* ============================== 修改口令 ============================== */

/** 弹窗改密表单字段（含当前口令） */
type PasswordDialogField = 'current' | 'next' | 'confirm'

/** 行内改密表单字段（不要求当前口令） */
type InlinePasswordField = 'next' | 'confirm'

/**
 * 修改口令（本人自助）。
 *
 * v0.14.5 起从「当前口令 + 新口令 + 确认」三段式改为**两步自助改密**：
 *   输入框里填新口令 → 点「Change password」→ `setOwnPassword()` 写时间戳。
 *
 * 为什么去掉当前口令与二次确认：
 *   - 页面 `/profile` 本身就是已登录会话内的本人操作，演示态下再验一次旧口令只是形式；
 *   - 二次确认的价值在于「口令不可见、怕打错」，而这里两个输入框（新口令 + 确认）
 *     仍然保留在展开区里 —— 真正被省略的只是「当前口令」。
 * 接后端时把 `setOwnPassword()` 换成 `PUT /api/me/password`，并在请求体里带上新口令即可；
 * 若后端要求旧口令，把 `current` 字段加回来（表单形状与校验逻辑都在本文件内，改动可控）。
 *
 * 口令**永不回显、也不进前端状态**：`setOwnPassword()` 只记 `passwordUpdatedAt`。
 */
export function PasswordForm({ user, onDone, footer }: AccountFormProps) {
  const { t } = useTranslation()
  const setOwnPassword = useOrgStore((s) => s.setOwnPassword)
  const form = useFormTouch<PasswordDialogField>()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showNext, setShowNext] = useState(false)

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

  const canSubmit =
    current !== '' && next.length >= PASSWORD_MIN && next === confirm && next !== current

  const handleSubmit = () => {
    form.submit()
    if (!canSubmit) {
      toast.error(t('profile.fixErrors'))
      return
    }
    setOwnPassword(user.id)
    form.reset()
    setCurrent('')
    setNext('')
    setConfirm('')
    toast.success(t('profile.passwordSaved'))
    onDone?.()
  }

  return (
    <>
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
      {footer?.(handleSubmit)}
    </>
  )
}

/**
 * 行内改密：**一个输入框 + 一个按钮**（`/profile` 用）。
 *
 * 与 `PasswordForm` 的区别只是排布，不是规则：
 *   - 不要求当前口令（页面本身就在已登录会话内，见 `PasswordForm` 注释）；
 *   - 仍然要求新口令 ≥ `PASSWORD_MIN` 位，且**两次输入一致**（第二框只在第一次输入后出现，
 *     避免空表单就摆两个密码框）；
 *   - 失败时不落库、按钮保持可点（点了才告诉你哪里不对），成功后才清空并收起。
 *
 * 为什么这里不做「当前口令」：这个组件的定位是「顺手换把钥匙」，
 * 需要严格鉴权的场景走弹窗形态 `ChangePasswordDialog`（那里仍要求当前口令）。
 */
export function InlinePasswordForm({
  user,
  onDone,
  footer,
}: AccountFormProps) {
  const { t } = useTranslation()
  const setOwnPassword = useOrgStore((s) => s.setOwnPassword)
  const form = useFormTouch<InlinePasswordField>()
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)

  const needConfirm = next.length > 0
  const nextIssue_: FieldIssue | null =
    next.length > 0 && next.length < PASSWORD_MIN
      ? { level: 'error', message: t('users.passwordTooShort') }
      : null
  const confirmIssue: FieldIssue | null =
    needConfirm && confirm !== '' && confirm !== next
      ? { level: 'error', message: t('users.passwordMismatch') }
      : null
  const canSubmit = next.length >= PASSWORD_MIN && confirm === next

  const handleSubmit = () => {
    form.submit()
    if (!canSubmit) {
      toast.error(t('profile.fixErrors'))
      return
    }
    setOwnPassword(user.id)
    form.reset()
    setNext('')
    setConfirm('')
    toast.success(t('profile.passwordSaved'))
    onDone?.()
  }

  return (
    <>
      <div className="flex max-w-xl flex-col gap-1">
        <div className="flex items-center gap-2">
          {/* 不显示「New password」标签：这一行只做一件事，标签是噪音 */}
          <FormField
            id="account-password-inline-next"
            className="min-w-0 flex-1"
            label=""
            issue={form.shows('next') ? nextIssue_ : null}
          >
            <InputGroup>
              <InputGroupInput
                id="account-password-inline-next"
                type={show ? 'text' : 'password'}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                onBlur={() => form.touch('next')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) handleSubmit()
                }}
                placeholder={t('profile.passwordPlaceholder', { count: PASSWORD_MIN })}
                aria-label={t('profile.changePassword')}
                autoComplete="new-password"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? t('smtp.hidePassword') : t('smtp.showPassword')}
                >
                  {show ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </FormField>

          {/* 确认框只在已输入口令时出现 —— 空状态只一个框，更紧凑 */}
          {needConfirm && (
            <FormField
              id="account-password-inline-confirm"
              className="min-w-0 flex-1"
              label=""
              issue={form.shows('confirm') ? confirmIssue : null}
            >
              <Input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onBlur={() => form.touch('confirm')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) handleSubmit()
                }}
                placeholder={t('profile.confirmPasswordPlaceholder')}
                aria-label={t('profile.confirmPasswordPlaceholder')}
                autoComplete="new-password"
              />
            </FormField>
          )}
          {/* 刻意不置灰：点不动就看不到「哪里不对」。点了才统一揭示校验信息 */}
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={handleSubmit}
            data-profile-action="change-password-submit"
          >
            {t('profile.changePassword')}
          </Button>
        </div>
      </div>
      {footer?.(handleSubmit)}
    </>
  )
}

/* ============================== 弹窗外壳 ============================== */

interface OwnAccountDialogProps {
  user: OrgUser
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 修改登录名：弹窗形态（左下角用户菜单用）。
 *
 * 关闭时卸载表单（`open &&`），下次打开就是干净的空白表单 —— 不需要再手工「切换用户时重置」，
 * 也避免了「上次没提交完的新登录名/口令残留在输入框里」的尴尬。
 */
export function ChangeUsernameDialog({
  user,
  open,
  onOpenChange,
}: OwnAccountDialogProps) {
  const { t } = useTranslation()
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
        {open && (
          <UsernameForm
            user={user}
            onDone={() => onOpenChange(false)}
            footer={(submit) => (
              <DialogFooter>
                <ActionButtons
                  cancelLabel={t('common.cancel')}
                  onCancel={() => onOpenChange(false)}
                  confirmLabel={t('common.save')}
                  onConfirm={submit}
                />
              </DialogFooter>
            )}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** 修改口令：弹窗形态（左下角用户菜单用） */
export function ChangePasswordDialog({
  user,
  open,
  onOpenChange,
}: OwnAccountDialogProps) {
  const { t } = useTranslation()
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
        {open && (
          <PasswordForm
            user={user}
            onDone={() => onOpenChange(false)}
            footer={(submit) => (
              <DialogFooter>
                <ActionButtons
                  cancelLabel={t('common.cancel')}
                  onCancel={() => onOpenChange(false)}
                  confirmLabel={t('common.save')}
                  onConfirm={submit}
                />
              </DialogFooter>
            )}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
