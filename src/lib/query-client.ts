import { QueryClient } from '@tanstack/react-query'

/**
 * 全局共享 QueryClient —— 所有服务器资源（REST 列表、认证令牌、缩略图）
 * 统一走这一层缓存：单一缓存策略出口，替代分散在 tableau-api / thumbnail-cache
 * 里的手写缓存（见 docs/architecture-review.html 第七章「缓存统一方案」）。
 *
 * 全局默认值即全库约定：
 * - staleTime 5 分钟：列表类资源 5 分钟内视为新鲜
 *   （认证令牌 / 缩略图属于不可变或长生命周期资源，在各自 queryOptions 里覆盖为更长）
 * - gcTime 15 分钟：无订阅者后保留 15 分钟再回收 —— 统一的容量上限
 * - retry 1：瞬时故障按指数退避重试一次
 * - refetchOnWindowFocus false：窗口切回不重发（Tableau REST 走代理，避免无谓流量）
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
