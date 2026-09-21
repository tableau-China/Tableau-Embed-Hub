# Changelog（变更记录）

> 每次版本变更在此记录。**跨文件检查**：版本号需与 `package.json`、侧边栏版本显示、`PROGRESS.md`、本文件四者保持一致。

## 版本对照表

| 版本 | package.json | 侧边栏显示 | PROGRESS.md | CHANGELOG 条目 | 日期 |
| --- | --- | --- | --- | --- | --- |
| 0.8.0 | ✅ `0.8.0` | ✅ `v0.8.0`（`src/config/app.ts`） | ✅ 已同步 | ✅ [本节](#080---2026-09-21) | 2026-09-21 |
| 0.7.1 | ✅ `0.7.1` | ✅ `v0.7.1`（`src/config/app.ts`） | ✅ 已同步 | ✅ [本节](#071---2026-09-19) | 2026-09-19 |
| 0.7.0 | ✅ `0.7.0` | ✅ `v0.7.0`（`src/config/app.ts`） | ✅ 已同步 | ✅ [本节](#070---2026-09-19) | 2026-09-19 |
| 0.5.0 | ✅ `0.5.0` | ✅ `v0.5.0`（`src/config/app.ts`） | ✅ 已同步 | ✅ [本节](#050---2026-09-18) | 2026-09-18 |
| 0.4.2 | ✅ `0.4.2` | ✅ `v0.4.2`（`src/config/app.ts`） | ✅ 已同步 | ✅ [本节](#042---2026-09-18) | 2026-09-18 |
| 0.4.1 | ✅ `0.4.1` | ✅ `v0.4.1`（`src/config/app.ts`） | ✅ 已同步 | ✅ [本节](#041---2026-09-04) | 2026-09-04 |
| 0.4.0 | ✅ `0.4.0` | ✅ `v0.4.0`（`src/config/app.ts`） | ✅ 已同步 | ✅ [本节](#040---2026-09-04) | 2026-09-04 |
| 0.2.1 | ✅ `0.2.1` | ✅ `v0.2.1` | ✅ 已同步 | ✅ [本节](#021---2026-08-16) | 2026-08-16 |
| 0.2.0 | ✅ `0.2.0` | ✅ `v0.2.0` | ✅ 已同步 | ✅ [本节](#020---2026-08-16) | 2026-08-16 |
| 0.1.0 | ✅ `0.1.0` | ✅ `v0.1.0` | ✅ 已同步 | ✅ [本节](#010---2026-08-16) | 2026-08-16 |

> 约定：新版本发布时，先升 `package.json` 的 `version`，再更新本表与下方条目。

## [0.8.0] - 2026-09-21

### Users 页补齐「登录名」与「重置口令」，状态口径收敛为 active / disabled

来自 order-center（聚水潭订单中心）那条线的回灌：它在接真实后端时发现模板的 Users 页
缺了三样「账号本来就该有」的东西。本次只回灌**与后端无关**的部分 —— 模板仍是纯前端，
`pnpm dev` 开箱即跑；api 层 / session-store / team-store 属于「有后端才有意义」，没有搬。

#### Added（新增）

- **登录名（`OrgUser.username`）**：列表新增一列（等宽字体，便于对照日志），新建表单必填。
  登录名是账号的**主键口径**（登录、日志、按录入人隔离的业务归属都认它），与展示名
  `name` 刻意分开 —— 展示名可中文可重名，登录名改一次历史归属就全漂。
  规则与真实后端同口径（`USERNAME_PATTERN`：2-64 位 `[A-Za-z0-9_.@-]`，大小写不敏感去重），
  `usernameIssue()` 与既有的 `teamSlugIssue()` 写法一致。
- **「重置口令」独立入口 + `ResetPasswordDialog`**：列表行上的钥匙按钮。三条刻意的取舍：
  ① 管理员重置**不需要旧口令**（要求旧口令等于要求管理员知道对方的私人口令，
  那是「改密」不是「重置」）；② 两次输入 + 最短 8 位（口令不可见，敲错一个字符
  管理员无法自查）；③ 说明重置会让旧会话失效。
- **`setUserPassword(id)`**（store 动作）：演示态**只记录 `passwordUpdatedAt` 时间戳，
  不保存口令** —— 把明文口令写进 localStorage 是最容易被抄进真实项目的一段坏示范。
  接后端时把这个动作内部换成 `PUT /api/users/{id}/password` 即可，调用方无需改动
  （与 `config-store.ts` 的处理方式一致）。
- **老数据迁移**（`persist.migrate` v1 → v2）：为已存在 localStorage 里的账号补登录名
  （按邮箱前缀，重名加序号），并把 `invited` / `inactive` 归到 `disabled`。

#### Changed（变更）

- **用户状态收敛为 `active` / `disabled`**（原 `active` / `invited` / `inactive`）：
  `invited` 要有「发邀请 → 接受 → 激活」的流程支撑，模板没有；真实系统里那通常是
  `active` + 一张独立的邀请令牌表，而不是账号状态。`inactive` 与 `disabled` 同义，
  两个词并存必然有人用错。接后端时这个类型不用改：接口返回 `active` / `disabled`，直接对上。
- **空态区分「无权限」与「真的没有账号」**：非系统管理员看到的不再是
  「No users yet. Add the first user to get started.」（会让人以为库里真的没人）。
- 用户表单的「编辑」态不再显示口令字段，改为提示「改口令请用列表里的 Reset password」；
  登录名在编辑态禁用（与后端一致：登录名建后不可改）。

#### 说明（边界）

- 本模板**没有** `RefreshBar` / `PageToolbar` 这两个通用件（它们在 order-center 里是
  另一条线的产物），因此 Users 页仍用卡片头承载标题与「Add user」按钮，未引入新布局。
- 演示态的口令**不会被校验、也不会被保存**：表单收集它是为了让形状与真实后端一致。

## [0.7.1] - 2026-09-19

**文档订正（无功能改动）。** `PROGRESS.md` 的目标描述与实际不符：原文写「**不含** Tableau / AI 功能」，
但本线含 favorites / recents / workbooks / views 四个 Tableau 页面（浏览器内签发 Connected App JWT
嵌入真实视图，凭据见 README「凭据配置」）。

### Fixed（订正）

- **`PROGRESS.md` 目标描述**：改为「**含 Tableau 页面**（favorites / recents / workbooks / views）；
  **不含 AI 功能**」，并补一句「**不含**内部流程页（flows / amro / clean-layer / sql-icon-map）——
  那些只存在于本地开发线」，避免后来者误以为本线有流程页或没有 Tableau。
- 版本四处同步 0.7.1（package.json / `src/config/app.ts` / PROGRESS.md / CHANGELOG.md）。

### 说明

- 本版**只改文档与版本号**：`vite build` / `tsc -b` / `pnpm lint` / `check:i18n` 与三套 CDP 校验
  （`check:permissions` 14 项、`check:smtp`、`check:team-routes` 16 项）均无行为改动，结果与 0.7.0 一致。
- 本地开发线（custom）的同版本条目里还有一项 `GIT_SYNC.md` 远端仓库名订正 —— 该文件只存在于开发线，不在本线。

## [0.7.0] - 2026-09-19

**页面权限 + 个人资料归位 + Config/SMTP + 帮助页 + 前端通用件。** 本版把此前只在本地开发线完成的
**v0.6.0 页面权限**一并入库，并落地四个新页面与一套通用件；全站页面宽度统一、横向滚动条缺陷修复。

### Added（新增）

- **页面权限（v0.6.0 内容）**：
  - `src/config/permissions.ts` —— `ROUTE_CATALOG` 11 条路由（侧边栏 / 路由守卫 / 权限页**三处同源**，
    新增页面只登记一行）+ 5 个角色（全局 `system-admin`/`member` + 团队岗位三名）+ 由 `defaultRoles`
    派生的 `DEFAULT_GRANTS` + `normalizeGrants`/`withDefaultRoles`；`RouteEntry.navHidden`（入口不在侧边栏
    但仍受权限约束）、`LEGACY_PERMISSION_ALIASES`（页面改名时迁移持久化矩阵里的旧键）
  - `src/lib/permissions.ts`（通配匹配、作用域求值、pathname → 目录条目）、`src/stores/permission-store.ts`
    （三条硬规则写在 store 里）、`src/hooks/use-permissions.ts`、`src/components/route-guard.tsx`
    （`GlobalRouteGate` 挂在 `__root.tsx`，新增页面无需各写守卫）
  - 权限页 `/permissions`：角色 × 页面勾选矩阵（勾选即时生效、**无保存按钮**；整表操作只有「补齐默认授权」
    与「重置全部授权」，且刻意做得不像一对「取消/保存」）
- **个人资料 `/profile`**：`/settings` → `/profile`，入口移到左下角用户菜单；表单绑定当前登录用户，
  校验与 `/users` 用户弹窗同源；去掉旧页的占位字段与假控件
- **系统配置 `/config/smtp`**（Config 分组，fail-closed 默认仅系统管理员）：服务商预设一键回填、
  三态加密方式（none / STARTTLS / SSL）、7 项**实时预检**、字段级 inline 错误、密码留空即保持、
  `Discard`/`Reset`（二次确认）、服务商参考表；`src/lib/smtp.ts` 纯函数领域层 + `src/stores/config-store.ts`
  （**密码只存内存、永不落盘**，接后端的接口形状写在文件头）
- **帮助页 `/help`**：核心功能 8 条 + 开发者与版本（`src/config/app.ts` 为元信息唯一来源）+ 技术栈徽章 +
  文档入口 + 上线前安全提醒；侧边栏 Config 分组内**排在 SMTP 之后**，默认授权给所有成员
- **前端通用件**：`PageContainer`、`FormGrid`/`FormField`、`NoteCallout`、`DescriptionList`、
  `useFormTouch`；约定写入 `docs/ui-conventions.md`（页面/表单骨架、宽度约定、宽表格为何顶宽整页、新增页面清单）
- **校验脚本**：`scripts/check-smtp.mjs`（规则断言 + 6 项 CDP 用例，含「保存后刷新：密码不落盘」）；
  `scripts/check-permissions.mjs`（目录静态自检 + 12 项用例）

### Changed（变更，第二批：非流程类框架改动一次性补齐）

- **工具链与本线统一**：依赖升级（React 19.3 / Vite 8.3 / ESLint 10.11 / typescript-eslint 8.70 /
  TanStack Router 1.170.38 / lucide-react 1.47 等），并按官方方案采用「**TS 6 API 并行**」别名结构 ——
  `typescript` → `npm:@typescript/typescript6@6.0.2`（供 lint 解析 JS API）、
  `@typescript/native` → `npm:typescript@7.1.0-dev…`（`tsc`/`typecheck` 仍用 TS 7 原生编译器，另有 `tsc6` 入口）。
  **`pnpm lint` 恢复可用并在 CI 中启用**（`.github/workflows/ci.yml` 里恢复 `- run: pnpm lint`，
  同时保留本线的「内部路径守卫」步骤）。
  注：本次推送走 SSH（`git push git@github.com:… main`）—— 当前 HTTPS 用的 classic PAT 没有
  `workflow` scope，推送 workflow 文件会被 GitHub 拒绝，而该限制不作用于 SSH 密钥
- **统一日志出口** `src/lib/logger.ts`（新）：仅开发构建输出（`import.meta.env.DEV`），生产静默；
  全仓库唯一允许调用 `console` 的位置（例外写在 eslint 配置里，而不是散落的 inline disable）；
  Tableau 配置与嵌入组件的诊断输出改走 logger
- **收藏状态订阅修复**：`view-store` 新增 `useFavorites()`（`useSyncExternalStore`），
  Views / Workbooks / Recents 三处订阅 —— 修掉「切换收藏后星标停留在旧状态」
- **缩略图 ObjectURL 生命周期**（`thumbnail-query`）：`useObjectUrl` 改为在提交后的 effect 中释放上一代 URL，
  既不误杀在用 URL 也不泄漏；**Tableau 认证错误单列 `TableauAuthError`**（signin 失败不重试，避免重试风暴）
- **弹窗表单改为渲染期派生**（`team-dialog` / `user-dialogs`）：消除 effect 内 setState 与级联渲染，
  同时满足 `react-hooks/set-state-in-effect`
- `useIsMobile` 改用 `useSyncExternalStore`（首屏即为真实值，不再 undefined→false 翻转）
- 侧边栏宽度 16rem → 11rem；`team-switcher` / `team-context` / `use-current-team` 注释同步为
  `/profile`、`/config/smtp` 的现状
- **未纳入本线**：flows / sql-icon-map 的图标字体与代码高亮变量（`index.html` 的 Material Symbols、
  `index.css` 的 `--code-*`）随该功能留在本地开发线

### Changed（变更，第一批：v0.7.0 主体）

- **页面宽度统一**：页面一律铺满内容区（`<PageContainer>`），窄栏下沉到内容块（表单 768px、
  摘要 768px、长段落 `max-w-prose`）；实测 7 个页面 × 6 档视口卡片宽度一致且无横向滚动
- **shell 级修复**：`SidebarInset` 与 `<main>` 补 `min-w-0` —— 它们是 flex 子项，默认 `min-width: auto`
  会让宽表格（`TableHead`/`TableCell` 默认 `whitespace-nowrap`）把整页顶得比视口还宽；现在过宽内容
  改为在卡片内部滚动
- **主操作禁用语义统一**：不再因为「存在校验错误」而置灰保存按钮（点不动也看不到哪里错），改为
  有改动即可点、点击后统一揭示所有错误；仅在无改动时禁用
- `src/components/app-sidebar.tsx` 改为目录派生 + 权限过滤；`Header` 段映射、`_root` 守卫、i18n 同步

### Notes（边界）

- **前端权限不是安全边界**：本版拒绝的是「渲染 + 直达 URL」，改内存即可绕过；接后端后必须由接口再校验
- **SMTP 密码只在内存**：纯前端下「加密后存 localStorage」的密钥必然随 bundle 发出，属安全剧场；
  接后端后改为服务端加密存储、接口只回 `hasPassword`
- **SMTP 预检 ≠ 真实连通性**：浏览器开不了 SMTP 套接字，EHLO → STARTTLS → AUTH 的真实握手必须服务端执行

### 验证

- ✅ `pnpm build`（tsc -b + vite build）；`pnpm typecheck`
- ✅ `pnpm check:i18n`（411 keys，en-US 单语言对齐）
- ✅ `pnpm check:permissions`：静态自检 + 12 项 CDP 用例
- ✅ `pnpm check:smtp`：规则断言 + 6 项页面用例
- ✅ `pnpm check:team-routes`：16 项
- ✅ 宽度实测：7 个页面 × 6 档视口（768/900/1024/1280/1440/1600）卡片宽度一致、无横向滚动条
- ✅ 依赖升级后复验：`pnpm install`（本线锁文件不含 @xyflow/react、html-to-image）→ `vite build` ✅ /
  `tsc -b` ✅（TS 7 原生编译器）/ `pnpm lint` ✅（0 error，15 条既有 react-refresh 警告）/
  `check:i18n` ✅ / `check:permissions` ✅ 14 项 / `check:smtp` ✅ / `check:team-routes` ✅ 16/16

## [0.5.0] - 2026-09-18

**团队身份进入 URL**：每个团队拥有独立的 URL 前缀 `/t/{slug}/...`，不同团队的工作区页面不再共用同一路由（对齐 pg-explorer 的 `/t/{slug}` + `/admin/*` 划分）。此前 slug 只存在 store 与 localStorage 里，URL 无法表达「当前是哪个团队」——分享链接丢失团队、同一浏览器多标签页无法并存两个团队、同一页面在不同团队间无从区分。本次把 URL 确立为团队身份的唯一事实来源。

> 与 v0.4.2 的衔接：上一版把 `slug` 收紧为「新建时手工输入、仅 ASCII、创建后不可改」的稳定标识，正好成为 URL 中可靠的团队键 —— 链接可读、可分享，且**改团队名不会让已发出的链接失效**（`/t/acme_hq/views` 永远指向同一个团队）。本版本因此不做 slug 的任何派生或规范化。

### Added（新增）

- **团队 URL 上下文解析层** `src/lib/team-context.ts`：`parseTeamSlugFromPath` / `findTeamBySlug` / `teamScopedPath` / `resolveCurrentTeam` / `stripTeamPrefix` / `isUserMemberOfTeam` / `userDefaultTeam` / `activeTeamSlug()`（命令式读取，供 beforeLoad 与重定向桩使用）——纯函数为主，URL 优先、store 回退，供导航、数据分区共用同一套判断
- **React 侧读取入口** `src/hooks/use-current-team.ts`：`useCurrentTeam()`（订阅 pathname + org store）、`useTeamSlug()`（侧边栏导航前缀的唯一来源）
- **团队作用域布局路由** `src/routes/t.$teamSlug.tsx`：用 URL slug 校验团队并同步 `activeTeamId`；两类兜底页（slug 不存在 → Team not found、非成员 → No access，均带可操作出口），不再渲染半截页面
- **团队作用域页面**：`t.$teamSlug.index.tsx`（Dashboard）、`.favorites`、`.recents`、`.workbooks`、`.views`（原扁平页面迁移，内容不变，仅路由与链接前缀）
- **旧路径兼容桩**：`/`、`/favorites`、`/recents`、`/workbooks`、`/views` 保留为 `beforeLoad` 重定向到团队作用域路径（`/views` 旧链接的 `?workbook=&view=` search 参数原样透传）；当前用户无任何团队时统一落到 `/teams`
- **团队路由浏览器校验** `scripts/check-team-routes.mjs`（`pnpm check:team-routes`）：Node 24 内置 WebSocket 直连 Chrome CDP，14 项断言——根路径与旧路径重定向、未知 slug / 非成员兜底页、管理页无 slug、侧边栏链接前缀、收藏按 URL 团队分区、真实点击 TeamSwitcher 与 UserMenu
- **i18n** `teamRoute.*` 7 个 key（Team not found / No access / 回退按钮文案）

### Changed（变更）

- **侧边栏导航按团队前缀生成** `src/components/app-sidebar.tsx`：拆成两层——`GENERAL_ITEMS` 用路由模式（`/t/$teamSlug/workbooks`）配合 `useTeamSlug()` 填充 params（不再拼接字符串）；`SETTINGS_ITEMS`（`/users`、`/teams`、`/settings`）保持无 slug 的跨团队管理面。无团队时团队条目渲染为禁用项，避免拼出 `/t//workbooks`
- **TeamSwitcher 切换团队 = 切换 URL 前缀** `src/components/org/team-switcher.tsx`：高亮团队改由 URL 决定（`useCurrentTeam()`），切换时 `setActiveTeam` + `navigate({ href })` 保留同级子路径——所有团队共用同一套页面，切团队相当于「换个站点看同一个页面」；管理页上则回到团队首页
- **收藏 / 最近浏览改为 URL 优先分区** `src/lib/view-store.ts`：`teamSuffix()` 先用 pathname 里的 `/t/{slug}` 解析团队，管理页回退 `activeTeamId`。修复两个隐患——①布局把 slug 同步到 activeTeamId 存在一帧延迟，以 URL 为准可保证首帧就落在正确分区；②多标签页可各自停在 `/t/A` 与 `/t/B`，单一 activeTeamId 无法表达
- **Header 标题解析支持 slug 前缀** `src/components/header.tsx`：`/t/{slug}/xxx` 跳过 `t` 与 slug 两段再取一级路由段，管理页仍取第一段
- **UserMenu 切换身份后落到合法团队** `src/components/org/user-menu.tsx`：新身份不属于当前 URL 的团队时跳到其默认团队，避免停在「无权限」兜底页；无任何团队时跳 `/teams`
- **ThumbnailCard** 新增 `linkParams` 属性（团队作用域路由需要 teamSlug），三处 `Link` 同步透传

### Verified（验证）

- `pnpm build`（tsc -b + vite build）✅；`pnpm typecheck` ✅；`pnpm check:i18n` ✅
- `pnpm check:team-routes` ✅ **14/14**：`/`→`/t/acme_hq`、`/workbooks`→`/t/acme_hq/workbooks`、`/views?view=abc` search 透传、`/t/acme_analytics/recents` 直达、未知 slug→Team not found、`/users` `/teams` `/settings` 无 slug 且侧边栏回退 activeTeamId、侧边栏链接全部带当前 slug、`team-1` 收藏在 acme_analytics 下不可见而在 acme_hq 下可见、点击 TeamSwitcher 后 URL 变 `/t/acme_analytics/workbooks`（保留同级子路径）、点击 UserMenu 切到 Dave Kim 后跳到其默认团队 `/t/acme_data_platform`、再访问 `/t/acme_hq` 显示 No access
- `bash scripts/check-public-paths.sh` ✅（确认本版本未引入任何内部内容路径）
- `pnpm lint` ⚠️ 无法运行：typescript-eslint 8.67 尚不支持 TS 7.0（模块加载期即报错，与本版本无关，属既有工具链问题）
- package.json `0.4.2` → `0.5.0`（四文件版本同步）

### 遗留（Known）

- `/teams`、`/users` 仍是跨团队管理页（无 slug）；若后续需要「团队内成员/设置」视图，按 pg-explorer 的做法应是 `/t/{slug}/users` 与管理面 `/admin/users` 并存

## [0.4.2] - 2026-09-18

Team `slug` 改为**新建时手工输入**的稳定标识（仅英文、数字、下划线），不再由团队名派生。

### Breaking（不兼容，合并本版本的下游应用需同步调整）

- `createTeam` 入参新增**必填** `slug`：`{ name, slug, description, logo }`（此前由名称自动生成）。
- 移除导出 `slugify()` / `uniqueSlug()` / `nextTeamSlug()`；新增 `TEAM_SLUG_PATTERN` / `isValidTeamSlug()` / `sanitizeTeamSlug()` / `teamSlugIssue()`。
- 种子团队 slug 改为下划线形式（`acme_hq` → `acme_hq`、`acme_analytics` → `acme_analytics`、`acme_data_platform` → `acme_data_platform`），仅影响全新环境；不做自动迁移，已有持久化数据里的旧 slug **保持原值不变**（避免静默改写下游的映射键）。

### Fixed（修复）

- **slug 不再允许中文**：字符集收紧为 `^[A-Za-z0-9_]+$`（英文、数字、下划线）。中文 slug 会出现在 URL / 路由参数 / 配置键里并被百分号转义（`试单` → `%E8%AF%95%E5%8D%95`），既不可读，又容易在复制粘贴、nginx 规则、日志排查时出错。
- **slug 不再随团队名变化**：此前 `updateTeam` 每改一次名就重算 slug，而 `slugify` 又把非 ASCII 全部抹成 `-`。凡以 slug 作「团队 → 应用形态 / 数据源 / 权限」映射键的下游模块，在团队页改一次名即**静默失配并回落到默认团队** —— 外部表现是「某个团队的内容和默认团队一模一样」，且没有任何报错。现在改名只改 `name`（名称可以是中文）。

### Added（新增）

- 新建团队对话框新增 **Team slug** 输入框：实时过滤非法字符（中文/空格/连字符打不进去）、与既有团队重复时即时标红、提交前统一校验。
- `sanitizeTeamSlug()`（输入过滤）与 `teamSlugIssue()`（空 / 非法字符 / 重复），表单与 store 共用同一口径。

### Changed（变更）

- 编辑态 slug 输入框置灰只读，提示「创建时固定，不可编辑」。
- `OrgTeam.slug` 注释明确：字符集、唯一、与 `name` 解耦，外部模块应以其为团队身份。
- i18n en-US 新增 `teams.slugLabel` / `slugPlaceholder` / `slugRequired` / `slugInvalid` / `slugTaken`；`slugHint` 改为规则说明、`slugLocked` 改为编辑态只读说明。

### Verified（验证）

- `pnpm typecheck` ✅ / `pnpm build` ✅ / `pnpm check:i18n` ✅（218 keys）
- 合法性实测：`dev_api` ✅ / `Dev_API2` ✅；`dev-api`、`dev api`、`dev.api`、`试单`、`JST_API_测试`、空 ❌
- 输入过滤实测：`JST API 测试（Dev API）` → `JSTAPIDevAPI`；`dev-api` → `devapi`；`Dev_HQ-01` → `Dev_HQ01`；`试单` → `''`
- 校验实测：`''` → `empty`；`dev-api` → `charset`；已占用 → `taken`；空闲 → `null`
- 端到端（真跑 store）：新建团队 slug 取输入值；把 team1 改名为英文名再改成中文名，slug 恒为原值；全部团队 slug 均为 ASCII ✅
- package.json `0.4.1` → `0.4.2`（四文件版本同步）

## [0.4.1] - 2026-09-04

多团队交互细节修正 + 操作按钮全局统一（users / teams 页面）。

### Changed（变更）

- **Team 次序稳定为创建次序**：`createTeam` 改为追加队尾；新增 `sortTeamsById`（id 升序，兜底兼容旧持久化数据乱序）；左上角 TeamSwitcher 下拉不再重排（移除原「当前团队置顶 + 名称排序」逻辑），切换只改选中项
- **Default team 清晰标记**：TeamSwitcher 头部（正在使用默认团队时名称旁星标）、下拉列表（默认团队行 `★ Default` 徽章，与当前项 ✓ 并存）、/teams 页行内 `★ Default` 徽章（与 Active 徽章并存）
- **公共操作按钮组件** `components/action-bar.tsx`（ActionBar / ActionButtons）：桌面右对齐、窄屏自动堆叠；新建/编辑/删除确认/关闭等按钮统一复用
- **修复按钮落左问题**：CardHeader 基类 `flex-col` 与追加 `flex-row` 在窄视口冲突 → users/teams 页头改为显式行布局（标题 `flex-1`、按钮 `shrink-0` 恒右）
- **新增成员/分配团队行右对齐**：成员管理对话框与用户↔团队对话框的 Add 行整体靠右（附小标题 Add a member / Assign to another team）
- i18n en-US 新增：`teams.defaultLabel` / `teams.addMemberHint` / `users.addMembershipHint`

### Verified（验证）

- `tsc -b` ✅ / `vite build` ✅ / `pnpm check:i18n` ✅（212 keys）
- CDP 几何实测（1440 / 820 / 400px × /users、/teams）：页头主按钮右缘 = 内容右缘 − padding；弹窗内主操作（Save changes / Create）恒为最右按钮
- package.json `0.4.0` → `0.4.1`（四文件版本同步）

## [0.4.0] - 2026-09-04

多团队 + 全局用户（参照 pg-explorer teams/users 模型）。0.3.x 版本号为内部流程功能线（仅存于本地 custom 分支、未公开），公开框架线版本号直接跳到 0.4.0。

### Added（新增）

- **组织数据层** `src/stores/org-store.ts`（新依赖 zustand 5，localStorage 持久化 `shadcn-admin-cn:org`）：User（全局，位于 Team 之上：name/email/isSystemAdmin/status）⇄ TeamMember（userId+teamId、岗位 team-admin|analyst|viewer、isDefault）⇄ Team（name/slug/description/logo）；默认团队互斥、移除/删除后自动提升或重算 activeTeamId；最后一个系统管理员与当前用户不可删除；种子 3 团队 + 6 用户 + 10 成员关系
- **左上角 Team 切换器** `components/org/team-switcher.tsx`：点击弹出当前用户所属团队并切换（团队作用域数据随之切换）；系统管理员另有 Create team / Manage teams 入口；无团队空态
- **底部用户菜单** `components/org/user-menu.tsx`：当前用户 + 全局身份（System administrator / Member）；演示「Switch user」切换身份（体现用户 > team）
- **新路由 `/teams`**：团队管理页——新建/编辑/删除、成员管理对话框（添加/移除成员、改岗位、设默认团队）；非系统管理员只读
- **`/users` 升级**：store 驱动全局用户表（状态 / 系统管理员 / 所属团队徽章）、增删改、用户↔多团队分配对话框
- **收藏/最近按团队隔离** `lib/view-store.ts`：key 带 activeTeamId（`…:favorites:team-<id>`）；旧无后缀数据首次读取自动迁入当前团队后清除；跨标签页同步保留
- 新组件 `components/org/*`（team-logo / team-dialog / team-members-dialog / user-dialogs）；i18n en-US 新增 teams.\*、users.\* 扩展、common 动作键（共 268 keys）

### Changed（变更）

- 侧边栏头部品牌块 → TeamSwitcher + 品牌注脚（版本单一来源 `src/config/app.ts`）
- 版本号 `0.2.1` → `0.4.0`（四文件版本同步）

### Verified（验证）

- `pnpm build`（tsc -b + vite build）✅；`pnpm check:i18n` ✅；公开路径守卫 `scripts/check-public-paths.sh` ✅（无内部内容混入）
- 无头 Chrome（/、/users、/teams、/favorites、/settings）渲染正常、零 console error

## [0.2.1] - 2026-08-16

Views 嵌入体验与链接体系重构（纯前端，无后端依赖）。

### Changed（变更）

- package.json `0.2.0` → `0.2.1`（四文件版本同步）

### Fixed（修复）

- **侧边栏 Logo 换成 Tableau 图标**：`app-sidebar.tsx` 顶部 Logo 由 Lucide Command 图标（深色圆角方块）改为直接使用 `public/favicon.ico`（与浏览器 favicon 同一张图，展开/折叠两种状态均生效）；移除未再使用的 `Command` 导入
- **点击工作簿直达视图**：/workbooks 卡片点击后进入 /views 并**自动打开默认视图直接嵌入**。`tableau-api.ts` 的 workbooks 查询新增 `defaultViewId` 字段；`views.tsx` 在已选工作簿且未指定视图时，自动选中默认视图（`defaultViewId` 匹配，兜底列表第一个）并回写 URL，嵌入随即加载（下拉选择工作簿同样生效）
- **/views 页面精简**：删除 "Select workbook" 选择面板（工作簿/视图改由 URL 驱动）；"Manual view URL (fallback)" 收进标题右侧 Info 图标弹层；收藏按钮移至标题右侧；加载/重试错误提示保留在标题下方
- **Header 重构**：删除面包屑（原 favorites/recents/workbooks/views 段缺失映射导致显示 "Page not found"），改为直接显示当前页面标题（新增 `language-toggle.tsx` 语言按钮置于右上角主题切换旁，当前仅 en-US；Settings 页原静态语言下拉同步移除）
- **/views 参数改用 UUID**：`/views?workbook=<wbId>&view=<viewId>`（点击 workbooks 卡片、favorites/recents 跳转均传 UUID；旧的名称为参数链接自动重写为 UUID，失效视图兜底到默认视图）。嵌入 iframe 仍用名称路径（实测 UUID / contentUrl `/sheets/` 路径 404），但名称由 API 按 UUID 解析而来，不再经过 URL 编码往返（修复含空格/特殊字符名称导致视图打不开的问题）。`view-store.ts` 的 favorites/recents 记录新增 `workbookId/viewId`（新旧数据兼容，去重按 UUID 优先）
- **嵌入层 UI 修正**：删除 `tableau-embed.tsx` 自定义加载遮罩（与 iframe 内 Tableau 原生 spinner 叠加成"双层 loading"）；错误提示由全屏遮罩改为顶部非遮挡横幅（视图区域保持可见）
- **/views 单参数打开（仅视图 UUID）**：workbooks 的 dashboard 卡片链接改为 `linkTo="/views" + linkSearch={{ view: d.id }}`，不再传 workbook id。`tableau-api.ts` 新增 `fetchViewDetail(viewId)`（GET /views/{id}，解析视图名称 + 所属工作簿 id/contentUrl/viewUrlName）；`views.tsx` 在仅含视图 UUID 参数时按详情解析并嵌入（工作簿优先命中受限项目列表取全名，兜底用 contentUrl slug），旧的双参数/名称链接自动重写为 `?view=<uuid>` 单一形态，加载失败纳入错误提示与重试
- **/views 头部重排**：恢复标题 + 描述（左侧），Info 与收藏按钮移至右侧；Info 弹层现显示**当前视图在 Tableau 服务器上的完整 URL**（只读 + 一键复制），下方保留手动 URL 兜底输入（新增 i18n key：`views.tableauUrl/copyUrl/copied/copyFailed`）
- **Workbooks 列表未受"访问级别:Samples"限制**：已连接应用的访问级别/域允许列表**仅作用于嵌入工作流**（[官方文档](https://help.tableau.com/current/online/zh-cn/connected_apps_direct.htm)：REST API 授权配置时可忽略），JWT 也没有项目级 claim（注册 claim 仅 kid/iss/alg/sub/aud/exp/iat/jti/scp），故 REST 列表仍返回全部 15 个工作簿。修复：`tableau.ts` 新增 `restrictedProjectName: 'Samples'`，`fetchWorkbooks` 追加 `filter=projectName:eq:Samples` 查询参数（实测 `/projects/{id}/workbooks` 端点在 Cloud 3.23 返回 404 不可用，`filter=projectId:eq:` 亦被拒，`projectName` filter 为可用方案）→ 列表仅返回 Samples 的 2 个工作簿（Superstore、World Indicators）

### Known Issues（遗留问题）

- Tableau Cloud REST API **不支持 CORS**（实测：响应无 ACAO 头、OPTIONS 预检 405）→ 已加 Vite dev 代理（`/tableau-proxy` → https://10ax.online.tableau.com）；**生产部署需在网关/nginx 配置同路径反代**，否则列表不可用；Views 页手动 URL 兜底嵌入不受影响

## [0.2.0] - 2026-08-16

从 pg_explorer 迁移 Tableau 相关页面（纯前端实现，无后端依赖）。

### Added（新增）

- **路由**：`/favorites`、`/recents`、`/workbooks`、`/views`（Views = Tableau 嵌入）
- **Tableau Connected App 配置**（测试环境，明文）：`src/config/tableau.ts` 硬编码 clientId / secretId / secretValue + 服务器 `https://10ax.online.tableau.com`（站点 xilejunchina，嵌入用户 wyp@vizwise.cn）
- **客户端 JWT**：`src/lib/tableau-jwt.ts`（jose 签发 HS256，claims 与旧后端 jsonwebtoken 实现一致），5 分钟有效期 + 4 分钟自动刷新
- **REST 客户端**：`src/lib/tableau-api.ts`（auth/signin → workbooks / views 列表；浏览器 CORS 可能受限，页面提供手动 URL 兜底）
- **本地持久化**：`src/lib/view-store.ts`（favorites / recents 基于 localStorage）
- **嵌入组件**：`src/components/tableau/tableau-embed.tsx`（官方 **Embedding API v3**：new TableauViz() + token 属性认证 + v3 事件；token 就绪后才创建组件避免认证竞态；4 分钟热刷新不重建）
- **侧边栏**：新增 Tableau 分组（Favorites / Recents / Workbooks / Views）
- **i18n**：en-US 新增 nav / views / workbooks / favorites / recents / common 等 key

### Changed（变更）

- package.json `0.1.0` → `0.2.0`（四文件版本同步）

### Fixed（修复）

- **Workbooks 列表 400 错误**：`fetchWorkbooks` 的 `fields` 参数含 `projectName`，Tableau 判定为非法字段名并以 400 / error 409004 拒绝整个请求（实测错误体：`Invalid field names '[..., ProjectName, ...]' for Workbook`）→ 改为 `fields=id,name,contentUrl,updatedAt,showTabs`，项目名改从响应 `location.name`（兜底 `project.name`）解析；顺带修复 `showTabs` 布尔解析（Tableau 以字符串 `"true"/"false"` 返回，原 `Boolean("false")` 恒为 true）
- **`/favicon.ico` 404**：项目无 favicon（无 `public/` 目录）→ 新增 `public/favicon.svg`（现代浏览器主图标）+ `public/favicon.ico`（32×32 传统兜底）+ `public/apple-touch-icon.png`（180×180 iOS）；`index.html` 补充三个 `<link>` 声明。图标改用 **Tableau 官方彩色 Logo**（来源 [SVG Repo](https://www.svgrepo.com/show/354428/tableau-icon.svg)，9 个 polygon 直接用作 SVG；ICO/PNG 由一次性脚本按 viewBox 光栅化生成，见 `CHANGELOG` 备注）

### Known Issues（遗留问题）

- Tableau Cloud REST API **不支持 CORS**（实测：响应无 ACAO 头、OPTIONS 预检 405）→ 已加 Vite dev 代理（`/tableau-proxy` → https://10ax.online.tableau.com）；**生产部署需在网关/nginx 配置同路径反代**，否则列表不可用；Views 页手动 URL 兜底嵌入不受影响

## [0.1.0] - 2026-08-16

首个可运行版本：管理后台模板骨架（含全部基础页面）。

### Added（新增）

- **技术栈**：Vite 8.2.1 + React 19.2.8 + TypeScript 7.1.0-dev + Tailwind CSS v4 + shadcn/ui（radix-nova 预设）+ TanStack Router / Query + i18next
- **shadcn/ui**：init + 24 个组件
- **页面**：Dashboard（统计卡片 + 最近活动）、Users（用户表格）、Tasks（任务表格）、Settings（表单 + 标签页 + toast）、404（catch-all）
- **布局**：可折叠侧边栏（图标模式 + 移动端抽屉）、头部面包屑、next-themes 深浅色切换、用户下拉菜单
- **i18n**：en-US 词典（59 key），`pnpm check:i18n` 自动校验 key 对齐
- **CI**（GitHub Actions）：`install → check:i18n → build`；lint 步骤暂缓（见 Known Issues）
- **git**：main 分支首次提交（`1ff5ebd` + `89c68f9`）

### Changed（变更）

- TypeScript `7.0.2` → `7.1.0-dev.20260815.1`（next 开发版，正式版发布后直接升级）
- i18n 范围：原计划四语（zh-CN 默认 + zh-TW / ja-JP）→ **仅 en-US**，多语言后期扩展
- `index.html`：`lang="zh-CN"` → `lang="en"`；标题/描述同步改为英文优先
- `tsconfig.app.json`：删除 TS7 已移除的 `baseUrl`（paths 改相对解析）
- `tsconfig.json`（根）：补充 `paths` 映射（shadcn CLI 依赖它解析 `@` 别名）
- `.gitignore`：新增 `.pnpm-store/`（沙箱将 pnpm 内容存储重定向进工作区，勿提交）
- CI：`pnpm lint` 步骤注释暂缓（附恢复说明）

### Fixed（修复）

- **shadcn 4.18 别名 Bug**：根 tsconfig 无 `paths` 时组件被写入字面 `@/` 目录 → 补 paths + 迁移 25 个文件到 `src/`
- 骨架期漏装 `@tanstack/eslint-plugin-query`（lint 报 ERR_MODULE_NOT_FOUND）
- `pnpm-workspace.yaml`：修复为 `allowBuilds: '@swc/core': true`（SWC postinstall）

### Known Issues（遗留问题）

- **npm 缓存损坏**（机器级）：`~/.npm` 含 root 属主文件 → EPERM，绕行目录 `/tmp/npmcache` 也已损坏；npm 查询改用 curl 直查 registry。永久修复：`sudo chown -R 502:20 ~/.npm`（需用户手动）
- **typescript-eslint 不兼容 TS 7**（上游 [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)）：`pnpm lint` 暂不可用，CI 已暂缓该步骤
- 构建告警：主 chunk 578 kB > 500 kB，需代码分割优化
- dev 服务器仅监听 IPv6 `localhost`（`127.0.0.1` 直连不通）；浏览器访问 `http://localhost:5173` 即可

### TODO（待办）

- [ ] 推 GitHub（公开仓库，历史干净）
- [ ] typescript-eslint 支持 TS 7 后恢复 lint（升级依赖 + 取消 ci.yml 注释）
- [ ] 多语言扩展：zh-CN / zh-TW / ja-JP（新增 locale 目录 + i18n 配置）
- [ ] `@vitejs/plugin-react-swc` → `@vitejs/plugin-react`（Vite 性能建议）
- [ ] 代码分割优化（消除 >500 kB chunk 告警）
- [ ] 真实数据层（当前 mock 数据 → API / DB）

---

<!-- 后续版本追加格式（复制即可）：
## [0.3.0] - YYYY-MM-DD
### Added / Changed / Fixed / Known Issues / TODO
-->
