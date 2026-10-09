import { createFileRoute } from '@tanstack/react-router'

import { LoginPage } from '@/features/login/login-page'

/**
 * 登录页路由 `/login`。
 *
 * `staticData.layout = 'bare'`（机制见 routes/__root.tsx）：**不套 App shell**（没有侧边栏 / 头部），
 * 也不经过 `__root.tsx` 里的权限门禁 —— 登录页必须在「还没有身份」的状态下可用。
 *
 * 它因此**不登记**在 `ROUTE_CATALOG` 里（那里是「登录后能看什么」的目录），
 * 而是在 `scripts/check-route-catalog.mjs` 的白名单里显式声明豁免 —— 漏登记会是权限盲区，
 * 有意豁免必须留痕。
 */
export const Route = createFileRoute('/login')({
  staticData: { layout: 'bare' },
  component: LoginPage,
})
