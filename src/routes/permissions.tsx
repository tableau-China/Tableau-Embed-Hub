import { createFileRoute } from '@tanstack/react-router'

import { PermissionsPage } from '@/features/permissions/permissions-page'

/**
 * 权限页（跨团队管理页，无 slug）：角色 × 路由的勾选矩阵。
 * 准入由 __root.tsx 的 GlobalRouteGate 统一兜住 —— 默认只有系统管理员可见
 * （ROUTE_CATALOG 里 `page.permissions` 的 defaultRoles 为空 = fail-closed）。
 */
export const Route = createFileRoute('/permissions')({
  component: PermissionsPage,
})
