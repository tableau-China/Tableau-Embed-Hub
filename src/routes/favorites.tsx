import { createFileRoute } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { ThumbnailCard } from '@/components/thumbnail-card'
import { favoritesExternalStore, removeFavorite } from '@/lib/view-store'
import { resolveViewPreviewBlob } from '@/lib/tableau-api'

export const Route = createFileRoute('/favorites')({
  component: FavoritesPage,
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

function FavoritesPage() {
  const { t } = useTranslation()
  const favorites = useSyncExternalStore(
    favoritesExternalStore.subscribe,
    favoritesExternalStore.getSnapshot,
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('favorites.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('favorites.subtitle')}</p>
      </div>

      {favorites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Star className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('favorites.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {favorites.map((f) => (
            <ThumbnailCard
              key={`${f.workbook}/${f.view}`}
              id={`${f.workbook}/${f.view}`}
              name={f.view}
              subtitle={f.workbook}
              linkTo="/views"
              linkSearch={{ workbook: f.workbook, view: f.view }}
              thumbnailLoader={() => resolveViewPreviewBlob(f.workbook, f.view)}
              updatedAt={f.accessedAt}
              showFavorite
              isFavorited
              onToggleFavorite={() => removeFavorite(f.workbook, f.view)}
              showInfo
              infoMetaRows={[
                { label: t('thumbnailCard.workbook'), value: f.workbook },
                { label: t('thumbnailCard.addedAt'), value: formatDate(f.accessedAt) },
              ]}
              menuPreset="favorites"
            />
          ))}
        </div>
      )}
    </div>
  )
}
