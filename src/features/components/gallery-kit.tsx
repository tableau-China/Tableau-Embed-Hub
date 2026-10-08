import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  COMPONENT_SECTION_META,
  componentsOf,
  type ComponentEntry,
  type ComponentSection,
} from '@/config/component-catalog'
import { cn } from '@/lib/utils'

/**
 * 组件总览页的**版面零件**（只服务于 /components，不对外复用）
 *
 * 页面结构刻意做成「数据驱动」：章节与条目从 `COMPONENT_CATALOG` 渲染，
 * 各章节文件只需提供 `id → 预览组件` 的映射（DEMOS）。
 * 于是「加一个公共件」= 目录文件加一行 + （可选）DEMOS 加一个组件，版面不用改。
 */

/** id → 预览组件。没有对应 id 的条目会显示「无实时预览」。 */
export type DemoMap = Record<string, ComponentType>

/** 章节外壳：标题 + 一句话说明 + 内容（所有章节共用，保证观感一致） */
export function GalleryCard({
  id,
  title,
  hint,
  children,
}: {
  id: string
  title: ReactNode
  hint: ReactNode
  children: ReactNode
}) {
  return (
    <Card data-gallery-section={id}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}

/** 目录驱动章节：按 COMPONENT_CATALOG 的顺序渲染该章节的全部条目 */
export function GallerySection({ section, demos }: { section: ComponentSection; demos: DemoMap }) {
  const { t } = useTranslation()
  const meta = COMPONENT_SECTION_META.find((item) => item.id === section)

  if (!meta) return null

  return (
    <GalleryCard id={section} title={t(meta.titleKey)} hint={t(meta.hintKey)}>
      {componentsOf(section).map((entry) => (
        <EntryCard key={entry.id} entry={entry} Demo={demos[entry.id]} />
      ))}
    </GalleryCard>
  )
}

/** 单个条目：名字 + 用途 + import 路径 + 实时预览（+ 可选用法片段） */
function EntryCard({ entry, Demo }: { entry: ComponentEntry; Demo?: ComponentType }) {
  const { t } = useTranslation()
  const hasSnippet = entry.snippet !== undefined

  return (
    <article className="flex flex-col gap-3 rounded-lg border p-4" data-component={entry.id}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-sm font-medium break-words">{entry.name}</h3>
          <p className="text-muted-foreground text-xs">{t(entry.descKey)}</p>
        </div>
        <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px] break-all">
          {entry.importPath}
        </code>
      </header>

      {Demo ? (
        <Demo />
      ) : (
        !hasSnippet && (
          <p className="text-muted-foreground text-xs" data-no-preview>
            {t('components.noPreview')}
          </p>
        )
      )}

      {entry.snippet !== undefined && (
        <Snippet label={t('components.snippetLabel')} code={entry.snippet} />
      )}
    </article>
  )
}

/** 代码片段（纯展示，不给复制按钮 —— 这个页面是「看一眼」，不是 playground） */
export function Snippet({ label, code }: { label?: string; code: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label !== undefined && (
        <span className="text-muted-foreground text-[11px] font-medium">{label}</span>
      )}
      <pre className="bg-muted/50 overflow-x-auto rounded-md border p-3 text-[11px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export interface SpecRow {
  item: ReactNode
  value: ReactNode
  source?: ReactNode
}

/** 规格表（App shell 章节用）：刻意给长文案列加 whitespace-normal —— 见 docs/ui-conventions.md §2 */
export function SpecTable({ rows }: { rows: readonly SpecRow[] }) {
  const { t } = useTranslation()

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('components.shell.item')}</TableHead>
            <TableHead>{t('components.shell.value')}</TableHead>
            <TableHead className="whitespace-normal">{t('components.shell.where')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              <TableCell className="align-top whitespace-normal">{row.item}</TableCell>
              <TableCell className="align-top font-mono text-xs whitespace-normal">
                {row.value}
              </TableCell>
              <TableCell className="text-muted-foreground align-top text-xs whitespace-normal">
                {row.source}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** 颜色 token 色块 */
export function TokenSwatch({
  token,
  className,
  hint,
}: {
  token: string
  className: string
  hint?: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border p-2">
      <span className={cn('size-8 shrink-0 rounded-md border', className)} aria-hidden />
      <span className="flex min-w-0 flex-col">
        <code className="text-[11px] break-all">{token}</code>
        {hint !== undefined && (
          <span className="text-muted-foreground text-[11px]">{hint}</span>
        )}
      </span>
    </div>
  )
}
