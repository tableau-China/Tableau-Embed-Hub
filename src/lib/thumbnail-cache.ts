/**
 * 缩略图缓存（从 pg_explorer 移植，去掉后端 apiClient，改为直接 fetch）
 * 模块级 Map 缓存 blob + ObjectURL + 失败标记，避免重复请求
 * 带并发控制（最多同时请求 MAX_CONCURRENT 个），避免浏览器连接排队
 */

// blob 缓存：id -> blob
const blobCache = new Map<string, Blob>()
// ObjectURL 缓存：id -> url
const objectUrlCache = new Map<string, string>()
// 失败缓存：id -> 过期时间戳（失败后 5 分钟内不重试）
const failureCache = new Map<string, number>()
const FAILURE_TTL = 5 * 60 * 1000 // 5 分钟

// 并发控制
const MAX_CONCURRENT = 4
let activeCount = 0
const waitQueue: (() => void)[] = []

/** 获取并发槽，超出则排队等待 */
function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeCount++
      resolve()
    })
  })
}

/** 释放并发槽 */
function releaseSlot() {
  activeCount--
  if (waitQueue.length > 0 && activeCount < MAX_CONCURRENT) {
    const next = waitQueue.shift()!
    next()
  }
}

/**
 * 获取缩略图 blob（带模块级缓存 + 失败缓存 + 并发控制）
 * 首次调用从网络获取，之后从缓存返回；失败后 5 分钟内不再重试，返回 null
 */
export async function getThumbnailBlob(url: string, id: string): Promise<Blob | null> {
  const failedAt = failureCache.get(id)
  if (failedAt && Date.now() - failedAt < FAILURE_TTL) {
    return null
  }
  if (blobCache.has(id)) {
    return blobCache.get(id)!
  }
  if (!url) return null

  await acquireSlot()
  try {
    const res = await fetch(url, { headers: { Accept: 'image/*' } })
    if (!res.ok) throw new Error(`thumbnail ${res.status}`)
    const blob = await res.blob()
    blobCache.set(id, blob)
    return blob
  } catch {
    failureCache.set(id, Date.now())
    return null
  } finally {
    releaseSlot()
  }
}

/** 获取（或复用）blob 对应的 ObjectURL */
export function getThumbnailObjectUrl(blob: Blob | null, id: string): string | null {
  if (!blob) return null
  const cached = objectUrlCache.get(id)
  if (cached) return cached
  const url = URL.createObjectURL(blob)
  objectUrlCache.set(id, url)
  return url
}
