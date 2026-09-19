import { createFileRoute } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ThumbnailCard } from '@/components/thumbnail-card'
import {
  clearRecents,
  isFavorite,
  recentsExternalStore,
  toggleFavorite,
  useFavorites,
} from '@/lib/view-store'
import { resolvedViewPreviewQueryOptions } from '@/lib/tableau-api'

export const Route = createFileRoute('/t/$teamSlug/recents')({
  component: RecentsPage,
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

function RecentsPage() {
  const { t } = useTranslation()
  const { teamSlug } = Route.useParams()
  const recents = useSyncExternalStore(
    recentsExternalStore.subscribe,
    recentsExternalStore.getSnapshot,
  )
  // 订阅收藏列表：在最近浏览里切换收藏后星标即时更新
  useFavorites()

  return (
    <div className="flex flex-col gap-6">
      {recents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Clock className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('recents.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 网格直接开头：与 favorites 一致，顶部不再有独占一行的空按钮 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {recents.map((r) => (
              <ThumbnailCard
                key={`${r.workbook}/${r.view}`}
                id={`${r.workbook}/${r.view}`}
                name={r.view}
                subtitle={r.workbook}
                linkTo="/t/$teamSlug/views"
                linkParams={{ teamSlug }}
                linkSearch={{
                  workbook: r.workbookId ?? r.workbook,
                  view: r.viewId ?? r.view,
                }}
                thumbnailQuery={resolvedViewPreviewQueryOptions(r.workbook, r.view)}
                updatedAt={r.accessedAt}
                showFavorite
                isFavorited={isFavorite(r.workbook, r.view)}
                onToggleFavorite={() => toggleFavorite(r.workbook, r.view)}
                showInfo
                infoMetaRows={[
                  { label: t('thumbnailCard.workbook'), value: r.workbook },
                  { label: t('thumbnailCard.accessedAt'), value: formatDate(r.accessedAt) },
                ]}
              />
            ))}
          </div>

          {/* 清空入口移到网格下方：低频、破坏性操作，ghost 弱化存在感 */}
          <Button
            variant="ghost"
            size="sm"
            className="self-end"
            onClick={clearRecents}
          >
            <Trash2 className="size-4" />
            {t('recents.clear')}
          </Button>
        </>
      )}
    </div>
  )
}
