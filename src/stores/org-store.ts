import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 组织数据 store：Users(用户，全局，位于 Team 之上) ⇄ TeamMember(成员/岗位) ⇄ Teams(团队)
 *
 * 模型对齐 pg-explorer：
 * - User.isSystemAdmin   —— 全局系统管理员（位于所有团队之上，可管理全部用户与团队）
 * - TeamMember.role      —— 团队岗位：team-admin | analyst | viewer
 * - TeamMember.isDefault —— 该用户在团队中的默认团队（用于决定初始 activeTeamId）
 *
 * 当前为纯前端演示（localStorage 持久化，无后端），后续接 API 时替换 action 内部实现即可。
 */

/* ============================== 类型 ============================== */

/**
 * 用户状态。**只有两个值** —— 与真实后端的账号表严格一致（`status` 列取 `active` / `disabled`）。
 *
 * 这里刻意不再保留 `invited` / `inactive`：
 *   - `invited` 要有「发邀请 → 对方接受 → 激活」的流程支撑，模板没有；真实系统里那通常是
 *     `active` + 一张独立的邀请令牌表，而不是账号状态本身。留一个没人处理的选项，
 *     结果是界面能选、代码里没有任何分支认它；
 *   - `inactive` 与 `disabled` 同义，两个词并存必然有人用错。
 *
 * 换后端时这个类型不用改：接口返回 `status: 'active' | 'disabled'`，直接对上。
 */
export type UserStatus = 'active' | 'disabled'

/** 团队岗位（对齐 pg-explorer TeamMember.role：2=TEAM_ADMIN 3=ANALYST 4=VIEWER） */
export type TeamRole = 'team-admin' | 'analyst' | 'viewer'

export interface OrgUser {
  id: number
  /**
   * 登录名（唯一，大小写不敏感）—— 账号的**主键口径**：登录、日志、按录入人隔离的业务归属
   * 都认它。与 `name`（展示名，可中文、可重名）刻意分开：展示名随便改，
   * 登录名一改，已发出的会话与历史业务数据的归属就全漂了。
   */
  username: string
  name: string
  email: string
  /** 头像缩略字（如 AC）；新建用户时按姓名自动生成 */
  initials: string
  /** true = 全局系统管理员（用户层级高于 team，可管理所有用户/团队） */
  isSystemAdmin: boolean
  status: UserStatus
  createdAt: string
  /**
   * 最近一次重置口令的时间。
   *
   * **口令本身永远不进前端状态** —— 哪怕是演示态的 localStorage：把明文口令写进浏览器存储
   * 是最容易被抄进真实项目的一段坏示范。这里只留一个时间戳；真实实现把
   * `setUserPassword()` 换成 `PUT /api/users/{id}/password` 即可（数据形状不变，
   * 与 `config-store.ts` 的做法一致）。
   */
  passwordUpdatedAt?: string
}

export interface OrgTeam {
  id: number
  name: string
  /**
   * 团队的**稳定标识**，由创建者在新建时**手工输入**，且**创建后不可修改**：
   * - 字符集：仅英文、数字、下划线（`TEAM_SLUG_PATTERN`），唯一；
   *   不允许中文/空格/连字符 —— slug 会进 URL 与配置键，非 ASCII 会被转义成乱码。
   * - 与 `name` 解耦：`name` 可随意改（含中文），`slug` 不会跟着变。
   *
   * 外部模块（路由、按团队切换应用形态/数据源、权限映射等）应把它当作团队身份来用；
   * **不要**用会变的 `name` 当映射键，否则一次改名就会静默失配。
   */
  slug: string
  description: string
  /** TeamLogo 图标 key（lucide 图标名，见 components/org/team-logo.tsx） */
  logo: string
  /**
   * 是否已冻结（临时停用）。除系统管理员外，任何人都**不能进入**冻结的团队：
   * 它不会出现在成员的切换列表里，`setActiveTeam` 也会拒绝。
   *
   * 用途：团队整改 / 数据有问题 / 预算暂停时先冻结——成员自然回落到自己所属的其它团队，
   * 不需要把人逐个移出去（移出去再拉回来会丢岗位设置）。
   *
   * 与 `OrgUser.status` 的区别：冻结**不影响账号**，人还能登录，只是进不去这个团队。
   */
  suspended: boolean
}

export interface TeamMember {
  /** 复合主键：`${teamId}:${userId}` */
  id: string
  userId: number
  teamId: number
  role: TeamRole
  /** 是否为该用户的默认团队（决定初始 activeTeamId） */
  isDefault: boolean
}

/* ============================== 常量 ============================== */

export const TEAM_ROLES: TeamRole[] = ['team-admin', 'analyst', 'viewer']

export const USER_STATUSES: UserStatus[] = ['active', 'disabled']

/** 团队岗位 → i18n label key（用户列与团队页通用） */
export const TEAM_ROLE_LABEL_KEYS: Record<TeamRole, string> = {
  'team-admin': 'users.roleTeamAdmin',
  analyst: 'users.roleAnalyst',
  viewer: 'users.roleViewer',
}

/**
 * 用户状态 → i18n label key。
 * 注意 `disabled` 在界面上叫 **Frozen（冻结）**：值是 `disabled`（与后端 status 列对齐），
 * 展示文案用「冻结」是因为它描述的正是这个动作——临时停用、账号与团队关系都还在。
 */
export const USER_STATUS_LABEL_KEYS: Record<UserStatus, string> = {
  active: 'users.active',
  disabled: 'users.frozen',
}

/** 允许的 TeamLogo 图标 key（与 team-logo.tsx 的映射保持一致） */
export const TEAM_LOGO_KEYS = [
  'building2',
  'briefcase',
  'monitor-play',
  'workflow',
  'globe',
  'command',
  'audio-waveform',
  'gallery-vertical-end',
  'zap',
  'star',
  'shield',
  'cpu',
  'blocks',
  'layout-grid',
] as const

/* ============================== 工具 ============================== */

/** 从姓名生成双字母缩略字：多词取首字母，单词取前两个字符（大写） */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words
    .slice(0, 2)
    .map((w) => w[0]!)
    .join('')
    .toUpperCase()
}

/**
 * 登录名规范：进 URL / 日志 / 配置，限制为 ASCII 安全字符。
 *
 * 与后端 `UserRepository.USERNAME_PATTERN` 保持同一口径 —— 前端先拦一道只是少一次往返，
 * **真正的校验在服务端**（接口不信任前端传来的值）。
 */
export const USERNAME_PATTERN = /^[A-Za-z0-9_.@-]{2,64}$/

export type UsernameIssue = 'empty' | 'charset' | 'taken'

/** 校验登录名：为空 / 含非法字符 / 与既有账号重复（大小写不敏感）。`null` = 可用 */
export function usernameIssue(
  username: string,
  users: readonly Pick<OrgUser, 'id' | 'username'>[],
  excludeUserId?: number,
): UsernameIssue | null {
  const value = username.trim()
  if (value === '') return 'empty'
  if (!USERNAME_PATTERN.test(value)) return 'charset'
  const taken = users.some(
    (u) => u.id !== excludeUserId && u.username.toLowerCase() === value.toLowerCase(),
  )
  return taken ? 'taken' : null
}

/**
 * Team slug 允许的字符集：**仅英文、数字、下划线**。
 *
 * 刻意不允许中文、空格、连字符等：slug 会出现在 URL、路由参数、配置键、日志里，
 * 非 ASCII 字符一律被百分号转义（`试单` → `%E8%AF%95%E5%8D%95`），既不可读，
 * 又容易在复制粘贴、nginx 规则、日志排查时出错。slug 由创建者**手工输入**，
 * 不再由团队名自动派生（名称是中文时派生结果必然不可用）。
 */
export const TEAM_SLUG_PATTERN = /^[A-Za-z0-9_]+$/

/** slug 是否合法（非空且仅含英文/数字/下划线） */
export function isValidTeamSlug(slug: string): boolean {
  return TEAM_SLUG_PATTERN.test(slug)
}

/**
 * 输入过滤：丢弃所有非法字符（中文、空格、连字符、标点…）。
 * 供输入框 onChange 使用 —— 敲入非法字符时直接打不进去，而不是等提交才报错。
 */
export function sanitizeTeamSlug(input: string): string {
  return input.replace(/[^A-Za-z0-9_]/g, '')
}

/** slug 校验结果；`null` = 可用 */
export type TeamSlugIssue = 'empty' | 'charset' | 'taken'

/**
 * 校验团队 slug：为空 / 含非法字符 / 与既有团队重复。
 * 表单与 store 共用同一口径，避免「前端放行、落库才出问题」。
 * `excludeTeamId`：忽略指定团队自身已占用的 slug。
 */
export function teamSlugIssue(
  slug: string,
  teams: readonly Pick<OrgTeam, 'id' | 'slug'>[],
  excludeTeamId?: number,
): TeamSlugIssue | null {
  if (slug === '') return 'empty'
  if (!isValidTeamSlug(slug)) return 'charset'
  const taken = teams.some((t) => t.id !== excludeTeamId && t.slug === slug)
  return taken ? 'taken' : null
}

export function isMemberOf(
  members: TeamMember[],
  userId: number,
  teamId: number,
): boolean {
  return members.some((m) => m.userId === userId && m.teamId === teamId)
}

export function userMemberRole(
  members: TeamMember[],
  userId: number,
  teamId: number,
): TeamRole | null {
  return members.find((m) => m.userId === userId && m.teamId === teamId)?.role ?? null
}

export function teamMembers(members: TeamMember[], teamId: number): TeamMember[] {
  return members.filter((m) => m.teamId === teamId)
}

export function userMemberships(members: TeamMember[], userId: number): TeamMember[] {
  return members.filter((m) => m.userId === userId)
}

/**
 * 该用户能否进入这个团队：正常团队人人可进；**冻结团队只有系统管理员能进**。
 * 系统管理员保留入口是为了能进去处理故障/查看数据，而不是被自己的冻结操作锁在外面。
 */
export function canEnterTeam(
  team: Pick<OrgTeam, 'suspended'>,
  user: Pick<OrgUser, 'isSystemAdmin'> | undefined,
): boolean {
  if (!team.suspended) return true
  return user?.isSystemAdmin === true
}

/** 用户可进入的团队 id 集合（冻结团队对非管理员直接排除） */
export function enterableTeamIds(
  teams: readonly OrgTeam[],
  members: TeamMember[],
  user: Pick<OrgUser, 'id' | 'isSystemAdmin'> | undefined,
): number[] {
  if (!user) return []
  return userMemberships(members, user.id)
    .map((m) => teams.find((t) => t.id === m.teamId))
    .filter((t): t is OrgTeam => t !== undefined && canEnterTeam(t, user))
    .map((t) => t.id)
}

/**
 * 删除团队时会「失去全部团队」的成员用户（这些用户只属于该团队）。
 * 归属不变量（每个用户至少属于一个团队）要求删除前先处理这批人，UI 与 store 共用此判定。
 */
export function orphanedUsersOfTeam(members: TeamMember[], teamId: number): number[] {
  const affected = members.filter((m) => m.teamId === teamId).map((m) => m.userId)
  return affected.filter(
    (userId) => userMemberships(members, userId).length <= 1,
  )
}

/**
 * 团队按创建次序展示：id 自增单调，升序即创建次序。
 * 数组本身由 createTeam 保证追加到末尾，此函数供展示层兜底
 * （兼容 v0.4.0 早期持久化数据中新建团队被插入队首的乱序）。
 */
export function sortTeamsById<T extends OrgTeam>(teams: readonly T[]): T[] {
  return [...teams].sort((a, b) => a.id - b.id)
}

/* ============================== 种子数据 ============================== */

const SEED_TEAMS: OrgTeam[] = [
  {
    id: 1,
    name: 'Acme HQ',
    slug: 'acme_hq',
    description: 'Headquarters workspace · default team of the Administrator',
    logo: 'building2',
    suspended: false,
  },
  {
    id: 2,
    name: 'Acme Analytics',
    slug: 'acme_analytics',
    description: 'Tableau workbooks, views and embedded analytics demos',
    logo: 'monitor-play',
    suspended: false,
  },
  {
    id: 3,
    name: 'Acme Data Platform',
    slug: 'acme_data_platform',
    description: 'Data platform & governance pipeline demos',
    logo: 'workflow',
    suspended: false,
  },
]

const SEED_USERS: OrgUser[] = [
  {
    id: 1,
    name: 'Admin',
    username: 'admin',
    email: 'admin@example.com',
    initials: 'AD',
    isSystemAdmin: true,
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Alice Chen',
    username: 'alice.chen',
    email: 'alice@example.com',
    initials: 'AC',
    isSystemAdmin: false,
    status: 'active',
    createdAt: '2026-08-02T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'Bob Martin',
    username: 'bob.martin',
    email: 'bob@example.com',
    initials: 'BM',
    isSystemAdmin: false,
    status: 'active',
    createdAt: '2026-08-03T00:00:00.000Z',
  },
  {
    id: 4,
    name: 'Carol White',
    username: 'carol.white',
    email: 'carol@example.com',
    initials: 'CW',
    isSystemAdmin: false,
    status: 'disabled',
    createdAt: '2026-08-04T00:00:00.000Z',
  },
  {
    id: 5,
    name: 'Dave Kim',
    username: 'dave.kim',
    email: 'dave@example.com',
    initials: 'DK',
    isSystemAdmin: false,
    status: 'active',
    createdAt: '2026-08-05T00:00:00.000Z',
  },
  {
    id: 6,
    name: 'Eve Torres',
    username: 'eve.torres',
    email: 'eve@example.com',
    initials: 'ET',
    isSystemAdmin: false,
    status: 'disabled',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
]

const SEED_MEMBERS: TeamMember[] = [
  // Admin —— 系统管理员，属于全部 3 个团队
  { id: '1:1', userId: 1, teamId: 1, role: 'team-admin', isDefault: true },
  { id: '2:1', userId: 1, teamId: 2, role: 'analyst', isDefault: false },
  { id: '3:1', userId: 1, teamId: 3, role: 'team-admin', isDefault: false },
  // Alice —— HQ analyst(默认) + Data Platform viewer
  { id: '1:2', userId: 2, teamId: 1, role: 'analyst', isDefault: true },
  { id: '3:2', userId: 2, teamId: 3, role: 'viewer', isDefault: false },
  // Bob —— Analytics team-admin(默认) + HQ viewer
  { id: '2:3', userId: 3, teamId: 2, role: 'team-admin', isDefault: true },
  { id: '1:3', userId: 3, teamId: 1, role: 'viewer', isDefault: false },
  // Carol —— HQ viewer(默认)
  { id: '1:4', userId: 4, teamId: 1, role: 'viewer', isDefault: true },
  // Dave —— Data Platform analyst(默认)
  { id: '3:5', userId: 5, teamId: 3, role: 'analyst', isDefault: true },
  // Eve —— Data Platform viewer(默认)
  { id: '3:6', userId: 6, teamId: 3, role: 'viewer', isDefault: true },
]

/* ============================== Store ============================== */

interface OrgState {
  users: OrgUser[]
  teams: OrgTeam[]
  members: TeamMember[]
  currentUserId: number | null
  activeTeamId: number | null

  /**
   * 切换当前登录用户（演示态的「登录」）。
   * **被冻结的用户无法登录** —— 返回 false，调用方负责提示原因。
   */
  setCurrentUser: (userId: number) => boolean
  /**
   * 切换当前团队。返回 false = 被拒（不是该团队成员，或团队已冻结而当前用户不是系统管理员）。
   */
  setActiveTeam: (teamId: number) => boolean

  addUser: (data: {
    /** 登录名（唯一，大小写不敏感）；重复时抛错 */
    username: string
    name: string
    email: string
    isSystemAdmin: boolean
    status: UserStatus
    /**
     * 新用户初始所属团队。不传时取**当前团队**（`activeTeamId`），再退回第一个团队。
     *
     * 「每个用户必须属于某个团队」是硬性不变量：如果没有任何团队可用，本动作返回 `null`，
     * 由调用方提示「请先创建团队」——而不是造出一个没有归属的用户。
     */
    teamId?: number
    /** 在初始团队中的岗位，默认 viewer（最小权限） */
    role?: TeamRole
  }) => OrgUser | null
  updateUser: (id: number, patch: Partial<Pick<OrgUser, 'name' | 'email' | 'initials' | 'isSystemAdmin' | 'status'>>) => void
  /**
   * 冻结 / 解冻用户：冻结把 `status` 置为 `disabled`，**该用户无法登录**；
   * 账号本身与它的团队关系都保留（与删除账号是两件事）。
   *
   * 返回 false = 被护栏拦下：不能冻结自己（否则当场把自己锁在外面）、
   * 不能冻结最后一名未冻结的系统管理员。
   */
  freezeUser: (id: number, frozen: boolean) => boolean
  deleteUser: (id: number) => void
  /**
   * 重置口令（管理员操作，不需要旧口令）。
   *
   * 演示态**只记录时间戳**，不保存口令 —— 见 `OrgUser.passwordUpdatedAt` 的说明。
   * 接后端时把这个动作内部换成 `PUT /api/users/{id}/password` 即可，调用方无需改动。
   */
  setUserPassword: (id: number) => void

  /**
   * 新建团队。`slug` 由调用方（新建表单）提供并已通过 `teamSlugIssue` 校验：
   * 非空、仅英文/数字/下划线、且未被其它团队占用。slug 落库后即固定不变。
   */
  createTeam: (data: { name: string; slug: string; description: string; logo: string }) => OrgTeam
  updateTeam: (id: number, patch: Partial<Pick<OrgTeam, 'name' | 'description' | 'logo' | 'suspended'>>) => void
  /** 冻结 / 解冻团队：冻结后仅系统管理员可进入（见 `canEnterTeam`） */
  setTeamSuspended: (id: number, suspended: boolean) => void
  /**
   * 删除团队。返回 false = 被护栏拦下：该团队里有成员**只属于它**，
   * 删掉会让这些人失去全部团队（违反「每个用户必须属于某个团队」）。
   */
  deleteTeam: (id: number) => boolean

  addMember: (teamId: number, userId: number, role: TeamRole) => void
  updateMember: (teamId: number, userId: number, patch: { role?: TeamRole; isDefault?: boolean }) => void
  /** 移除成员关系。返回 false = 被拦下：这是该用户唯一的团队，移除会让他没有归属 */
  removeMember: (teamId: number, userId: number) => boolean
}

/**
 * 持久化到 localStorage 的字段（与 `persist.partialize` 一一对应）。
 * 迁移函数可能拿到更老、字段不全的数据，因此把返回值断言成这个形状。
 */
type PersistedOrgState = Pick<
  OrgState,
  'users' | 'teams' | 'members' | 'currentUserId' | 'activeTeamId'
>

/**
 * 切换用户/团队关系变化后重算 activeTeamId：
 * 优先保留原团队（前提是该用户仍是成员、且他能进入——冻结团队对非管理员不算数），
 * 否则取默认团队 → 第一个可进入的团队；一个都进不去时返回 null。
 */
function resolveActiveTeamId(
  teams: readonly OrgTeam[],
  members: TeamMember[],
  users: readonly OrgUser[],
  userId: number,
  fallbackTeamId: number | null,
): number | null {
  const user = users.find((u) => u.id === userId)
  const mine = userMemberships(members, userId).filter((m) => {
    const team = teams.find((t) => t.id === m.teamId)
    return team !== undefined && canEnterTeam(team, user)
  })
  if (mine.length === 0) return null
  if (fallbackTeamId !== null && mine.some((m) => m.teamId === fallbackTeamId)) {
    return fallbackTeamId
  }
  return (mine.find((m) => m.isDefault) ?? mine[0]!).teamId
}

function nextId(list: Array<{ id: number }>): number {
  return list.length === 0 ? 1 : Math.max(...list.map((x) => x.id)) + 1
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      users: SEED_USERS,
      teams: SEED_TEAMS,
      members: SEED_MEMBERS,
      currentUserId: 1,
      activeTeamId: 1,

      setCurrentUser: (userId) => {
        const { members, teams, users } = get()
        const user = users.find((u) => u.id === userId)
        // 冻结（status: disabled）的账号无法登录 —— 演示态的“登录”就是切换身份，这里同样拦住
        if (!user || user.status !== 'active') return false
        set({
          currentUserId: userId,
          activeTeamId: resolveActiveTeamId(
            teams,
            members,
            users,
            userId,
            get().activeTeamId,
          ),
        })
        return true
      },

      setActiveTeam: (teamId) => {
        const { members, teams, users, currentUserId } = get()
        if (currentUserId === null || !isMemberOf(members, currentUserId, teamId)) {
          return false
        }
        const team = teams.find((t) => t.id === teamId)
        const user = users.find((u) => u.id === currentUserId)
        // 冻结团队只有系统管理员能进
        if (!team || !canEnterTeam(team, user)) return false
        set({ activeTeamId: teamId })
        return true
      },

      addUser: (data) => {
        const username = data.username.trim()
        // 登录名唯一性在 store 里再兜一层（大小写不敏感）。真实系统靠数据库的 UNIQUE 约束，
        // 演示态没有数据库 —— 不兜的话会静默产生两个"同一个人"。
        const problem = usernameIssue(username, get().users)
        if (problem === 'empty' || problem === 'charset') {
          throw new Error(`Invalid username: ${username}`)
        }
        if (problem === 'taken') {
          throw new Error(`Username already taken: ${username}`)
        }
        // 归属不变量：新用户必须落进某个团队。默认落到**当前团队**（团队页范围），
        // 当前团队为空时退回第一个团队；一个团队都没有则拒绝创建。
        const { teams, activeTeamId, members } = get()
        const initialTeam =
          teams.find((t) => t.id === (data.teamId ?? activeTeamId)) ?? teams[0]
        if (!initialTeam) return null

        const user: OrgUser = {
          id: nextId(get().users),
          username,
          name: data.name.trim(),
          email: data.email.trim(),
          initials: initialsOf(data.name),
          isSystemAdmin: data.isSystemAdmin,
          status: data.status,
          createdAt: new Date().toISOString(),
        }
        const membership: TeamMember = {
          id: `${initialTeam.id}:${user.id}`,
          userId: user.id,
          teamId: initialTeam.id,
          role: data.role ?? 'viewer',
          // 第一个（也是唯一一个）团队即默认团队
          isDefault: userMemberships(members, user.id).length === 0,
        }
        set((s) => ({
          users: [...s.users, user],
          members: [...s.members, membership],
        }))
        return user
      },

      updateUser: (id, patch) => {
        set((s) => ({
          users: s.users.map((u) => {
            if (u.id !== id) return u
            const name = patch.name !== undefined ? patch.name.trim() : u.name
            return {
              ...u,
              ...patch,
              name,
              initials: patch.name !== undefined ? initialsOf(patch.name) : u.initials,
            }
          }),
        }))
      },

      freezeUser: (id, frozen) => {
        const { users, currentUserId } = get()
        const user = users.find((u) => u.id === id)
        if (!user) return false
        // 护栏 1：不能冻结自己 —— 否则当场把自己锁在系统外（真实系统里同样如此）
        if (currentUserId === id) return false
        // 护栏 2：不能冻结最后一名「未冻结」的系统管理员（否则没人能再解冻/管理）
        if (frozen && user.isSystemAdmin) {
          const activeAdmins = users.filter(
            (u) => u.isSystemAdmin && u.status === 'active' && u.id !== id,
          )
          if (activeAdmins.length === 0) return false
        }
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id ? { ...u, status: frozen ? 'disabled' : 'active' } : u,
          ),
        }))
        return true
      },

      deleteUser: (id) => {
        const { users, teams } = get()
        const user = users.find((u) => u.id === id)
        if (!user) return
        // 保护：不能删除最后一个系统管理员
        const superAdmins = users.filter((u) => u.isSystemAdmin)
        if (user.isSystemAdmin && superAdmins.length <= 1) return
        // 保护：不能删除当前登录用户（演示场景由 UI 兜底，这里再防一层）
        if (get().currentUserId === id) return
        set((s) => {
          const remaining = s.members.filter((m) => m.userId !== id)
          return {
            users: s.users.filter((u) => u.id !== id),
            members: remaining,
            activeTeamId:
              s.currentUserId !== id
                ? s.activeTeamId
                : resolveActiveTeamId(
                    teams,
                    remaining,
                    s.users,
                    s.currentUserId!,
                    null,
                  ),
          }
        })
      },

      setUserPassword: (id) => {
        // 刻意不接收、也不保存口令：口令只应写后端。这里做的只是把「刚刚重置过」这件事
        // 记下来（真实系统里这个时间戳同样有用 —— 用来判断「改密后旧会话是否该失效」）。
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id ? { ...u, passwordUpdatedAt: new Date().toISOString() } : u,
          ),
        }))
      },

      createTeam: (data) => {
        const team: OrgTeam = {
          id: nextId(get().teams),
          name: data.name.trim(),
          // slug 由用户输入，在此落库后固定不变（改名/改描述都不会动它）
          slug: data.slug.trim(),
          description: data.description.trim(),
          logo: data.logo,
          // 新团队默认不冻结
          suspended: false,
        }
        const creatorId = get().currentUserId
        set((s) => {
          // 创建者自动成为 team-admin 成员；若创建者尚无任何团队，则作为默认团队
          const mine = creatorId !== null ? userMemberships(s.members, creatorId) : []
          const member: TeamMember = {
            id: `${team.id}:${creatorId}`,
            userId: creatorId!,
            teamId: team.id,
            role: 'team-admin',
            isDefault: mine.length === 0,
          }
          const members =
            creatorId !== null
              ? [...s.members, member]
              : s.members
          return {
            // 新团队追加到末尾：数组次序 = 创建次序（id 自增单调，见 sortTeamsById）
            teams: [...s.teams, team],
            members,
            activeTeamId: team.id,
          }
        })
        return team
      },

      updateTeam: (id, patch) => {
        set((s) => ({
          teams: s.teams.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...patch,
                  name: patch.name !== undefined ? patch.name.trim() : t.name,
                  // 注意：**不重算 slug**。slug 是团队稳定标识（创建时定），
                  // 改名只改展示名；否则按 slug 做团队→应用/数据源映射的模块会静默失配。
                  description:
                    patch.description !== undefined
                      ? patch.description.trim()
                      : t.description,
                }
              : t,
          ),
        }))
      },

      setTeamSuspended: (id, suspended) => {
        set((s) => {
          const teams = s.teams.map((t) => (t.id === id ? { ...t, suspended } : t))
          return {
            teams,
            // 冻结的团队对非管理员不再可进：当前用户若是非管理员且正停在这个团队，
            // 需要立刻把他挪到自己可进入的团队（否则会出现“停留在已冻结团队”的破窗）
            activeTeamId:
              s.currentUserId !== null
                ? resolveActiveTeamId(
                    teams,
                    s.members,
                    s.users,
                    s.currentUserId,
                    s.activeTeamId,
                  )
                : s.activeTeamId,
          }
        })
      },

      deleteTeam: (id) => {
        const { members, teams, users, currentUserId, activeTeamId } = get()
        // 归属不变量：删掉这个团队会让部分成员失去全部团队 —— 拒绝删除，由 UI 提示先安置这些人
        if (orphanedUsersOfTeam(members, id).length > 0) return false
        const remaining = members.filter((m) => m.teamId !== id)
        const nextTeams = teams.filter((t) => t.id !== id)
        set({
          teams: nextTeams,
          members: remaining,
          activeTeamId:
            activeTeamId === id && currentUserId !== null
              ? resolveActiveTeamId(nextTeams, remaining, users, currentUserId, null)
              : activeTeamId,
        })
        return true
      },

      addMember: (teamId, userId, role) => {
        set((s) => {
          if (isMemberOf(s.members, userId, teamId)) return s
          const mine = userMemberships(s.members, userId)
          const member: TeamMember = {
            id: `${teamId}:${userId}`,
            userId,
            teamId,
            role,
            isDefault: mine.length === 0,
          }
          return { members: [...s.members, member] }
        })
      },

      updateMember: (teamId, userId, patch) => {
        set((s) => {
          let members = s.members.map((m) =>
            m.userId === userId && m.teamId === teamId ? { ...m, ...patch } : m,
          )
          // 将该成员关系设为默认时，同一用户的其他成员关系自动取消默认
          if (patch.isDefault === true) {
            members = members.map((m) =>
              m.userId === userId && m.teamId !== teamId
                ? { ...m, isDefault: false }
                : m,
            )
          }
          return { members }
        })
      },

      removeMember: (teamId, userId) => {
        const { members, teams, users, currentUserId, activeTeamId } = get()
        // 归属不变量：这是该用户唯一的团队 —— 拒绝移除，由 UI 提示先给他分配其它团队
        if (userMemberships(members, userId).length <= 1) return false
        let next = members.filter((m) => !(m.userId === userId && m.teamId === teamId))
        // 若被移除的是该用户唯一的默认团队，则把剩余成员关系的第一个提升为默认
        const mine = userMemberships(next, userId)
        if (mine.length > 0 && !mine.some((m) => m.isDefault)) {
          next = next.map((m) =>
            m.userId === userId && m.teamId === mine[0]!.teamId
              ? { ...m, isDefault: true }
              : m,
          )
        }
        set({
          members: next,
          // 移除的是当前用户当前所在的团队 → 重算其 activeTeamId
          activeTeamId:
            currentUserId === userId && activeTeamId === teamId
              ? resolveActiveTeamId(teams, next, users, userId, null)
              : activeTeamId,
        })
        return true
      },
    }),
    {
      name: 'shadcn-admin-cn:org',
      version: 3,
      migrate: (persisted, version) => {
        const from = version ?? 0
        let p = (persisted ?? {}) as Partial<PersistedOrgState>

        // v1 -> v2：账号新增必填的 `username`，状态收敛为 active / disabled。
        //
        // 老数据是 localStorage 里已经存着的账号，没有登录名 —— 不补就会在列表与表单里
        // 渲染出 `undefined`（比"名字不好看"严重得多）。按邮箱前缀补一个，重名就加序号。
        // 状态：invited / inactive 一律归到 disabled（模板没有邀请流程，见 UserStatus 注释）。
        if (from < 2 && p.users) {
          const used = new Set<string>()
          p = {
            ...p,
            users: p.users.map((u) => {
              const base =
                ((u.email ?? '').split('@')[0] ?? '').replace(/[^A-Za-z0-9_.@-]/g, '').slice(0, 60) ||
                `user${u.id}`
              let username = base
              let n = 1
              while (used.has(username.toLowerCase())) username = `${base}${++n}`
              used.add(username.toLowerCase())
              return {
                ...u,
                username,
                status: (u.status as string) === 'active' ? 'active' : 'disabled',
              }
            }),
          }
        }

        // v2 -> v3：团队新增 `suspended`（默认不冻结）；并落实**每个用户必须属于某个团队**——
        // 早期版本新建的用户可能一个团队都没有（那时还没有这条不变量），
        // 这里给他们补一条成员关系（当前团队 → 第一个团队），否则列表里会出现"无家可归"的账号。
        if (from < 3) {
          const teams: OrgTeam[] = (p.teams ?? []).map((t) => ({
            ...t,
            suspended: t.suspended === true,
          }))
          const members: TeamMember[] = [...(p.members ?? [])]
          const fallbackTeamId =
            teams.find((t) => t.id === p.activeTeamId)?.id ?? teams[0]?.id
          if (fallbackTeamId !== undefined) {
            for (const u of p.users ?? []) {
              if (members.some((m) => m.userId === u.id)) continue
              members.push({
                id: `${fallbackTeamId}:${u.id}`,
                userId: u.id,
                teamId: fallbackTeamId,
                role: 'viewer',
                isDefault: true,
              })
            }
          }
          p = { ...p, teams, members }
        }

        return p as PersistedOrgState
      },
      partialize: (s) => ({
        users: s.users,
        teams: s.teams,
        members: s.members,
        currentUserId: s.currentUserId,
        activeTeamId: s.activeTeamId,
      }),
    },
  ),
)
