import { useSyncExternalStore } from 'react'

import { LEGACY_STORAGE_PREFIX, STORAGE_PREFIX } from '@/lib/storage-migration'
import { parseTeamSlugFromPath } from '@/lib/team-context'
import { useOrgStore } from '@/stores/org-store'

/**
 * 收藏 / 最近浏览 store —— 按 Team 隔离（对齐 pg-explorer 的团队作用域语义）。
 *
 * - localStorage key 带当前团队后缀（如 tableau-embed-hub:favorites:team-1）
 * - 团队身份以 **URL 中的 /t/{slug}** 为准（v0.5.0 起团队进入路由），
 *   管理页等无 slug 路径回退 org store 的 activeTeamId
 * - 切换团队时（URL slug 变化或 activeTeamId 变化）自动失效缓存并触发订阅方重渲染
 * - v0.4.0 升级迁移：旧的无后缀全局数据首次读取时迁入当前团队，之后清除，避免多团队重复拷贝
 *
 * 关键点：getSnapshot 必须返回缓存中的同一引用，直到数据真正变更
 * （否则 React 每次渲染都拿到新引用 → 无限重渲染 → "Maximum update depth exceeded"）。
 */

export interface ViewRef {
  /** 工作簿名称（展示用；兼容旧数据） */
  workbook: string
  /** 视图名称（展示用） */
  view: string
  /** 工作簿 UUID（匹配与 /views URL 参数优先用 UUID） */
  workbookId?: string
  /** 视图 UUID */
  viewId?: string
  accessedAt: string
}

/** 调用方已知的 UUID（存库时带上，跳转 /views 时作为参数） */
export interface ViewIds {
  workbookId?: string
  viewId?: string
}

const KEY_PREFIX = STORAGE_PREFIX
/** v0.3.x 及以前的无后缀全局 key（用于一次性迁移）—— 落在**更名前**的命名空间下 */
const LEGACY_FAVORITES_KEY = `${LEGACY_STORAGE_PREFIX}:favorites`
const LEGACY_RECENTS_KEY = `${LEGACY_STORAGE_PREFIX}:recents`
const FAV_EVENT = `${KEY_PREFIX}:favorites-changed`
const RECENT_EVENT = `${KEY_PREFIX}:recents-changed`
const MAX_RECENTS = 30

/**
 * 当前团队后缀（localStorage key 的分区标识）：
 * 优先用 URL 里的 /t/{slug} 解析出团队 —— URL 是团队身份的权威来源；
 * 无 slug 的跨团队管理页回退 activeTeamId；两者都没有时落到 global。
 *
 * 以 URL 优先的原因：布局把 slug 同步到 activeTeamId 是一个 effect，
 * 存在「URL 已切到 B、activeTeamId 仍是 A」的一帧；此外同一浏览器的多个标签页
 * 可以各自停在 /t/A 与 /t/B，此时 activeTeamId 无法表达两个团队。
 */
function teamSuffix(): string {
  const { teams, activeTeamId } = useOrgStore.getState()

  if (typeof window !== 'undefined') {
    const slug = parseTeamSlugFromPath(window.location.pathname)
    const team = slug ? teams.find((t) => t.slug === slug) : undefined
    if (team) return `team-${team.id}`
  }

  return activeTeamId === null ? 'global' : `team-${activeTeamId}`
}

function scopedKey(baseKey: string): string {
  return `${KEY_PREFIX}:${baseKey}:${teamSuffix()}`
}

function readList(key: string): ViewRef[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as ViewRef[]) : []
  } catch {
    return []
  }
}

function writeList(key: string, list: ViewRef[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // storage 不可用时静默降级
  }
}

/**
 * v0.3.x → v0.4.0 一次性迁移：旧全局收藏/最近在首次读取时迁入当前团队 key。
 * 迁移后立即删除旧 key，保证其它团队不会再次拷贝同一份数据。
 */
function adoptLegacyOnce(scoped: string, legacy: string): ViewRef[] {
  const list = readList(scoped)
  if (list.length > 0) return list
  const legacyList = readList(legacy)
  if (legacyList.length === 0) return list
  writeList(scoped, legacyList)
  try {
    localStorage.removeItem(legacy)
  } catch {
    // 忽略
  }
  return legacyList
}

/**
 * 供 useSyncExternalStore 使用的团队作用域 store。
 * - read()：key 随 activeTeamId 变化 → 单槽缓存 { suffix, list }；
 *   变更事件回调会先 invalidate() 再触发 React 读取，快照引用稳定。
 * - subscribe()：同时监听本 store 变更事件 + org store（团队切换）+ 跨标签页 storage。
 */
function createViewStore(baseKey: string, eventName: string, legacyKey: string) {
  let cache: { suffix: string; list: ViewRef[] } | null = null

  const read = (): ViewRef[] => {
    const suffix = teamSuffix()
    if (cache !== null && cache.suffix === suffix) return cache.list
    const key = scopedKey(baseKey)
    const list = adoptLegacyOnce(key, legacyKey)
    cache = { suffix, list }
    return list
  }

  const invalidate = () => {
    cache = null
  }

  const subscribe = (cb: () => void) => {
    const onChange = () => {
      invalidate()
      cb()
    }
    // 本页签内：收藏/最近写操作派发的 CustomEvent
    window.addEventListener(eventName, onChange)
    // 跨标签页：storage 事件（只关心本 store 的 key 族）
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith(`${KEY_PREFIX}:${baseKey}`)) return
      onChange()
    }
    window.addEventListener('storage', onStorage)
    // 团队切换：activeTeamId 变化 → 失效缓存并通知订阅者
    const unsubscribeOrg = useOrgStore.subscribe((state, prev) => {
      if (state.activeTeamId !== prev.activeTeamId) {
        onChange()
      }
    })
    return () => {
      window.removeEventListener(eventName, onChange)
      window.removeEventListener('storage', onStorage)
      unsubscribeOrg()
    }
  }

  const write = (list: ViewRef[]) => {
    writeList(scopedKey(baseKey), list)
    invalidate()
    window.dispatchEvent(new CustomEvent(eventName))
  }

  return { read, subscribe, write }
}

const favoritesStore = createViewStore('favorites', FAV_EVENT, LEGACY_FAVORITES_KEY)
const recentsStore = createViewStore('recents', RECENT_EVENT, LEGACY_RECENTS_KEY)

/** 供 useSyncExternalStore 使用（稳定快照 + 变更订阅） */
export const favoritesExternalStore = {
  subscribe: favoritesStore.subscribe,
  getSnapshot: favoritesStore.read,
}

export const recentsExternalStore = {
  subscribe: recentsStore.subscribe,
  getSnapshot: recentsStore.read,
}

/**
 * React 侧订阅收藏列表：收藏写操作（收藏/取消/移除）后使用方自动重渲染。
 * getSnapshot 返回缓存中的同一引用直到数据真正变更（与外部 store 约定一致，
 * 不会造成无限重渲染）。所有"渲染期读取 isFavorite"的页面都应经本 hook 订阅，
 * 否则写库后星标停留在旧状态（v0.7.0 遗留问题的修复）。
 */
export function useFavorites(): ViewRef[] {
  return useSyncExternalStore(
    favoritesExternalStore.subscribe,
    favoritesExternalStore.getSnapshot,
  )
}

/** 同一视图判定：双方都有 UUID 时按 UUID 比较，否则按名称（兼容旧数据） */
function sameView(
  a: ViewRef,
  b: { workbook: string; view: string; workbookId?: string; viewId?: string },
): boolean {
  if (a.workbookId && b.workbookId && a.viewId && b.viewId) {
    return a.workbookId === b.workbookId && a.viewId === b.viewId
  }
  return a.workbook === b.workbook && a.view === b.view
}

export function getFavorites(): ViewRef[] {
  return favoritesStore.read()
}

export function isFavorite(workbook: string, view: string, ids?: ViewIds): boolean {
  return getFavorites().some((f) => sameView(f, { workbook, view, ...ids }))
}

/** 返回切换后的收藏状态（true=已收藏） */
export function toggleFavorite(workbook: string, view: string, ids?: ViewIds): boolean {
  const list = getFavorites()
  const exists = list.some((f) => sameView(f, { workbook, view, ...ids }))
  const next = exists
    ? list.filter((f) => !sameView(f, { workbook, view, ...ids }))
    : [{ workbook, view, ...ids, accessedAt: new Date().toISOString() }, ...list]
  favoritesStore.write(next)
  return !exists
}

export function removeFavorite(workbook: string, view: string) {
  const list = getFavorites().filter((f) => !(f.workbook === workbook && f.view === view))
  favoritesStore.write(list)
}

export function getRecents(): ViewRef[] {
  return recentsStore.read()
}

export function addRecent(workbook: string, view: string, ids?: ViewIds) {
  const list = getRecents().filter((r) => !sameView(r, { workbook, view, ...ids }))
  const next = [
    { workbook, view, ...ids, accessedAt: new Date().toISOString() },
    ...list,
  ].slice(0, MAX_RECENTS)
  recentsStore.write(next)
}

export function clearRecents() {
  recentsStore.write([])
}
