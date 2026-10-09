import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertCircle, ArrowLeft, Copy, ExternalLink, Info, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TableauEmbed } from '@/components/tableau/tableau-embed'
import { TABLEAU_CONFIG, buildViewUrl } from '@/config/tableau'
import {
  fetchViewDetail,
  fetchWorkbooks,
  fetchWorkbookViews,
  type TableauView,
  type TableauWorkbook,
} from '@/lib/tableau-api'
import { addRecent, getRecents, isFavorite, toggleFavorite, useFavorites } from '@/lib/view-store'
import { resolveInitialViewSearch } from '@/lib/view-entry'

export const Route = createFileRoute('/t/$teamSlug/views')({
  validateSearch: (search: Record<string, unknown>) => ({
    workbook: typeof search.workbook === 'string' ? search.workbook : undefined,
    view: typeof search.view === 'string' ? search.view : undefined,
  }),
  component: ViewsPage,
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s?: string) => !!s && UUID_RE.test(s)

function ViewsPage() {
  const { t } = useTranslation()
  const { teamSlug } = Route.useParams()
  const navigate = useNavigate()
  const { workbook, view } = useSearch({ from: '/t/$teamSlug/views' })
  const [manualUrl, setManualUrl] = useState('')

  const {
    data: workbooks,
    error: workbooksError,
    isLoading: workbooksLoading,
    refetch: refetchWorkbooks,
  } = useQuery({
    queryKey: ['tableau', 'workbooks'],
    queryFn: fetchWorkbooks,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  // 视图详情（仅 view UUID 参数、无 workbook 参数时）：解析视图及其所属工作簿
  const {
    data: viewDetail,
    error: viewDetailError,
    isLoading: viewDetailLoading,
    refetch: refetchViewDetail,
  } = useQuery({
    queryKey: ['tableau', 'view-detail', view],
    queryFn: () => fetchViewDetail(view!),
    enabled: !!view && isUuid(view) && !workbook,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  // 工作簿解析：view-only → 详情里的 workbookId（优先命中受限项目列表取全名）；
  // 否则按 URL 参数匹配（UUID 优先，名称兜底——兼容旧链接）
  const selectedWorkbook = useMemo<TableauWorkbook | undefined>(() => {
    if (viewDetail) {
      const matched = workbooks?.find((w) => w.id === viewDetail.workbookId)
      if (matched) return matched
      if (viewDetail.workbookId) {
        return {
          id: viewDetail.workbookId,
          name: viewDetail.workbookContentUrl || viewDetail.workbookId,
          contentUrl: viewDetail.workbookContentUrl || '',
        }
      }
      return undefined
    }
    return (
      workbooks?.find((w) => w.id === workbook) ??
      workbooks?.find((w) => w.name === workbook)
    )
  }, [workbooks, workbook, viewDetail])

  const {
    data: views,
    error: viewsError,
    isLoading: viewsLoading,
    refetch: refetchViews,
  } = useQuery({
    queryKey: ['tableau', 'views', selectedWorkbook?.id],
    queryFn: () => fetchWorkbookViews(selectedWorkbook!.id),
    enabled: !!selectedWorkbook?.id && !viewDetail,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const selectedView = useMemo<TableauView | undefined>(() => {
    if (viewDetail) {
      return { id: viewDetail.id, name: viewDetail.name, contentUrl: viewDetail.contentUrl }
    }
    return views?.find((v) => v.id === view) ?? views?.find((v) => v.name === view)
  }, [views, view, viewDetail])

  // 嵌入 URL 必须用名称路径（实测 UUID / contentUrl 路径 404）；
  // 名称取自 API 解析结果（按 UUID 查询），不经过 URL 编码往返，避免不稳定。
  const embedSrc =
    manualUrl.trim() ||
    (selectedWorkbook && selectedView
      ? buildViewUrl(selectedWorkbook.name, selectedView.name)
      : undefined)

  useEffect(() => {
    if (selectedWorkbook && selectedView) {
      addRecent(selectedWorkbook.name, selectedView.name, {
        workbookId: selectedWorkbook.id,
        viewId: selectedView.id,
      })
    }
  }, [selectedWorkbook, selectedView])

  // URL 规范化 + 自动打开（仅工作簿驱动路径；view-only 已是最简形态）：
  // - 旧链接（workbook + view 参数，或名称为参数）→ 重写为只含视图 UUID；
  // - 只带 workbook 未指定视图（或视图参数已失效）→ 自动选中默认视图（defaultViewId 匹配，兜底第一个）。
  useEffect(() => {
    if (viewDetail) return
    if (!selectedWorkbook || !views || views.length === 0) return
    const requested = view
      ? views.find((v) => v.id === view) ?? views.find((v) => v.name === view)
      : undefined
    const targetView =
      requested ??
      views.find((v) => v.id === selectedWorkbook.defaultViewId) ??
      views[0]
    if (!targetView) return
    if (!workbook && view === targetView.id) return
    void navigate({
      to: '/t/$teamSlug/views',
      params: { teamSlug },
      search: { workbook: undefined, view: targetView.id },
      replace: true,
    })
  }, [viewDetail, selectedWorkbook, views, view, workbook, navigate, teamSlug])

  /**
   * 落点 1/2：**地址里没有指定视图时**，落到"上次打开的视图"；没有最近记录就落到固定兜底视图。
   *
   * 为什么放在页面而不是侧边栏链接上：直接输 URL、书签、旧路径 /views 的重定向、
   * 浏览器前进后退都会走到这里 —— 规则放在页面，从任何入口进来都落到同一个地方。
   * 读 recents 放在 effect 里（不在渲染期读 localStorage）；导航后 search 参数就位，不会重复触发。
   */
  useEffect(() => {
    if (workbook || view) return
    const target = resolveInitialViewSearch(getRecents(), TABLEAU_CONFIG.fallbackViewId)
    if (!target) return
    void navigate({
      to: '/t/$teamSlug/views',
      params: { teamSlug },
      // 路由的 validateSearch 产出的是**两个键都在**的形状，这里显式写全（可能为 undefined）
      search: { workbook: target.workbook, view: target.view },
      replace: true,
    })
  }, [workbook, view, navigate, teamSlug])

  /**
   * 落点 2/2：**解析不出来就落到固定兜底视图**（「如果找不到」那条要求的落点）。
   *
   * 触发条件是"查询都跑完 + 仍然没有可嵌入的视图 + 当前不是兜底视图"：
   * 共享链接指向已删除视图、最近记录里的视图被删、UUID 拼错…… 所有"找不到"的情形
   * 都收敛到同一个兜底视图，而不是停在空白嵌入框上。
   *
   * 只接管两种入口：**完全没参数**、**只给了视图 UUID**（且没有 workbook 参数）。
   * 带 workbook 参数或旧式名称参数的链接走各自既有的解析逻辑（它们本来就有"默认视图 / 名称兜底"），
   * 否则 check:team-routes 的「/views?view=abc 保留 search 参数」用例会被兜底抢走。
   * 已经在兜底视图上时不再跳转（与上面那条一起保证不会来回跳）。
   */
  const resolving = workbooksLoading || viewDetailLoading || viewsLoading
  useEffect(() => {
    if (embedSrc || resolving || workbook) return
    if (view !== undefined && !isUuid(view)) return
    const fallback = TABLEAU_CONFIG.fallbackViewId
    if (!fallback || view === fallback) return
    void navigate({
      to: '/t/$teamSlug/views',
      params: { teamSlug },
      search: { workbook: undefined, view: fallback },
      replace: true,
    })
  }, [embedSrc, resolving, workbook, view, navigate, teamSlug])

  // 订阅收藏列表：切换收藏后星标即时更新
  useFavorites()

  const favorited =
    selectedWorkbook && selectedView
      ? isFavorite(selectedWorkbook.name, selectedView.name, {
          workbookId: selectedWorkbook.id,
          viewId: selectedView.id,
        })
      : false

  const onToggleFavorite = () => {
    if (!selectedWorkbook || !selectedView) return
    const nowFav = toggleFavorite(selectedWorkbook.name, selectedView.name, {
      workbookId: selectedWorkbook.id,
      viewId: selectedView.id,
    })
    toast(nowFav ? t('views.favorited') : t('views.unfavorited'))
  }

  const onRetry = () => {
    void refetchWorkbooks()
    void refetchViews()
    void refetchViewDetail()
  }

  // 当前视图在 Tableau 服务器上的 URL（名称由 API 按 UUID 解析而来）
  const tableauUrl =
    selectedWorkbook && selectedView
      ? buildViewUrl(selectedWorkbook.name, selectedView.name)
      : ''

  const onCopyUrl = async () => {
    if (!tableauUrl) return
    try {
      await navigator.clipboard.writeText(tableauUrl)
      toast(t('views.copied'))
    } catch {
      toast(t('views.copyFailed'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          {/*
            视图名与工作簿名**同一行**（不再各占一行）：一行能放下时就别用两行，
            标题区更紧凑。两者都可以截断（min-w-0 + truncate），星标不参与压缩（shrink-0）。
          */}
          <div className="flex min-w-0 items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-ml-2 size-8 shrink-0 p-0 text-muted-foreground"
            >
              <Link
                to="/t/$teamSlug/workbooks"
                params={{ teamSlug }}
                aria-label={t('views.backToWorkbooks')}
                title={t('views.backToWorkbooks')}
              >
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">
              {selectedView?.name ?? t('views.title')}
            </h1>
            <span className="min-w-0 truncate text-muted-foreground text-sm">
              {selectedWorkbook ? selectedWorkbook.name : t('views.subtitle')}
            </span>
            {/* 收藏开关：紧跟在工作簿名右侧（原来在最右侧的按钮组里，离标题太远） */}
            {selectedWorkbook && selectedView && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={onToggleFavorite}
                aria-label={favorited ? t('views.unfavorite') : t('views.favorite')}
                title={favorited ? t('views.unfavorite') : t('views.favorite')}
              >
                <Star className={favorited ? 'fill-amber-400 text-amber-400' : ''} />
              </Button>
            )}
          </div>
          {(workbooksError || viewsError || viewDetailError) && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3" />
              {t('views.loadError')}
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onRetry}>
                {t('views.retry')}
              </Button>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* 信息弹层：当前视图在 Tableau 上的 URL（可复制）+ 手动 URL 兜底 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-8 text-muted-foreground"
                title={t('views.tableauUrl')}
                aria-label={t('views.tableauUrl')}
              >
                <Info className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96">
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>{t('views.tableauUrl')}</Label>
                  <div className="flex items-start gap-1.5">
                    {/*
                      两处必须：① **换行**显示（原来 truncate 只留一行，长 URL 会顶出下边框）；
                      ② 它本身是链接，点击在新标签页打开该视图（跳转与右侧的复制按钮并存）。
                      链接里带上外链图标，否则"能点"这件事没有任何视觉线索。
                    */}
                    {tableauUrl ? (
                      <a
                        href={tableauUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={t('views.openInTableau')}
                        aria-label={t('views.openInTableau')}
                        className="bg-muted hover:bg-accent flex min-w-0 flex-1 items-start gap-1.5 rounded-md border px-2 py-1.5 font-mono text-xs hover:underline"
                      >
                        <ExternalLink className="text-muted-foreground mt-0.5 size-3 shrink-0" />
                        <span className="min-w-0 break-all">{tableauUrl}</span>
                      </a>
                    ) : (
                      <code className="bg-muted min-w-0 flex-1 rounded-md border px-2 py-1.5 font-mono text-xs">
                        —
                      </code>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => void onCopyUrl()}
                      disabled={!tableauUrl}
                      aria-label={t('views.copyUrl')}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>{t('views.manualUrl')}</Label>
                  <Input
                    placeholder={t('views.manualPlaceholder')}
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                  />
                  {manualUrl.trim() && (
                    <Button variant="secondary" size="sm" onClick={() => setManualUrl('')}>
                      {t('common.clear')}
                    </Button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

        </div>
      </div>

      <TableauEmbed src={embedSrc} />
    </div>
  )
}