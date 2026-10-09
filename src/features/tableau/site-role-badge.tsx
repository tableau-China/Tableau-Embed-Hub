import { Badge } from '@/components/ui/badge'
import { siteRoleTier, type SiteRoleTier } from '@/lib/tableau-site-roles'
import { useSiteRoleLabel } from '@/features/tableau/use-site-role-label'

/**
 * 站点角色的**展示**（两个页面与弹窗共用）
 *
 * 为什么单独一个文件：同一个角色会在三处出现（表格徽章、下拉选项、变更确认弹窗），
 * 而"未知角色怎么办"这条兜底必须只有一处 —— 站点上可能存在本应用目录里没有的角色
 * （旧版 ExplorerCanPublish、Server 专有的 ServerAdministrator），
 * 各处自己判断迟早会有一处把它显示成空白或错误的名字。
 */

/** 角色等级 → 徽章配色（等级判断在 lib/tableau-site-roles.ts，本文件不重复判断） */
const TIER_VARIANT: Record<SiteRoleTier, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  admin: 'default',
  creator: 'secondary',
  explorer: 'outline',
  viewer: 'outline',
  none: 'destructive',
}

/** 站点角色徽章（data-site-role 供脚本断言）。展示名统一走 useSiteRoleLabel */
export function SiteRoleBadge({ role, className }: { role: string; className?: string }) {
  const label = useSiteRoleLabel()
  return (
    <Badge
      variant={TIER_VARIANT[siteRoleTier(role)]}
      className={className}
      data-site-role={role}
    >
      {label(role)}
    </Badge>
  )
}
