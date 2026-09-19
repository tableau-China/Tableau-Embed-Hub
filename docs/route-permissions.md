# 页面权限设计（Route Permissions）

> v0.6.0 落地（框架线 v0.7.0 同步）。适用对象：需要给不同角色开通不同页面的人，以及**后期要给模板加新页面 / 新按钮**的人。
> 相关文件：`src/config/permissions.ts`（目录）、`src/lib/permissions.ts`（求值）、`src/stores/permission-store.ts`（矩阵）、`src/hooks/use-permissions.ts`（React 入口）、`src/features/permissions/permissions-page.tsx`（权限页）、`scripts/check-permissions.mjs`（校验）。

## 1. 三个概念

| 概念 | 说明 | 例子 |
| --- | --- | --- |
| **权限键** `PermissionKey` | 稳定标识，**与路由路径解耦**：改路径不会让已配置的授权失效 | `page.workbooks` |
| **角色** `RoleKey` | 全局身份 + 团队岗位，共 5 个 | `system-admin` / `member` / `team-admin` / `analyst` / `viewer` |
| **授权项** Grant | 角色持有的权限键列表，支持通配 | `page.workbooks.*`、`*` |

一行路由目录长这样（`src/config/permissions.ts`）：

```ts
{
  key: 'page.workbooks',        // 权限键（稳定标识）
  to: '/t/$teamSlug/workbooks', // 路由模式（与 routes/ 下的文件路由一一对应）
  scope: 'team',                // team = 团队作用域；global = 跨团队页面
  group: 'general',             // 侧边栏与权限页的分组（general / settings / config）
  labelKey: 'nav.workbooks',    // 标题 i18n key
  defaultRoles: ['team-admin', 'analyst', 'viewer'], // 默认授权角色（新装/恢复默认时使用）
  // required: true,            // 底座页面：任何角色都不可取消勾选
  // navHidden: true,           // 入口不在侧边栏（如 Profile 在左下角用户菜单），但权限判定照旧
}
```

## 2. 求值规则（最重要的一节）

```
准入 = 授权矩阵[角色] 命中权限键
角色 = rolesForScope(scope, actor)
```

1. **系统管理员恒通过**：`system-admin` 的角色授权固定为 `*`，不可编辑 —— 保证系统里永远有人能开权限，不会把自己锁在门外。
2. **团队作用域页面**（`/t/{slug}/...`）→ 按**该用户在当前团队里的岗位**判定。同一个人在 A 团队是 `team-admin`、在 B 团队是 `viewer`，因此「Workbooks 在 A 团队能看、在 B 团队看不到」天然成立，不需要第二套模型。
3. **跨团队页面**（`/users`、`/teams`、`/permissions`、`/profile`、`/config/smtp`）→ 按**全局身份**判定（`member` / `system-admin`）。团队岗位在这些页面上不参与判定。
4. **通配**：`*` 命中一切；`page.workbooks.*` 命中 `page.workbooks.<任意>`（**不含** `page.workbooks` 本身）。通配只写在授权侧，权限键永远写全。本线**不预置**通配授权（三个团队岗位逐条显式），需要时在权限页对某角色手动添加。
5. **底座页面**（`required: true`）：`page.dashboard`（团队首页）与 `page.teams`（无团队用户的唯一出口）。它们的勾选框在所有角色列上锁定为已勾选——关掉等于让用户进门就撞「无权访问」或无处可去。

## 3. 三道防线（缺一不可）

| 位置 | 作用 | 实现 |
| --- | --- | --- |
| 侧边栏过滤 | 无权访问的入口不渲染 | `app-sidebar.tsx` 用 `useCan()` 过滤目录条目（`navHidden` 的页面本就不在侧边栏） |
| 页面内入口过滤 | 入口在别处的页面（如左下角用户菜单的 Profile）同样按权限决定是否显示 | `components/org/user-menu.tsx` 里的 `can('page.profile')` |
| 路由守卫 | 直接输入 URL 也被拦，而不是渲染半截页面 | 团队页在 `routes/t.$teamSlug.tsx`（成员校验**之后**）；跨团队页在 `components/route-guard.tsx` 的 `GlobalRouteGate`（挂在 `__root.tsx`） |
| 兜底页 | 给出可操作的出口 | `RouteForbidden`（回团队首页 / 团队列表） |

**入口可以换地方，权限不能有盲区**：把页面入口从侧边栏挪到菜单里（`navHidden: true`）时，仍必须登记在 `ROUTE_CATALOG` 并照常按 `useCan()` 过滤入口 —— 否则那个页面会变成「谁都能进」的权限盲区。

**顺序不可调换**：团队页必须先判「团队是否存在 → 是否成员 → 岗位是否有权」，否则会把「不是这个团队的人」显示成「无权限」。

**前端守卫不是安全边界**：它拒绝的是渲染与直达，改内存即可绕过。接后端后接口必须自行校验（见第 6 节）。

## 4. 新增一个页面（后期不同应用扩张时的标准流程）

1. 建路由文件 `src/routes/...`；
2. 在 `ROUTE_CATALOG` **登记一行**：`key`（唯一，建议 `page.<应用>.<页面>`）、`to`（与路由模式一致）、`scope`、`group`、`labelKey`、`defaultRoles`；
3. 在 `src/components/app-sidebar.tsx` 的 `ICONS` 里配上图标（`Record<RouteKey, LucideIcon>`，漏配 tsc 会报错）；
4. 补 `src/i18n/locales/en-US/common.json` 的 nav key（`pnpm check:i18n` 会卡）。

→ 侧边栏入口、URL 直达拦截、权限页勾选行**三处同时生效**，不需要再改其他地方。

若入口不在侧边栏（如左下角用户菜单里的 Profile）：第 2 步加 `navHidden: true`，并在那个入口处用 `useCan()` 过滤 —— 该页面依旧出现在权限页矩阵里（这是有意的：入口位置与权限判定分开）。

### 改名 / 换路径

- **只换路径**：改 `to` 即可，权限键不动，已配置的授权继续生效；
- **页面改名**（如 v0.7.0 的 `/settings` → `/profile`）：把旧键写进 `LEGACY_PERMISSION_ALIASES`，`normalizeGrants()` 会在反序列化时把持久化矩阵里的旧键改写成新键。不迁移的话，老用户浏览器里的旧键会变成死数据，而新页面按 fail-closed 直接对他们消失。

### 默认授权策略（fail-closed）

- **全新安装**：按 `defaultRoles` 授权；
- **已有安装升级**：持久化矩阵里没有的新权限键**不会**被自动授权 —— 新页面默认只有系统管理员可见。权限页对这类行打 `No role` 红标，并出现「补齐默认授权」按钮标出缺口数，点一下按 `defaultRoles` 补上；
- 想省掉每次勾选：给角色授通配（如 `page.<应用>.*`），该分支下**后续新增的页面自动生效**（需要某个分支成批放开时用；本线默认不用通配，收紧更容易）。

### 页面上的两个整表操作（不要混淆）

| 操作 | 语义 | 位置与确认 |
| --- | --- | --- |
| 补齐默认授权 | **并集**：只补目录声明的默认键，手工加过的授权一条不动 | 右上角，**仅在有真缺口时出现**，标出缺口数，勾完即消失 |
| 重置全部授权 | **覆盖**：整表拉回出厂默认，手工改动（含多给的授权、通配）全部丢弃 | 页尾危险操作区，二次确认弹窗 |

两者的差别由 `scripts/check-permissions.mjs` 的静态自检钉住（`withDefaultRoles` 是并集）。

另外：**本页没有「保存」**。勾选即写入 store 并持久化（zustand persist → localStorage），页面顶部有明确说明，全页不存在 Save 类按钮。需要「填表 + 保存」语义的页面请参考 `/profile` 与 `/config/smtp`，权限页**不是**那种页面。

「没有角色能打开」有两种，别混：

- `Admin only`（灰）—— 目录里 `defaultRoles` 为空，**设计上**只有系统管理员可见（如 `permissions` 自身与 `config/smtp`）；
- `No role`（红）—— 目录声明了默认角色但当前无人有权，属**真缺口**（升级后新增页面最常见）。

## 5. 按钮级权限（命名空间已预留，本版未实现）

约定：`action.<页面分支>.<动作>`，例如 `action.workbooks.create`、`action.users.create`。

**为什么单独开 `action.*` 分支**：授权支持通配。若把动作写成 `page.workbooks.create`，一条 `page.workbooks.*`（本意是「workbooks 分支下的页面」）会顺带把动作权限一起授出去 —— 页面可见 ≠ 允许操作。两个分支互不命中，可分别收紧。

落地步骤：

1. 在 `ACTION_CATALOG` 登记 `{ key, owner, labelKey }`（`owner` = 所属页面权限键）；
2. 把 `ActionKey` 从 `never` 改成 `(typeof ACTION_CATALOG)[number]['key']` —— `PermissionKey` 自动扩展，所有 `useCan()` 调用点立刻获得类型检查；
3. 页面里用 `const can = useCan(); can('action.workbooks.create')` 控制按钮（隐藏或禁用按场景定，建议**破坏性操作禁用 + 提示原因**，非破坏性操作隐藏）；
4. 权限页会自动把动作行嵌到所属页面行下面（渲染结构已就绪，`scopeOfPermission()` 保证动作与页面按同一角色判定）。

## 6. 接后端时的迁移形状

前端只读两处：`useCan()`（判定）与权限页（写入）。数据形状保持 `RoleGrants = Record<RoleKey, string[]>` 即可平移：

```
表：route_permissions(role_key, pattern)      -- pattern 支持 '*' 与 'page.<分支>.*'
读：GET  /me/permissions  → { grants: RoleGrants, catalogVersion: 'v0.6.0' }
写：PUT  /roles/{role}/permissions { patterns: string[] }
```

注意事项：

- **服务端必须再判一次**（列表接口按权限裁剪，写接口按权限拒绝），前端守卫只负责体验；
- 目录（`ROUTE_CATALOG`）仍在代码里（它是路由表的一部分），后端只需存「角色 → 权限键」；
- 权限键与路由路径解耦，因此**改路径不用改权限数据**；若确实要改 key，需带上迁移脚本。

## 7. 已知边界

- 不做运行时动态路由：TanStack Router 的路由树是编译期生成的，权限做的是「过滤入口 + 拦截访问 + 兜底页」；
- 目录未登记的路由不受权限约束（交给 404 兜底），但也不会出现在导航与权限页；
- 「不适用」单元格（团队岗位列 × 管理页、member 列 × 团队页）不可勾选：勾了也不生效，显示为可勾选只会误导；
- 权限矩阵是全局一份（按角色定义），不支持「A 团队给 team-admin 额外开某页」这类**团队级例外**；如需该能力，应新增一层「团队覆盖」矩阵并让 `rolesForScope` 叠加判定。

## 8. 验证

```bash
pnpm build              # 需要先构建 dist
pnpm check:permissions  # 目录静态自检 + 12 项浏览器用例
pnpm check:smtp         # SMTP 校验规则断言 + 6 项页面用例（Config 分组的页面行为）
pnpm check:team-routes  # 团队路由回归（16 项）
```

`check:permissions` 覆盖：目录静态自检（含通配匹配语义、旧键迁移、「补齐 ≠ 重置」并集语义）、权限页可达性与矩阵结构、无保存按钮 + 即时生效说明、锁定列与底座页、普通成员直达管理页被拦、取消勾选后入口消失 + 直达被拦、整列 All/Clear、重置需二次确认、补齐只对真缺口出现并生效、Config 菜单 fail-closed（成员无入口且直达被拦）、Help 默认授权给成员、Config 分组内 Help 紧随 SMTP、Profile 入口在用户菜单且侧边栏没有它。
