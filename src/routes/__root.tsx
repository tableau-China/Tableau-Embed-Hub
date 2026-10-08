import { createRootRoute, Outlet } from '@tanstack/react-router'

import { AppSidebar } from '@/components/app-sidebar'
import { Header } from '@/components/header'
import { GlobalRouteGate } from '@/components/route-guard'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <SidebarProvider>
      <AppSidebar />
      {/* SidebarInset 加 min-w-0：它是 flex 子项，默认 min-width:auto = 「内容的最小宽度」，
          于是一个宽表格（TableHead/TableCell 默认 whitespace-nowrap）就能把它顶得比可用空间还宽
          —— 表现为整页底部横向滚动条、且各页面宽度不一。加上它之后过宽内容被限制在**卡片内部**
          滚动（Table 自带 overflow-x-auto），页面宽度在所有页面上保持一致。
          页面级宽度约定见 components/page-container.tsx。 */}
      <SidebarInset className="min-w-0">
        <Header />
        {/* min-w-0 是必须的：<main> 是 flex 子项，默认 min-width:auto 会取「内容的最小宽度」，
            于是一个宽表格（TableHead/TableCell 默认 whitespace-nowrap）就能把整页撑得比视口还宽
            —— 表现为底部横向滚动条、且各页面宽度不一。加上它以后，过宽的内容被限制在**卡片内部**
            滚动（Table 自带 overflow-x-auto），页面宽度在所有页面上保持一致。
            页面级宽度约定见 components/page-container.tsx。 */}
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-2 md:gap-8 md:p-4">
          {/* 跨团队页面（/users、/teams、/permissions、/profile、/config/smtp、/help）的准入在此统一兜住；
              团队作用域页面（/t/{slug}/...）的准入在 routes/t.$teamSlug.tsx：
              那里必须先判「团队是否存在 / 是否成员」，否则会把「不是成员」显示成「无权限」 */}
          <GlobalRouteGate>
            <Outlet />
          </GlobalRouteGate>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
