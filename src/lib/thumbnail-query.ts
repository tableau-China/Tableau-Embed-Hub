import { queryOptions } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

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
 * - URL 随渲染同步派生（useMemo）：blob 变化时本渲染立即换用新 URL，无中间帧
 * - 释放交给 effect 清理：URL 被替换（提交后）或组件卸载时 revoke，
 *   杜绝全局 ObjectURL 泄漏（替代旧 objectUrlCache 永不 revoke）
 *
 * 为什么安全：已加载完成的图片不会因 revoke 而消失；换图时 img 的 src
 * 在本次提交已指向新 URL，旧 URL 的加载（若有）已被浏览器中止，revoke 无副作用。
 */
export function useObjectUrl(blob: Blob | null): string | null {
  const url = useMemo(
    () => (blob === null ? null : URL.createObjectURL(blob)),
    [blob],
  )

  useEffect(() => {
    if (url === null) return
    return () => URL.revokeObjectURL(url)
  }, [url])

  return url
}
