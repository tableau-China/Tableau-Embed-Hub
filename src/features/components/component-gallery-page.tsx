import { useTranslation } from 'react-i18next'
import { Blocks } from 'lucide-react'

import { NoteCallout } from '@/components/note-callout'
import { PageContainer } from '@/components/page-container'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { COMPONENT_CATALOG } from '@/config/component-catalog'
import { ActionsSection, FormsSection, LayoutSection } from '@/features/components/basic-sections'
import {
  DataSection,
  FeedbackSection,
  FiltersSection,
  HooksSection,
  OverlaysSection,
} from '@/features/components/data-sections'
import { ShellSection, TokensSection } from '@/features/components/shell-sections'

/**
 * 组件总览页（/components）—— 「动手写之前先看一眼这里」的公共件清单 + 实时预览
 *
 * 三件事：
 *   1. **App shell 规格**：侧边栏宽度、顶栏高度、页面 padding、断点 —— 数值能 import 的一律 import，
 *      避免文档与实现各写一份（「窄屏抽屉比桌面还宽」那个 bug 就是这么来的）；
 *   2. **主题 token**：颜色与圆角只认 token 类名，深色模式靠它切换；
 *   3. **组件目录**：自研通用件 + UI 原语 + 配套 hook，每条都带 import 路径与可交互预览。
 *
 * 数据来自 src/config/component-catalog.ts（唯一来源）—— 加一个公共件只需在那里加一行，
 * 版面、章节顺序都由目录驱动，本文件不用改。
 */
export function ComponentGalleryPage() {
  const { t } = useTranslation()

  return (
    <PageContainer>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <Blocks className="size-4" />
                {t('nav.components')}
              </CardTitle>
              <CardDescription>{t('components.subtitle')}</CardDescription>
            </div>
            {/* 条目数从目录本身取：清单变了这里跟着变，不用手改文案 */}
            <Badge variant="outline" data-gallery-count>
              {t('components.entryCount', { count: COMPONENT_CATALOG.length })}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground max-w-prose text-sm">{t('components.introBody')}</p>
          <NoteCallout title={t('components.introNoteTitle')}>
            <p className="text-muted-foreground max-w-prose">{t('components.introNote')}</p>
          </NoteCallout>
        </CardContent>
      </Card>

      <ShellSection />
      <TokensSection />
      {/* 以下章节按 COMPONENT_SECTION_META 的顺序（组件目录驱动，加条目不用动这里） */}
      <LayoutSection />
      <ActionsSection />
      <FormsSection />
      <DataSection />
      <FiltersSection />
      <OverlaysSection />
      <FeedbackSection />
      <HooksSection />
    </PageContainer>
  )
}
