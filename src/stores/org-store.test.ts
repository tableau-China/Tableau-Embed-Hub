import { describe, expect, it, vi } from 'vitest'

/**
 * org-store 用 zustand/persist 读写 localStorage，而 vitest 跑在 node 环境（见 vitest.config.ts）。
 * 用 `vi.hoisted` 打桩：它在所有 import **之前**执行，保证 store 被求值时存储已经就位
 * （若放在普通顶层语句里，动态 import 会先一步求值，zustand 会退化成「storage unavailable」）。
 */
vi.hoisted(() => {
  const memory = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage
  // 注意：zustand 的默认 storage 是 `createJSONStorage(() => window.localStorage)` —— 取的是
  // **window**.localStorage，不是裸 localStorage；node 环境两者都没有，所以都得补。
  const g = globalThis as unknown as { localStorage: Storage; window: unknown }
  g.localStorage = localStorage
  g.window = { localStorage }
})

const { defaultTeamId, isDefaultTeam, useOrgStore } = await import('./org-store')

/**
 * 默认团队护栏（docs/org-rules.md 铁律 4：默认团队不可删除、**不可冻结**）。
 *
 * 这一层才是真正的兜底 —— UI 只是提前把行内按钮与弹窗开关置灰，
 * 任何调用方（将来的批量操作、接口层）都要在这里被拦下。
 */
describe('默认团队不可冻结', () => {
  it('冻结默认团队被拒绝，且数据不变', () => {
    const defaultId = defaultTeamId(useOrgStore.getState().teams)
    expect(defaultId).not.toBeNull()

    expect(useOrgStore.getState().setTeamSuspended(defaultId!, true)).toBe(false)
    expect(
      useOrgStore.getState().teams.find((t) => t.id === defaultId)!.suspended,
    ).toBe(false)
  })

  it('非默认团队照常可以冻结 / 解冻', () => {
    const other = useOrgStore
      .getState()
      .teams.find((t) => !isDefaultTeam(useOrgStore.getState().teams, t.id))!
    expect(useOrgStore.getState().setTeamSuspended(other.id, true)).toBe(true)
    expect(useOrgStore.getState().teams.find((t) => t.id === other.id)!.suspended).toBe(true)
    expect(useOrgStore.getState().setTeamSuspended(other.id, false)).toBe(true)
    expect(useOrgStore.getState().teams.find((t) => t.id === other.id)!.suspended).toBe(false)
  })
})

describe('默认团队不可删除', () => {
  it('删除默认团队被拒绝', () => {
    const defaultId = defaultTeamId(useOrgStore.getState().teams)
    expect(useOrgStore.getState().deleteTeam(defaultId!)).toBe(false)
    expect(useOrgStore.getState().teams.some((t) => t.id === defaultId)).toBe(true)
  })
})
