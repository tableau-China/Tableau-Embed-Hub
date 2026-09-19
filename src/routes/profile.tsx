import { createFileRoute } from '@tanstack/react-router'

import { ProfilePage } from '@/features/profile/profile-page'

/**
 * 个人资料页（跨团队页面，无 slug）：v0.7.0 由 `/settings` 改名而来。
 *
 * 入口在左下角的用户菜单（不在侧边栏）—— `ROUTE_CATALOG` 里标记 `navHidden: true`，
 * 但仍登记在权限目录中，因此 __root.tsx 的 GlobalRouteGate 与权限页矩阵照常生效。
 */
export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})
