import { createFileRoute } from '@tanstack/react-router'

import { TableauSchedulesPage } from '@/features/tableau/tableau-schedules-page'

/**
 * `/t/{teamSlug}/tableau/schedules` —— Tableau **定时计划与运行情况**（只读）。
 * 站点级数据、团队作用域导航；权限与导航见 src/config/permissions.ts（`page.tableau.schedules`）。
 */
export const Route = createFileRoute('/t/$teamSlug/tableau/schedules')({
  component: TableauSchedulesPage,
})
