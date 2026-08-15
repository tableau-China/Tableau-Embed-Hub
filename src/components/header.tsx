import { useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ModeToggle } from '@/components/mode-toggle'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

const SEGMENT_LABEL_KEYS: Record<string, string> = {
  '': 'nav.dashboard',
  users: 'nav.users',
  tasks: 'nav.tasks',
  settings: 'nav.settings',
}

export function Header() {
  const { t } = useTranslation()
  const { pathname } = useRouterState().location
  const segment = pathname === '/' ? '' : pathname.split('/').filter(Boolean)[0] ?? ''
  const labelKey = SEGMENT_LABEL_KEYS[segment] ?? 'notFound.title'

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <span className="text-muted-foreground">shadcn-admin</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          <BreadcrumbItem>
            <BreadcrumbPage>{t(labelKey)}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <ModeToggle />
      </div>
    </header>
  )
}
