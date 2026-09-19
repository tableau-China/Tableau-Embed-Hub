import { createFileRoute } from '@tanstack/react-router'

import { HelpPage } from '@/features/help/help-page'

/**
 * 帮助页（跨团队页面，无 slug）：核心功能说明 + 开发者信息 + 版本号。
 *
 * 入口在侧边栏的 Settings 分组（`ROUTE_CATALOG` 的 `page.help`，默认授权给所有成员）：
 * 与 /users、/teams 一样走 __root.tsx 的 GlobalRouteGate 统一准入。
 */
export const Route = createFileRoute('/help')({
  component: HelpPage,
})
