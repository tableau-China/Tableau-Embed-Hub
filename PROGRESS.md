# shadcn-admin-cn 项目进度（PROGRESS）

> 更新于 2026-09-19 ｜ 项目根目录：`/Users/xilejun/WorkBuddy/ds_Harness/shadcn_admin_cn`

## 项目概况

- **目标**：从零构建管理后台模板（React 19 + TypeScript 7 + Vite 8 + Tailwind CSS v4 + shadcn/ui(Radix) + TanStack Router），包含 shadcn-admin 的全部基础功能，**含 Tableau 页面**（favorites / recents / workbooks / views —— 浏览器内签发 Connected App JWT 嵌入真实视图，凭据见 README「凭据配置」），**不含 AI 功能**；也不含内部流程页（flows / amro / clean-layer / sql-icon-map，那些只存在于本地开发线），v0.4.0 起含**多团队 + 全局用户**（参照 pg-explorer，无部门管理），v0.5.0 起**团队身份进入 URL**（`/t/{slug}/...`，对齐 pg-explorer 的 `/t/{slug}` + `/admin/*` 划分），v0.6.0 起**页面级权限**（角色 × 路由，权限页勾选；按钮级权限仅预留命名空间），v0.7.0 起**个人资料归位**（`/settings` → `/profile`，入口在左下角用户菜单）+ **Config 分组与 SMTP 配置页** + **帮助页** + **前端通用件**；i18n 当前仅 **en-US**，中文/日文后期扩展。
- **关键决策**：跳过 shadcn-admin 模板（无 Sat Naing 署名义务）、TypeScript 7.1.0-dev（next 开发版，验证未来升级，正式版发布后直接升级）、Vite 8.2.1 最新稳定、i18n 当前仅 en-US（zh-CN / zh-TW / ja-JP 后期扩展）。
- **注意**：用户原指定路径 `/Users/xilejun/ds_Harness/shadcn_admin_cn` 不存在，实际目录在 `/Users/xilejun/WorkBuddy/ds_Harness/shadcn_admin_cn`。
- **版本记录**：每个版本的变更/问题/待办记入 **CHANGELOG.md**（含版本对照表）；版本号需与 package.json、侧边栏显示、PROGRESS.md 交叉核对（当前 **0.7.1**）。

---

## ✅ v0.7.1（2026-09-19）— 文档订正

无功能改动，只订正本文件一处与实际不符的目标描述：

- ✅ **「不含 Tableau 功能」是错误的**：本线**含** favorites / recents / workbooks / views 四个 Tableau 页面
  （浏览器内签发 Connected App JWT 嵌入真实视图）。已改为「含 Tableau 页面；不含 AI 功能」，
  并写明**不含**内部流程页（flows / amro / clean-layer / sql-icon-map —— 它们只存在于本地开发线）
- ✅ 版本四处同步 0.7.1（package.json / `src/config/app.ts` / PROGRESS.md / CHANGELOG.md）
- 说明：`GIT_SYNC.md`（远端仓库名订正）只存在于本地开发线，不在本线

## ✅ v0.7.0（2026-09-19）— 页面权限 + 个人资料 / Config-SMTP / 帮助页 + 前端通用件

框架线一次落三个版本的内容（v0.6.0 的页面权限此前只在本地开发线完成，本版一并入库）：

- ✅ **页面级权限（v0.6.0）**：`ROUTE_CATALOG` 作为侧边栏 / 路由守卫 / 权限页的唯一数据源（新增页面只登记一行）；
  5 个角色 × 11 条路由的勾选矩阵 `/permissions`（勾选即时生效、无保存按钮；底座页面与系统管理员列锁定；
  新页面 fail-closed，可用「补齐默认授权」一键补齐）
- ✅ **个人资料 `/profile`（v0.7.0）**：由 `/settings` 改名，入口移到左下角用户菜单（`navHidden` 但仍受权限约束）；
  表单绑定 org-store 当前登录用户，保存后侧边栏头像/缩写同步
- ✅ **Config 分组 + SMTP 配置页 `/config/smtp`**：服务商预设一键回填、三态加密方式、7 项实时预检、
  密码留空即保持、Reset 二次确认；`src/lib/smtp.ts` 为纯函数领域层，`stores/config-store.ts` 持久化且**密码不落盘**
- ✅ **帮助页 `/help`**：核心功能 8 条 + 开发者与版本（`src/config/app.ts` 为元信息唯一来源）+ 技术栈 +
  文档入口 + 上线前安全提醒；排在 Config 分组内 SMTP 之后，默认授权给所有成员
- ✅ **前端通用件**：`PageContainer` / `FormGrid` + `FormField` / `NoteCallout` / `DescriptionList` / `useFormTouch`；
  约定与宽度规则写入 `docs/ui-conventions.md`
- ✅ **版面与 shell 修复**：页面一律铺满内容区（窄栏下沉到内容块）；`SidebarInset`/`main` 补 `min-w-0`，
  修掉「宽表格顶宽整页」导致的横向滚动条
- ✅ **校验脚本**：新增 `scripts/check-smtp.mjs`；`check-permissions.mjs` 静态自检 + 12 项 CDP 用例；
  `check-team-routes.mjs` 16 项；三个脚本都会在调试端口被占用时快速失败（避免连到残留 Chrome 产生假失败）
- ✅ 版本四处同步 0.7.0（package.json / `src/config/app.ts` / PROGRESS.md / CHANGELOG.md）

## ✅ 已完成（Done）

| # | 事项 | 说明 |
| --- | --- | --- |
| 1 | 方案评估 | 确定从 shadcn/ui + Tailwind + Radix 从零重建，避开老仓库（pg-explorer）的密钥历史与版权污染 |
| 2 | 骨架文件 | 写入 14 个基础文件：package.json、tsconfig×3、vite.config.ts、index.html、.gitignore、README.md、LICENSE（MIT）、eslint.config.js、.github/workflows/ci.yml、scripts/check-i18n.mjs、src/index.css、src/vite-env.d.ts |
| 3 | 依赖安装 | `pnpm install` 成功，关键版本：**typescript 7.1.0-dev.20260815.1（next 标签，自 7.0.2 升级）**、vite 8.2.1、react 19.2.8、tailwindcss 4.3.3、@tanstack/react-router 1.170.29、@tanstack/router-plugin 1.168.32、i18next 26.3.6 |
| 4 | 环境问题修复 | ① npm 缓存目录 root 权限损坏 → 用 `npm_config_cache=/tmp/npmcache` 绕过（后该目录也损坏，npm 查询改用 curl 直查 registry）；② pnpm dlx 缓存被沙箱拦截 → 改为本地安装 shadcn CLI（4.18.0）；③ `pnpm-workspace.yaml` 占位文件修复为 `allowBuilds: '@swc/core': true`，SWC postinstall 正常 |
| 5 | 定位 shadcn 4.18 变更 | 新版 CLI 的 `-b` 参数从"基础色（slate）"改为"组件库选择"：`radix | base | aria`——需用 `-b radix`；init 另需 `-p nova` 预设（默认交互式弹菜单） |
| 6 | 版本/范围调整 | TypeScript 切到 **7.1.0-dev.\***（next 标签，现锁 7.1.0-dev.20260815.1，升级开发版用 `pnpm add -D typescript@next`）；i18n 范围收敛为**仅 en-US**（zh-CN / zh-TW / ja-JP 后期扩展），index.html lang=en |
| 7 | TS7 工具链适配 | ① tsconfig.app.json 删除 TS7 已移除的 `baseUrl`（paths 改相对解析）；② 修复骨架期漏装的 `@tanstack/eslint-plugin-query`；③ 实测 typescript-eslint 8.67.0 与 canary 均硬性拒绝 TS 7（上游 #10940），`pnpm lint` 暂不可用，**CI 已暂缓 lint 步骤**（ci.yml 注释含恢复说明） |
| 8 | shadcn init + add | `shadcn init -y -b radix -p nova`（radix-nova 预设，neutral 基色）✅；add 21+1 个组件（sidebar/breadcrumb/collapsible/separator/sheet/tooltip/input/label/button/card/dropdown-menu/select/table/dialog/avatar/badge/skeleton/tabs/switch/sonner/command/toggle）✅ |
| 9 | shadcn 别名 Bug 修复 | shadcn CLI 从**根 tsconfig.json** 解析 `@` 别名；根文件原无 paths → 组件被写入字面 `@/` 目录。修复：根 tsconfig.json 补 `paths` + 迁移 25 个文件到 src/；此后 add 已验证写盘正确 |
| 10 | 应用代码 | TanStack Router 文件路由（dashboard / users / tasks / settings / 404 catch-all）+ 布局（可折叠侧边栏、头部面包屑、主题切换 next-themes、用户菜单）+ i18n 框架（en-US 59 key，i18next）+ sonner toast + mock 数据表 |
| 11 | 工具链验证 | `pnpm build`（tsc -b + vite build）✅ 2089 模块；`pnpm check:i18n` ✅ 1 语言 59 key；dev 服务器冒烟测试 ✅（/、/users、404 均 200） |
| 12 | git 首次提交 | `git init -b main` + 首次提交 `1ff5ebd`（59 文件）；`.pnpm-store/`（沙箱重定向的 pnpm 内容存储）与 dist/node_modules 均已 gitignore |

## ✅ v0.2.0（2026-08-16）— Tableau 迁移

从 pg_explorer 迁移 Tableau 相关页面（纯前端实现，无后端依赖）：

- ✅ 新增路由：`/favorites`、`/recents`、`/workbooks`、`/views`（Views = Tableau 嵌入）
- ✅ `src/config/tableau.ts`：Connected App 测试凭据明文配置（10ax.online.tableau.com / xilejunchina / wyp@vizwise.cn）
- ✅ `src/lib/tableau-jwt.ts`：客户端 JWT（jose HS256，5 分钟有效 + 4 分钟刷新）
- ✅ `src/lib/tableau-api.ts`：REST 客户端（workbooks/views 列表；CORS 受限时手动 URL 兜底）
- ✅ `src/lib/view-store.ts`：favorites/recents localStorage 持久化
- ✅ `src/components/tableau/tableau-embed.tsx`：@tableau/embedding-api v3 嵌入组件
- ✅ 侧边栏 Tableau 分组 + en-US i18n 扩展；版本同步 0.2.0（四文件）
- ✅ CORS 实测：Tableau Cloud 不支持（无 ACAO 头 / 预检 405）→ dev 代理 `/tableau-proxy` 落地（生产需 nginx 同路径反代）
- ✅ 浏览器验证列表与嵌入；git 提交（`70d127f` 已推 GitHub）

## ✅ v0.2.1（2026-08-16）— Views 嵌入体验与链接体系重构

- ✅ **/views 链接体系改为 UUID 驱动**：workbooks 卡片直传视图 UUID（`?view=<uuid>` 单参数）；旧双参数/名称链接自动重写；`tableau-api.ts` 新增 `fetchViewDetail`（按 UUID 解析视图名 + 所属工作簿）；`view-store.ts` favorites/recents 记录新增 `workbookId/viewId`（新旧数据兼容）
- ✅ **嵌入层修正**：删除自定义加载遮罩（消除双层 loading）；错误改为顶部非遮挡横幅；Info 弹层显示视图完整 URL（一键复制）+ 手动 URL 兜底
- ✅ **Header 重构**：面包屑改为当前页面标题（修复 "Page not found"）；新增 `language-toggle.tsx`（当前仅 en-US）；Settings 静态语言下拉移除
- ✅ **Samples 项目限制**：`fetchWorkbooks` 追加 `filter=projectName:eq:Samples` → 列表仅返回 2 个工作簿
- ✅ 版本同步 0.2.1（四文件）

## ✅ v0.5.0（2026-09-18）— 团队身份进入 URL（`/t/{slug}/...`）

参照 pg-explorer 的团队 slug 路由：工作区页面全部挂到 `/t/{slug}` 下，跨团队管理页保持无 slug（对标对方的 `/admin/*`）。此前 slug 只在 store/localStorage 里，URL 无法表达团队，导致多团队共用同一路由、分享与多标签页失效。

- ✅ **解析层** `src/lib/team-context.ts`：`parseTeamSlugFromPath` / `resolveCurrentTeam` / `teamScopedPath` / `stripTeamPrefix` / `userDefaultTeam` / `activeTeamSlug()`（命令式）；纯函数为主，URL 优先、store 回退
- ✅ **React 读取入口** `src/hooks/use-current-team.ts`：`useCurrentTeam()` / `useTeamSlug()`（订阅 pathname + org store）
- ✅ **布局路由** `src/routes/t.$teamSlug.tsx`：slug 校验 + `activeTeamId` 单向同步（仅值变化时写盘）+ Team not found / No access 两类兜底页
- ✅ **页面迁移**：`t.$teamSlug.{index,favorites,recents,workbooks,views}`（内容不变，仅路由与链接前缀）
- ✅ **旧路径兼容桩**：`/`、`/favorites`、`/recents`、`/workbooks`、`/views`（search 透传）→ 重定向到团队作用域路径
- ✅ **侧边栏**（`app-sidebar.tsx`）：团队条目用路由模式 + `params` 填充（不再拼字符串）；管理条目无 slug；无团队时禁用
- ✅ **TeamSwitcher**：切团队 = 切 URL 前缀并保留同级子路径（`navigate({ href })`）；高亮由 URL 决定
- ✅ **view-store**：分区后缀改为 URL 优先 —— 修掉「slug→activeTeamId 有一帧延迟」与「多标签页无法并存两个团队」两个隐患
- ✅ **Header / UserMenu / ThumbnailCard**：标题解析跳过 `t/{slug}` 两段；切身份后落到合法团队；`linkParams` 透传 teamSlug
- ✅ **校验脚本** `scripts/check-team-routes.mjs`（`pnpm check:team-routes`）：Chrome CDP 直驱（含真实点击 TeamSwitcher / UserMenu），14/14 通过
- ✅ 验证：`pnpm build` ✅ / `pnpm typecheck` ✅ / `pnpm check:i18n` ✅ / `pnpm check:team-routes` ✅ 14/14 / `scripts/check-public-paths.sh` ✅
- ✅ 版本同步 0.5.0（package.json / APP_VERSION / PROGRESS.md / CHANGELOG.md）

## ✅ v0.4.2（2026-09-18）— Team slug 改为新建时手工输入（仅英文/数字/下划线）

- ✅ **slug 改为用户输入**：新建团队对话框新增 **Team slug** 输入框（必填）；`createTeam` 入参新增必填 `slug`，不再由团队名派生
- ✅ **字符集收紧为 `^[A-Za-z0-9_]+$`**：不允许中文/空格/连字符 —— slug 会进 URL、路由、配置键，非 ASCII 会被百分号转义成乱码（`试单` → `%E8%AF%95%E5%8D%95`）
- ✅ **新增校验/过滤工具**：`TEAM_SLUG_PATTERN`、`isValidTeamSlug()`、`sanitizeTeamSlug()`（输入实时过滤非法字符）、`teamSlugIssue()`（`empty` / `charset` / `taken`），表单与 store 共用同一口径
- ✅ **slug 创建后不可改**：`updateTeam` 不再重算 slug；编辑态输入框置灰只读并提示
- ✅ **种子 slug 改下划线形式**：`acme_hq` / `acme_analytics` / `acme_data_platform`；**不做自动迁移**（不改写存量 slug，避免静默改掉下游映射键）
- ✅ **移除** `slugify()` / `uniqueSlug()` / `nextTeamSlug()`（含下游合并注意项，已在 CHANGELOG 标为 Breaking）
- ✅ 验证：typecheck ✅ / build ✅ / check:i18n ✅（218 keys）；合法性 + 过滤 + 校验 + 端到端改名回归实测

### 背景（事故复盘）

下游应用把 `slug` 当作「团队 → 应用形态」的映射键，而模板里 `slug` 是**按名称派生、且改名会重算**的值，`slugify` 又把非 ASCII 全部抹成 `-`。结果：在团队页给团队改一次名，slug 就变成映射表里不存在的值，下游静默回落到默认团队 —— 表现为「某个团队的内容和默认团队一模一样」，无任何报错。修复方式：slug 与名称彻底解耦，改为创建时手工输入的 ASCII 标识（见上）。

## ✅ v0.4.1（2026-09-04）— 多团队次序/Default 标记 + 操作按钮全局统一

- ✅ **Team 次序 = 创建次序**：createTeam 追加队尾；新增 `sortTeamsById`（id 升序兜底旧数据）；TeamSwitcher 下拉不再重排、切换只改选中项
- ✅ **Default team 标记**：切换器头部星标 / 下拉 `★ Default` 徽章 / /teams 页行内徽章（与 Active 并存）
- ✅ **公共操作按钮** `components/action-bar.tsx`（ActionBar / ActionButtons，右对齐+窄屏堆叠）：users/teams 页头、新建/编辑/删除/成员管理全部复用
- ✅ 修复 CardHeader flex-col/flex-row 冲突导致按钮落左（窄视口）——显式行布局替代
- ✅ 验证：tsc ✅ / build ✅ / check:i18n ✅（212 keys）/ CDP 三档宽度几何断言 ✅；版本同步 0.4.1

## ✅ v0.4.0（2026-09-04）— 多团队 + 全局用户（公开框架线）

- ✅ **数据层** `src/stores/org-store.ts`（zustand 5 + persist）：User(全局) ⇄ TeamMember(岗位 team-admin/analyst/viewer + isDefault) ⇄ Team；默认团队自动维护、最后一名系统管理员/当前用户不可删除；种子 3 团队 + 6 用户 + 10 成员关系
- ✅ **左上角 Team 切换器**：切换当前用户所属团队；系统管理员可 Create team / Manage teams（新 `/teams` 管理页：团队增删改 + 成员对话框）
- ✅ **用户 > Team**：`/users` store 化升级（系统管理员/状态/所属团队徽章、增删改、用户↔多团队分配）；底部用户菜单支持演示性 Switch user
- ✅ **收藏/最近按团队隔离** `lib/view-store.ts`：key 带 activeTeamId + 旧数据自动迁移
- ✅ 版本同步 0.4.0（package.json / `config/app.ts` APP_VERSION / PROGRESS / CHANGELOG）
- ✅ 验证：`pnpm build` ✅ / `pnpm check:i18n` ✅ / 公开路径守卫 ✅ / 无头 Chrome 多页面渲染零 console error ✅

## ⏭️ 下一步（Next）

1. 等 typescript-eslint 支持 TS 7 后恢复 lint（升级依赖 + 取消 ci.yml 注释）；
2. 多语言扩展（zh-CN / zh-TW / ja-JP）：新增 `src/i18n/locales/<lang>/common.json` + i18n 配置加资源；
3. 组件补充（如 data-table、form 等）、真实数据层（mock → API/DB）。

## 🚧 阻塞点（Blockers）

- **npm 缓存损坏**（机器级）：`~/.npm` 含 root 属主文件导致 EPERM，绕行目录 `/tmp/npmcache` 也已损坏；npm 命令（npm view 等）改用 curl 直查 registry；pnpm 有独立 store 不受影响。永久修复：`sudo chown -R 502:20 ~/.npm`（需用户自己操作）。
- **typescript-eslint 不兼容 TS 7**（上游）：8.67.0 与 canary 均硬性拒绝（"typescript-eslint does not support TS 7.0"），官方跟踪 [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)；`pnpm lint` 暂无法运行，CI 已暂缓该步骤。
- ~~沙箱权限~~（已解决）：当前会话工作区即项目目录，workspace-write 模式已覆盖全部写入。

## 日常开发命令

```bash
cd /Users/xilejun/WorkBuddy/ds_Harness/shadcn_admin_cn

pnpm dev          # 开发服务器（http://localhost:5173）
pnpm build        # 类型检查（tsc -b）+ 生产构建
pnpm check:i18n   # 校验语言词典 key 对齐（当前 en-US）
pnpm typecheck    # 仅类型检查
# pnpm lint       # 待 typescript-eslint 支持 TS 7 后恢复

# 添加新组件（radix 库 + nova 预设；根 tsconfig.json 已有 @ 别名映射）
pnpm exec shadcn add -y <component-name>

# 升级 TypeScript 开发版
pnpm add -D typescript@next
```