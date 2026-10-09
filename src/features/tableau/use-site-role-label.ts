import { useTranslation } from 'react-i18next'

import { SITE_ROLE_LABEL_KEYS, isTableauSiteRole } from '@/lib/tableau-site-roles'

/**
 * 站点角色展示名：已知角色走词典，未知角色**原样显示 Tableau 的取值**
 * （站点上可能存在本应用目录里没有的角色：旧版 ExplorerCanPublish、Server 专有的 ServerAdministrator）。
 *
 * 单独一个文件而不是放在 site-role-badge.tsx 里：那个文件要被 Fast Refresh 追着跑，
 * 只允许导出组件；hook 与组件混在一个文件会让 HMR 退化成整页刷新（eslint 也会报）。
 */
export function useSiteRoleLabel() {
  const { t } = useTranslation()
  return (role: string) =>
    isTableauSiteRole(role)
      ? t(SITE_ROLE_LABEL_KEYS[role])
      : t('tableauUsers.unknownRole', { role })
}
