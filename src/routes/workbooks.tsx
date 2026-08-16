import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ThumbnailCard } from '@/components/thumbnail-card'
import { fetchWorkbooks, getPreviewImageBlob } from '@/lib/tableau-api'

export const Route = createFileRoute('/workbooks')({
  component: WorkbooksPage,
})

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

      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.map((wb) => (
            <ThumbnailCard
              key={wb.id}
              id={wb.id}
              name={wb.name}
              subtitle={wb.projectName ?? '-'}
              linkTo="/views"
              linkSearch={{ workbook: wb.name }}
              updatedAt={wb.updatedAt}
              thumbnailLoader={(id) => getPreviewImageBlob('workbook', id)}
              showInfo
              infoMetaRows={[
                { label: t('thumbnailCard.project'), value: wb.projectName ?? '-' },
                { label: t('thumbnailCard.id'), value: wb.id },
              ]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
