import { describe, expect, it } from 'vitest'

import common from '@/i18n/locales/en-US/common.json'
import {
  ACTION_CATALOG,
  DEFAULT_GRANTS,
  EDITABLE_ROLES,
  LOCKED_ROLES,
  REQUIRED_KEYS,
  ROLE_KEYS,
  ROUTE_CATALOG,
  applicableRoles,
  isAdminOnly,
  isKnownPermission,
  matchesGrant,
  normalizeGrants,
  withDefaultRoles,
} from './permissions'

/** 逐层取 i18n key（`nav.ai` → common.nav.ai），用于断言目录里的文案 key 真的存在 */
function hasI18nKey(key: string): boolean {
  let node: unknown = common
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return false
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string'
}

/**
 * 权限目录与求值语义的**纯函数**用例。
 *
 * 为什么值得单独测：这些规则（通配匹配、作用域求值、fail-closed 缺省、底座页面不可取消）
 * 一旦写错就是"某些人看不到/看得到不该看的页面"，而页面行为用例要起浏览器才能覆盖到其中一小部分。
 * 这里毫秒级就能把边界钉住，与 `check:permissions`（真实浏览器驱动）互补。
 */
describe('matchesGrant（通配语义）', () => {
  it('`*` 命中一切', () => {
    expect(matchesGrant('*', 'page.users')).toBe(true)
    expect(matchesGrant('*', 'action.users.create')).toBe(true)
  })

  it('逐条授权精确命中', () => {
    expect(matchesGrant('page.users', 'page.users')).toBe(true)
    expect(matchesGrant('page.users', 'page.teams')).toBe(false)
  })

  it('分支通配命中子键', () => {
    expect(matchesGrant('page.config.*', 'page.config.smtp')).toBe(true)
  })

  it('分支通配**不**命中分支自身', () => {
    // `page.config.*` 表示"这个分支下的页面"，不是"page.config 这个键"
    expect(matchesGrant('page.config.*', 'page.config')).toBe(false)
  })

  it('前缀相同但不是同一段时不误命中', () => {
    // 关键：切掉 `*` 后必须保留那个点，否则 `page.user.*` 会命中 `page.users`
    expect(matchesGrant('page.user.*', 'page.users')).toBe(false)
    expect(matchesGrant('page.users.*', 'page.users')).toBe(false)
  })
})

describe('applicableRoles（作用域决定由谁决定可见性）', () => {
  it('团队页面 → 三个团队岗位', () => {
    const teamEntry = ROUTE_CATALOG.find((e) => e.scope === 'team')!
    expect(applicableRoles(teamEntry)).toEqual(['team-admin', 'analyst', 'viewer'])
  })

  it('跨团队页面 → 全局身份 member', () => {
    const globalEntry = ROUTE_CATALOG.find((e) => e.scope === 'global')!
    expect(applicableRoles(globalEntry)).toEqual(['member'])
  })
})

describe('normalizeGrants / withDefaultRoles', () => {
  it('系统管理员恒为 `*`（保证永远有人能开权限）', () => {
    const grants = normalizeGrants({ 'system-admin': [], member: [], 'team-admin': [], analyst: [], viewer: [] })
    expect(grants['system-admin']).toEqual(['*'])
  })

  it('底座页面（required）不可被清空', () => {
    const grants = normalizeGrants({
      'system-admin': ['*'],
      member: [],
      'team-admin': [],
      analyst: [],
      viewer: [],
    })
    for (const key of REQUIRED_KEYS) {
      const entry = ROUTE_CATALOG.find((e) => e.key === key)!
      for (const role of applicableRoles(entry)) {
        expect(grants[role]).toContain(key)
      }
    }
  })

  it('「补齐默认授权」是并集语义：保留手工授权，只增不减', () => {
    const merged = withDefaultRoles({
      'system-admin': ['*'],
      member: ['page.users'],
      'team-admin': ['page.custom.*'],
      analyst: [],
      viewer: [],
    })
    expect(merged.member).toContain('page.users') // 手工项保留
    expect(merged['team-admin']).toContain('page.custom.*') // 通配保留
    expect(merged.analyst).toContain('page.dashboard') // 按目录补上默认值
  })

  it('去重', () => {
    const grants = normalizeGrants({
      'system-admin': ['*'],
      member: ['page.users', 'page.users'],
      'team-admin': [],
      analyst: [],
      viewer: [],
    })
    expect(grants.member.filter((k) => k === 'page.users')).toHaveLength(1)
  })
})

describe('isKnownPermission / isAdminOnly', () => {
  it('目录里的键与通配算已知，凭空捏造的键不算', () => {
    expect(isKnownPermission('page.users')).toBe(true)
    expect(isKnownPermission('page.config.*')).toBe(true)
    expect(isKnownPermission('*')).toBe(true)
    expect(isKnownPermission('page.nope')).toBe(false)
  })

  it('defaultRoles 里没有任何可编辑角色 = 有意只给管理员', () => {
    const smtp = ROUTE_CATALOG.find((e) => e.key === 'page.config.smtp')!
    expect(isAdminOnly(smtp)).toBe(true)
    const ai = ROUTE_CATALOG.find((e) => e.key === 'page.ai')!
    expect(isAdminOnly(ai)).toBe(false)
  })
})

describe('ROUTE_CATALOG 不变量', () => {
  it('key 唯一', () => {
    const keys = ROUTE_CATALOG.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('路由模式唯一', () => {
    const paths = ROUTE_CATALOG.map((e) => e.to)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('defaultRoles 都是合法角色，且都属于该条目的适用角色', () => {
    for (const entry of ROUTE_CATALOG) {
      const applicable = applicableRoles(entry)
      for (const role of entry.defaultRoles) {
        expect(ROLE_KEYS, `${entry.key} 的 defaultRoles 含非法角色 ${role}`).toContain(role)
        expect(applicable, `${entry.key} 的 defaultRoles 含对该作用域无效的角色 ${role}`).toContain(
          role,
        )
      }
    }
  })

  it('侧边栏文案 key 在词典里都存在（漏配文案 = 界面显示裸 key）', () => {
    for (const entry of ROUTE_CATALOG) {
      expect(hasI18nKey(entry.labelKey), `${entry.key} 的 labelKey「${entry.labelKey}」缺文案`).toBe(
        true,
      )
    }
  })

  it('分组对应的侧边栏分组标题文案存在', () => {
    for (const key of ['nav.general', 'nav.aiGroup', 'nav.settings', 'nav.config']) {
      expect(hasI18nKey(key), `缺少分组文案 ${key}`).toBe(true)
    }
  })

  it('ACTION_CATALOG 的 owner 必须在 ROUTE_CATALOG 里存在', () => {
    const routeKeys = new Set(ROUTE_CATALOG.map((e) => e.key))
    for (const action of ACTION_CATALOG) {
      expect(routeKeys, `动作 ${action.key} 的 owner「${action.owner}」不是已登记页面`).toContain(
        action.owner,
      )
    }
  })
})

describe('默认授权矩阵自身的一致性', () => {
  it('锁死角色只有系统管理员，且可编辑角色与它不相交', () => {
    expect(LOCKED_ROLES).toEqual(['system-admin'])
    for (const role of EDITABLE_ROLES) expect(LOCKED_ROLES).not.toContain(role)
  })

  it('每个角色都有默认授权条目（哪怕是空数组）', () => {
    for (const role of ROLE_KEYS) expect(DEFAULT_GRANTS[role]).toBeDefined()
  })
})
