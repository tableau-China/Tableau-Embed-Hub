import { createFileRoute } from '@tanstack/react-router'

import { ComponentGalleryPage } from '@/features/components/component-gallery-page'

/**
 * 组件总览页（跨团队页面，无 slug）：公共件清单 + 实时预览 + App shell 规格 + 主题 token。
 *
 * 入口在侧边栏的 Config 分组（`ROUTE_CATALOG` 的 `page.components`，默认授权给所有成员，
 * 与 /help 同为说明书性质）：与 /help 一样走 __root.tsx 的 GlobalRouteGate 统一准入。
 */
export const Route = createFileRoute('/components')({
  component: ComponentGalleryPage,
})
