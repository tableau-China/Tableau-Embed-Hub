import type { ComponentType } from 'react'

import type { OAuthProviderId } from '@/lib/login'

/**
 * 第三方联合登录的**品牌标识**（内联 SVG）。
 *
 * 为什么不用图标库：lucide-react 已不再提供品牌图标（Google 的彩色 G 更不在其列），
 * 而联合登录按钮上的品牌标识是**识别性**的一部分 —— 换成通用图标会让用户认不出这是哪个 provider。
 * 两个标志均为各自官方发布的简版标（GitHub mark / Google "G"），只取固定配色、不改形状。
 *
 * 尺寸与配色由调用方控制：`className` 负责大小，颜色写死在品牌色里（品牌标识不跟随主题）。
 */

interface BrandIconProps {
  className?: string
}

/** GitHub mark（单色，跟随按钮文字色） */
export function GitHubMark({ className }: BrandIconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

/** Google "G"（四色） */
export function GoogleMark({ className }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.4 5.4 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  )
}

/**
 * provider id → 品牌标识。
 *
 * `Record<OAuthProviderId, …>` 让「目录里加了 provider 却忘了配图标」在 tsc 阶段直接报错
 *（同 app-sidebar 的 ICONS 手法）。
 */
export const OAUTH_ICONS: Record<OAuthProviderId, ComponentType<BrandIconProps>> = {
  github: GitHubMark,
  google: GoogleMark,
}
