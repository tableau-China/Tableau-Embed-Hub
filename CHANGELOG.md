# Changelog（变更记录）

> 每次版本变更在此记录。**跨文件检查**：版本号需与 `package.json`、侧边栏版本显示、`PROGRESS.md`、本文件四者保持一致。

## 版本对照表

| 版本 | package.json | 侧边栏显示 | PROGRESS.md | CHANGELOG 条目 | 日期 |
| --- | --- | --- | --- | --- | --- |
| 0.11.0 | ✅ `0.11.0` | ✅ `v0.11.0`（`src/config/app.ts`） | ✅ 已同步 | ✅ [本节](#0110---2026-10-07) | 2026-10-07 |
| 0.10.1 | ✅ `0.10.1` | ✅ `v0.10.1`（`src/config/app.ts`） | ✅ 已同步 | ✅ [本节](#0101---2026-10-04) | 2026-10-04 |
| 0.10.0 | ✅ `0.10.0` | ✅ `v0.10.0`（`src/config/app.ts`） | ✅ 已同步 | ✅ [本节](#0100---2026-09-23) | 2026-09-23 |
| 0.9.0 | ✅ `0.9.0` | ✅ `v0.9.0`（`src/config/app.ts`） | ✅ 已同步 | ✅ [本节](#090---2026-09-21) | 2026-09-21 |
| 0.8.1 | ✅ `0.8.1` | ✅ `v0.8.1`（`src/config/app.ts`） | ✅ 已同步 | ✅ [本节](#081---2026-09-21) | 2026-09-21 |
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

## [0.11.0] - 2026-10-07

### 依赖版本巡检脚本 + 每周定时检查（`pnpm check:versions`）

#### Added（新增）

- **`scripts/check-versions.mjs`**：把 `package.json` 里全部依赖与 registry 的 `latest` 逐个比对，
  并判断 latest 是否**仍在声明范围内**，以此区分两类升级：
  - 范围内 → `pnpm update` 即可；
  - 跨范围 → 要改 `package.json`、可能有破坏性变更，必须人工评估。

  实现要点：零第三方依赖（自带最小 semver）；`npm:` 别名依赖按**别名真实目标包**查 registry、
  按**别名声**读 `node_modules`（两者不同名，混用会读错版本）；registry 依次取
  `--registry` → `npm_config_registry` → 项目/用户 `.npmrc` → npmjs.org；带并发、超时与重试；
  `--md` / `--json` 供文档与周报，`--strict` 在存在跨范围升级时退出码 1（0 正常 / 2 脚本自身出错）。
- **`package.json` → `checkVersions.hold`**：已知要**刻意暂缓**的包（包名 → 理由）。`@types/node` 的 `24 → 26` major
  是故意的（类型线不高于最低支持的 Node 24 运行时），登记后不再计入「待升级」，改为单独列出 ——
  否则每周都会重复误报同一个假警报。
- **每周定时检查**：DSH 会话内每周六 21:00（Asia/Shanghai）触发一次巡检，产出简报并**等确认后再动手**（不自动升级）。

#### Changed（变更）

- 版本 0.10.1 → 0.11.0（package.json / `src/config/app.ts` / README / PROGRESS.md / CHANGELOG.md）
- 修复上一条提交在本地被覆盖的两处：`package.json` 的 `check:i18n:keys` 脚本行、PROGRESS 里该条的措辞
  （CI 一直在调用 `pnpm check:i18n:keys`，脚本行必须留在 package.json 里）

#### Fixed（修复）

- **`check:permissions` 的「假通过」用例**（2026-10-01 起记录在 PROGRESS「阻塞点」）：该用例 `switchUser('Carol White')`，
  而 Carol 的种子状态是 `status: 'disabled'`（刻意保留用于演示用户冻结），`setCurrentUser` 按设计拒绝切换，
  用例没察觉就以管理员身份继续断言 —— 三条用例因此长期「假通过」。修法：
  ① 三处改用 acme_hq 里**活跃**的 viewer（Bob Martin）；② `switchUser` 切换后**核实身份真的变了**，失败即抛错，
  不再静默沿用旧身份。本地 `pnpm check:permissions` **15/15 全绿**。
  CI 注释与 PROGRESS 阻塞点同步更新：`ui-checks` 仍为 advisory，但只剩「几何断言依赖字体渲染」一条待观察。

#### Verified（验证）

- `pnpm check:versions` 实跑通过：40 个依赖、registry 可达、报告可读
- `pnpm check:permissions` 15/15（修好的假通过用例首次全绿）
- `tsc -b` / `pnpm lint` / `vite build` / `pnpm check:i18n` / `pnpm check:i18n:keys` / `pnpm check:routes` / `pnpm check:team-routes` / `pnpm check:filters` / `pnpm check:smtp` / `pnpm test` 全绿

#### 备注（组件本体漂移）

- `node_modules/.bin/shadcn add <组件> --diff` 可看 `src/components/ui/*` 与上游 registry 的差异（只读）；
  当前它建议把 `button.tsx` 的 `import { cn } from "@/lib/utils"` 改成 `from "cn"` —— 这是本项目故意的本地约定，
  该命令只作参考，**不作升级依据**。

## [0.10.1] - 2026-10-04

### 默认团队不可删除 + 团队冻结补进编辑对话框 + 修 12 个漏键

#### Added（新增）

- **默认团队（创建最早的团队）不可删除**：`defaultTeamId()` / `isDefaultTeam()` 两个判定函数，
  `deleteTeam()` 命中即返回 `false`；`/teams` 行内该行删除按钮 **disabled** 并在 title 说明原因，
  行内新增系统级 `Default` 徽章（与「我的默认团队」`My default` 徽章区分——前者是系统兜底团队，
  后者是当前用户切换身份时的初始团队）。规则写进 [`docs/org-rules.md`](./docs/org-rules.md) 铁律 4。
- **团队编辑对话框新增 `Suspended` 开关**：此前冻结只能从列表行的 ⏸ 按钮操作，现在编辑弹窗里也能改
  （走 `setTeamSuspended()`，会一并重算 `activeTeamId`，避免有人停在刚冻结、自己又进不去的团队）。
- **`scripts/check-i18n-keys.mjs`（反向漏键检查）**：`check:i18n` 只比对语言之间是否对齐，
  发现不了「代码在用、词典缺失」的 key；新脚本扫描全部 `t('literal')` 调用（含复数 `_one/_other`），
  缺失即退出码 1。

#### Fixed（修复）

- **12 个「代码在用、词典缺失」的 key**（界面上会把 key 名原样渲染出来）：
  - `teams.slugLabel` / `slugPlaceholder` / `slugLocked` / `slugRequired` / `slugInvalid` / `slugTaken`
    —— v0.4.2 把 slug 改成手工输入后词典没跟上（`teams.slugHint` 的旧文案 `URL slug (auto): {{slug}}`
    既过时又没传插值，会原样显示 `{{slug}}`，本次改写为「仅英文/数字/下划线，创建后固定」）；
  - `views.tableauUrl` / `copyUrl` / `copied` / `copyFailed` —— 团队作用域 Views 页的链接弹层；
  - `settings.language` —— 词典里没有 `settings` 命名空间，语言按钮改用已有的 `profile.language`。

#### Changed（变更）

- `teams.defaultLabel` 语义明确为**系统级默认团队**徽章；当前用户的默认团队徽章改用 `teams.myDefaultLabel`（`My default`）
- 版本 0.10.0 → 0.10.1（package.json / `src/config/app.ts` / README / PROGRESS.md / CHANGELOG.md）

#### Verified（验证）

- `tsc -b` / `pnpm lint`（0 error）/ `vite build` / `pnpm check:i18n`（516 keys）/ 新脚本 `check-i18n-keys`（381 个字面量 key 全在）✅
- **store 单测**：默认团队删除被拒、非默认且无孤儿成员的团队可删、冻结/解冻开关生效 ✅
- **无头 Chrome 端到端**：默认团队行删除按钮 `disabled: true`、其余两行可删；编辑对话框内 `Suspended` 开关 →
  行内出现 `Suspended` 徽章；超级管理员仍可进入冻结团队；切到 Bob 后该团队从侧栏消失、直进 URL 命中
  `Team suspended` 兜底页；再切回 Admin 关闭开关 → 恢复 ✅

## [0.10.0] - 2026-09-23

### 列表筛选栏公共件 + Users 页筛选（登录名 / 状态 / 团队）

筛选这件事在本模板里第一次出现，因此**先立公共件再用**：控件长什么样、什么时候出现「重置」、
「没有数据」与「被筛掉」怎么区分，都收在两处（`components/filter-bar.tsx` + `hooks/use-list-filters.ts`），
后续列表页直接复用（约定见 [`docs/ui-conventions.md`](./docs/ui-conventions.md) §5）。

#### Added（新增）

- **`src/components/filter-bar.tsx`（公共件，与 `action-bar.tsx` / `form-field.tsx` 同级）**
  - `FilterBar` —— 筛选栏容器：`flex-wrap` 一行排布，**有筛选生效时**才在右侧显示
    `Showing X of Y` 与「重置筛选」（没有筛选时不该出现无处发力的按钮）；
  - `FilterSearch` —— 关键词搜索框（`InputGroup` + 放大镜），有内容时出现一键清空；
    用 `type="search"` 保留语义与 Esc 清空，但隐藏 WebKit 自带的清除叉（否则界面上会有两个「✕」）；
  - `FilterSelect` —— 单选下拉，**首项恒为「全部」**（`'all'`），触发器上是「字段名 + 当前值」
    （`Status  All`）—— 收起后仍要知道这一格筛的是什么字段；
    `aria-label` 带上当前值（`role="combobox"` 上 `aria-label` 会盖掉可见文本，只写字段名会让读屏用户听不到筛掉了什么）。
  - 三条刻意的约束：**受控**（状态归页面，控件不碰数据源，因此也能用在弹窗里）、
    **值一律字符串**（数字 id 用 `String(id)`）、**带 `data-filter-*` 钩子**（供端到端脚本定位）。
- **`src/hooks/use-list-filters.ts`** —— 筛选状态：`values / set / reset / activeCount / isFiltered / isDirty`。
  默认值只在挂载时取一次快照（调用方通常写字面量），因此 `reset` 与 `activeCount` 不会每帧变化而拖累下游 `useMemo`。
- **`/users` 筛选**：登录名搜索（包含匹配、大小写不敏感、去首尾空格）+ 状态（Active / Frozen，选项与文案同源于
  `USER_STATUSES` / `USER_STATUS_LABEL_KEYS`）+ 团队（**成员关系命中**，不区分岗位、不看默认团队）；
  三者可叠加；筛选只影响视图，行内动作与表头列数不变。
- **第三种空态**：列表里**有账号但被筛掉**时，显示「No users match the current filters.」+ 一键重置 ——
  与「还没有用户」（`users.empty`）、「无权限」（`users.noPermission`）严格区分。
- **i18n**：新增 `filters.*` 命名空间（`all` / `search` / `clearSearch` / `clearAll` / `clearAllHint` / `showing`）
  与 `users.searchPlaceholder` / `users.filterTeam` / `users.noMatch`；词典 452 → **461 keys**。
- **`scripts/check-filters.mjs`（`pnpm check:filters`）**：静态自检（公共件用到的 key 是否在词典里、
  `USER_STATUSES` 与 `USER_STATUS_LABEL_KEYS` 是否一一对应、`filters.showing` 的插值占位符是否齐全）
  + **7 项页面用例**（CDP）：初始态安静、搜索口径与一键清空、无匹配空态与重置出口、
  状态 × 团队组合取交集、团队筛选按成员关系命中、非管理员视角、宽窄屏几何断言（单行 / 堆叠 / 无横向滚动条）。

#### Changed（变更）

- `/users` 顶部新增筛选栏（`CardContent` 内、表格之上）；**一条账号都没有时不渲染筛选栏** ——
  没有数据可筛，摆一排控件只会让人以为坏了。
- 表格行新增 `data-user-row="<username>"`、空态行新增 `data-user-empty="none|filtered"`，
  与既有的 `data-smtp-*` / `data-perm-*` 一致，作为端到端脚本的稳定钩子。
- 版本 0.9.0 → 0.10.0（package.json / `src/config/app.ts` / README / PROGRESS.md / CHANGELOG.md）

#### 说明（边界，刻意的）

- **只搜登录名**（`username`），不搜展示名与邮箱：登录名是账号的主键口径，与展示名刻意分开
  （见 [`docs/org-rules.md`](./docs/org-rules.md)）。要扩到展示名/邮箱，改 `users.tsx` 里
  `visibleUsers` 的一行判断即可 —— 控件、hook、i18n 都不用动。
- **筛选是视图态**：默认不进 URL（刷新回默认）。需要「可分享 / 刷新不丢」时，把同一组受控组件接到
  TanStack Router 的 `useSearch` + `navigate({ search })`，**公共件一行都不用改**。
- 本版只有 `/users` 接入；`/teams` 与 Tableau 各列表页未动（公共件已就绪，下一步按需接）。

#### Verified（验证）

- `tsc -b` / `pnpm lint`（0 error，16 条既有 fast-refresh warning）/ `vite build` / `pnpm check:i18n`（**461 keys**）
- `pnpm check:filters`：静态自检 PASS + **7/7 页面用例通过**（真实 Chrome CDP，见上）
- 几何实测（1440 / 390 两档）：三个控件宽屏同一行（top 均为 174，搜索 256px、下拉各 160px、高 32px）、
  窄屏纵向堆叠且等宽（326px）、两档 `scrollWidth - innerWidth = 0`（无横向滚动条）；
  触发器文本 `Status All` / `Team All`、`aria-label="Status: All"`、占位符 `Search username…`

#### Changed（工具链与依赖同步，2026-10-01 补记；仍属未发布的 0.10.0）

本版发布前做了一次依赖面核对：**39 项依赖里没有任何包存在更高的大版本**，因此只做了小版本升级，
并把三处「版本线不匹配」的问题一次修掉。

- **TS 7 原生编译器刷新**：`@typescript/native` → `npm:typescript@7.1.0-dev.20260930.4`（原 `…20260918.1`）。
  `tsc6` 线（`typescript` → `npm:@typescript/typescript6@6.0.2`）**保持不动**：typescript-eslint 8.71.0 的
  peer 仍为 `>=4.8.4 <6.1.0`，**尚不支持 TS 7**，所以「TS 6 API 并行」的两条线都必须留着
  （**升级 TS 7 只能动 `@typescript/native`**，写成 `pnpm add -D typescript@next` 会把 lint 那条线顶掉）。
  退路已实测：TS `7.0.2` 稳定版对本项目同样零诊断，若 next 线出问题可直接回落。
- **`@types/node` 26 → 24 线**（`^24.19.0`）：运行时与 CI 都是 Node 24，而类型装的是 Node 26 —— 类型线高于运行时
  等于允许写出「`tsc` 通过、运行时才炸」的代码。**类型线以最低支持的运行时为准**。
- **pnpm 版本收敛**：`package.json` 新增 `"packageManager": "pnpm@11.28.2"`，`ci.yml` 的 `version: 11`
  → `11.28.2`。此前本地 corepack 是 11.10.0、CI 浮动到 11 线最新，同一个 lockfile 被两个版本处理。
- **依赖小版本升级（9 项，全部在现有 range 内，无大版本跳跃）**：@tanstack/react-router 1.170.38→1.170.41、
  @tanstack/router-plugin 1.168.40→1.168.42、@tanstack/react-query / react-query-devtools / eslint-plugin-query
  5.103.1→5.104.0、vite 8.3.0→8.3.1、lucide-react 1.47.0→1.49.0、react-i18next 17.0.14→17.0.15、
  typescript-eslint 8.70.0→8.71.0（**沿用精确锁定，未改成 `^`**）。
- **文档订正**：`PROGRESS.md` 的 TS 版本号（20260815.1 → 20260930.4）、升级命令、lint 状态与阻塞点全部对齐实际；
  `README.md` 技术栈表补 pnpm / Node 版本行与「TS 为什么装两份」说明。

#### Fixed（公开路径守卫，2026-10-01 补记；仍属未发布的 0.10.0）

- **`scripts/check-public-paths.sh` 不再把 `src/features/` 整体列为内部内容**：该前缀是守卫上线时（8/29）
  写的，当时 `src/features/` 确实只有内部页；v0.7.0 起 `config` / `help` / `permissions` / `profile`
  四个**公开页**也搬了进去，于是规则变成误报 —— 任何一次改动这四个页面都会被 CI 拦下，
  而无基线运行（首次推送 / 强推）**在当时的 main 上直接 exit 1**。
  实测：`bash scripts/check-public-paths.sh` 修复前报 4 个违规、exit 1；修复后 ✅ exit 0。
- **改为按真实内部路径列举**（依据 `git diff --name-status main custom`，即 custom 分支专有文件）：
  `src/features/{amro,clean-layer,flows,sql-icon-map}/`、`src/routes/flows*`、
  `src/routes/t.$teamSlug.flows*`、内部文档与抽取/构建/校验脚本，以及只在 custom 线的
  框架同步与评审材料（`GIT_SYNC.md`、`scripts/sync-framework.sh`、`docs/architecture-review.html`）。
  顺带补上原来**漏拦**的 6 个团队作用域路由 `src/routes/t.$teamSlug.flows*.tsx`
  （旧规则 `src/routes/flows` 是前缀匹配，够不到 slug 那一段）。
- 规则自检（一次性核对，未入库）：应拦的 custom 专有文件 **56/56 命中**，main 已跟踪文件 **0 误伤**，
  custom 专有文件 **0 未覆盖**。脚本头部补了维护要点：**不要再用整目录前缀**，改规则后必须跑一次无基线全量自检。

#### Changed（通用起点：站点绑定 env 化 + 接入/部署文档，2026-10-01 补记；仍属未发布的 0.10.0）

目标：让**别人 clone 下来就能接自己的站点**，而不是"必须改作者的代码"。

- **品牌信息不再被测试钉死**（原先 fork 必然 CI 红）：`scripts/check-permissions.mjs` 的 Help 用例
  改为**从 `src/config/app.ts` 导入期望值**（`APP_NAME` / `APP_AUTHOR` / `APP_WEBSITE` / `APP_WEBSITE_LABEL`），
  不再写死 `'xilejun'` / `'xilejun.com'`；`APP_WEBSITE_LABEL` 由 `APP_WEBSITE` **派生**（fork 只改一处）。
  **实测**：把品牌改成 `acme-admin` / `ACME Inc` / `https://acme.example.com` 后重新构建，Help 用例仍 ✅，
  失败数没有任何增加；`app.ts` 头部补了「fork 时改这里」的说明。
- **站点绑定全部 env 化**（原先 serverUrl / siteName / siteContentUrl / embedUser / 项目过滤 / API 版本 /
  代理路径**六项硬编码**，只有凭据走 env）：新增 7 个 `VITE_TABLEAU_*` 变量，`src/vite-env.d.ts` 全量声明，
  `.env.example` 重写为「站点绑定 / 凭据」两段并逐项注释。
- **dev 代理与运行时同源读取 `.env`**：`vite.config.ts` 改用 `loadEnv`，`serverUrl` 不再有第二份拷贝
  （原先改 .env 只改了应用、dev 代理仍打旧站点）。
- **项目过滤缺省规则修正**：演示站点默认 `Samples`；**配了自己的站点则默认不过滤** ——
  原先新人接上自己的站点会"只看到 2 个工作簿"且无从归因。
- **新增「Environment check」卡（`/help`）**：显示实际生效的站点、凭据来源（演示/`.env`）、项目过滤与代理路径，
  让"我配对了没有"有个界面答案；`check:permissions` 的 Help 用例已覆盖该卡，并支持两个可选严格断言
  `EXPECT_TABLEAU_SITE_SOURCE=demo|own` / `EXPECT_TABLEAU_PROJECT=<项目名>|all` 用于验证 `.env` 覆盖。
- **新增 `docs/tableau-setup.md`**（Connected App 创建、域名白名单、访问级别 vs REST、五分钟接入、排查表、安全边界）
  与 **`deploy/nginx.conf.example`**（REST 反代要点：`proxy_ssl_server_name`、`Host` 覆盖、SSE 段预留）；
  README 新增「配置自己的 Tableau 站点」「部署」两节，并修掉**重复的 `## 路线图`**标题、刷新路线图。
- **公开线移除内部功能宣传**：Help 页的「Core features」原有一条 *Processing flow atlas*（文案点名
  FOC / AMRO / clean-layer）与一条指向 `docs/flow-page-conventions.md` 的文档入口 —— 这两样在公开线**都不存在**
  （页面与文档只在 custom 分支），且属于内部代号外泄。已从 `FEATURES` / `DOCS` 与 i18n 中移除，
  并在注释里写明「这里只列 main 真实存在的功能」。路径守卫管不了文案，这条只能靠人守。

#### Added（AI 应用起点：`src/lib/ai` + `/ai` 页面 + 代理契约，2026-10-01 补记；仍属未发布的 0.10.0）

目标：让它同时是「AI 应用起点」——**clone 下来零配置就能看到 AI 页在动**，配一个代理就能换成真模型，且**API Key 永不进浏览器**。

- **抽象层 `src/lib/ai/`**（照 Tableau 那套的三段式：配置 / 客户端 / 错误类型）：
  - `types.ts`：`AiProvider` 接口（`chat({ messages, signal, onDelta })`）+ `AiError` 错误分类
    （config / http / network / aborted / parse）与 `retryable` 语义 —— UI 据此区分"重试有没有用"；
  - `config.ts`：环境变量 → 运行时配置。**留空 `VITE_AI_PROXY_URL` 即演示模式**；
  - `demo.ts`：内置演示 provider，本地流式输出、**输出确定**（便于断言），并把"怎么接真模型"写进回复；
  - `deepseek.ts`：OpenAI 兼容 `/chat/completions` 的 **SSE 流式**客户端 —— 只 POST 同源代理、**请求里不带任何 Key**；
  - `index.ts`：`resolveAiProvider()`（换上游只改这里，页面不动）。
- **`src/lib/env.ts`（新）**：抽出「空串算未配置 / 取缺省值 / 取可选值」三个后处理工具，
  `src/config/tableau.ts` 改为复用（去掉一份重复实现）。注释里写明**为什么不提供按名字取 env 的函数**：
  Vite 只内联静态引用，`import.meta.env[key]` 在产物里拿不到值。
- **`src/hooks/use-ai-chat.ts`（新）**：流式增量写入、失败时**移除空的占位气泡**、
  取消时**保留已生成内容**、`retry / stop / clear`；卸载时中断进行中的请求。
- **`/ai` 页面**（`src/features/ai/ai-chat-page.tsx`）：流式渲染 + Stop + Retry + Clear + 起始提示 +
  错误分级提示 + provider 徽章（Demo / Proxy）；演示模式下给出一条明确的接入指引。
- **一行接入权限体系**：`ROUTE_CATALOG` 新增 `page.ai`（`scope: 'global'`、新分组 `ai`、默认授权 `member`）——
  侧边栏入口、URL 直达拦截、权限页勾选三处同时生效；侧边栏与权限页的**分组文案由 tsc 强制补齐**
  （`Record<NavGroup, string>` 漏了 `ai` 直接编译报错，这正是这套目录设计想要的效果）。
- **配置面**：`vite-env.d.ts` 声明 3 个 AI 变量；`.env.example` 新增「③ AI 能力」段（含"Key 只能放网关"的警示）；
  `/help` 环境自检卡新增 **AI provider** 行（demo / proxy + 模型名与代理路径）。
- **文档**：新增 `docs/ai-integration.md`（铁律、数据流、**契约**、nginx / 约 20 行 Node 网关 / Serverless 三种落法、
  环境变量、验收清单、排查表、以及"把 AI 接到 Tableau 上（VizQL Data Service）"的思路）；
  Help 页文档入口从 3 条改为 4 条（新增 AI 接入）。
- **用例**：
  - 新增「**AI 页默认授权给成员，且演示 provider 能流式回复**」——真实浏览器里点起始提示、
    等流式完成、断言消息条数与内容；
  - 修掉「补齐默认授权」用例**把缺口数写死为 4** 的问题（新增 `page.ai` 后立刻误报，应用其实是对的）：
    改为**从 `ROUTE_CATALOG` 动态计算**期望缺口数 —— 与「品牌硬编码」同一类"fixture 跟不上目录"的坑。

#### Changed（起点信誉：静态断言进 CI、用例跨平台、路由级分割、单测、社区文件、双语 README，2026-10-01 补记；仍属未发布的 0.10.0）

目标：让"别人 clone 下来 CI 是绿的、坏了自己能查"这件事成立。

- **路由 ↔ 权限目录一致性断言**（`scripts/check-route-catalog.mjs` / `pnpm check:routes`）：
  路由守卫是 **fail-open** 的（目录里没登记的路径一律放行），因此"新建页面文件却忘了登记"会静默
  产生权限盲区。新脚本做三件事：未登记路由报错、目录里的死条目报错、白名单里的路径消失也报错
  （防止白名单腐烂成"什么都放行"）。**纯静态、不需要浏览器，已加入 CI 的阻塞步骤**。
  **实测**：把 `createFileRoute('/ai')` 临时改成别的路径，脚本同时报出"未登记路由"与"目录死条目"两条。
- **路由级代码分割**：`tanstackRouter({ autoCodeSplitting: true })` —— **路由文件一行没改**，
  但入口 chunk 从 **1.14 MB 降到 419 KB（gzip 133 KB）**；Tableau Embedding SDK 被隔离进
  按需加载的 `t._teamSlug.views` chunk（337 KB），没打开过 Views 的人不再下载它。
  **实测**：四套浏览器用例在懒加载后全部照常通过（说明分割没有破坏首屏与等待逻辑）。
- **4 套 CDP 用例跨平台**：原先 4 个脚本都硬编码 macOS 的 Chrome 路径（Linux/CI 上根本起不来，
  这也是它们长期只在作者本机跑、坏了没人发现的原因之一）。改为 `resolveChrome()`：
  `CHROME_PATH` 优先 → 依次探测 macOS / Debian-Ubuntu / chromium 的常见位置，找不到时给出
  带候选清单的明确报错。**实测**：默认探测与 `CHROME_PATH` 覆盖两种方式在本机均通过。
- **CI 新增 `ui-checks` job**（`continue-on-error: true`，advisory）：在 ubuntu runner 上跑
  `check:team-routes` / `check:smtp` / `check:filters` / `check:permissions` —— 四套浏览器用例全部进 CI。
  **刻意标为 advisory 并写明原因**：① 首次在 Linux 上运行，`check:filters` 的**几何断言**依赖字体渲染，
  可能与 macOS 有细微差异；② `check:permissions` 有一条**已知失败**用例（切到刻意冻结的种子用户，
  见 PROGRESS「阻塞点」）。两条都解决后再去掉 `continue-on-error` 并加入必需检查 ——
  在此之前它只提供可见性，不能当作"权限没问题"的证据。
- **单元测试**：新增 `vitest`（`pnpm test`，`vitest.config.ts` 只保留 `@` 别名、不带路由插件）+
  **45 个纯函数用例**：环境变量口径（空串必须落回缺省，否则 `.env` 里留空的 `VITE_AI_PROXY_URL`
  会变成空代理地址）、权限通配与作用域语义（含 `page.user.*` **不**命中 `page.users` 的前缀陷阱）、
  目录不变量（key/路由唯一、`defaultRoles` 合法且适用于该作用域、**每条 labelKey 在词典里都存在**、
  动作的 owner 必须是已登记页面）、SMTP 校验规则与归一化。**已加入 CI**（毫秒级、无需浏览器）。
- **社区文件**：`CONTRIBUTING.md`（含 5 条易踩的约定：一行登记页面、不要把密钥写进 `VITE_*`、
  共用组件优先、注释写"为什么"、版本号到处核对）、`SECURITY.md`（把"纯前端不是安全边界""演示凭据
  是有意的""AI Key 只能放服务端"写成明确条目）、`.github/ISSUE_TEMPLATE/{bug_report,feature_request}.yml`、
  `.github/PULL_REQUEST_TEMPLATE.md`（勾选项直接对应 CI 跑的命令）。
- **README 双语**：新增 `README.en.md`（英文完整版），中文版与英文版顶部互相链接；
  同步了页面表（新增 `/ai`）、脚本表（新增 `test` / `check:routes`）与路线图（Phase 3–4 勾上）。

#### Verified（补记，2026-10-01）

- `tsc -b --force` ✅ ／ `pnpm lint` ✅（**0 error**，16 条既有 fast-refresh warning，与升级前一致，无新增）
- `pnpm build` ✅（vite 8.3.1，2491 modules transformed）
- 公开路径守卫 ✅（无基线全量自检 exit 0）
- 静态检查：`pnpm test` **45/45**（vitest 0.9s）、`pnpm check:routes` ✅、`pnpm check:i18n` ✅ 501 keys
- 四套浏览器用例回归：`check:permissions` **13/14**（唯一红的是「整列 Clear」那条 —— 它切到了刻意冻结的
  种子用户 Carol White，store 按设计拒绝切换，属用例问题，按当前决策不修，见 PROGRESS「阻塞点」）、
  `check:team-routes` **16/16**、`check:smtp` 6/6、`check:filters` 7/7
- 通用起点改造的端到端实测：① 不写 `.env` → 运行时自检卡为 `demo` / `Samples`；
  ② 写 `.env` 指向 `env-test.example.com` → 运行时为 `own` / `all`（`EXPECT_TABLEAU_*` 严格断言通过，
  证明 `.env` 覆盖**改变的是运行时行为**，不只是产物里的字面量）；③ fork 模拟（改品牌）后 Help 用例仍 ✅；
  ④ `/ai` 页在无 `.env` 时走演示 provider 并**真的流式出字**（新用例在真实浏览器中断言）；
  ⑤ 代码分割后入口 chunk **1.14MB → 419KB**（gzip 133KB），且四套浏览器用例在懒加载后全部照常通过；
  ⑥ `check:routes` 反向验证：故意把路由路径改错，脚本同时报出"未登记路由"与"目录死条目"。
- 依赖漏洞审计**未完成**：npmmirror 不提供 audit 端点（`ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS`），
  需 `pnpm audit --registry=https://registry.npmjs.org` 才能核验（见 PROGRESS「阻塞点」）。

## [0.9.0] - 2026-09-21

### 团队冻结（suspend）+ 用户冻结（freeze）+ 用户必须归属某个团队

三件事一起做，因为它们共享同一条线索：**状态属于数据模型，拦截必须落在 store，界面只负责把话说清楚**。
新规则集中写在 [`docs/org-rules.md`](./docs/org-rules.md)（含三条铁律与接后端映射）。

#### Added（新增）

- **团队冻结** `OrgTeam.suspended`：冻结后**仅系统管理员可进入**——
  TeamSwitcher 对非管理员不再列出该团队、`setActiveTeam()` 直接拒绝、`/t/$teamSlug` 守卫渲染
  `TeamSuspended` 兜底页（直接粘 URL 也进不去）；管理员在列表与 `/teams` 行内看到 `Suspended` 徽章。
  冻结是**临时停用**：团队、成员关系、数据都保留，成员自动回落到自己所属的其它团队
  （不需要把人逐个移出去再拉回来，那会丢岗位设置）。
- **`setTeamSuspended(id, suspended)`** + `/teams` 行内一键冻结/解冻（`PauseCircle` / `Play`），
  冻结后立即重算 `activeTeamId`，避免有人「停在一个进不去的团队」。
- **用户冻结** `freezeUser(id, frozen)`：冻结即 `status: 'disabled'`，**该用户无法登录**
  —— `setCurrentUser()` 返回 `false`，侧栏用户菜单里该项 `disabled` 并标 `Frozen`。
  账号与团队关系保留，解冻即恢复（与「删除账号」是两件事）。
- **`/users` 行内冻结/解冻按钮**（`Ban` / `CircleCheck`）+ 状态徽章文案改为 **Frozen**。
- **用户归属不变量**：每个用户必须至少属于一个团队。
  - 新建用户默认加入**当前团队**（岗位 `viewer`，并作为其默认团队），表单里明确写出「New users join the current team (X) as Viewer」；
  - 没有任何团队可用时**拒绝创建**（`addUser()` 返回 `null`）；
  - 移除成员关系时，若是该用户唯一的团队 → 拒绝（按钮同步禁用）；
  - 删除团队时，若团队里有成员**只属于它** → 拒绝删除，确认框直接列出受影响人数；
  - `persist.migrate` **v2 → v3**：给老数据里的「无归属」账号补一条成员关系，团队补 `suspended: false`。
- **`docs/org-rules.md`**：三条铁律、各拦截点、接后端映射（`status` 列 / `suspended_at` / `(team_id,user_id)` 唯一约束）、改这块代码的自查清单。

#### Changed（变更）

- `USER_STATUS_LABEL_KEYS.disabled` → `users.frozen`（**值不变**，仍是 `disabled`；只是界面口径统一为「冻结」）
- `/teams` 行内「当前团队」徽章由 `Active` 改名为 **`Current`**（`teams.currentLabel`），与新增的冻结状态区分开
- `removeMember()` / `deleteTeam()` / `setActiveTeam()` / `setCurrentUser()` 现在**返回布尔值**表达「是否执行」，
  调用方据此提示原因（原先静默失败）；`addUser()` 返回 `OrgUser | null`
- 版本 0.8.1 → 0.9.0（package.json / `src/config/app.ts` / README / PROGRESS.md / CHANGELOG.md）

#### Verified（验证）

- `tsc -b` / `pnpm lint`（0 error）/ `vite build` / `pnpm check:i18n`（452 keys）全绿
- **store 单测**（Node + TS strip-types）：冻结团队进入判定、非管理员切换被拒、默认团队被冻结时自动回落、
  冻结用户无法登录、不能冻结自己、不能冻结最后一名管理员、新用户落入当前团队、唯一团队不可移除、
  含「唯一团队成员」的团队不可删除、迁移 v1→v3 / v2→v3 —— 全部通过
- **无头 Chrome 端到端**：冻结 Analytics → 行内 `Suspended` 徽章；管理员仍可进入；切到 Bob 后侧栏不再出现该团队、
  直接访问 `/t/acme_analytics` 命中 `Team suspended` 兜底页；解冻恢复；冻结 Dave → 行内 `Frozen`、
  用户菜单该项 `disabled` + `Frozen`；新建用户落进当前团队（`Viewer · Acme Analytics`）；
  删除 `Acme Data Platform` 被拦下并提示「2 members belong only to this team」

## [0.8.1] - 2026-09-21

### 侧栏团队切换器只保留团队名称（去掉 default 星标与说明文字）

- **去掉头部 default 星标**：team 名称旁的琥珀色五角星在窄侧栏会挤压标题，改为只显示名称（下拉列表里的
  `★ Default` 徽章保留 —— 那里不影响标题，且是「默认团队」的唯一标识位）
- **去掉头部说明文字**：左上角不再显示 team 的 description 第二行，名称独占一行、`truncate` 完整可读
- 交互不变：点击仍弹出团队列表切换；`/teams` 页的 `★ Default` 徽章不受影响
- 版本 0.8.0 → 0.8.1（package.json / `src/config/app.ts` / README / PROGRESS.md / CHANGELOG.md 五处同步）

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
