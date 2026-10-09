import { describe, expect, it } from 'vitest'

import common from '@/i18n/locales/en-US/common.json'
import {
  SITE_ROLE_FAILURE_LABEL_KEYS,
  SITE_ROLE_HINT_KEYS,
  SITE_ROLE_LABEL_KEYS,
  TABLEAU_SITE_ROLES,
  isTableauSiteRole,
  siteRoleFailureKey,
  siteRoleLabelKey,
  siteRoleTier,
} from './tableau-site-roles'

/** 逐层取 i18n key（tableauUsers.role.creator → common.tableauUsers.role.creator） */
function hasI18nKey(key: string): boolean {
  let node: unknown = common
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return false
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string'
}

/**
 * 站点角色目录的纯函数用例。
 *
 * 为什么值得单测：这些字符串会被原样发回 Tableau（PUT /users/{id} 的 siteRole），
 * 拼错一个字母服务端就回 400013；而角色名、说明、错误码文案是常量映射表里的 key，
 * check-i18n-keys 只检查**字面量** t() 调用，看不到它们 —— 这里直接把词典读进来断言。
 */
describe('站点角色目录', () => {
  it('每个角色都有展示名与说明，且 key 都在词典里', () => {
    for (const role of TABLEAU_SITE_ROLES) {
      expect(hasI18nKey(SITE_ROLE_LABEL_KEYS[role]), role + ' 缺展示名').toBe(true)
      expect(hasI18nKey(SITE_ROLE_HINT_KEYS[role]), role + ' 缺说明').toBe(true)
    }
  })

  it('不含 ServerAdministrator（Tableau Server 专有，Cloud 会拒绝）', () => {
    expect(TABLEAU_SITE_ROLES).not.toContain('ServerAdministrator')
  })

  it('保留旧站点仍在用的 ExplorerCanPublish', () => {
    expect(TABLEAU_SITE_ROLES).toContain('ExplorerCanPublish')
  })

  it('isTableauSiteRole 只认目录里的取值', () => {
    expect(isTableauSiteRole('Creator')).toBe(true)
    expect(isTableauSiteRole('ServerAdministrator')).toBe(false)
    expect(isTableauSiteRole('')).toBe(false)
  })

  it('等级映射只影响配色，未知角色不会被当成管理员', () => {
    expect(siteRoleTier('SiteAdministratorCreator')).toBe('admin')
    expect(siteRoleTier('SiteAdministratorExplorer')).toBe('admin')
    expect(siteRoleTier('Creator')).toBe('creator')
    expect(siteRoleTier('Explorer')).toBe('explorer')
    expect(siteRoleTier('ExplorerCanPublish')).toBe('explorer')
    expect(siteRoleTier('Viewer')).toBe('viewer')
    expect(siteRoleTier('Unlicensed')).toBe('none')
    // 未知角色：既不是 admin，也不假装有展示名（页面用 unknownRole 模板兜底）
    expect(siteRoleTier('ServerAdministrator')).toBe('none')
    expect(siteRoleLabelKey('ServerAdministrator')).toBeNull()
    expect(siteRoleLabelKey('Creator')).toBe('tableauUsers.role.creator')
  })
})

describe('写失败 → 文案', () => {
  it('Tableau 业务错误码各有专属文案，且 key 都在词典里', () => {
    const cases: [string, string][] = [
      ['409014', 'tableauUsers.error.noSeat'],
      ['400012', 'tableauUsers.error.unlicensedInGroup'],
      ['400013', 'tableauUsers.error.invalidRole'],
      ['403009', 'tableauUsers.error.forbidden'],
      ['404002', 'tableauUsers.error.userNotFound'],
      ['401002', 'tableauUsers.error.unauthorized'],
    ]
    for (const [code, expected] of cases) {
      expect(siteRoleFailureKey({ code })).toBe(expected)
    }
    for (const key of Object.values(SITE_ROLE_FAILURE_LABEL_KEYS)) {
      expect(hasI18nKey(key), key + ' 缺文案').toBe(true)
    }
  })

  it('没有业务码时按 HTTP 状态码兜底', () => {
    expect(siteRoleFailureKey({ status: 401 })).toBe('tableauUsers.error.unauthorized')
    expect(siteRoleFailureKey({ status: 403 })).toBe('tableauUsers.error.forbidden')
    expect(siteRoleFailureKey({ status: 404 })).toBe('tableauUsers.error.userNotFound')
    expect(siteRoleFailureKey({})).toBe('tableauUsers.error.unknown')
    expect(siteRoleFailureKey({ status: 500 })).toBe('tableauUsers.error.unknown')
  })

  it('未知业务码回落到状态码，不会误判成已知错误', () => {
    expect(siteRoleFailureKey({ code: '999999', status: 404 })).toBe(
      'tableauUsers.error.userNotFound',
    )
  })
})
