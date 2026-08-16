import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertCircle, Loader2, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TableauEmbed } from '@/components/tableau/tableau-embed'
import { buildViewUrl } from '@/config/tableau'
import {
  fetchWorkbooks,
  fetchWorkbookViews,
  type TableauWorkbook,
} from '@/lib/tableau-api'
import { addRecent, isFavorite, toggleFavorite } from '@/lib/view-store'

export const Route = createFileRoute('/views')({
  validateSearch: (search: Record<string, unknown>) => ({
    workbook: typeof search.workbook === 'string' ? search.workbook : undefined,
    view: typeof search.view === 'string' ? search.view : undefined,
  }),
  component: ViewsPage,
})

function ViewsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workbook, view } = useSearch({ from: '/views' })
  const [manualUrl, setManualUrl] = useState('')

  const {
    data: workbooks,
    isLoading: loadingWorkbooks,
    error: workbooksError,
    refetch: refetchWorkbooks,
  } = useQuery({
    queryKey: ['tableau', 'workbooks'],
    queryFn: fetchWorkbooks,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const selectedWorkbook = useMemo<TableauWorkbook | undefined>(
    () => workbooks?.find((w) => w.name === workbook),
    [workbooks, workbook],
  )

  const {
    data: views,
    isLoading: loadingViews,
    error: viewsError,
  } = useQuery({
    queryKey: ['tableau', 'views', selectedWorkbook?.id],
    queryFn: () => fetchWorkbookViews(selectedWorkbook!.id),
    enabled: !!selectedWorkbook?.id,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const embedSrc =
    manualUrl.trim() ||
    (workbook && view ? buildViewUrl(workbook, view) : undefined)

  useEffect(() => {
    if (workbook && view) addRecent(workbook, view)
  }, [workbook, view])

  const favorited = workbook && view ? isFavorite(workbook, view) : false

  const go = (next: { workbook?: string; view?: string }) => {
    void navigate({
      to: '/views',
      search: { workbook: next.workbook, view: next.view },
    })
  }

  const onToggleFavorite = () => {
    if (!workbook || !view) return
    const nowFav = toggleFavorite(workbook, view)
    toast(nowFav ? t('views.favorited') : t('views.unfavorited'))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('views.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('views.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('views.selectWorkbook')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="grid min-w-56 flex-1 gap-2">
            <Label>{t('views.workbook')}</Label>
            {loadingWorkbooks ? (
              <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t('views.loadingWorkbooks')}
              </div>
            ) : (
              <Select
                value={workbook ?? undefined}
                onValueChange={(v) => go({ workbook: v, view: undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('views.selectWorkbook')} />
                </SelectTrigger>
                <SelectContent>
                  {(workbooks ?? []).map((w) => (
                    <SelectItem key={w.id} value={w.name}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {workbooksError && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="size-3" />
                {t('views.loadError')}
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => void refetchWorkbooks()}
                >
                  {t('views.retry')}
                </Button>
              </p>
            )}
          </div>

          <div className="grid min-w-56 flex-1 gap-2">
            <Label>{t('views.view')}</Label>
            <Select
              value={view ?? undefined}
              onValueChange={(v) => go({ workbook, view: v })}
              disabled={!selectedWorkbook}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('views.selectView')} />
              </SelectTrigger>
              <SelectContent>
                {viewsError && (
                  <div className="px-2 py-1.5 text-xs text-destructive">
                    {t('views.loadError')}
                  </div>
                )}
                {(views ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.name}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loadingViews && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {t('views.loadingWorkbooks')}
              </p>
            )}
          </div>

          {workbook && view && (
            <Button variant="outline" size="icon" onClick={onToggleFavorite}>
              <Star className={favorited ? 'fill-amber-400 text-amber-400' : ''} />
              <span className="sr-only">
                {favorited ? t('views.unfavorite') : t('views.favorite')}
              </span>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('views.manualUrl')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <Input
            placeholder={t('views.manualPlaceholder')}
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            className="max-w-xl flex-1"
          />
          {manualUrl.trim() && (
            <Button variant="secondary" onClick={() => setManualUrl('')}>
              {t('common.clear')}
            </Button>
          )}
        </CardContent>
      </Card>

      <TableauEmbed src={embedSrc} />
    </div>
  )
}
