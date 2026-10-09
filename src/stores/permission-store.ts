import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  DEFAULT_GRANTS,
  LOCKED_ROLES,
  REQUIRED_KEYS,
  ROUTE_CATALOG,
  applicableRoles,
  isKnownPermission,
  normalizeGrants,
  withDefaultRoles,
  type RoleGrants,
  type RoleKey,
} from '@/config/permissions'
import { STORAGE_PREFIX } from '@/lib/storage-migration'

/**
 * 授权矩阵 store：角色 → 权限键/通配列表（localStorage 持久化）。
 *
 * 与 org-store 的分工：org-store 管「谁是什么角色」（用户 / 团队 / 成员岗位），
 * 本 store 管「什么角色能看哪些页面」。两者只在求值处交汇（lib/permissions.ts）。
 *
 * 三条不可绕过的规则（写在 store 里而不是 UI 里，避免将来某处 UI 漏判就把用户锁在门外）：
 *  1. `system-admin` 恒为 `*`，不可编辑；
 *  2. 底座页面（ROUTE_CATALOG.required，如 /teams、团队首页）不可取消；
 *  3. 任何写入都过一遍 normalizeGrants（去重 + 兜底规则）。
 *
 * 接入后端时替换成本文件：读 `GET /me/permissions`，写 `PUT /roles/{role}/permissions`，
 * 数据形状（RoleGrants）保持不变，其余代码无需改动；服务端必须再判一次（前端守卫不是安全边界）。
 */

interface PermissionState {
  /** 授权矩阵 */
  grants: RoleGrants

  /** 覆盖某角色的整列授权 */
  setRoleGrants: (role: RoleKey, keys: readonly string[]) => void
  /** 勾选/取消一个权限键（锁定角色与底座页面会被忽略） */
  toggleGrant: (role: RoleKey, key: string) => void
  /** 整列全选/清空（全选 = 逐条显式展开，不含通配） */
  setRoleAllRoutes: (role: RoleKey, granted: boolean) => void
  /** 按 ROUTE_CATALOG.defaultRoles 补齐默认授权（只增不减，用于升级后新增页面的默认值） */
  applyDefaultRoles: () => void
  /** 恢复默认矩阵（丢弃全部手工调整） */
  resetToDefaults: () => void
}

/** 该角色能否被编辑：锁死角色与未登记的权限键一律拒绝写入 */
function canEdit(role: RoleKey, key: string): boolean {
  if (LOCKED_ROLES.includes(role)) return false
  if (REQUIRED_KEYS.includes(key)) return false // 底座页面：不可取消
  return isKnownPermission(key)
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set) => ({
      grants: normalizeGrants(),

      setRoleGrants: (role, keys) => {
        if (LOCKED_ROLES.includes(role)) return
        set((s) => ({
          grants: normalizeGrants({
            ...s.grants,
            [role]: keys.filter((k) => !REQUIRED_KEYS.includes(k)),
          }),
        }))
      },

      toggleGrant: (role, key) => {
        if (!canEdit(role, key)) return
        set((s) => {
          const current = s.grants[role]
          const next = current.includes(key)
            ? current.filter((k) => k !== key)
            : [...current, key]
          return { grants: normalizeGrants({ ...s.grants, [role]: next }) }
        })
      },

      setRoleAllRoutes: (role, granted) => {
        if (LOCKED_ROLES.includes(role)) return
        set((s) => ({
          grants: normalizeGrants({
            ...s.grants,
            // 只授「对该角色适用」的行：团队岗位列不该拿到管理页权限（反之亦然），
            // 那类授权永不生效，落在矩阵里只会造成误读
            [role]: granted
              ? ROUTE_CATALOG.filter((e) => applicableRoles(e).includes(role)).map((e) => e.key)
              : [],
          }),
        }))
      },

      applyDefaultRoles: () => {
        set((s) => ({ grants: withDefaultRoles(s.grants) }))
      },

      resetToDefaults: () => {
        set(() => ({ grants: normalizeGrants(DEFAULT_GRANTS) }))
      },
    }),
    {
      name: `${STORAGE_PREFIX}:permissions`,
      version: 1,
      partialize: (s) => ({ grants: s.grants }),
      // 反序列化统一走 normalizeGrants：旧数据缺字段、脏数据、新增的底座页面都在此兜住。
      // 注意：**持久化数据里没有的新路由不会被自动授权**（fail-closed）—— 新页面默认只有
      // 系统管理员可见，需在权限页勾选，或点「补齐默认授权」按 defaultRoles 批量补上。
      merge: (persisted, current) => ({
        ...current,
        grants: normalizeGrants(
          (persisted as { grants?: Partial<Record<RoleKey, readonly string[]>> } | undefined)
            ?.grants,
        ),
      }),
    },
  ),
)
