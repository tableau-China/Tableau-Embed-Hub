export interface ViewRef {
  workbook: string
  view: string
  accessedAt: string
}

const FAVORITES_KEY = 'shadcn-admin-cn:favorites'
const RECENTS_KEY = 'shadcn-admin-cn:recents'
const FAV_EVENT = 'shadcn-admin-cn:favorites-changed'
const RECENT_EVENT = 'shadcn-admin-cn:recents-changed'
const MAX_RECENTS = 30

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
 * 供 useSyncExternalStore 使用的视图 store。
 * 关键点：getSnapshot 必须返回缓存中的同一引用，直到数据真正变更
 * （否则 React 每次渲染都拿到新引用 → 无限重渲染 → "Maximum update depth exceeded"）。
 * 变更时 write() 会失效缓存并派发事件（同页 CustomEvent + 跨标签页 storage 事件）。
 */
function createViewStore(key: string, eventName: string) {
  let cache: ViewRef[] | null = null

  const read = (): ViewRef[] => {
    if (cache === null) cache = readList(key)
    return cache
  }

  const invalidate = () => {
    cache = null
  }

  const subscribe = (cb: () => void) => {
    const onChange = () => {
      invalidate()
      cb()
    }
    window.addEventListener(eventName, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(eventName, onChange)
      window.removeEventListener('storage', onChange)
    }
  }

  const write = (list: ViewRef[]) => {
    writeList(key, list)
    invalidate()
    window.dispatchEvent(new CustomEvent(eventName))
  }

  return { read, subscribe, write }
}

const favoritesStore = createViewStore(FAVORITES_KEY, FAV_EVENT)
const recentsStore = createViewStore(RECENTS_KEY, RECENT_EVENT)

/** 供 useSyncExternalStore 使用（稳定快照 + 变更订阅） */
export const favoritesExternalStore = {
  subscribe: favoritesStore.subscribe,
  getSnapshot: favoritesStore.read,
}

export const recentsExternalStore = {
  subscribe: recentsStore.subscribe,
  getSnapshot: recentsStore.read,
}

export function getFavorites(): ViewRef[] {
  return favoritesStore.read()
}

export function isFavorite(workbook: string, view: string): boolean {
  return getFavorites().some((f) => f.workbook === workbook && f.view === view)
}

/** 返回切换后的收藏状态（true=已收藏） */
export function toggleFavorite(workbook: string, view: string): boolean {
  const list = getFavorites()
  const exists = list.some((f) => f.workbook === workbook && f.view === view)
  const next = exists
    ? list.filter((f) => !(f.workbook === workbook && f.view === view))
    : [{ workbook, view, accessedAt: new Date().toISOString() }, ...list]
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

export function addRecent(workbook: string, view: string) {
  const list = getRecents().filter((r) => !(r.workbook === workbook && r.view === view))
  const next = [{ workbook, view, accessedAt: new Date().toISOString() }, ...list].slice(0, MAX_RECENTS)
  recentsStore.write(next)
}

export function clearRecents() {
  recentsStore.write([])
}
