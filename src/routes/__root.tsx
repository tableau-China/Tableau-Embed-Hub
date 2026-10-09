import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'

import { AppSidebar } from '@/components/app-sidebar'
import { Header } from '@/components/header'
import { GlobalRouteGate } from '@/components/route-guard'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

/**
 * 路由级版面开关：某条路由要**跳出 App shell** 时，在自己的路由选项里声明
 * `staticData: { layout: 'bare' }`（登录页 `/login` 是第一个使用者）。
 *
 * 为什么用 staticData 而不是在 root 里判路径：版面归属是**路由自己的元信息** ——
 * 新增一个登录前页面时，改动只发生在那个路由文件里，root 不需要认识任何一条具体路径。
 *
 * 裸布局 = 既没有侧边栏/头部，也**不经过 GlobalRouteGate 的权限门禁** ——
 * 登录页必须在「还没有身份」的状态下可用，这是它存在的意义。
 */
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    layout?: 'shell' | 'bare'
  }
}

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const bare = useRouterState({
    select: (s) => s.matches.some((m) => m.staticData?.layout === 'bare'),
  })

  if (bare) {
    return (
      <div className="min-h-svh">
        <Outlet />
      </div>
    )
  }

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
