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

/** 用户状态（对齐 pg-explorer 0=active 1=invited 2=inactive 的前端字符串形态） */
export type UserStatus = 'active' | 'invited' | 'inactive'

/** 团队岗位（对齐 pg-explorer TeamMember.role：2=TEAM_ADMIN 3=ANALYST 4=VIEWER） */
export type TeamRole = 'team-admin' | 'analyst' | 'viewer'

export interface OrgUser {
  id: number
  name: string
  email: string
  /** 头像缩略字（如 AC）；新建用户时按姓名自动生成 */
  initials: string
  /** true = 全局系统管理员（用户层级高于 team，可管理所有用户/团队） */
  isSystemAdmin: boolean
  status: UserStatus
  createdAt: string
}

export interface OrgTeam {
  id: number
  name: string
  /** URL 友好的标识符（自动生成，不可编辑） */
  slug: string
  description: string
  /** TeamLogo 图标 key（lucide 图标名，见 components/org/team-logo.tsx） */
  logo: string
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

export const USER_STATUSES: UserStatus[] = ['active', 'invited', 'inactive']

/** 团队岗位 → i18n label key（用户列与团队页通用） */
export const TEAM_ROLE_LABEL_KEYS: Record<TeamRole, string> = {
  'team-admin': 'users.roleTeamAdmin',
  analyst: 'users.roleAnalyst',
  viewer: 'users.roleViewer',
}

/** 用户状态 → i18n label key */
export const USER_STATUS_LABEL_KEYS: Record<UserStatus, string> = {
  active: 'users.active',
  invited: 'users.invited',
  inactive: 'users.inactive',
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

/** name → URL slug（小写字母数字 + 连字符） */
export function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'team'
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

/* ============================== 种子数据 ============================== */

const SEED_TEAMS: OrgTeam[] = [
  {
    id: 1,
    name: 'Acme HQ',
    slug: 'acme-hq',
    description: 'Headquarters workspace · default team of the Administrator',
    logo: 'building2',
  },
  {
    id: 2,
    name: 'Acme Analytics',
    slug: 'acme-analytics',
    description: 'Tableau workbooks, views and embedded analytics demos',
    logo: 'monitor-play',
  },
  {
    id: 3,
    name: 'Acme Data Platform',
    slug: 'acme-data-platform',
    description: 'Data platform & governance pipeline demos',
    logo: 'workflow',
  },
]

const SEED_USERS: OrgUser[] = [
  {
    id: 1,
    name: 'Admin',
    email: 'admin@example.com',
    initials: 'AD',
    isSystemAdmin: true,
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Alice Chen',
    email: 'alice@example.com',
    initials: 'AC',
    isSystemAdmin: false,
    status: 'active',
    createdAt: '2026-08-02T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'Bob Martin',
    email: 'bob@example.com',
    initials: 'BM',
    isSystemAdmin: false,
    status: 'active',
    createdAt: '2026-08-03T00:00:00.000Z',
  },
  {
    id: 4,
    name: 'Carol White',
    email: 'carol@example.com',
    initials: 'CW',
    isSystemAdmin: false,
    status: 'inactive',
    createdAt: '2026-08-04T00:00:00.000Z',
  },
  {
    id: 5,
    name: 'Dave Kim',
    email: 'dave@example.com',
    initials: 'DK',
    isSystemAdmin: false,
    status: 'active',
    createdAt: '2026-08-05T00:00:00.000Z',
  },
  {
    id: 6,
    name: 'Eve Torres',
    email: 'eve@example.com',
    initials: 'ET',
    isSystemAdmin: false,
    status: 'inactive',
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

  setCurrentUser: (userId: number) => void
  setActiveTeam: (teamId: number) => void

  addUser: (data: { name: string; email: string; isSystemAdmin: boolean; status: UserStatus }) => OrgUser
  updateUser: (id: number, patch: Partial<Pick<OrgUser, 'name' | 'email' | 'initials' | 'isSystemAdmin' | 'status'>>) => void
  deleteUser: (id: number) => void

  createTeam: (data: { name: string; description: string; logo: string }) => OrgTeam
  updateTeam: (id: number, patch: Partial<Pick<OrgTeam, 'name' | 'description' | 'logo'>>) => void
  deleteTeam: (id: number) => void

  addMember: (teamId: number, userId: number, role: TeamRole) => void
  updateMember: (teamId: number, userId: number, patch: { role?: TeamRole; isDefault?: boolean }) => void
  removeMember: (teamId: number, userId: number) => void
}

/** 切换用户后重算 activeTeamId：保留原团队（若仍属于该用户），否则取默认团队 → 首个团队 */
function resolveActiveTeamId(
  members: TeamMember[],
  userId: number,
  fallbackTeamId: number | null,
): number | null {
  const mine = userMemberships(members, userId)
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
        const { members } = get()
        set({
          currentUserId: userId,
          activeTeamId: resolveActiveTeamId(members, userId, get().activeTeamId),
        })
      },

      setActiveTeam: (teamId) => {
        const { members, currentUserId } = get()
        if (currentUserId !== null && !isMemberOf(members, currentUserId, teamId)) return
        set({ activeTeamId: teamId })
      },

      addUser: (data) => {
        const user: OrgUser = {
          id: nextId(get().users),
          name: data.name.trim(),
          email: data.email.trim(),
          initials: initialsOf(data.name),
          isSystemAdmin: data.isSystemAdmin,
          status: data.status,
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ users: [...s.users, user] }))
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

      deleteUser: (id) => {
        const { users } = get()
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
                : resolveActiveTeamId(remaining, s.currentUserId!, null),
          }
        })
      },

      createTeam: (data) => {
        const team: OrgTeam = {
          id: nextId(get().teams),
          name: data.name.trim(),
          slug: slugify(data.name),
          description: data.description.trim(),
          logo: data.logo,
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
            teams: [team, ...s.teams],
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
                  slug:
                    patch.name !== undefined && patch.name.trim() !== t.name
                      ? slugify(patch.name)
                      : t.slug,
                  description:
                    patch.description !== undefined
                      ? patch.description.trim()
                      : t.description,
                }
              : t,
          ),
        }))
      },

      deleteTeam: (id) => {
        set((s) => {
          const members = s.members.filter((m) => m.teamId !== id)
          const activeTeamId =
            s.activeTeamId === id
              ? s.currentUserId !== null
                ? resolveActiveTeamId(members, s.currentUserId, null)
                : null
              : s.activeTeamId
          return {
            teams: s.teams.filter((t) => t.id !== id),
            members,
            activeTeamId,
          }
        })
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
        set((s) => {
          let members = s.members.filter(
            (m) => !(m.userId === userId && m.teamId === teamId),
          )
          // 若被移除的是该用户唯一的默认团队，则把剩余成员关系的第一个提升为默认
          const mine = userMemberships(members, userId)
          if (mine.length > 0 && !mine.some((m) => m.isDefault)) {
            members = members.map((m) =>
              m.userId === userId && m.teamId === mine[0]!.teamId
                ? { ...m, isDefault: true }
                : m,
            )
          }
          return {
            members,
            // 移除的是当前用户的团队 → 重算其 activeTeamId
            activeTeamId:
              s.currentUserId === userId && s.activeTeamId === teamId
                ? resolveActiveTeamId(members, userId, null)
                : s.activeTeamId,
          }
        })
      },
    }),
    {
      name: 'shadcn-admin-cn:org',
      version: 1,
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
