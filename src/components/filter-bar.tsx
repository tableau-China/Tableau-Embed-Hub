import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

/**
 * 列表筛选控件（**全站共用**，与 `action-bar.tsx` / `form-field.tsx` 同一层级）
 *
 * 目标：任何列表页（用户 / 团队 / 收藏 / 工作簿 …）都长同一副样子、同一套交互，
 * 新增页面时不必重新发明「搜索框 + 下拉 + 重置」。
 *
 * 三个部件按需组合（都是**受控组件**：状态归页面所有，筛选栏不藏状态）：
 *
 * ```tsx
 * const filters = useListFilters({ q: '', status: 'all' as StatusFilter })
 *
 * <FilterBar activeCount={filters.activeCount} onReset={filters.reset} shown={rows.length} total={all.length}>
 *   <FilterSearch
 *     value={filters.values.q}
 *     onChange={(v) => filters.set('q', v)}
 *     placeholder={t('users.searchPlaceholder')}
 *   />
 *   <FilterSelect
 *     id="user-filter-status"
 *     label={t('users.status')}
 *     value={filters.values.status}
 *     onChange={(v) => filters.set('status', v as StatusFilter)}
 *     options={statusOptions}
 *   />
 * </FilterBar>
 * ```
 *
 * 三条刻意的设计约束：
 *
 * 1. **受控**：不接收数据源、不自己过滤 —— 筛选口径（哪个字段、大小写、模糊还是精确）
 *    是业务判断，留在页面里；本文件只负责「长什么样、怎么重置」。
 *    这样同一组控件既能用在路由页面，也能用在弹窗里（不依赖 router context）。
 * 2. **状态归页面**：筛选是**视图态**，默认与 URL 无关（刷新即回默认）。
 *    需要「筛选结果可分享 / 刷新不丢」时，把同一组受控组件接到 TanStack Router 的
 *    `useSearch` + `navigate({ search })` 即可，**本文件一行都不用改**（见 docs/ui-conventions.md §6）。
 * 3. **可断言**：带 `data-filter-*` 钩子（`data-filter-search` / `data-filter-select="<id>"` /
 *    `data-filter-action="reset"`），供 scripts/check-filters.mjs 之类的端到端脚本定位
 *    —— 与 `data-smtp-*` / `data-perm-*` 同一做法。
 */

/* ============================== 容器 ============================== */

export interface FilterBarProps {
  children: ReactNode
  /**
   * 已生效（≠ 默认值）的筛选项数量。> 0 时右侧才出现结果计数与「重置」按钮 ——
   * 没有筛选时不该出现「重置」这种无处发力的按钮。
   */
  activeCount?: number
  /** 重置全部筛选（通常直接传 `useListFilters().reset`） */
  onReset?: () => void
  /** 当前可见行数（与 `total` 同时给出才显示 `Showing X of Y`） */
  shown?: number
  /** 未筛选时的总行数 */
  total?: number
  className?: string
}

export function FilterBar({
  children,
  activeCount = 0,
  onReset,
  shown,
  total,
  className,
}: FilterBarProps) {
  const { t } = useTranslation()
  const active = activeCount > 0
  const summary = active && shown !== undefined && total !== undefined

  return (
    <div
      data-filter-bar=""
      data-filter-active={activeCount}
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {children}
      {(summary || (active && onReset)) && (
        <div className="ml-auto flex items-center gap-2">
          {summary && (
            <span
              data-filter-summary=""
              className="text-xs text-muted-foreground tabular-nums"
            >
              {t('filters.showing', { shown, total })}
            </span>
          )}
          {active && onReset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-filter-action="reset"
              // title/aria 说明与按钮文案分开：文案是「重置筛选」，悬停提示要说清重置的是什么
              aria-label={t('filters.clearAllHint')}
              title={t('filters.clearAllHint')}
              onClick={onReset}
            >
              <X />
              {t('filters.clearAll')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/* ============================== 搜索 ============================== */

export interface FilterSearchProps {
  value: string
  onChange: (value: string) => void
  /** 占位文案（说明**搜什么字段**，如 “Search username…”） */
  placeholder?: string
  /** 无障碍名称；不传时用通用的 “Search” */
  label?: string
  id?: string
  className?: string
  disabled?: boolean
}

/**
 * 关键词搜索框。带一键清空按钮（有内容时才出现）。
 *
 * `type="search"` 保留语义与 Esc 清空，但**隐藏 WebKit 自带的清除叉** ——
 * 否则会和这里的清除按钮并排出现两个「✕」，看起来像一个 bug。
 */
export function FilterSearch({
  value,
  onChange,
  placeholder,
  label,
  id,
  className,
  disabled = false,
}: FilterSearchProps) {
  const { t } = useTranslation()

  return (
    <InputGroup
      data-filter-search=""
      className={cn('w-full sm:w-64', className)}
    >
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="search"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={label ?? t('filters.search')}
        className="[&::-webkit-search-cancel-button]:hidden"
        onChange={(event) => onChange(event.target.value)}
      />
      {value !== '' && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            disabled={disabled}
            aria-label={t('filters.clearSearch')}
            title={t('filters.clearSearch')}
            onClick={() => onChange('')}
          >
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}

/* ============================== 下拉 ============================== */

export interface FilterOption {
  /** 选项值（一律字符串：数字 id 用 String(id)） */
  value: string
  label: string
  /** 可选前置图标（如团队 Logo）—— 只出现在下拉列表里，不影响触发器文案 */
  icon?: ReactNode
}

export interface FilterSelectProps {
  /** 字段名（触发器上的灰色前缀，如 `Status`） */
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly FilterOption[]
  /** 控件 id：同时用于 DOM id 与 `data-filter-select="<id>"` */
  id: string
  /** 「全部」选项的值，默认 `'all'` */
  allValue?: string
  /** 「全部」选项的文案，默认 i18n `filters.all` */
  allLabel?: string
  className?: string
  disabled?: boolean
}

/**
 * 单选筛选下拉。首个选项恒为「全部」（= 该字段不参与筛选），
 * 因此「未筛选」永远有同一个显式取值，页面不必到处判空。
 *
 * 触发器上是 `字段名 + 当前值`（如 `Status  All`）而不是只有一个孤零零的值：
 * 下拉收起后，用户仍要知道「这一格筛的是什么字段」。
 */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  id,
  allValue = 'all',
  allLabel,
  className,
  disabled = false,
}: FilterSelectProps) {
  const { t } = useTranslation()
  const items: FilterOption[] = [
    { value: allValue, label: allLabel ?? t('filters.all') },
    ...options,
  ]
  /**
   * 无障碍名称带上当前值：`role="combobox"` 上用 `aria-label` 会**盖掉**触发器的可见文本，
   * 只留字段名的话，读屏用户听到的是「Status」而听不到「Frozen」，等于把筛掉的当前值丢了。
   */
  const selected = items.find((item) => item.value === value)
  const accessibleName = selected ? `${label}: ${selected.label}` : label

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        data-filter-select={id}
        aria-label={accessibleName}
        className={cn('w-full sm:w-auto sm:min-w-40', className)}
      >
        <span className="text-muted-foreground">{label}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.icon}
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
