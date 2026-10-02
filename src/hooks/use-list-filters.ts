import { useCallback, useMemo, useState } from 'react'

/**
 * 列表筛选状态（**列表页通用**，与 `components/filter-bar.tsx` 配套）
 *
 * 为什么要有这个 hook：筛选栏本身是受控的（见 filter-bar.tsx 的三条约束），
 * 于是每个页面都要「记 N 个值 + 逐个比较默认值算重置 + 判断有没有在筛」——
 * 三行样板乘以每个列表页，必然有人漏掉其中一条（最常见的是「重置」按钮的显示条件）。
 * 这里把这三件事收成一处，页面只写「有哪些筛选项、默认值是什么」。
 *
 * ```tsx
 * type StatusFilter = 'all' | UserStatus
 * type UserFilterValues = { q: string; status: StatusFilter; team: string }
 *
 * // 默认值建议写成模块级常量：它同时是「重置」的目标值
 * const USER_FILTER_DEFAULTS: UserFilterValues = { q: '', status: 'all', team: 'all' }
 *
 * const filters = useListFilters(USER_FILTER_DEFAULTS)
 * filters.values.status   // 当前值
 * filters.set('status', 'disabled')
 * filters.activeCount     // 已生效的筛选项数量（> 0 才显示「重置」按钮）
 * ```
 *
 * 两条约定：
 *
 * 1. **值一律是字符串**（数字 id 用 `String(id)`）。筛选值只用于比较与展示，
 *    引入 number / boolean / Date 会让「字段类型」在各页面各写一套，而收益为零；
 * 2. **默认值只在挂载时取一次快照**：调用方通常直接写字面量（每次渲染都是新对象），
 *    若把对象本身放进依赖里，`reset` 与 `activeCount` 每帧都变，反而让下游 `useMemo` 失效。
 */

/** 筛选值集合：键 = 筛选项名，值 = 字符串 */
export type ListFilterValues = Record<string, string>

/** 筛选项名（T 的字符串键） */
type FilterKey<T> = keyof T & string

export interface ListFilters<T extends ListFilterValues> {
  /** 当前筛选值（受控给 FilterSearch / FilterSelect） */
  values: T
  /** 改一项（同值写入会被 React 忽略，不产生多余渲染） */
  set: <K extends FilterKey<T>>(key: K, value: T[K]) => void
  /** 全部回到默认值 */
  reset: () => void
  /** 该项是否偏离默认值（如给标签加高亮 / 单独清除某一项） */
  isDirty: (key: FilterKey<T>) => boolean
  /** 已生效的筛选项数量 */
  activeCount: number
  /** 是否处于筛选状态（等价于 `activeCount > 0`） */
  isFiltered: boolean
}

export function useListFilters<T extends ListFilterValues>(defaults: T): ListFilters<T> {
  // 快照：默认值当作「常量」用（重置目标 + 比较基准），不随调用方每次渲染的新字面量漂移
  const [initial] = useState<T>(defaults)
  const [values, setValues] = useState<T>(defaults)

  const set = useCallback(<K extends FilterKey<T>>(key: K, value: T[K]) => {
    setValues((prev) => {
      if (prev[key] === value) return prev
      // 计算键会退化成 index signature，这里显式收回 T（键来自 keyof T，值来自 T[K]，是安全的）
      return { ...prev, [key]: value } as T
    })
  }, [])

  const reset = useCallback(() => setValues(initial), [initial])

  const dirtyKeys = useMemo(
    () =>
      (Object.keys(initial) as FilterKey<T>[]).filter((key) => values[key] !== initial[key]),
    [initial, values],
  )

  const isDirty = useCallback(
    (key: FilterKey<T>) => values[key] !== initial[key],
    [initial, values],
  )

  return {
    values,
    set,
    reset,
    isDirty,
    activeCount: dirtyKeys.length,
    isFiltered: dirtyKeys.length > 0,
  }
}
