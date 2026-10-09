import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ActionButtons } from '@/components/action-bar'
import { FormField } from '@/components/form-field'
import { NoteCallout } from '@/components/note-callout'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  SITE_ROLE_HINT_KEYS,
  TABLEAU_SITE_ROLES,
  isTableauSiteRole,
  siteRoleFailureKey,
} from '@/lib/tableau-site-roles'
import { TableauApiError } from '@/lib/tableau-rest'
import {
  SITE_USERS_QUERY_KEY,
  updateSiteUserRole,
  type TableauSiteUser,
} from '@/lib/tableau-users-api'
import { useSiteRoleLabel } from '@/features/tableau/use-site-role-label'

/**
 * 修改 Tableau **站点角色**（唯一会写 Tableau 的入口）
 *
 * 为什么必须二次确认：站点角色直接决定许可证席位（Creator/Explorer/Viewer 是不同价格的
 * 席位，Unlicensed 则完全登不进来），改错人的代价是"某人的分析突然打不开"或"多占一个席位"。
 * 所以这里刻意不用表格内联下拉：一次点击就改生产权限太轻了。
 *
 * 成功后不做乐观更新，而是等列表重新取回 —— 服务端可能因为席位不足拒绝（409014），
 * 先显示成功再回滚会让管理员误以为已经改好。
 */
export interface ChangeSiteRoleDialogProps {
  user: TableauSiteUser
  onOpenChange: (open: boolean) => void
}

/**
 * 由调用方**按 user.id 作 key 挂载**（`{editing && <ChangeSiteRoleDialog key={editing.id} …/>}`）：
 * 每次打开都是一次全新挂载，草稿状态直接用 props 初始化即可 ——
 * 不需要 useEffect 同步（在 effect 里 setState 会多一轮渲染，react-hooks 规则也会报错）。
 */
export function ChangeSiteRoleDialog({ user, onOpenChange }: ChangeSiteRoleDialogProps) {
  const { t } = useTranslation()
  const roleLabel = useSiteRoleLabel()
  const queryClient = useQueryClient()
  const [next, setNext] = useState(user.siteRole)

  const mutation = useMutation({
    mutationFn: (siteRole: string) => updateSiteUserRole(user.id, siteRole),
    onSuccess: async (_data, siteRole) => {
      await queryClient.invalidateQueries({ queryKey: SITE_USERS_QUERY_KEY })
      toast.success(
        t('tableauUsers.roleChanged', {
          name: user.fullName,
          role: roleLabel(siteRole),
        }),
      )
      onOpenChange(false)
    },
    onError: (error) => {
      // 只把状态码与 Tableau 业务码交给映射表：detail 会被站点语言本地化，不能拿来分流
      const failure =
        error instanceof TableauApiError ? { status: error.status, code: error.code } : {}
      toast.error(t(siteRoleFailureKey(failure)))
    },
  })

  // 站点上可能存在目录外的角色：把它作为一个选项原样带上，否则受控 Select 会显示成空白
  const options: { value: string; label: string }[] = TABLEAU_SITE_ROLES.map((role) => ({
    value: role,
    label: roleLabel(role),
  }))
  if (user.siteRole !== '' && !isTableauSiteRole(user.siteRole)) {
    options.unshift({ value: user.siteRole, label: roleLabel(user.siteRole) })
  }

  const hint = isTableauSiteRole(next) ? t(SITE_ROLE_HINT_KEYS[next]) : undefined
  const unchanged = next === user.siteRole

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // 提交中不允许关掉：请求已经发出去，关掉弹窗不会撤销它，只会让人以为没生效
        if (!mutation.isPending) onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('tableauUsers.changeRoleTitle')}</DialogTitle>
          <DialogDescription>
            {t('tableauUsers.changeRoleBody', { name: user.fullName })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FormField
            id="site-role-select"
            label={t('tableauUsers.newRole')}
            hint={hint}
            injectProps={false}
          >
            <Select value={next} onValueChange={setNext} disabled={mutation.isPending}>
              <SelectTrigger
                id="site-role-select"
                className="w-full"
                aria-label={t('tableauUsers.newRole')}
                aria-describedby="site-role-select-message"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {next === 'Unlicensed' && (
            <NoteCallout tone="warning" title={t('tableauUsers.unlicensedWarning')} />
          )}
        </div>

        <DialogFooter>
          <ActionButtons
            cancelLabel={t('common.cancel')}
            cancelDisabled={mutation.isPending}
            onCancel={() => onOpenChange(false)}
            confirmLabel={t('tableauUsers.confirm')}
            confirmDisabled={mutation.isPending || unchanged}
            onConfirm={() => mutation.mutate(next)}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
