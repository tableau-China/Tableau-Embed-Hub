import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Info, RefreshCw, SearchX, ShieldAlert } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FilterBar, FilterSearch, FilterSelect } from '@/components/filter-bar'
import { ListState } from '@/components/list-state'
import { NoteCallout } from '@/components/note-callout'
import { PageContainer } from '@/components/page-container'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TABLEAU_CONFIG } from '@/config/tableau'
import { useListFilters } from '@/hooks/use-list-filters'
import { TABLEAU_SITE_ROLES, isTableauSiteRole } from '@/lib/tableau-site-roles'
import {
  findSignedInUser,
  siteUsersQueryOptions,
  type TableauSiteUser,
} from '@/lib/tableau-users-api'
import { formatDateTime } from '@/lib/utils'
import { ChangeSiteRoleDialog } from '@/features/tableau/change-site-role-dialog'
import { SiteRoleBadge } from '@/features/tableau/site-role-badge'
import { useSiteRoleLabel } from '@/features/tableau/use-site-role-label'

/**
 * Tableau **站点用户与角色**页（/t/{slug}/tableau/users）
 *
 * 与 /users 的分工（两者看名字容易混，这里写清楚）：
 *   · /users      —— 本应用自己的账号（演示态存在 localStorage，接后端时换 store 实现）；
 *   · 本页        —— **Tableau Cloud 站点上的用户**，数据来自 REST API，角色改动写回 Tableau。
 *   两者没有同步关系：本页刻意不镜像到本地（见 lib/tableau-users-api.ts 顶部）。
 *
 * 只读 + 一次写：唯一的写操作是"改站点角色"，且必须二次确认（见 change-site-role-dialog）。
 */

/** 筛选默认值（同时是「重置」的目标值，模块级常量 —— 见 docs/ui-conventions.md §5） */
interface UserFilterValues extends Record<string, string> {
  q: string
  role: string
}

const FILTER_DEFAULTS: UserFilterValues = { q: '', role: 'all' }

function initialsOf(user: TableauSiteUser): string {
  const source = user.fullName || user.name
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase()
}

export function TableauUsersPage() {
  const { t } = useTranslation()
  const roleLabel = useSiteRoleLabel()
  const query = useQuery(siteUsersQueryOptions())
  const filters = useListFilters(FILTER_DEFAULTS)
  const [editing, setEditing] = useState<TableauSiteUser | null>(null)

  // 用 useMemo 稳定引用：`query.data?.users ?? []` 每次渲染都会造一个新数组，
  // 直接进下游 useMemo 的依赖会让筛选每次渲染都重算（react-hooks 也会提示）
  const users = useMemo(() => query.data?.users ?? [], [query.data])
  const signedIn = findSignedInUser(users, query.data?.signedInUserId, TABLEAU_CONFIG.embedUser)

  /**
   * 筛选口径（唯一一处）：
   *   · 关键词：登录名 / 展示名 / 邮箱 三者任一包含匹配（大小写不敏感、去首尾空格）——
   *     管理员找一个用户时想到的可能是邮箱（登录名）也可能是人名（展示名）；
   *   · 角色：精确匹配 Tableau 的原文取值。
   */
  const visibleUsers = useMemo(() => {
    const needle = filters.values.q.trim().toLowerCase()
    return users.filter((user) => {
      if (needle !== '') {
        const haystack = [user.name, user.fullName, user.email ?? ''].map((v) => v.toLowerCase())
        if (!haystack.some((value) => value.includes(needle))) return false
      }
      if (filters.values.role !== 'all' && user.siteRole !== filters.values.role) return false
      return true
    })
  }, [users, filters.values.q, filters.values.role])

  /**
   * 角色下拉选项 = 本应用目录里的可分配角色 + 数据里出现过的目录外角色。
   * 后者必须带上：站点上可能还有旧角色（ExplorerCanPublish）或 Server 专有角色，
   * 缺了它们，"按角色筛"就漏人，用户会以为列表少了一行。
   */
  const roleOptions = (() => {
    const known = TABLEAU_SITE_ROLES.map((role) => ({ value: role, label: roleLabel(role) }))
    const extra = [...new Set(users.map((user) => user.siteRole))]
      .filter((role) => role !== '' && !isTableauSiteRole(role))
      .map((role) => ({ value: role, label: roleLabel(role) }))
    return [...known, ...extra]
  })()

  return (
    <PageContainer>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle>{t('tableauUsers.title')}</CardTitle>
              <CardDescription>{t('tableauUsers.subtitle')}</CardDescription>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Button
                variant="outline"
                size="sm"
                data-tableau-sync="users"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                <RefreshCw className={query.isFetching ? 'animate-spin' : undefined} />
                {t('tableauUsers.sync')}
              </Button>
              {query.dataUpdatedAt > 0 && (
                <span className="text-muted-foreground text-xs">
                  {t('tableauUsers.lastSynced', {
                    time: formatDateTime(new Date(query.dataUpdatedAt).toISOString()),
                  })}
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <NoteCallout
            tone="info"
            className="mb-4"
            title={
              <span className="flex items-center gap-1.5">
                <Info className="size-3.5 shrink-0" />
                {t('tableauUsers.boundaryTitle')}
              </span>
            }
          >
            <p className="text-muted-foreground max-w-prose">{t('tableauUsers.boundaryBody')}</p>
          </NoteCallout>

          {signedIn && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>{t('tableauUsers.selfRoleHint')}</span>
            </div>
          )}

          {users.length > 0 && (
            <FilterBar
              className="mb-4"
              activeCount={filters.activeCount}
              onReset={filters.reset}
              shown={visibleUsers.length}
              total={users.length}
            >
              <FilterSearch
                id="tableau-user-filter-search"
                value={filters.values.q}
                onChange={(value) => filters.set('q', value)}
                placeholder={t('tableauUsers.searchPlaceholder')}
              />
              <FilterSelect
                id="tableau-user-filter-role"
                label={t('tableauUsers.filterRole')}
                value={filters.values.role}
                onChange={(value) => filters.set('role', value)}
                options={roleOptions}
              />
            </FilterBar>
          )}

          <ListState
            status={query.status}
            isEmpty={users.length === 0}
            emptyMessage={t('tableauUsers.empty')}
            errorTitle={t('tableauUsers.loadFailed')}
            errorHint={t('tableauUsers.loadFailedHint')}
            retryLabel={t('tableauUsers.sync')}
            onRetry={() => void query.refetch()}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tableauUsers.colUser')}</TableHead>
                  <TableHead>{t('tableauUsers.colLogin')}</TableHead>
                  <TableHead>{t('tableauUsers.colRole')}</TableHead>
                  <TableHead>{t('tableauUsers.colLastLogin')}</TableHead>
                  <TableHead>{t('tableauUsers.colAuth')}</TableHead>
                  <TableHead className="w-40" aria-label={t('tableauUsers.colActions')} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 第三种空态：有用户，但被筛掉了 —— 必须给"重置筛选"的出口 */}
                {visibleUsers.length === 0 && (
                  <TableRow data-tableau-users-empty="filtered">
                    <TableCell colSpan={6} className="py-8">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <SearchX className="size-6 text-muted-foreground" />
                        <span className="text-muted-foreground text-sm">
                          {t('tableauUsers.noMatch')}
                        </span>
                        <Button variant="outline" size="sm" onClick={filters.reset}>
                          {t('filters.clearAll')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {visibleUsers.map((user) => {
                  const isSelf = signedIn?.id === user.id
                  return (
                    <TableRow key={user.id} data-tableau-user={user.name}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback>{initialsOf(user)}</AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col">
                            <span className="flex items-center gap-1.5 font-medium">
                              <span className="truncate">{user.fullName}</span>
                              {isSelf && (
                                <Badge variant="outline">{t('tableauUsers.you')}</Badge>
                              )}
                            </span>
                            {user.email && (
                              <span className="text-muted-foreground truncate text-xs">
                                {user.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {user.name}
                      </TableCell>
                      <TableCell>
                        <SiteRoleBadge role={user.siteRole} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(user.lastLogin)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.authSetting ?? '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            data-tableau-change-role={user.name}
                            disabled={isSelf}
                            title={isSelf ? t('tableauUsers.selfRoleHint') : undefined}
                            onClick={() => setEditing(user)}
                          >
                            {t('tableauUsers.changeRole')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ListState>
        </CardContent>
      </Card>

      {/*
        按 user.id 作 key 挂载：换一个人就是一次全新挂载，弹窗里的草稿状态不需要 effect 同步
        （见 change-site-role-dialog.tsx 顶部说明）。
      */}
      {editing && (
        <ChangeSiteRoleDialog
          key={editing.id}
          user={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
        />
      )}
    </PageContainer>
  )
}
