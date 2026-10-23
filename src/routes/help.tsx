import { createFileRoute } from '@tanstack/react-router'

import { HelpPage } from '@/features/help/help-page'

/**
 * 帮助页（跨团队页面，无 slug）：核心功能说明 + 开发者信息 + 版本号。
 *
 * 入口在**左下角用户菜单**（Profile 下面；v0.14.4 起从侧边栏 Config 分组移入），
 * `ROUTE_CATALOG` 的 `page.help` 带 `navHidden`，因此不占侧边栏：
 * 与 /users、/teams 一样走 __root.tsx 的 GlobalRouteGate 统一准入。
 */
export const Route = createFileRoute('/help')({
  component: HelpPage,
})
