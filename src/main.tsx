// ⚠️ 必须是第一个 import：存储前缀迁移（shadcn-admin-cn: → tableau-embed-hub:）要在任何 store
// 模块被求值之前跑完 —— zustand persist 在模块加载时就 hydrate，晚一步读到的就是空数据。
// 该模块自身带副作用，理由与取舍见 src/lib/storage-migration.ts。ESM 依赖按声明顺序求值。
import '@/lib/storage-migration'

import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'

import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import '@/i18n'
import { queryClient } from '@/lib/query-client'
import { routeTree } from './routeTree.gen'
import './index.css'

const router = createRouter({ routeTree })

/** DevTools 仅在开发构建懒加载（生产 bundle 不包含） */
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : null

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider delayDuration={0}>
          <RouterProvider router={router} />
          <Toaster />
        </TooltipProvider>
        {ReactQueryDevtools ? (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          </Suspense>
        ) : null}
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
