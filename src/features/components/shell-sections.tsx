import { useTranslation } from 'react-i18next'
import { LayoutDashboard, ShieldCheck, Users } from 'lucide-react'

import { NoteCallout } from '@/components/note-callout'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
} from '@/components/ui/sidebar'
import { GalleryCard, SpecTable, TokenSwatch, type SpecRow } from '@/features/components/gallery-kit'
import { MOBILE_BREAKPOINT } from '@/hooks/use-mobile'

/**
 * App shell（外壳规格）+ Theme tokens（主题 token）两章 —— 手工版面（不走组件目录）
 *
 * 为什么这两章单独写：它们讲的不是「某个可 import 的组件」，而是**每个页面都要遵守的数值与颜色**。
 * 数值里能 import 的一律 import（侧边栏宽度、断点），避免文档与实现各写一份 ——
 * 「窄屏抽屉比桌面还宽」那个 bug 正是因为同一个宽度写了两处。
 */

/* ============================== App shell ============================== */

export function ShellSection() {
  const { t } = useTranslation()

  const rows: readonly SpecRow[] = [
    {
      item: t('components.shell.sidebarWidth'),
      value: `--sidebar-width: ${SIDEBAR_WIDTH}`,
      source: 'src/components/ui/sidebar.tsx',
    },
    {
      item: t('components.shell.sidebarIcon'),
      value: `--sidebar-width-icon: ${SIDEBAR_WIDTH_ICON}`,
      source: 'src/components/ui/sidebar.tsx',
    },
    {
      item: t('components.shell.sidebarMobile'),
      value: `w-(--sidebar-width)! → ${SIDEBAR_WIDTH}`,
      source: 'src/components/ui/sidebar.tsx',
    },
    {
      item: t('components.shell.sidebarPadding'),
      value: 'p-2 (8px) · header / group / item · item h-8',
      source: 'src/components/ui/sidebar.tsx',
    },
    {
      item: t('components.shell.header'),
      value: 'h-16 (64px) · px-2 md:px-4 · border-b',
      source: 'src/components/header.tsx',
    },
    {
      item: t('components.shell.main'),
      value: 'p-2 (8px) · md:p-4 (16px)',
      source: 'src/routes/__root.tsx',
    },
    {
      item: t('components.shell.pageGap'),
      value: 'gap-6 (24px) · no max-w (page fills the content area)',
      source: 'src/components/page-container.tsx',
    },
    {
      item: t('components.shell.cardSpacing'),
      value: '--card-spacing: 16px · size="sm" → 12px',
      source: 'src/components/ui/card.tsx',
    },
    {
      item: t('components.shell.breakpoint'),
      value: `md = ${MOBILE_BREAKPOINT}px`,
      source: 'src/hooks/use-mobile.ts',
    },
  ]

  return (
    <GalleryCard
      id="shell"
      title={t('components.shell.title')}
      hint={t('components.shell.hint')}
    >
      <SpecTable rows={rows} />

      {/* 侧边栏导航的静态切片：用真实的侧边栏件渲染，颜色/间距与线上一致 */}
      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          {t('components.shell.mockTitle')}
        </span>
        <SidebarProvider className="min-h-0">
          <div className="bg-sidebar text-sidebar-foreground w-44 overflow-hidden rounded-lg border">
            <SidebarGroup>
              <SidebarGroupLabel>{t('components.shell.mockGroup')}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive>
                      <LayoutDashboard />
                      <span>{t('nav.dashboard')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <Users />
                      <span>{t('nav.users')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled>
                      <ShieldCheck />
                      <span>{t('nav.permissions')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        </SidebarProvider>
      </div>

      <NoteCallout tone="warning" title={t('components.shell.noteTitle')}>
        <p className="text-muted-foreground max-w-prose">
          {t('components.shell.note', { width: SIDEBAR_WIDTH })}
        </p>
      </NoteCallout>
    </GalleryCard>
  )
}

/* ============================== Theme tokens ============================== */

const SURFACE_TOKENS = [
  { token: 'bg-background', cls: 'bg-background', hint: 'components.tokens.hintBackground' },
  { token: 'bg-card', cls: 'bg-card', hint: 'components.tokens.hintCard' },
  { token: 'bg-popover', cls: 'bg-popover', hint: 'components.tokens.hintPopover' },
  { token: 'bg-primary', cls: 'bg-primary', hint: 'components.tokens.hintPrimary' },
  { token: 'bg-secondary', cls: 'bg-secondary', hint: 'components.tokens.hintSecondary' },
  { token: 'bg-muted', cls: 'bg-muted', hint: 'components.tokens.hintMuted' },
  { token: 'bg-accent', cls: 'bg-accent', hint: 'components.tokens.hintAccent' },
  { token: 'bg-destructive', cls: 'bg-destructive', hint: 'components.tokens.hintDestructive' },
  { token: 'bg-border', cls: 'bg-border', hint: 'components.tokens.hintBorder' },
  { token: 'bg-ring', cls: 'bg-ring', hint: 'components.tokens.hintRing' },
] as const

const SIDEBAR_TOKENS = [
  { token: 'bg-sidebar', cls: 'bg-sidebar', hint: 'components.tokens.hintSidebar' },
  { token: 'bg-sidebar-accent', cls: 'bg-sidebar-accent', hint: 'components.tokens.hintSidebarAccent' },
  { token: 'bg-sidebar-primary', cls: 'bg-sidebar-primary', hint: 'components.tokens.hintSidebarPrimary' },
  { token: 'bg-sidebar-border', cls: 'bg-sidebar-border', hint: 'components.tokens.hintSidebarBorder' },
  { token: 'bg-sidebar-ring', cls: 'bg-sidebar-ring', hint: 'components.tokens.hintSidebarRing' },
] as const

const RADIUS_TOKENS = [
  { cls: 'rounded-sm', token: '--radius-sm', value: '10px × 0.6 = 6px' },
  { cls: 'rounded-md', token: '--radius-md', value: '10px × 0.8 = 8px' },
  { cls: 'rounded-lg', token: '--radius-lg', value: '10px（圆角基准）' },
  { cls: 'rounded-xl', token: '--radius-xl', value: '10px × 1.4 = 14px（Card）' },
  { cls: 'rounded-2xl', token: '--radius-2xl', value: '10px × 1.8 = 18px' },
] as const

export function TokensSection() {
  const { t } = useTranslation()

  return (
    <GalleryCard id="tokens" title={t('components.tokens.title')} hint={t('components.tokens.hint')}>
      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          {t('components.tokens.surface')}
        </span>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {SURFACE_TOKENS.map((item) => (
            <TokenSwatch
              key={item.token}
              token={item.token}
              className={item.cls}
              hint={t(item.hint)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          {t('components.tokens.sidebar')}
        </span>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {SIDEBAR_TOKENS.map((item) => (
            <TokenSwatch
              key={item.token}
              token={item.token}
              className={item.cls}
              hint={t(item.hint)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          {t('components.tokens.radius')}
        </span>
        <div className="flex flex-wrap gap-2">
          {RADIUS_TOKENS.map((item) => (
            <div key={item.token} className="flex items-center gap-2 rounded-md border p-2">
              <span className={`bg-muted size-8 shrink-0 border ${item.cls}`} aria-hidden />
              <span className="flex min-w-0 flex-col">
                <code className="text-[11px]">{item.token}</code>
                <span className="text-muted-foreground text-[11px]">{item.value}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </GalleryCard>
  )
}
