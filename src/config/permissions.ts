import type { TeamRole } from '@/stores/org-store'

/**
 * 权限配置 —— 页面/动作权限目录 + 角色 + 默认授权矩阵（授权体系的**唯一定义源**）
 *
 * 三个概念：
 *   PermissionKey（权限键）—— 稳定标识（`page.workbooks`）。**改路由路径不影响已配置的授权**。
 *   RoleKey（角色）        —— 全局身份（system-admin / member）+ 团队岗位（team-admin / analyst / viewer）。
 *   Grant（授权项）        —— 角色持有的权限键列表，支持通配 `*`、`page.<分支>.*`。
 *
 * 求值规则（实现见 lib/permissions.ts）：
 *   - system-admin 恒为 `*`（**不可编辑**，保证系统里永远有人能开权限，不会把自己锁在门外）；
 *   - 团队作用域路由（`/t/{slug}/...`）→ 按「该用户在当前团队里的岗位」求值；
 *   - 跨团队页面（`/users`、`/teams`、`/permissions`、`/profile`、`/config/smtp`）→ 按「全局身份」求值。
 *
 * 为什么把导航也放进这里：侧边栏、路由守卫、权限页**三处都读 ROUTE_CATALOG**。
 * 新增页面只改本文件一处（登记一行），不再出现「加了路由忘了加菜单 / 忘了加守卫」的漏配。
 * 未登记的路由不受权限约束（交给 404 兜底），但也不会出现在导航与权限页里。
 *
 * 本文件不依赖 React / zustand / window（`import type` 会被编译器与 node 类型擦除一并移除），
 * 因此可被 `scripts/check-*.mjs` 直接 import 做静态校验。
 */

/* ============================== 角色 ============================== */

/** 矩阵列的角色键。`team-admin | analyst | viewer` 与 org-store 的 TeamRole 同值（见下方断言） */
export type RoleKey = 'system-admin' | 'member' | 'team-admin' | 'analyst' | 'viewer'

/** 矩阵列顺序：全局身份一列 + 团队岗位三列 + 锁定的系统管理员列 */
export const ROLE_KEYS: readonly RoleKey[] = [
  'member',
  'team-admin',
  'analyst',
  'viewer',
  'system-admin',
]

/** 可在权限页勾选的角色 */
export const EDITABLE_ROLES: readonly RoleKey[] = ['member', 'team-admin', 'analyst', 'viewer']

/** 恒为 `*` 的角色：不可编辑（防止把系统里唯一的授权入口关掉） */
export const LOCKED_ROLES: readonly RoleKey[] = ['system-admin']

/** 团队岗位角色（团队作用域页面按它求值）—— 与 org-store 的 `TEAM_ROLES` 必须同值 */
export const TEAM_ROLE_KEYS = ['team-admin', 'analyst', 'viewer'] as const

/** `TEAM_ROLE_KEYS` 与 org-store 的 TeamRole 对齐的编译期断言（改一边忘了另一边会在此报错） */
type AssertTeamRoleAligned = TeamRole extends (typeof TEAM_ROLE_KEYS)[number]
  ? (typeof TEAM_ROLE_KEYS)[number] extends TeamRole
    ? true
    : never
  : never
const _teamRoleAligned: AssertTeamRoleAligned = true
void _teamRoleAligned

/** 角色 → i18n 文案 key（复用 users 段的角色名，避免同一角色两套叫法） */
export const ROLE_LABEL_KEYS: Record<RoleKey, string> = {
  'system-admin': 'users.roleSuperAdmin',
  member: 'users.roleMember',
  'team-admin': 'users.roleTeamAdmin',
  analyst: 'users.roleAnalyst',
  viewer: 'users.roleViewer',
}

/** 角色 → 求值场景说明 key（权限页列表头小字） */
export const ROLE_SCOPE_KEYS: Record<RoleKey, string> = {
  'system-admin': 'permissions.scopeGlobal',
  member: 'permissions.scopeGlobal',
  'team-admin': 'permissions.scopeTeam',
  analyst: 'permissions.scopeTeam',
  viewer: 'permissions.scopeTeam',
}

/** 参与者身份：一次请求里「谁、在哪个团队、什么岗位」 */
export interface ActorContext {
  /** 全局系统管理员（org-store 的 User.isSystemAdmin） */
  readonly isSystemAdmin: boolean
  /** 当前团队里的岗位；无当前团队或非成员时为 null */
  readonly teamRole: TeamRole | null
}

/* ============================== 路由目录 ============================== */

/** 权限作用域：team = 团队作用域页面（带 slug）；global = 跨团队管理页 */
export type RouteScope = 'team' | 'global'

/** 侧边栏分组（general = 团队工作区；ai = AI 能力；settings = 组织管理；config = 系统配置） */
export type NavGroup = 'general' | 'ai' | 'settings' | 'config'

export interface RouteEntry {
  /** 稳定权限键（点分层级：`page.<分支>.<叶子>`） */
  readonly key: string
  /** TanStack 路由模式；团队作用域以 `/t/$teamSlug` 开头（渲染时用当前 slug 填充 params） */
  readonly to: string
  readonly scope: RouteScope
  readonly group: NavGroup
  /** 导航与权限页的标题 i18n key */
  readonly labelKey: string
  /** 默认授权角色：**未列出的角色 = 不可见**，需在权限页显式授权（新页面 fail-closed 的依据） */
  readonly defaultRoles: readonly RoleKey[]
  /** 底座页面：任何角色都不可取消勾选（缺了它用户没有出口，比如无团队时的 /teams） */
  readonly required?: boolean
  /**
   * 入口不在侧边栏（改由页面内的其它位置打开，如左下角用户菜单的 Profile）。
   * **仍然照常参与权限体系**：路由守卫、权限矩阵、fail-closed 一视同仁 ——
   * 否则「从别处打开的页面」会变成权限盲区（可见性控制出现漏洞）。
   */
  readonly navHidden?: boolean
}

/**
 * 路由权限目录（侧边栏 / 路由守卫 / 权限页的共同数据源）。
 *
 * 新增页面步骤：
 *   1. 建路由文件 `src/routes/...`；
 *   2. 在本数组登记一行（key 唯一、to 与路由模式一致、labelKey 补 i18n）；
 *   3. 在 app-sidebar.tsx 的 ICONS 里给新 key 配图标（漏配 tsc 会报错）。
 * → 侧边栏入口、URL 直达拦截、权限页勾选行三处**同时生效**，无需再改别处。
 */
export const ROUTE_CATALOG = [
  /* —— 团队作用域（/t/{slug}/...）：按当前团队里的岗位求值 —— */
  {
    key: 'page.dashboard',
    to: '/t/$teamSlug',
    scope: 'team',
    group: 'general',
    labelKey: 'nav.dashboard',
    defaultRoles: ['team-admin', 'analyst', 'viewer'],
    required: true, // 团队首页：关掉后团队成员进门即「无权访问」，必须保留
  },
  {
    key: 'page.favorites',
    to: '/t/$teamSlug/favorites',
    scope: 'team',
    group: 'general',
    labelKey: 'nav.favorites',
    defaultRoles: ['team-admin', 'analyst', 'viewer'],
  },
  {
    key: 'page.recents',
    to: '/t/$teamSlug/recents',
    scope: 'team',
    group: 'general',
    labelKey: 'nav.recents',
    defaultRoles: ['team-admin', 'analyst', 'viewer'],
  },
  {
    key: 'page.workbooks',
    to: '/t/$teamSlug/workbooks',
    scope: 'team',
    group: 'general',
    labelKey: 'nav.workbooks',
    defaultRoles: ['team-admin', 'analyst', 'viewer'],
  },
  {
    key: 'page.views',
    to: '/t/$teamSlug/views',
    scope: 'team',
    group: 'general',
    labelKey: 'nav.views',
    defaultRoles: ['team-admin', 'analyst', 'viewer'],
  },
  /* —— 跨团队页面（无 slug）：按全局身份求值 —— */
  {
    // AI 对话页：模板作为「AI 应用起点」的样板页。
    // 不依赖团队（未配置代理时走内置演示 provider，零配置可看），因此是 global 作用域；
    // 默认授权给 member —— 它是展示能力，不是管理面（与 fail-closed 的 SMTP / 权限页形成对照）。
    key: 'page.ai',
    to: '/ai',
    scope: 'global',
    group: 'ai',
    labelKey: 'nav.ai',
    defaultRoles: ['member'],
  },
  {
    key: 'page.users',
    to: '/users',
    scope: 'global',
    group: 'settings',
    labelKey: 'nav.users',
    defaultRoles: ['member'],
  },
  {
    key: 'page.teams',
    to: '/teams',
    scope: 'global',
    group: 'settings',
    labelKey: 'nav.teams',
    defaultRoles: ['member'],
    required: true, // 无团队用户的唯一出口（/ → /teams），必须保留
  },
  {
    // 个人资料（v0.7.0 由 /settings 改名而来）：入口在左下角用户菜单，不在侧边栏（navHidden）——
    // 它是「我自己的账号」，不属于组织管理；但仍登记在目录里，守卫与权限矩阵照常生效
    key: 'page.profile',
    to: '/profile',
    scope: 'global',
    group: 'settings',
    labelKey: 'nav.profile',
    defaultRoles: ['member'],
    navHidden: true,
  },
  {
    // 系统配置 → SMTP 邮件服务：跨团队的系统级配置，按 fail-closed 默认**只有系统管理员**可见
    key: 'page.config.smtp',
    to: '/config/smtp',
    scope: 'global',
    group: 'config',
    labelKey: 'nav.smtp',
    defaultRoles: [],
  },
  {
    // 帮助页：说明模板的核心功能 / 开发者 / 版本号（侧边栏排在 Config → SMTP 之后）。
    // 它是给全体成员看的说明书、不属于管理面，因此默认授权给 member
    //（与同一分组里 fail-closed 只给系统管理员的 SMTP 形成对照）
    key: 'page.help',
    to: '/help',
    scope: 'global',
    group: 'config',
    labelKey: 'nav.help',
    defaultRoles: ['member'],
  },
  {
    // 组件总览页（/components）：公共件清单 + 实时预览 + App shell 规格 + 主题 token。
    // 与帮助页同为「说明书」性质、不属于管理面，因此默认授权给 member（fail-closed 的口子留给 SMTP / 权限页）。
    // ⚠️ 老浏览器（已有 localStorage 授权矩阵）看不到它 —— 新键不在既有矩阵里即为未授权，
    //    在 /permissions 点一次「补齐默认授权」即可。
    key: 'page.components',
    to: '/components',
    scope: 'global',
    group: 'config',
    labelKey: 'nav.components',
    defaultRoles: ['member'],
  },
  {
    // 权限页自身：新页面按 fail-closed 原则默认**只有系统管理员**可见
    key: 'page.permissions',
    to: '/permissions',
    scope: 'global',
    group: 'settings',
    labelKey: 'nav.permissions',
    defaultRoles: [],
  },
] as const satisfies readonly RouteEntry[]

/** 路由权限键（ROUTE_CATALOG 的键联合，新增一行即自动并入） */
export type RouteKey = (typeof ROUTE_CATALOG)[number]['key']

/**
 * 目录条目的字面量类型（保留精确的 key 字面量）。守卫 / 导航用它做类型安全的路由跳转。
 * 注意：`as const` 推断出的成员类型里，**未声明可选字段的条目没有该字段**
 *（如只有 dashboard/teams 声明了 `required`），因此读 `required` 这类可选字段要过
 * 下面的 `ROUTE_ENTRIES`（接口视图）。
 */
export type CatalogEntry = (typeof ROUTE_CATALOG)[number]

/** 目录的接口视图：读取可选字段（`required`）时用它，避免字面量联合的缺字段报错 */
export const ROUTE_ENTRIES: readonly RouteEntry[] = ROUTE_CATALOG

/* ============================== 动作（按钮级）权限：命名空间预留 ============================== */

/**
 * 动作（按钮级）权限目录 —— **本版仅预留结构，尚无条目**（本次只落地路由层权限）。
 *
 * 约定：`action.<页面分支>.<动作>`，例如
 *   `action.workbooks.create`     —— Workbooks 页「新建」按钮
 *   `action.users.create`         —— Users 页「新建用户」按钮
 *
 * 为什么单独开 `action.*` 分支，而不是挂在页面键下面：
 * 授权支持通配，若动作写成 `page.workbooks.create`，一条 `page.workbooks.*`
 * （本意是「workbooks 分支下的页面」）会顺带把动作权限一起授出去 —— 页面可见 ≠ 允许操作。
 * 两个分支互不命中，页面授权与动作授权可以分别收紧。
 *
 * 落地动作权限时的步骤：
 *   1. 在 ACTION_CATALOG 登记 `{ key, owner, labelKey }`（owner = 所属页面权限键）；
 *   2. 把 `ActionKey` 改成 `(typeof ACTION_CATALOG)[number]['key']`；
 *   3. 页面里用 `useCan()`（或 `<Can permission="action.…">`）包住按钮，
 *      权限页会自动把动作行嵌在所属页面行下面（渲染逻辑已就绪）。
 */
export const ACTION_CATALOG: readonly {
  /** 权限键：`action.<页面分支>.<动作>` */
  key: string
  /** 所属页面权限键（权限页据此把动作行嵌到页面行下） */
  owner: string
  /** 按钮文案对应的 i18n key */
  labelKey: string
}[] = []

/** 动作权限键 —— 待 ACTION_CATALOG 落地后改为其键联合，`PermissionKey` 会自动扩展 */
export type ActionKey = never

/** 全量权限键（当前 = 路由键） */
export type PermissionKey = RouteKey | ActionKey

/** 授权矩阵：角色 → 权限键/通配模式列表 */
export type RoleGrants = Record<RoleKey, string[]>

/**
 * 通配匹配：
 *   `*`            → 全部命中
 *   `page.workbooks.*` → 命中 `page.workbooks.<任意>`（**不含** `page.workbooks` 本身）
 *   其余            → 精确匹配
 * 只在授权项上支持通配，权限键永远写全（避免两侧都是模式导致误判）。
 *
 * 放在本文件（而非 lib/permissions.ts）是为了让 `scripts/check-permissions.mjs`
 * 能直接 import 到**同一份实现**做静态校验 —— lib 那份依赖 zustand，node 脚本不好加载。
 */
export function matchesGrant(grant: string, key: string): boolean {
  if (grant === '*') return true
  if (grant === key) return true
  return grant.endsWith('.*') && key.startsWith(grant.slice(0, -1))
}

/* ============================== 默认授权 ============================== */

/** 某条路由的授权对哪些角色有意义：团队页 → 团队岗位；管理页 → 全局身份 */
export function applicableRoles(entry: RouteEntry): readonly RoleKey[] {
  return entry.scope === 'team' ? TEAM_ROLE_KEYS : ['member']
}

/** 权限键是否已在目录中登记（路由键或动作键） */
export function isKnownPermission(key: string): boolean {
  return (
    ROUTE_CATALOG.some((e) => e.key === key) ||
    ACTION_CATALOG.some((e) => e.key === key) ||
    key.endsWith('.*') ||
    key === '*'
  )
}

/**
 * 是否「设计上只给系统管理员」：defaultRoles 里没有任何可编辑角色。
 *
 * 用来区分两种「没有角色能打开」的情形，避免误报成漏配置：
 *   - `isAdminOnly = true`（如 `page.permissions` 自身）→ 有意为之，权限页显示「Admin only」；
 *   - `isAdminOnly = false` 且当前无人有权（升级后新增页面最常见的状态）→ 真缺口，
 *     权限页显示「No role」并可一键「补齐默认授权」。
 */
export function isAdminOnly(entry: RouteEntry): boolean {
  return entry.defaultRoles.filter((r) => !LOCKED_ROLES.includes(r)).length === 0
}

/** 底座页面（required）的权限键 */
export const REQUIRED_KEYS: readonly string[] = ROUTE_ENTRIES.filter((e) => e.required).map(
  (e) => e.key,
)

/**
 * 由 ROUTE_CATALOG.defaultRoles 派生默认矩阵（**不手写第二份，避免目录与默认值漂移**）。
 *
 * 通配授权（如 `page.<分支>.*`）是权限体系支持的能力，可在权限页对某个角色手动添加；
 * 本线不预置通配，三个团队岗位都按 `defaultRoles` 逐条显式授权（收紧更容易、误授面更小）。
 */
function deriveDefaultGrants(): RoleGrants {
  const out: RoleGrants = {
    'system-admin': ['*'],
    member: [],
    'team-admin': [],
    analyst: [],
    viewer: [],
  }
  for (const entry of ROUTE_CATALOG) {
    for (const role of entry.defaultRoles) {
      if (LOCKED_ROLES.includes(role)) continue
      out[role].push(entry.key)
    }
  }
  return out
}

/** 默认授权矩阵（首次初始化 / 恢复默认 / 补齐默认授权时使用） */
export const DEFAULT_GRANTS: RoleGrants = deriveDefaultGrants()

/**
 * 旧权限键 → 新权限键（页面**改名**时的一次性迁移；只是换路径而不改名不需要迁移）。
 *
 * 为什么需要它：权限键是稳定标识，但页面改名后旧键就再也匹配不到目录条目 ——
 * 它会变成持久化矩阵里的死数据，而新页面按 fail-closed 变成「只有系统管理员可见」，
 * 老用户（已有 localStorage 的浏览器）会莫名其妙失去一个本来有的页面。
 * 在 normalizeGrants 里统一改写，任何读取路径拿到的都是新键。
 */
export const LEGACY_PERMISSION_ALIASES: Record<string, string> = {
  // 0.7.0：/settings 实为「个人资料」页 → 改名 /profile，入口移到左下角用户菜单
  'page.settings': 'page.profile',
}

/** 把旧权限键迁移为当前键（无别名时原样返回） */
export function migratePermissionKey(key: string): string {
  return LEGACY_PERMISSION_ALIASES[key] ?? key
}

/**
 * 归一化授权矩阵：补齐缺失角色、去重、锁死角色恒为 `*`、底座页面强制保留。
 * 用于首次初始化与 localStorage 反序列化（旧数据缺字段、脏数据都不会让 UI 崩）。
 *
 * `input === undefined` = 全新安装 → 取默认矩阵；否则只认传入的键，
 * **新增路由不在其中即为「未授权」**（fail-closed：新页面默认只有系统管理员可见）。
 */
export function normalizeGrants(
  input?: Partial<Record<RoleKey, readonly string[]>> | null,
): RoleGrants {
  const fresh = input === undefined || input === null
  const out: RoleGrants = {
    'system-admin': ['*'],
    member: [],
    'team-admin': [],
    analyst: [],
    viewer: [],
  }
  for (const role of EDITABLE_ROLES) {
    const list = input?.[role]
    out[role] =
      fresh || !Array.isArray(list)
        ? [...DEFAULT_GRANTS[role]]
        : [
            ...new Set(
              list
                .filter((k): k is string => typeof k === 'string' && k.length > 0)
                .map(migratePermissionKey),
            ),
          ]
  }
  return enforceRequiredGrants(out)
}

/** 底座页面：任何角色都不得缺少（否则用户没有出口 —— 例如无团队时进不去 /teams） */
export function enforceRequiredGrants(grants: RoleGrants): RoleGrants {
  const out: RoleGrants = { ...grants, member: [...grants.member] }
  for (const role of EDITABLE_ROLES) out[role] = [...grants[role]]
  for (const entry of ROUTE_ENTRIES) {
    if (!entry.required) continue
    for (const role of applicableRoles(entry)) {
      if (!out[role].includes(entry.key)) out[role].push(entry.key)
    }
  }
  return out
}

/** 按 defaultRoles 补齐默认授权（**只增不减**）：用于升级后把新页面的默认授权一键补上 */
export function withDefaultRoles(grants: RoleGrants): RoleGrants {
  const out: RoleGrants = { ...grants }
  for (const role of EDITABLE_ROLES) out[role] = [...grants[role]]
  for (const entry of ROUTE_CATALOG) {
    for (const role of entry.defaultRoles) {
      if (LOCKED_ROLES.includes(role) || out[role].includes(entry.key)) continue
      out[role].push(entry.key)
    }
  }
  return enforceRequiredGrants(out)
}
