import { createFileRoute } from '@tanstack/react-router'

import { LoginConfigPage } from '@/features/config/login-config-page'

/**
 * 登录页配置（跨团队页面，无 slug）：登录样式 + 第三方联合登录的公开参数。
 *
 * 准入由 __root.tsx 的 GlobalRouteGate 统一兜住 —— `ROUTE_CATALOG` 里 `page.config.login`
 * 的 defaultRoles 为空，即 fail-closed：默认**只有系统管理员**可见（与 SMTP 同为系统级配置）。
 */
export const Route = createFileRoute('/config/login')({
  component: LoginConfigPage,
})
