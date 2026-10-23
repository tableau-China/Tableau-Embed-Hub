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

/**
 * 登录名的唯一性与自改口令（v0.14.0「个人信息」入口）。
 *
 * 为什么在 store 层测：UI 只是提前把话说清楚，真正的拒绝发生在 `updateUser()` 里 ——
 * 与 docs/org-rules.md 对冻结/删除护栏的同一立场：任何调用方都绕不过去。
 */
describe('登录名唯一性（updateUser 的 username 通道）', () => {
  it('改成与他人重复的登录名（大小写不敏感）被拒绝，且数据不变', () => {
    const before = useOrgStore.getState().users
    // Alice（id=2）改成 'ADMIN' —— 与 admin 撞名，只是大小写不同
    expect(() =>
      useOrgStore.getState().updateUser(2, { username: 'ADMIN' }),
    ).toThrow(/already taken/i)
    expect(useOrgStore.getState().users).toEqual(before)
  })

  it('改成自己当前的登录名不算占用（排除自身）', () => {
    const before = useOrgStore.getState().users
    expect(() =>
      useOrgStore.getState().updateUser(2, { username: 'alice.chen' }),
    ).not.toThrow()
    // 数据等价（同一值重写），但确实走通了 store 的校验
    expect(useOrgStore.getState().users).toEqual(before)
  })

  it('非法字符集的登录名被拒绝', () => {
    expect(() =>
      useOrgStore.getState().updateUser(2, { username: '中文 名' }),
    ).toThrow(/Invalid username/)
  })

  it('合法新登录名可落库，且不动姓名派生的缩写', () => {
    const before = useOrgStore.getState().users.find((u) => u.id === 2)!
    useOrgStore.getState().updateUser(2, { username: 'alice.c' })
    const after = useOrgStore.getState().users.find((u) => u.id === 2)!
    expect(after.username).toBe('alice.c')
    // 缩写是展示名的投影：改登录名不该动它
    expect(after.initials).toBe(before.initials)
    expect(after.name).toBe(before.name)
  })
})

describe('本人自助改密（setOwnPassword）', () => {
  it('只记录时间戳，不保存口令本身', () => {
    const before = useOrgStore.getState().users.find((u) => u.id === 1)!
    expect(before.passwordUpdatedAt).toBeUndefined()

    useOrgStore.getState().setOwnPassword(1)
    const after = useOrgStore.getState().users.find((u) => u.id === 1)!

    // 时间戳写上了，账号其它字段一个都没动
    expect(after.passwordUpdatedAt).toBeTypeOf('string')
    expect(Number.isNaN(Date.parse(after.passwordUpdatedAt!))).toBe(false)
    expect(after).toMatchObject({
      id: before.id,
      username: before.username,
      name: before.name,
      email: before.email,
      initials: before.initials,
      isSystemAdmin: before.isSystemAdmin,
      status: before.status,
    })
    // 口令本身绝不进前端状态（连键都不该出现）
    expect(Object.keys(after).some((k) => k.toLowerCase().includes('password') && k !== 'passwordUpdatedAt')).toBe(false)
  })

  it('改的是指定账号，其他人不受影响', () => {
    // 与前一条用例在同一进程里跑：用执行前的快照作基准，而不是假设"从未设置过"
    const before = useOrgStore.getState().users
    useOrgStore.getState().setOwnPassword(2)
    const users = useOrgStore.getState().users
    expect(users.find((u) => u.id === 2)!.passwordUpdatedAt).toBeTypeOf('string')
    // id=1 的字段原样不动（无论它此前有没有时间戳）
    expect(users.find((u) => u.id === 1)).toEqual(before.find((u) => u.id === 1))
  })
})
