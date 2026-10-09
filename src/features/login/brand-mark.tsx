import { APP_NAME } from '@/config/app'
import { cn } from '@/lib/utils'

/**
 * 品牌标识（左侧图形 + 应用名）—— 登录页与登录设置页共用的「这是哪个应用」的部分。
 *
 * 图形是内联 SVG（抽象的后台布局骨架），**不用 public/favicon.svg** —— 那是演示站点的 Tableau 图标，
 * 拿它当登录页 logo 会把「本站品牌」和「被嵌入的服务」混在一起。
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      </span>
      <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
    </div>
  )
}
