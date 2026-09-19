import { createFileRoute } from '@tanstack/react-router'

import { SmtpConfigPage } from '@/features/config/smtp-config-page'

/**
 * SMTP 邮件服务配置（跨团队页面，无 slug）。
 *
 * 准入由 __root.tsx 的 GlobalRouteGate 统一兜住 —— `ROUTE_CATALOG` 里 `page.config.smtp`
 * 的 defaultRoles 为空，即 fail-closed：默认**只有系统管理员**可见（系统级配置）。
 */
export const Route = createFileRoute('/config/smtp')({
  component: SmtpConfigPage,
})
