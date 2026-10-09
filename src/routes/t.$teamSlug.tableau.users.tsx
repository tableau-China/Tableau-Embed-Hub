import { createFileRoute } from '@tanstack/react-router'

import { TableauUsersPage } from '@/features/tableau/tableau-users-page'

/**
 * `/t/{teamSlug}/tableau/users` —— Tableau **站点用户与角色**。
 *
 * 团队作用域只是"导航归属"（与 workbooks/views 同一组）；这一页的数据是**站点级**的，
 * 不随团队切换而不同。权限与导航都不在这个文件里：见 src/config/permissions.ts 的
 * ROUTE_CATALOG（`page.tableau.users` 一行）。
 */
export const Route = createFileRoute('/t/$teamSlug/tableau/users')({
  component: TableauUsersPage,
})
