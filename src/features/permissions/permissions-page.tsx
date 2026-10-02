import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Info, Lock, RotateCcw, Search, Wand2, Zap } from 'lucide-react'

import { ActionButtons } from '@/components/action-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ACTION_CATALOG,
  LOCKED_ROLES,
  ROLE_KEYS,
  ROLE_LABEL_KEYS,
  ROLE_SCOPE_KEYS,
  ROUTE_CATALOG,
  applicableRoles,
  isAdminOnly,
  type NavGroup,
  type RoleKey,
  type RouteEntry,
} from '@/config/permissions'
import { useCurrentTeam } from '@/hooks/use-current-team'
import { useActor, usePermissionGrants } from '@/hooks/use-permissions'
import { hasPermission, isUngranted, matchingWildcard, wildcardsOf } from '@/lib/permissions'
import { TEAM_ROLE_LABEL_KEYS, useOrgStore } from '@/stores/org-store'
import { usePermissionStore } from '@/stores/permission-store'

/**
 * 权限页 `/permissions` —— 角色 × 路由的勾选矩阵（**授权体系的唯一操作入口**）。
 *
 * 数据源：ROLE_KEYS（列）× ROUTE_CATALOG（行）。因此「后期不同应用新增页面」
 * 只要在 ROUTE_CATALOG 登记一行，这里自动多出一行可勾选，无需改本文件。
 *
 * 三处提示语直接写在页面上，因为「谁在什么场景下被判定」是这套体系最容易搞错的地方：
 *   - 团队页面按**当前团队里的岗位**判定（同一个人在不同团队可以不同）；
 *   - 管理页按**全局身份**判定（member / 系统管理员）；
 *   - 新页面 fail-closed：没有 defaultRoles 的新页面默认只有系统管理员可见。
 *
 * 底座页面（required）与系统管理员列不可编辑 —— 规则写在 store 里，这里只做 UI 呈现，
 * 避免出现「把唯一入口关掉」的操作。
 *
 * **本页没有「保存」按钮**：勾选即写入 store 并持久化（zustand persist → localStorage），
 * 与 /profile、/config/smtp 那种「填表 + 保存」的页面语义不同。因此这里刻意只留两类按钮，且互不相似：
 *   1. 「补齐默认授权（N）」—— 仅在存在未授权页面时出现的**增量**操作（只加不减）；
 *   2. 「重置全部授权」—— 页尾的危险操作，带二次确认（整表拉回出厂默认）。
 * 两者都不叫 Save，位置与危险级别也不同，避免被误读成「其中一个是保存」。
 */

/** 分组 → i18n 标题 key（与侧边栏同源文案） */
const GROUP_LABEL_KEYS: Record<NavGroup, string> = {
  general: 'nav.general',
  ai: 'nav.aiGroup',
  settings: 'nav.settings',
  config: 'nav.config',
}

/** 分组 → 求值场景说明 key（AI 页是跨团队页面，按全局身份求值） */
const GROUP_SCOPE_KEYS: Record<NavGroup, string> = {
  general: 'permissions.noteTeam',
  ai: 'permissions.noteGlobal',
  settings: 'permissions.noteGlobal',
  config: 'permissions.noteGlobal',
}

const GROUPS: NavGroup[] = ['general', 'ai', 'settings', 'config']

export function PermissionsPage() {
  const { t } = useTranslation()
  const grants = usePermissionGrants()
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ROUTE_CATALOG.filter(
      (e) =>
        q === '' ||
        t(e.labelKey).toLowerCase().includes(q) ||
        e.key.toLowerCase().includes(q) ||
        e.to.toLowerCase().includes(q),
    )
  }, [query, t])

  // 「漏授权」缺口数（升级后新增页面 / 手工清空造成）：>0 时右上角才出现「补齐默认授权」。
  // 刻意排除 isAdminOnly 的路由（如 permissions 自身）—— 那是设计上只给系统管理员，
  // 算成缺口会让提示常驻并逼着人去点一个不该点的按钮。
  const ungrantedCount = ROUTE_CATALOG.filter(
    (e) => !isAdminOnly(e) && isUngranted(grants, e.key),
  ).length

  return (
    <div className="flex flex-col gap-6">
      <Header />

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>{t('permissions.matrixTitle')}</CardTitle>
              <CardDescription>{t('permissions.matrixSubtitle')}</CardDescription>
              {/* 明确「没有保存这一步」，避免把右上角的按钮误读成保存 */}
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Zap className="size-3.5 shrink-0" />
                {t('permissions.autoSaved')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('permissions.searchPlaceholder')}
                  className="h-8 w-56 pl-8"
                  data-perm-search
                />
              </div>
              {/* 增量操作：只在真的有「未授权页面」时出现，勾完即消失 → 不会与页尾的重置形成一对
                  看起来像「取消 + 保存」的按钮 */}
              {ungrantedCount > 0 && <FillDefaultsButton missing={ungrantedCount} />}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56 pl-6">{t('permissions.page')}</TableHead>
                  {ROLE_KEYS.map((role) => (
                    <TableHead key={role} className="min-w-36 align-top">
                      <RoleHeader role={role} />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {GROUPS.map((group) => {
                  const groupRows = rows.filter((e) => e.group === group)
                  if (groupRows.length === 0) return null
                  return [
                    <TableRow key={`group-${group}`} className="hover:bg-transparent">
                      <TableCell colSpan={ROLE_KEYS.length + 1} className="bg-muted/40 pl-6">
                        <span className="font-medium">{t(GROUP_LABEL_KEYS[group])}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {t(GROUP_SCOPE_KEYS[group])}
                        </span>
                      </TableCell>
                    </TableRow>,
                    ...groupRows.map((entry) => (
                      <PermissionRow
                        key={entry.key}
                        entry={entry}
                        ungranted={!isAdminOnly(entry) && isUngranted(grants, entry.key)}
                        adminOnly={isAdminOnly(entry)}
                      />
                    )),
                  ]
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={ROLE_KEYS.length + 1}
                      className="text-muted-foreground py-8 text-center"
                    >
                      {t('permissions.empty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PageFooter />
    </div>
  )
}

/** 页头：标题 + 说明 + 当前身份（便于切换身份后核对判定结果） */
function Header() {
  const { t } = useTranslation()
  const users = useOrgStore((s) => s.users)
  const currentUserId = useOrgStore((s) => s.currentUserId)
  const team = useCurrentTeam()
  const actor = useActor()
  const user = users.find((u) => u.id === currentUserId) ?? null
  const teamRole = actor.teamRole

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('permissions.title')}</CardTitle>
        <CardDescription>{t('permissions.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Info className="size-4 shrink-0" />
          <span>
            {t('permissions.currentActor', {
              name: user?.name ?? '—',
              role: t(user?.isSystemAdmin ? 'users.roleSuperAdmin' : 'users.roleMember'),
            })}
            {team && teamRole && (
              <>
                {' · '}
                {t('permissions.actorTeamRole', {
                  team: team.name,
                  role: t(TEAM_ROLE_LABEL_KEYS[teamRole]),
                })}
              </>
            )}
          </span>
        </div>
        <ul className="ml-6 list-disc space-y-1 text-xs">
          <li>{t('permissions.noteTeam')}</li>
          <li>{t('permissions.noteGlobal')}</li>
          <li>{t('permissions.noteNewPage')}</li>
        </ul>
      </CardContent>
    </Card>
  )
}

/**
 * 增量操作：按 ROUTE_CATALOG 的 defaultRoles 补齐默认授权（**只加不减**）。
 * 与「重置全部授权」的区别写在 title 提示里 —— 这是最容易混淆的一对操作：
 *   补齐 = 并集（手工多给的授权保留）；重置 = 出厂值（手工改动全丢）。
 */
function FillDefaultsButton({ missing }: { missing: number }) {
  const { t } = useTranslation()
  const applyDefaultRoles = usePermissionStore((s) => s.applyDefaultRoles)

  return (
    <Button
      variant="outline"
      size="sm"
      title={t('permissions.fillDefaultsHint')}
      data-perm-action="apply-defaults"
      onClick={() => {
        applyDefaultRoles()
        toast.success(t('permissions.fillDefaultsDone'))
      }}
    >
      <Wand2 className="size-3.5" />
      {t('permissions.fillDefaults', { missing })}
    </Button>
  )
}

/**
 * 页尾：危险操作区（重置全部授权）+ 按钮级权限的预留说明。
 * 重置不做成右上角的普通按钮 —— 它丢弃全部手工改动，必须与日常勾选在视觉上分开，
 * 并且二次确认（不然「两个 defaults 按钮」就真的像一对「取消 / 保存」了）。
 */
function PageFooter() {
  const { t } = useTranslation()
  const resetToDefaults = usePermissionStore((s) => s.resetToDefaults)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2">
        <p className="text-muted-foreground text-xs">
          {t('permissions.actionsReserved', { registered: ACTION_CATALOG.length })}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          data-perm-action="reset"
          onClick={() => setConfirmOpen(true)}
        >
          <RotateCcw className="size-3.5" />
          {t('permissions.resetAction')}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('permissions.resetTitle')}</DialogTitle>
            <DialogDescription>{t('permissions.resetMessage')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <ActionButtons
              cancelLabel={t('common.cancel')}
              onCancel={() => setConfirmOpen(false)}
              confirmLabel={t('permissions.resetConfirm')}
              confirmVariant="destructive"
              onConfirm={() => {
                resetToDefaults()
                setConfirmOpen(false)
                toast.success(t('permissions.resetDone'))
              }}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 角色列表头：角色名 + 求值场景 + 计数 + 整列操作 + 通配标签 */
function RoleHeader({ role }: { role: RoleKey }) {
  const { t } = useTranslation()
  const grants = usePermissionGrants()[role] ?? []
  const setRoleAllRoutes = usePermissionStore((s) => s.setRoleAllRoutes)
  const toggleGrant = usePermissionStore((s) => s.toggleGrant)
  const locked = LOCKED_ROLES.includes(role)
  const wildcards = wildcardsOf(grants)
  // 计数只统计「对该角色有意义」的行（团队岗位列不计管理页、member 列不计团队页），
  // 否则分母里的无关行会让读数失真，也看不出 fail-closed 的缺口。
  const relevant = ROUTE_CATALOG.filter((e) => applicableRoles(e).includes(role))
  const grantedCount = relevant.filter((e) => hasPermission(grants, e.key)).length

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{t(ROLE_LABEL_KEYS[role])}</span>
        {locked && <Lock className="text-muted-foreground size-3" />}
      </div>
      <span className="text-muted-foreground text-[11px] font-normal">
        {t(ROLE_SCOPE_KEYS[role])}
      </span>

      {locked ? (
        <span className="text-muted-foreground text-[11px] font-normal">
          {t('permissions.lockedRole')}
        </span>
      ) : (
        <>
          <span className="text-muted-foreground text-[11px] font-normal">
            {/* 参数名避开 i18next 的 count 复数约定（否则会去找 grantedCount_one/_other） */}
            {t('permissions.grantedCount', {
              granted: grantedCount,
              total: relevant.length,
            })}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="xs"
              data-perm-action={`select-all-${role}`}
              onClick={() => setRoleAllRoutes(role, true)}
            >
              {t('permissions.selectAll')}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              data-perm-action={`clear-${role}`}
              onClick={() => setRoleAllRoutes(role, false)}
            >
              {t('permissions.clear')}
            </Button>
          </div>
          {wildcards.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {wildcards.map((w) => (
                <Badge
                  key={w}
                  variant="secondary"
                  className="gap-1 font-mono text-[10px] font-normal"
                  title={t('permissions.wildcardHint')}
                >
                  {w}
                  <button
                    type="button"
                    className="hover:text-destructive"
                    aria-label={t('permissions.removeWildcard', { pattern: w })}
                    data-perm-wildcard-remove={`${role}:${w}`}
                    onClick={() => toggleGrant(role, w)}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** 一行 = 一个路由页面（左侧信息 + 每个角色一个勾选框） */
function PermissionRow({
  entry,
  ungranted,
  adminOnly,
}: {
  entry: RouteEntry
  /** 真缺口：目录声明了默认角色，但当前没人有权（升级后新增页面最常见） */
  ungranted: boolean
  /** 设计上只有系统管理员（defaultRoles 为空） */
  adminOnly: boolean
}) {
  const { t } = useTranslation()

  return (
    <TableRow>
      <TableCell className="pl-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{t(entry.labelKey)}</span>
          {entry.required && (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
              <Lock className="size-3" />
              {t('permissions.required')}
            </Badge>
          )}
          {adminOnly && (
            <Badge
              variant="secondary"
              className="text-[10px] font-normal"
              title={t('permissions.adminOnlyHint')}
            >
              {t('permissions.adminOnly')}
            </Badge>
          )}
          {ungranted && (
            <Badge variant="destructive" className="text-[10px] font-normal" title={t('permissions.ungrantedHint')}>
              {t('permissions.ungranted')}
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground font-mono text-[11px]">
          {entry.key} · {entry.to}
        </div>
      </TableCell>
      {ROLE_KEYS.map((role) => (
        <TableCell key={role} className="align-top">
          {applicableRoles(entry).includes(role) || LOCKED_ROLES.includes(role) ? (
            <PermissionCell role={role} entry={entry} />
          ) : (
            // 作用域不匹配的单元格（团队岗位列 × 管理页 / member 列 × 团队页）显示为「不适用」：
            // 勾了也不生效（求值场景不同），显示为可勾选只会误导。
            <span
              className="text-muted-foreground/40 pl-1"
              data-perm-na={`${role}:${entry.key}`}
              title={t('permissions.notApplicable')}
            >
              —
            </span>
          )}
        </TableCell>
      ))}
    </TableRow>
  )
}

/**
 * 单个勾选框。
 *
 * - 勾选态 = **有效授权**（含由通配继承来的），因此通配行也显示为已勾选；
 * - 由通配继承（而非逐条勾选）时旁边加一个琥珀色圆点 + title 说明，
 *   要细化就先在列头把通配标签去掉，再逐条勾；
 * - 底座页面与系统管理员列禁用（规则在 store 里，这里只是不给出入口）。
 *
 * `data-perm-role` / `data-perm-key`：供 scripts/check-permissions.mjs 精确定位单元格
 * （表格里同名的文本标签很多，按文本选择不可靠）。
 */
function PermissionCell({ role, entry }: { role: RoleKey; entry: RouteEntry }) {
  const { t } = useTranslation()
  const grants = usePermissionGrants()[role] ?? []
  const toggleGrant = usePermissionStore((s) => s.toggleGrant)

  const effective = hasPermission(grants, entry.key)
  const wildcard = matchingWildcard(grants, entry.key)
  const locked = LOCKED_ROLES.includes(role)
  const hint = locked
    ? t('permissions.lockedRole')
    : entry.required
      ? t('permissions.required')
      : wildcard
        ? t('permissions.inherited', { pattern: wildcard })
        : t('permissions.toggleHint')

  return (
    <span className="inline-flex items-center gap-1.5" title={hint}>
      <Checkbox
        checked={effective}
        disabled={locked || entry.required === true}
        data-perm-role={role}
        data-perm-key={entry.key}
        onCheckedChange={() => toggleGrant(role, entry.key)}
      />
      {wildcard && <span className="size-1.5 rounded-full bg-amber-500" title={hint} />}
    </span>
  )
}

/**
 * 动作（按钮级）权限的预留说明见 PageFooter（`permissions.actionsReserved`）：
 * 本次只落地路由层权限，模型与渲染已就绪 —— ACTION_CATALOG 一有登记，
 * 权限页就会在该页面行下面嵌出动作行（命名空间见 config/permissions.ts）。
 */
