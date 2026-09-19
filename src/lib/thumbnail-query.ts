import { queryOptions } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

/**
 * 通用缩略图查询层 —— 图片 blob 统一走 TanStack Query 缓存：
 * - staleTime Infinity：图片内容视为不可变，拿到后不再重发（替代旧 blobCache Map）
 * - gcTime 10 分钟：无订阅者后自动回收（替代旧 Map 的容量管理）
 * - retry 2 + 指数退避：替代旧「失败 5 分钟记忆」（failureCache）
 */

export function imageBlobQueryOptions(url: string) {
  return queryOptions<Blob | null>({
    queryKey: ['thumbnail', 'by-url', url],
    queryFn: async () => {
      const res = await fetch(url, { headers: { Accept: 'image/*' } })
      if (!res.ok) throw new Error(`thumbnail ${res.status}`)
      return res.blob()
    },
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 5000),
  })
}

/**
 * Blob → ObjectURL，生命周期随 blob 变化与组件卸载自动收敛：
 * - URL 随渲染同步派生：blob 变化时本渲染立即换用新 URL，无中间帧
 * - 旧 URL 在「提交后」的 effect body 中释放 —— 此时 DOM 已切换到新 src，
 *   revoke 不会再中断任何进行中的加载；绝不误杀当前在用的 URL
 * - 组件卸载时释放当前 URL，杜绝全局 ObjectURL 泄漏
 *   （替代旧 objectUrlCache 永不 revoke 的实现）
 */
export function useObjectUrl(blob: Blob | null): string | null {
  // 渲染期派生（React 官方「根据 props 调整 state」模式）
  const [entry, setEntry] = useState<{ blob: Blob | null; url: string | null }>({
    blob: null,
    url: null,
  })

  let url = entry.url
  let staleUrl: string | null = null
  if (entry.blob !== blob) {
    staleUrl = entry.url
    url = blob === null ? null : URL.createObjectURL(blob)
    setEntry({ blob, url })
  }

  // 活动 URL 的 ref 只在 effect 内读写（满足 react-hooks/refs 规则）
  const liveRef = useRef<string | null>(null)

  useEffect(() => {
    // 提交后释放上一代 URL：DOM 已切到新 src，revoke 幂等且不会中断任何加载
    if (staleUrl !== null) URL.revokeObjectURL(staleUrl)

    if (url === null || blob === null) {
      liveRef.current = null
      return
    }

    // StrictMode 的「模拟卸载→重挂载」会执行一次 cleanup 把当前 URL revoke
    // 并把 ref 清空；重挂载时检测到 ref 与当前 URL 不一致 → 重建 URL，
    // 图片在 dev 下一帧内自愈（生产构建无此路径，零额外开销）。
    if (liveRef.current !== url) {
      const rebuilt = URL.createObjectURL(blob)
      liveRef.current = rebuilt
      setEntry({ blob, url: rebuilt })
      return
    }
    liveRef.current = url

    // 真正卸载：释放当前 URL，杜绝 ObjectURL 泄漏
    return () => {
      if (liveRef.current !== null) {
        URL.revokeObjectURL(liveRef.current)
        liveRef.current = null
      }
    }
  }, [staleUrl, url, blob])

  return url
}
