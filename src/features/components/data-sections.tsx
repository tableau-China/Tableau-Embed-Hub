import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, Copy, FileText, Plus, Search, Settings, ShieldX } from 'lucide-react'
import { toast } from 'sonner'

import { ConfigStatusCard } from '@/components/config-status-card'
import { DescriptionList } from '@/components/description-list'
import { FilterBar, FilterSearch, FilterSelect, type FilterOption } from '@/components/filter-bar'
import { NoteCallout } from '@/components/note-callout'
import { GuardCard } from '@/components/route-guard'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GallerySection, type DemoMap } from '@/features/components/gallery-kit'
import { useListFilters } from '@/hooks/use-list-filters'

/**
 * 「数据展示」「列表筛选」「浮层」「反馈与状态」「配套 hook」五章的预览组件
 *
 * 列表筛选这一章是**可交互的完整例子**：它同时演示了 FilterBar 三件套、
 * useListFilters 与「筛选后空态」—— 新增列表页时照抄这一段即可。
 */

/* ============================== 数据展示 ============================== */

const TABLE_ROWS = [
  { name: 'Alpha Workbook', owner: 'laura', members: 4 },
  { name: 'Beta Workbook', owner: 'marco', members: 2 },
  { name: 'Gamma Workbook', owner: 'nina', members: 7 },
] as const

function TableDemo() {
  const { t } = useTranslation()
  return (
    <Table>
      <TableCaption>{t('components.demo.tableCaption')}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t('components.demo.tableName')}</TableHead>
          <TableHead>{t('components.demo.tableOwner')}</TableHead>
          <TableHead className="text-right">{t('components.demo.tableMembers')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {TABLE_ROWS.map((row) => (
          <TableRow key={row.name}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell>{row.owner}</TableCell>
            <TableCell className="text-right tabular-nums">{row.members}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function BadgeDemo() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>{t('components.demo.badgeDefault')}</Badge>
      <Badge variant="secondary">{t('components.demo.badgeSecondary')}</Badge>
      <Badge variant="outline">{t('components.demo.badgeOutline')}</Badge>
      <Badge variant="destructive">{t('components.demo.badgeDanger')}</Badge>
    </div>
  )
}

function AvatarDemo() {
  return (
    <div className="flex items-center gap-4">
      <Avatar>
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
      <AvatarGroup>
        <Avatar>
          <AvatarFallback>AL</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>MK</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>NN</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+2</AvatarGroupCount>
      </AvatarGroup>
    </div>
  )
}

function DescriptionListDemo() {
  const { t } = useTranslation()
  return (
    <DescriptionList
      items={[
        { label: t('components.demo.dlOwner'), value: 'laura' },
        { label: t('components.demo.dlProject'), value: 'Finance' },
        { label: t('components.demo.dlUpdated'), value: '2026-10-08', icon: <Calendar className="size-3.5" /> },
        { label: t('components.demo.dlId'), value: 'wb-0042', icon: <FileText className="size-3.5" /> },
      ]}
    />
  )
}

function SkeletonDemo() {
  return (
    <div className="flex max-w-md items-center gap-3">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  )
}

function BreadcrumbDemo() {
  const { t } = useTranslation()
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#">{t('components.demo.crumbHome')}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#">{t('nav.teams')}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{t('components.demo.crumbCurrent')}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/* ============================== 列表筛选 ============================== */

type GalleryStatus = 'active' | 'paused'

/** 默认值 = 「重置」的目标值，写成模块级常量（与真实列表页同一约定） */
const FILTER_DEFAULTS: { q: string; status: string } = { q: '', status: 'all' }

const LIST_ROWS: readonly { name: string; owner: string; status: GalleryStatus }[] = [
  { name: 'Alpha Workbook', owner: 'laura', status: 'active' },
  { name: 'Beta Workbook', owner: 'marco', status: 'paused' },
  { name: 'Gamma Workbook', owner: 'nina', status: 'active' },
]

function FilterBarDemo() {
  const { t } = useTranslation()
  const filters = useListFilters(FILTER_DEFAULTS)
  const [columns, setColumns] = useState(false)

  const statusOptions: FilterOption[] = [
    { value: 'active', label: t('components.demo.statusActive') },
    { value: 'paused', label: t('components.demo.statusPaused') },
  ]

  const rows = useMemo(() => {
    const q = filters.values.q.trim().toLowerCase()
    return LIST_ROWS.filter((row) => {
      const matchQ = q === '' || row.name.toLowerCase().includes(q) || row.owner.includes(q)
      const matchStatus = filters.values.status === 'all' || row.status === filters.values.status
      return matchQ && matchStatus
    })
  }, [filters.values.q, filters.values.status])

  return (
    <div className="flex flex-col gap-4" data-gallery-filter-demo>
      <FilterBar
        activeCount={filters.activeCount}
        onReset={filters.reset}
        shown={rows.length}
        total={LIST_ROWS.length}
      >
        <FilterSearch
          value={filters.values.q}
          onChange={(value) => filters.set('q', value)}
          placeholder={t('components.demo.searchPlaceholder')}
        />
        <FilterSelect
          id="gallery-status"
          label={t('components.demo.statusLabel')}
          value={filters.values.status}
          onChange={(value) => filters.set('status', value)}
          options={statusOptions}
        />
        {/* 筛选态之外的额外开关也放同一行：FilterBar 只是「一行控件 + 右侧计数/重置」的容器 */}
        <Button
          variant={columns ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setColumns((value) => !value)}
        >
          {t('components.demo.columnsToggle')}
        </Button>
      </FilterBar>

      {rows.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center text-sm">
          <span>{t('components.demo.filterEmpty')}</span>
          <Button variant="ghost" size="sm" onClick={filters.reset}>
            {t('filters.clearAll')}
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('components.demo.tableName')}</TableHead>
              <TableHead className="whitespace-normal">{t('components.demo.tableOwner')}</TableHead>
              <TableHead>{t('components.demo.statusLabel')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="whitespace-normal">{row.owner}</TableCell>
                <TableCell>
                  <Badge variant={row.status === 'active' ? 'secondary' : 'outline'}>
                    {row.status === 'active'
                      ? t('components.demo.statusActive')
                      : t('components.demo.statusPaused')}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

/* ============================== 浮层 ============================== */

function DialogDemo() {
  const { t } = useTranslation()
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{t('components.demo.openDialog')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('components.demo.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('components.demo.dialogBody')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('common.cancel')}</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>{t('common.save')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SheetDemo() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-2">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">{t('components.demo.openSheet')}</Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle>{t('components.demo.sheetTitle')}</SheetTitle>
            <SheetDescription>{t('components.demo.sheetBody')}</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">{t('components.demo.openSheetLeft')}</Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>{t('components.demo.sheetTitle')}</SheetTitle>
            <SheetDescription>{t('components.demo.sheetBody')}</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function PopoverDemo() {
  const { t } = useTranslation()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Settings />
          {t('components.demo.openPopover')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <PopoverHeader>
          <PopoverTitle>{t('components.demo.popoverTitle')}</PopoverTitle>
          <PopoverDescription>{t('components.demo.popoverBody')}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}

function TooltipDemo() {
  const { t } = useTranslation()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t('components.demo.tooltipBody')}>
          <Copy />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t('components.demo.tooltipBody')}</TooltipContent>
    </Tooltip>
  )
}

function CommandDemo() {
  const { t } = useTranslation()
  return (
    <Command className="max-w-md rounded-lg border">
      <CommandInput placeholder={t('components.demo.commandPlaceholder')} />
      <CommandList>
        <CommandEmpty>{t('components.demo.commandEmpty')}</CommandEmpty>
        <CommandGroup heading={t('components.demo.commandGroup')}>
          <CommandItem>
            <Plus />
            {t('nav.createTeam')}
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Search />
            {t('nav.manageTeams')}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t('components.demo.commandGroupConfig')}>
          <CommandItem>
            <Settings />
            {t('nav.smtp')}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

/* ============================== 反馈与状态 ============================== */

function NoteCalloutDemo() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <NoteCallout title={t('components.demo.noteInfoTitle')}>
        <p className="text-muted-foreground max-w-prose">{t('components.demo.noteInfoBody')}</p>
      </NoteCallout>
      <NoteCallout tone="warning" title={t('components.demo.noteWarnTitle')}>
        <p className="text-muted-foreground max-w-prose">{t('components.demo.noteWarnBody')}</p>
      </NoteCallout>
    </div>
  )
}

function ToastDemo() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast.success(t('components.demo.toastSaved'))}>
        {t('components.demo.toastSuccessBtn')}
      </Button>
      <Button variant="outline" onClick={() => toast.error(t('components.demo.toastDeleted'))}>
        {t('components.demo.toastErrorBtn')}
      </Button>
      <Button variant="outline" onClick={() => toast(t('components.demo.toastInfoBody'))}>
        {t('components.demo.toastInfoBtn')}
      </Button>
    </div>
  )
}

function GuardCardDemo() {
  const { t } = useTranslation()
  return (
    <GuardCard
      icon={<ShieldX className="size-6" />}
      title={t('components.demo.guardTitle')}
      description={t('components.demo.guardBody')}
    >
      <Button variant="outline" onClick={() => toast(t('components.demo.toastInfoBody'))}>
        {t('components.demo.guardAction')}
      </Button>
    </GuardCard>
  )
}

/* ============================== 章节装配 ============================== */

const DATA_DEMOS: DemoMap = {
  table: TableDemo,
  badge: BadgeDemo,
  avatar: AvatarDemo,
  descriptionList: DescriptionListDemo,
  skeleton: SkeletonDemo,
  breadcrumb: BreadcrumbDemo,
}

const FILTER_DEMOS: DemoMap = { filterBar: FilterBarDemo }

const OVERLAY_DEMOS: DemoMap = {
  dialog: DialogDemo,
  sheet: SheetDemo,
  popover: PopoverDemo,
  tooltip: TooltipDemo,
  command: CommandDemo,
}

const FEEDBACK_DEMOS: DemoMap = {
  noteCallout: NoteCalloutDemo,
  toast: ToastDemo,
  guardCard: GuardCardDemo,
  configStatusCard: ConfigStatusCard,
}

const HOOK_DEMOS: DemoMap = {}

export function DataSection() {
  return <GallerySection section="data" demos={DATA_DEMOS} />
}

export function FiltersSection() {
  return <GallerySection section="filters" demos={FILTER_DEMOS} />
}

export function OverlaysSection() {
  return <GallerySection section="overlays" demos={OVERLAY_DEMOS} />
}

export function FeedbackSection() {
  return <GallerySection section="feedback" demos={FEEDBACK_DEMOS} />
}

export function HooksSection() {
  return <GallerySection section="hooks" demos={HOOK_DEMOS} />
}
