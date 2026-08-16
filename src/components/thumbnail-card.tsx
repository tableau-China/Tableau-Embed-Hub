/**
 * 统一缩略图卡片组件（从 pg_explorer 移植，作者原创设计）
 *
 * 用于 Favorites、Recents、Workbooks 等页面的视图缩略图展示。
 * 设计亮点：
 * - IntersectionObserver 懒加载（仅进入视口才取图）
 * - 悬停浮现的收藏（星标）/ 置顶（图钉）圆形按钮（overlay 模式）
 * - 热门火焰徽章（访问次数达到阈值）
 * - card（完整卡片）/ compact（紧凑）双变体
 * - Info 弹窗元数据行、渐变标题遮罩、hover 轻微放大
 *
 * 修改此文件即可全局调整所有缩略图样式。
 */
import React from 'react'
import { Link } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Star,
  ImageIcon,
  Info,
  MoreHorizontal,
  X,
  Pin,
  Flame,
  Eye,
  ExternalLink,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { getThumbnailBlob, getThumbnailObjectUrl } from '@/lib/thumbnail-cache'

// ==================== 类型定义 ====================

/** 缩略图卡片变体 */
export type ThumbnailCardVariant = 'card' | 'compact'

/** 全局访问次数达到该阈值即标记为"热门" */
export const HOT_ACCESS_THRESHOLD = 20

/** 菜单项配置 */
export interface MenuItemConfig {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  separatorBefore?: boolean
  className?: string
}

/** Info 弹窗元数据行 */
export interface MetaRow {
  label: string
  value: React.ReactNode
}

/** 缩略图卡片属性 */
export interface ThumbnailCardProps {
  /** 必需：唯一标识 */
  id: string
  /** 必需：显示名称 */
  name: string
  /** 缩略图 URL（可选；缺省显示占位图标） */
  thumbnailUrl?: string
  /** 自定义缩略图加载器（如 Tableau previewImage 需带认证头；返回 Blob） */
  thumbnailLoader?: (id: string) => Promise<Blob | null>
  /** 必需：点击卡片跳转路径 */
  linkTo: string
  /** 跳转搜索参数（如 /views 的 workbook/view） */
  linkSearch?: { workbook?: string; view?: string }

  // ---- 变体与样式 ----
  variant?: ThumbnailCardVariant
  aspectRatio?: string
  className?: string
  contentClassName?: string

  // ---- 副标题区域 ----
  subtitle?: string
  hideSubtitle?: boolean
  updatedAt?: string
  accessCount?: number
  titleSuffix?: React.ReactNode

  // ---- 收藏功能 ----
  showFavorite?: boolean
  isFavorited?: boolean
  onToggleFavorite?: (id: string, isFavorited: boolean) => void

  // ---- 置顶（pin）功能 ----
  showPin?: boolean
  isPinned?: boolean
  onTogglePin?: (id: string, isPinned: boolean) => void

  // ---- 选择 ----
  showSelection?: boolean
  isSelected?: boolean
  onToggleSelected?: (id: string, isSelected: boolean) => void

  // ---- Info 弹窗 ----
  showInfo?: boolean
  infoTitle?: string
  infoDescription?: React.ReactNode
  infoMetaRows?: MetaRow[]

  // ---- 更多菜单 ----
  menuItems?: MenuItemConfig[]
  /** 菜单预设：'favorites' 收藏页菜单（隐藏"收藏"项） */
  menuPreset?: 'favorites'
  hideFavoriteMenu?: boolean
}

// ==================== Hook：缩略图 URL 加载 ====================

/** IntersectionObserver — 回调 ref 模式，React 在 attach/detach 时自动通知 */
function useInView(): [React.RefCallback<HTMLDivElement>, boolean] {
  const [inView, setInView] = useState(false)
  const obsRef = useRef<IntersectionObserver | null>(null)

  const refCallback = useCallback((node: HTMLDivElement | null) => {
    if (obsRef.current) {
      obsRef.current.disconnect()
      obsRef.current = null
    }
    if (node && !inView) {
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true)
            obs.disconnect()
          }
        },
        { rootMargin: '200px' },
      )
      obs.observe(node)
      obsRef.current = obs
    }
  }, [inView])

  useEffect(() => {
    return () => {
      obsRef.current?.disconnect()
    }
  }, [])

  return [refCallback, inView]
}

/** 统一的缩略图 URL 加载 hook（IntersectionObserver 懒加载，仅进入视口才取图） */
export function useThumbnailUrl(
  thumbnailUrl: string,
  id: string,
  loader?: (id: string) => Promise<Blob | null>,
): [React.RefCallback<HTMLDivElement>, string | null] {
  const [refCallback, inView] = useInView()
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!inView) return
    let alive = true
    const load = loader
      ? loader(id)
      : thumbnailUrl
        ? getThumbnailBlob(thumbnailUrl, id)
        : Promise.resolve(null)
    load.then((blob) => {
      if (alive) setUrl(getThumbnailObjectUrl(blob, id))
    })
    return () => {
      alive = false
    }
  }, [id, thumbnailUrl, inView, loader])

  return [refCallback, url]
}

// ==================== 子组件 ====================

/** 收藏 Star 按钮 */
function FavoriteButton({
  isFavorited,
  onToggle,
  id,
  size = 'md',
  overlay = false,
}: {
  isFavorited: boolean
  onToggle: (id: string, isFavorited: boolean) => void
  id: string
  size?: 'sm' | 'md'
  overlay?: boolean
}) {
  const starColor = isFavorited ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'

  if (overlay) {
    const posClasses = size === 'sm' ? 'top-1 left-1 p-1' : 'top-2 left-2 p-1.5'
    return (
      <span
        role='button'
        tabIndex={0}
        className={`absolute ${posClasses} z-10 rounded-full cursor-pointer transition-all ${
          isFavorited
            ? 'bg-amber-500 text-white opacity-100'
            : 'bg-black/50 text-white/70 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-black/70'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onToggle(id, isFavorited)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.stopPropagation()
            e.preventDefault()
            onToggle(id, isFavorited)
          }
        }}
      >
        <Star className={`${iconSize} ${isFavorited ? 'fill-current' : ''}`} />
      </span>
    )
  }

  return (
    <span
      role='button'
      tabIndex={0}
      className='flex-shrink-0 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors'
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onToggle(id, isFavorited)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation()
          e.preventDefault()
          onToggle(id, isFavorited)
        }
      }}
    >
      <Star className={`${iconSize} ${starColor}`} />
    </span>
  )
}

/** 置顶 Pin 按钮 */
function PinButton({
  isPinned,
  onToggle,
  id,
  size = 'md',
  overlay = false,
}: {
  isPinned: boolean
  onToggle: (id: string, isPinned: boolean) => void
  id: string
  size?: 'sm' | 'md'
  overlay?: boolean
}) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'

  if (overlay) {
    const posClasses = size === 'sm' ? 'top-1 right-1 p-1' : 'top-2 right-2 p-1.5'
    return (
      <span
        role='button'
        tabIndex={0}
        className={`absolute ${posClasses} z-10 rounded-full cursor-pointer transition-all ${
          isPinned
            ? 'bg-primary text-primary-foreground opacity-100'
            : 'bg-black/50 text-white/70 opacity-0 group-hover:opacity-100 hover:text-white'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onToggle(id, isPinned)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.stopPropagation()
            e.preventDefault()
            onToggle(id, isPinned)
          }
        }}
      >
        <Pin className={iconSize} />
      </span>
    )
  }

  const pinColor = isPinned ? 'text-primary' : 'text-muted-foreground'
  return (
    <span
      role='button'
      tabIndex={0}
      className='flex-shrink-0 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors'
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onToggle(id, isPinned)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation()
          e.preventDefault()
          onToggle(id, isPinned)
        }
      }}
    >
      <Pin className={`${iconSize} ${pinColor}`} />
    </span>
  )
}

/** 选择框 */
function SelectionCheckbox({
  id,
  isSelected,
  onToggle,
}: {
  id: string
  isSelected: boolean
  onToggle: (id: string, isSelected: boolean) => void
}) {
  return (
    <div
      className='absolute top-2 left-2 z-10'
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
      }}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(id, isSelected)}
        aria-label='选择卡片'
      />
    </div>
  )
}

/** Info Popover（card 模式专用） */
function InfoPopover({
  title,
  description,
  metaRows,
}: {
  title: string
  description?: React.ReactNode
  metaRows?: MetaRow[]
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role='button'
          tabIndex={0}
          className='flex-shrink-0 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors'
          onKeyDown={(e) => {
            if (e.key === 'Enter') setOpen(true)
          }}
        >
          <Info className='h-4 w-4' />
        </span>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        side='top'
        className='w-[420px] max-h-[70vh] overflow-y-auto p-0'
      >
        <div className='flex items-start justify-between p-4 pb-2'>
          <h3 className='text-base font-semibold text-foreground leading-snug pr-2'>{title}</h3>
          <button
            onClick={() => setOpen(false)}
            className='flex-shrink-0 p-1 rounded hover:bg-muted cursor-pointer text-muted-foreground hover:text-foreground transition-colors'
          >
            <X className='h-4 w-4' />
          </button>
        </div>
        <div className='px-4 pb-4 space-y-2 text-sm'>
          <div className='text-muted-foreground leading-relaxed'>
            {description || t('thumbnailCard.noDescription')}
          </div>
          {metaRows && metaRows.length > 0 && (
            <div className='grid grid-cols-[72px_1fr] gap-x-4 gap-y-1.5 mt-2'>
              {metaRows.map((row, i) => (
                <React.Fragment key={i}>
                  <span className='text-foreground font-medium'>{row.label}</span>
                  <span className='text-foreground'>{row.value}</span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** 更多菜单 */
function MoreMenu({ items }: { items: MenuItemConfig[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span
          role='button'
          tabIndex={0}
          className='flex-shrink-0 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors'
        >
          <MoreHorizontal className='h-4 w-4' />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {items.map((item, i) => (
          <div key={i}>
            {item.separatorBefore && <DropdownMenuSeparator />}
            <DropdownMenuItem className={item.className} onClick={item.onClick}>
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ==================== 主组件 ====================

export function ThumbnailCard({
  id,
  name,
  thumbnailUrl = '',
  thumbnailLoader,
  linkTo,
  linkSearch,
  variant = 'card',
  aspectRatio,
  className = '',
  subtitle,
  hideSubtitle = false,
  updatedAt,
  accessCount,
  showFavorite = false,
  isFavorited = false,
  onToggleFavorite,
  showPin = false,
  isPinned = false,
  onTogglePin,
  showSelection = false,
  isSelected = false,
  onToggleSelected,
  showInfo = false,
  infoTitle,
  infoDescription,
  infoMetaRows,
  menuItems,
  menuPreset,
  hideFavoriteMenu = false,
  contentClassName = '',
  titleSuffix,
}: ThumbnailCardProps) {
  const { t } = useTranslation()
  const resolvedAspect = aspectRatio || (variant === 'compact' ? '4/3' : '16/9')
  const [thumbnailRef, thumbnailUrlState] = useThumbnailUrl(thumbnailUrl, id, thumbnailLoader)
  const isCompact = variant === 'compact'

  // 菜单：打开视图 + 收藏（收藏页预设隐藏收藏项）+ 置顶 + 自定义
  const effectiveHideFavoriteMenu = hideFavoriteMenu || menuPreset === 'favorites'
  const allMenuItems: MenuItemConfig[] = [
    {
      label: t('thumbnailCard.open'),
      icon: <ExternalLink className='h-4 w-4 mr-2' />,
      onClick: () => undefined, // 卡片本体即链接，菜单项保留占位（如需独立跳转可扩展）
    },
    ...(!effectiveHideFavoriteMenu && showFavorite && onToggleFavorite
      ? [
          {
            label: isFavorited ? t('thumbnailCard.unfavorite') : t('thumbnailCard.favorite'),
            icon: (
              <Star
                className={`h-4 w-4 mr-2 ${isFavorited ? 'fill-amber-400 text-amber-400' : ''}`}
              />
            ),
            onClick: () => onToggleFavorite(id, isFavorited),
          },
        ]
      : []),
    ...(showPin && onTogglePin
      ? [
          {
            label: isPinned ? t('thumbnailCard.unpin') : t('thumbnailCard.pin'),
            icon: <Pin className={`h-4 w-4 mr-2 ${isPinned ? 'fill-blue-500 text-blue-500' : ''}`} />,
            onClick: () => onTogglePin(id, isPinned),
          },
        ]
      : []),
    ...(menuItems || []),
  ]

  const btnSize = isCompact ? 'sm' : 'md'
  const hoverScale = isCompact ? 'group-hover:scale-105' : 'group-hover:scale-[1.02]'
  const isHot = accessCount != null && accessCount >= HOT_ACCESS_THRESHOLD

  const thumbnailBody = thumbnailUrlState ? (
    <img
      src={thumbnailUrlState}
      alt={name}
      className={`w-full h-full object-cover ${hoverScale} transition-transform duration-200`}
    />
  ) : (
    <div className='w-full h-full flex items-center justify-center'>
      <ImageIcon className={isCompact ? 'h-6 w-6 text-muted-foreground/30' : 'h-8 w-8 text-muted-foreground/30'} />
    </div>
  )

  // ---- 紧凑模式渲染 ----
  if (isCompact) {
    return (
      <Link to={linkTo as never} search={linkSearch as never} className='group block'>
        <div
          ref={thumbnailRef}
          className={`aspect-[4/3] bg-muted rounded overflow-hidden relative ${className}`}
          style={{ aspectRatio: resolvedAspect }}
        >
          {thumbnailBody}
          {/* 标题遮罩 */}
          <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5'>
            <p className='text-white text-sm font-medium truncate'>{name}</p>
          </div>
          {showFavorite && onToggleFavorite && (
            <FavoriteButton id={id} isFavorited={isFavorited} onToggle={onToggleFavorite} size={btnSize} overlay />
          )}
          {showPin && onTogglePin && (
            <PinButton id={id} isPinned={isPinned} onToggle={onTogglePin} size={btnSize} overlay />
          )}
          {isHot && (
            <div className='absolute top-1.5 right-1.5 bg-amber-500 text-white rounded shadow-sm p-0.5'>
              <Flame className='h-3 w-3' />
            </div>
          )}
        </div>
      </Link>
    )
  }

  // ---- 完整卡片模式渲染 ----
  return (
    <div className={cn('group rounded-md overflow-hidden border bg-card hover:shadow-md transition-shadow', className)}>
      {/* 缩略图区域 */}
      <Link to={linkTo as never} search={linkSearch as never} className='block'>
        <div ref={thumbnailRef} className='bg-muted relative' style={{ aspectRatio: resolvedAspect }}>
          {thumbnailBody}
          {showFavorite && onToggleFavorite && (
            <FavoriteButton id={id} isFavorited={isFavorited} onToggle={onToggleFavorite} size={btnSize} overlay />
          )}
          {showSelection && onToggleSelected && (
            <SelectionCheckbox id={id} isSelected={isSelected} onToggle={onToggleSelected} />
          )}
          {showPin && onTogglePin && (
            <PinButton id={id} isPinned={isPinned} onToggle={onTogglePin} size={btnSize} overlay />
          )}
        </div>
      </Link>

      {/* 信息区域 */}
      <div className={cn('p-3 space-y-1', contentClassName)}>
        {/* 第一行：标题 + titleSuffix + info + 更多 */}
        <div className='flex items-start gap-1.5'>
          <Link to={linkTo as never} search={linkSearch as never} className='flex-1 min-w-0'>
            <p className='font-medium text-sm truncate leading-tight'>
              {name}
              {titleSuffix && <span className='font-normal text-muted-foreground ml-1'>{titleSuffix}</span>}
            </p>
          </Link>
          {showInfo && (
            <InfoPopover
              title={infoTitle || name}
              description={infoDescription}
              metaRows={infoMetaRows}
            />
          )}
          {allMenuItems.length > 0 && <MoreMenu items={allMenuItems} />}
        </div>

        {/* 第二行：subtitle */}
        {!hideSubtitle && subtitle && (
          <p className='text-xs text-muted-foreground truncate' title={subtitle}>
            {subtitle}
          </p>
        )}

        {/* 第三行：访问次数 + 日期 */}
        {(accessCount != null || updatedAt) && (
          <div className='flex items-center justify-between'>
            {accessCount != null && (
              <span className='text-xs text-muted-foreground flex items-center gap-1'>
                <Eye className='h-3 w-3' />
                {accessCount}
                {isHot && <Flame className='h-3 w-3 text-amber-500' />}
              </span>
            )}
            {updatedAt && (
              <span className='text-xs text-muted-foreground ml-auto'>
                {new Date(updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
