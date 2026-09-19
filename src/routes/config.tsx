import { createFileRoute, Outlet } from '@tanstack/react-router'

/**
 * /config 布局路由（系统配置，跨团队页面，无 slug）：
 * - /config        -> config.index.tsx（落到第一个有权访问的配置页）
 * - /config/smtp   -> config.smtp.tsx（SMTP 邮件服务配置）
 *
 * 布局本身只渲染 <Outlet/>，子页面各自负责完整内容（与多页分支同一结构）。
 */
export const Route = createFileRoute('/config')({
  component: () => <Outlet />,
})
