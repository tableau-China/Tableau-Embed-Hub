/**
 * Tableau **站点角色**目录（站点用户页的唯一数据源）。
 *
 * 为什么单独一个纯模块（不放进页面、也不放进 API 模块）：
 *   1. 角色名是 **Tableau 的产品词**，拼错一个字母服务端就回 400013（格式不正确/不被支持）——
 *      所以要有一处常量表把「可选项 / 展示名 / 说明 / 徽章层级 / 错误码 → 文案」全部收在一起；
 *   2. 纯数据 + 纯函数，node 里可直接单测（见 tableau-site-roles.test.ts），
 *      页面只负责渲染，不重复判断角色等级；
 *   3. 不 import 任何 fetch / React / store，脚本与测试都能安全加载。
 *
 * 取值来源：REST API "Update User" 的 siteRole 取值列表（2026-10 核对），
 * 见 https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_ref_users_and_groups.htm#update_user
 *
 * 刻意**不收** `ServerAdministrator`：它是 Tableau **Server** 专有角色（且只有另一个
 * ServerAdministrator 能授予），Tableau Cloud（本项目目标：Connected App + Online）不会接受，
 * 放进来等于给用户一个点了必然报错的选项。若某站点确实存在该角色的用户，
 * 页面会把它当作「未知角色」原样展示当前值（见 TableauSiteRole 的 isTableauSiteRole 判断），
 * 只是不提供"改成它"的入口。
 */

/** 可分配的站点角色（顺序 = 下拉框顺序：能力由低到高，Unlicensed 收尾） */
export const TABLEAU_SITE_ROLES = [
  'Viewer',
  'Explorer',
  'ExplorerCanPublish',
  'Creator',
  'SiteAdministratorExplorer',
  'SiteAdministratorCreator',
  'Unlicensed',
] as const

export type TableauSiteRole = (typeof TABLEAU_SITE_ROLES)[number]

/** 角色等级：只用于徽章配色与「这是管理员」这类粗判，不做权限计算（权限由 Tableau 决定） */
export type SiteRoleTier = 'admin' | 'creator' | 'explorer' | 'viewer' | 'none'

const TIERS: Record<TableauSiteRole, SiteRoleTier> = {
  Viewer: 'viewer',
  Explorer: 'explorer',
  ExplorerCanPublish: 'explorer',
  Creator: 'creator',
  SiteAdministratorExplorer: 'admin',
  SiteAdministratorCreator: 'admin',
  Unlicensed: 'none',
}

/** 角色 → 展示名 i18n key（常量映射表：check-i18n-keys 认字面量，不认模板拼接） */
export const SITE_ROLE_LABEL_KEYS: Record<TableauSiteRole, string> = {
  Viewer: 'tableauUsers.role.viewer',
  Explorer: 'tableauUsers.role.explorer',
  ExplorerCanPublish: 'tableauUsers.role.explorerCanPublish',
  Creator: 'tableauUsers.role.creator',
  SiteAdministratorExplorer: 'tableauUsers.role.siteAdministratorExplorer',
  SiteAdministratorCreator: 'tableauUsers.role.siteAdministratorCreator',
  Unlicensed: 'tableauUsers.role.unlicensed',
}

/** 角色 → 一句话说明 i18n key（弹窗里跟在选项后面的小字） */
export const SITE_ROLE_HINT_KEYS: Record<TableauSiteRole, string> = {
  Viewer: 'tableauUsers.roleHint.viewer',
  Explorer: 'tableauUsers.roleHint.explorer',
  ExplorerCanPublish: 'tableauUsers.roleHint.explorerCanPublish',
  Creator: 'tableauUsers.roleHint.creator',
  SiteAdministratorExplorer: 'tableauUsers.roleHint.siteAdministratorExplorer',
  SiteAdministratorCreator: 'tableauUsers.roleHint.siteAdministratorCreator',
  Unlicensed: 'tableauUsers.roleHint.unlicensed',
}

/** 站点角色原文是否在「可分配列表」里（服务端可能回旧角色或 Server 专有角色） */
export function isTableauSiteRole(value: string): value is TableauSiteRole {
  return (TABLEAU_SITE_ROLES as readonly string[]).includes(value)
}

/** 角色等级；未知角色一律 'none'（只影响配色，不会把未知角色显示成管理员） */
export function siteRoleTier(role: string): SiteRoleTier {
  return isTableauSiteRole(role) ? TIERS[role] : 'none'
}

/** 展示名的兜底：已知角色走词典，未知角色原样显示 Tableau 的取值（不猜、不翻译） */
export function siteRoleLabelKey(role: string): string | null {
  return isTableauSiteRole(role) ? SITE_ROLE_LABEL_KEYS[role] : null
}

/* ============================== 写失败 → 文案 ============================== */

/** 失败判定的最小输入：不依赖 TableauApiError 类，保持本模块可被任意环境加载 */
export interface SiteRoleFailure {
  status?: number
  /** Tableau 业务错误码（如 400013） */
  code?: string
}

/**
 * Tableau 错误码 → i18n key（写角色这条路上真实会遇到的几类）。
 *
 * 为什么按错误码而不是按 detail 文案分流：detail **会被站点语言本地化**
 * （演示站点就返回中文），拿文案做判断等于把界面文案绑死在站点语言上。
 * 错误码清单来自官方 "Update User" 的响应码表（2026-10 核对）。
 */
export const SITE_ROLE_FAILURE_LABEL_KEYS: Record<string, string> = {
  // 许可证席位不足（要升 Creator/Explorer 但站点没有余量）
  '409014': 'tableauUsers.error.noSeat',
  // 用户仍在「设置了最低站点角色」的组里，不能降为 Unlicensed
  '400012': 'tableauUsers.error.unlicensedInGroup',
  // 站点角色取值不被该版本支持
  '400013': 'tableauUsers.error.invalidRole',
  // 不能改自己的许可证角色（Tableau 明确禁止）／Guest 用户不可改
  '403009': 'tableauUsers.error.forbidden',
  // 用户不存在（列表过期、用户被别处删了）
  '404002': 'tableauUsers.error.userNotFound',
  // 令牌/权限不足（scope 缺失或调用者不是站点管理员）
  '401002': 'tableauUsers.error.unauthorized',
}

export function siteRoleFailureKey(failure: SiteRoleFailure): string {
  if (failure.code && SITE_ROLE_FAILURE_LABEL_KEYS[failure.code]) {
    return SITE_ROLE_FAILURE_LABEL_KEYS[failure.code]
  }
  if (failure.status === 401) return 'tableauUsers.error.unauthorized'
  if (failure.status === 403) return 'tableauUsers.error.forbidden'
  if (failure.status === 404) return 'tableauUsers.error.userNotFound'
  return 'tableauUsers.error.unknown'
}
