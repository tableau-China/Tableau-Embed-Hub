import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Loader2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ThumbnailCard } from '@/components/thumbnail-card'
import {
  fetchWorkbooks,
  fetchWorkbookViews,
  previewImageQueryOptions,
  type TableauWorkbook,
} from '@/lib/tableau-api'
import { isFavorite, toggleFavorite } from '@/lib/view-store'

export const Route = createFileRoute('/t/$teamSlug/workbooks')({
  component: WorkbooksPage,
})

/** 收起状态下列出的 dashboard 数量（与 pg-explorer 一致） */
const DASHBOARDS_PREVIEW_COUNT = 4

function WorkbooksPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tableau', 'workbooks'],
    queryFn: fetchWorkbooks,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('workbooks.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('workbooks.subtitle')}</p>
        </div>
        {error && (
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t('views.retry')}
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex h-[40vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="font-medium text-destructive">{t('workbooks.error')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('workbooks.errorHint')}</p>
          </CardContent>
        </Card>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('workbooks.empty')}
          </CardContent>
        </Card>
      )}

      {/* 双层结构：Workbook 卡片（每行一个，可展开） */}
      {data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {data.map((wb) => (
            <WorkbookCard key={wb.id} workbook={wb} />
          ))}
        </div>
      )}
    </div>
  )
}

function WorkbookCard({ workbook }: { workbook: TableauWorkbook }) {
  const { t } = useTranslation()
  const { teamSlug } = Route.useParams()
  const [isExpanded, setIsExpanded] = useState(false)

  // dashboard（视图）列表：立即加载，无需延迟（与 pg-explorer 一致）
  const { data: dashboards, isLoading: loadingDashboards } = useQuery({
    queryKey: ['tableau', 'views', workbook.id],
    queryFn: () => fetchWorkbookViews(workbook.id),
    retry: 1,
    staleTime: 10 * 60 * 1000,
  })

  // 展开时显示全部，收起时显示前 4 个
  const visibleDashboards = isExpanded
    ? dashboards ?? []
    : (dashboards?.slice(0, DASHBOARDS_PREVIEW_COUNT) ?? [])

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="px-4 pb-1 pt-1">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 shrink-0 text-muted-foreground" />
              <CardTitle className="truncate text-base">{workbook.name}</CardTitle>
              {workbook.projectName && (
                <span className="truncate text-sm text-muted-foreground">
                  · {workbook.projectName}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {workbook.updatedAt && (
                <span>更新: {new Date(workbook.updatedAt).toLocaleDateString()}</span>
              )}
              {dashboards && dashboards.length > 0 && (
                <Badge variant="outline" className="text-xs font-normal">
                  <LayoutDashboard className="mr-1 size-3" />
                  {t('workbooks.dashboardsCount', { count: dashboards.length })}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-1 pt-0">
        {/* Dashboard 缩略图网格 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visibleDashboards.map((d) => (
            <ThumbnailCard
              key={d.id}
              id={d.id}
              name={d.name}
              subtitle={workbook.name}
              linkTo="/t/$teamSlug/views"
              linkParams={{ teamSlug }}
              linkSearch={{ workbook: workbook.id, view: d.id }}
              thumbnailQuery={previewImageQueryOptions('view', d.id)}
              showFavorite
              isFavorited={isFavorite(workbook.name, d.name)}
              onToggleFavorite={() => toggleFavorite(workbook.name, d.name)}
              showInfo
              infoMetaRows={[
                { label: t('thumbnailCard.workbook'), value: workbook.name },
                { label: t('thumbnailCard.id'), value: d.id },
              ]}
              updatedAt={workbook.updatedAt}
              menuPreset="favorites"
            />
          ))}
          {loadingDashboards &&
            [...Array(DASHBOARDS_PREVIEW_COUNT)].map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded bg-muted" />
            ))}
          {dashboards && dashboards.length === 0 && (
            <div className="col-span-full py-2 text-xs text-muted-foreground">
              {t('workbooks.noDashboards')}
            </div>
          )}
        </div>

        {/* 展开/收起 */}
        {dashboards && dashboards.length > DASHBOARDS_PREVIEW_COUNT && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronDown className="size-3" />
                <span>{t('workbooks.collapse')}</span>
              </>
            ) : (
              <>
                <ChevronRight className="size-3" />
                <span>{t('workbooks.viewAll', { count: dashboards.length })}</span>
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
