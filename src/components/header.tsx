import { useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { LanguageToggle } from '@/components/language-toggle'
import { ModeToggle } from '@/components/mode-toggle'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

/** 一级路由段 → 标题 i18n key（表头直接显示当前页面标题，不再用面包屑） */
const SEGMENT_TITLE_KEYS: Record<string, string> = {
  '': 'nav.dashboard',
  users: 'nav.users',
  settings: 'nav.settings',
  favorites: 'nav.favorites',
  recents: 'nav.recents',
  workbooks: 'nav.workbooks',
  views: 'nav.views',
  teams: 'nav.teams',
}

/** 一级路由段 → 页面描述 i18n key（紧随标题右侧，小字展示） */
const SEGMENT_SUBTITLE_KEYS: Record<string, string> = {
  '': 'dashboard.subtitle',
  users: 'users.subtitle',
  settings: 'settings.subtitle',
  favorites: 'favorites.subtitle',
  recents: 'recents.subtitle',
  workbooks: 'workbooks.subtitle',
  views: 'views.subtitle',
  teams: 'teams.subtitle',
}

export function Header() {
  const { t } = useTranslation()
  const { pathname } = useRouterState().location
  const segment = pathname === '/' ? '' : pathname.split('/').filter(Boolean)[0] ?? ''
  const titleKey = SEGMENT_TITLE_KEYS[segment] ?? 'notFound.title'
  const subtitleKey = SEGMENT_SUBTITLE_KEYS[segment]

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <span className="truncate text-base font-medium">{t(titleKey)}</span>
      {subtitleKey && (
        <span className="truncate text-muted-foreground text-sm">· {t(subtitleKey)}</span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <LanguageToggle />
        <ModeToggle />
      </div>
    </header>
  )
}
