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
} from '@/lib/view-store'
import { resolveViewPreviewBlob } from '@/lib/tableau-api'

export const Route = createFileRoute('/recents')({
  component: RecentsPage,
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

function RecentsPage() {
  const { t } = useTranslation()
  const recents = useSyncExternalStore(
    recentsExternalStore.subscribe,
    recentsExternalStore.getSnapshot,
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('recents.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('recents.subtitle')}</p>
        </div>
        {recents.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearRecents}>
            <Trash2 className="size-4" />
            {t('recents.clear')}
          </Button>
        )}
      </div>

      {recents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Clock className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('recents.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {recents.map((r) => (
            <ThumbnailCard
              key={`${r.workbook}/${r.view}`}
              id={`${r.workbook}/${r.view}`}
              name={r.view}
              subtitle={r.workbook}
              linkTo="/views"
              linkSearch={{ workbook: r.workbook, view: r.view }}
              thumbnailLoader={() => resolveViewPreviewBlob(r.workbook, r.view)}
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
      )}
    </div>
  )
}
