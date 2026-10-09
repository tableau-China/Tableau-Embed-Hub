# Tableau Embed Hub 项目进度（PROGRESS）

> 更新于 2026-10-09 ｜ 项目根目录：`/Users/xilejun/dsh-projects/shadcn-admin-cn`

## 项目概况

- **目标**：从零构建管理后台模板（React 19 + TypeScript 7 + Vite 8 + Tailwind CSS v4 + shadcn/ui(Radix) + TanStack Router），包含 shadcn-admin 的全部基础功能，**含 Tableau 页面**（favorites / recents / workbooks / views —— 浏览器内签发 Connected App JWT 嵌入真实视图，凭据见 README「凭据配置」），**不含 AI 功能**；也不含内部流程页（flows / amro / clean-layer / sql-icon-map，那些只存在于本地开发线），v0.4.0 起含**多团队 + 全局用户**（参照 pg-explorer，无部门管理），v0.5.0 起**团队身份进入 URL**（`/t/{slug}/...`，对齐 pg-explorer 的 `/t/{slug}` + `/admin/*` 划分），v0.6.0 起**页面级权限**（角色 × 路由，权限页勾选；按钮级权限仅预留命名空间），v0.7.0 起**个人资料归位**（`/settings` → `/profile`，入口在左下角用户菜单）+ **Config 分组与 SMTP 配置页** + **帮助页** + **前端通用件**，v0.9.0 起**团队冻结 + 用户冻结 + 用户必须归属团队**，v0.10.0 起**列表筛选栏公共件**（`/users` 先行），v0.11.1 起**组件总览页**（`/components`：公共件清单 + 实时预览），v0.12.0 起**登录页模板**（`/login`：三种样式 + 第三方联合登录入口；`/config/login` 配置样式与 provider 公开参数），v0.13.0 起**更名为 tableau-embed-hub**（显示名 Tableau Embed Hub）+ **Tableau 站点用户与角色 / 定时计划运行情况**两页 + **Help 页第三方版权与商标说明**（Help 同时挪到 Config 分组最末）；i18n 当前仅 **en-US**，中文/日文后期扩展。
- **关键决策**：跳过 shadcn-admin 模板（无 Sat Naing 署名义务）、TypeScript 7.1.0-dev（next 开发版，验证未来升级，正式版发布后直接升级；**现锁 7.1.0-dev.20261009.1**；**两阶段路线**：先换 7.1 stable，再等上游支持 TS 7 后替换 TS 6 线，见 README「TypeScript 为什么装了两份」）、Vite 8 最新稳定、i18n 当前仅 en-US（zh-CN / zh-TW / ja-JP 后期扩展）。
- **工具链锁定**：pnpm **12.9.1**（`package.json` 的 `packageManager` 字段，CI 同版本）、Node **24**（本地与 CI 一致，`@types/node` 对齐 **24 线**——类型线高于运行时会写出跑不起来的代码）。⚠️ 2026-10-05 pnpm 由 11.28.2 升级到 12.9.1：pnpm 12 要求 lock 头部带 `packageManagerDependencies` 文档（+158 行，含 pnpm 自身各平台 `@pnpm/exe.*`），**不提交这份 lock，CI 的 `--frozen-lockfile` 会直接失败**；迁移后已实测 12.6.0 / 12.9.1 的 `--frozen-lockfile` 通过。
- **注意**：项目目录历经搬迁，当前根目录为 `/Users/xilejun/dsh-projects/shadcn-admin-cn`（更早记录中的 `WorkBuddy/ds_Harness/shadcn_admin_cn` 已失效）。
- **版本记录**：每个版本的变更/问题/待办记入 **CHANGELOG.md**（含版本对照表）；版本号需与 package.json、侧边栏显示、PROGRESS.md 交叉核对（当前 **0.13.0**）。
- **项目更名**（2026-10-09）：`shadcn-admin-cn` → 仓库/包名 **`tableau-embed-hub`**、显示名 **`Tableau Embed Hub`**（主打「Tableau 嵌入可视化」，品牌唯一来源仍是 `src/config/app.ts`）。localStorage 前缀同步改为 `tableau-embed-hub`，旧 key 保留并由 `src/lib/storage-migration.ts` 一次性迁移；细节见 CHANGELOG「未发布」节。

---

## 🚧 未发布 — TS 7 dev 刷新 + README（中英）排版重做（2026-10-09）

- ✅ **TS 7 原生编译器刷新**：`@typescript/native` → `npm:typescript@7.1.0-dev.20261009.1`（原 `7.1.0-dev.20260930.4`，next 通道当日构建）。
  验证：`tsc -v` 正确；typecheck / lint(0 error) / vitest(113) / check:i18n / check:i18n:keys / check:routes / build 全绿，
  且 **`dist` 产物哈希与升级前完全一致**（换编译器没有改变输出）。
- ✅ **README（中英）排版重做**：
  ① 开头三段提示原属同一个引用块（渲染时挤成一段）→ 拆为「状态段 + 两个独立告示块」（`[!WARNING]` 非官方项目 / `[!CAUTION]` 凭据边界，**凭据边界独立成块换行**）；
  ② 「页面与入口」表格被中间插入的引用块断成两截（表头丢失、后续行另起一表）→ 引用块移到表下、表格合并为一张，
     并补齐漏登记的行：中文补 `/components`，英文补 `/login`、`/config/login`、`/components` 与 Views 落点说明；
  ③ 订正技术栈表的 shadcn/ui 预设（`new-york` → `radix-nova`，与 `components.json` 对齐）、脚本表补 `check:i18n:keys` 与 `check:versions`。
- ✅ **TS 升级路线进 README**：新增「TypeScript 为什么装了两份」小节（两条线各自指向什么、谁在用），并写明**两阶段计划** ——
  ① TS **7.1 正式版**发布后把第一份换成 `npm:typescript@7.1.x` stable（此时仍是两份）；② 等上游 typescript-eslint 支持 TS 7 后**逐步替换 TS 6 线**，
  最终只留一份；判据三条（peer 上限 ≥ 7 / #10940 合入 stable / 实测 `typecheck`+`lint` 同源全绿）与上游 issue 链接一并写明。
- 🔎 **记录一个盲区**：`pnpm check:versions` 只跟 registry 的 `latest` 比对，而当前 pin 是 next 通道的 prerelease（高于 `latest` 7.0.2），
  因此**巡检永远不会提示 TS dev 有新构建** —— 要盯 dev 通道得另看 `next` dist-tag。

## ✅ v0.13.0 — 项目更名 tableau-embed-hub + Help 页第三方版权说明（2026-10-09）

- ✅ **改名落地**：`shadcn-admin-cn` → 仓库/包名 `tableau-embed-hub`、显示名 **Tableau Embed Hub**（`src/config/app.ts` 仍是唯一品牌来源）。
  同步：`package.json` name/description、`index.html` `<title>` + `<meta name="description">`、README ×2、LICENSE 署名、侧边栏注脚、
  AI 默认提示词、i18n 关于正文与 SMTP 发件人占位、nginx 样例。顺手修掉侧边栏**写死** `shadcn-admin`（与 `APP_NAME` 不一致）的历史问题 —— 以后改名只动一个常量。
- ✅ **持久化前缀迁移**：`shadcn-admin-cn:` → `tableau-embed-hub:`（favorites / recents / org / permissions / config 五处 + 两个自定义事件名）。
  `src/lib/storage-migration.ts` 启动时一次性复制、**旧 key 保留不删**（可回滚、已有数据不丢）；四个读写持久化的 store 都 import 它，
  结构上保证「先迁移、后 hydrate」。另有 6 项单测（幂等 / 不覆盖新数据 / 非匹配前缀不动）。
- ✅ **Help 页**：① 侧边栏位置由「紧跟 SMTP」挪到 **Config 分组最末（Components 之后）**；② 新增**「第三方版权与商标」**卡片 ——
  21 项直接依赖的「组件 / 许可 / 版权所有者」表（数据源 `src/config/third-party.ts`，版权字段逐个核对 node_modules 里的 LICENSE）、
  非开源 `@tableau/embedding-api` 的高亮警示、Salesforce 商标归属声明。**说明随发行物走**：使用者拿到的是构建产物，看不到仓库里的 THIRD-PARTY.md。
- ✅ **合规文档**：新增 `THIRD-PARTY.md`（含 embedding API 许可限制与「改为运行时从使用者自己站点加载」的迁移计划）；
  README ×2 首屏加「非官方 / 无担保 / 凭据自负」声明与商标归属。
- ✅ 验证：tsc / eslint（0 error）/ vitest / check:i18n / check:i18n:keys / check:routes / build 全绿；
  `check:permissions` 真实 Chrome **15/15**（含新增三条断言：侧边栏顺序、版权表行数、商标归属文案）。
- ✅ 版本同步 **0.13.0**（package.json / `src/config/app.ts` / README / README.en / PROGRESS / CHANGELOG）；
  0.12.0 内容线与本版合并在同一次提交发布，见 CHANGELOG 版本对照表下方的说明。

## ✅ v0.13.0 — /views 落点：上次打开的视图 → 固定兜底视图（2026-10-09）

- ✅ **点侧边栏 Views（或直接打开 `/t/{slug}/views` 不带参数）**：先落到**上次打开的视图**（recents 第一条，团队作用域），
  找不到就落到固定兜底视图 `VITE_TABLEAU_FALLBACK_VIEW`（新增站点绑定项；缺省 = 演示站点 `Superstore/Overview` = `5959968c-c18b-4ada-bff1-99ac36af1dc1`）。
- ✅ **规则只接管两种入口**：完全没参数、只给了视图 UUID。带 `?workbook=` 或旧式名称参数的链接保持原有解析
  （否则 `check:team-routes` 的「`/views?view=abc` 保留 search 参数」用例会被兜底抢走）。
- ✅ 规则放在**页面**而不是侧边栏链接上：直接输 URL、书签、旧路径 `/views` 重定向、浏览器前进后退都走同一条规则。
- ✅ **删除**空态提示 "Select a workbook and view above, or paste a view URL to embed."（连带词典里的死键 `views.embedEmpty`）——
  页面现在总会先解析出目标视图再嵌入，那句话在兜底也打不开时只会变成误导性死文案。
- ✅ 落点解析抽成纯函数 `src/lib/view-entry.ts`（5 项单测：UUID 优先、取第一条、旧数据退名称、无最近记录用兜底、都没配则不跳）。
- 🎯 决策：兜底视图是**站点内容**，因此与站点绑定同源（`.env.example` / `docs/tableau-setup.md` 都写清"换自己的站点必须改成自己站点上的视图 UUID"）；
  团队前缀用**当前团队**而不是写死 `acme_hq`（在别的团队下也能正常打开，不会跳到别的团队去）。
- ✅ **版面收紧与交互补齐（同日追加）**：① 视图名 + 工作簿名**同一行**（`min-w-0 truncate` 各自截断，标题区从两行变一行）；
  ② 收藏星标从右上角按钮组**移到工作簿名右侧**（改为 ghost 图标按钮，不参与压缩）；
  ③ info 弹层里的 Tableau URL **换行显示**（去掉 `truncate`，改 `break-all`，长 URL 不再顶出下边框）且**可点击跳转**
  （`target="_blank" rel="noreferrer"` + 外链图标，复制按钮保留）；用无头 Chrome 截图逐项目视核对。
- ✅ 验证：tsc / eslint（0 error）/ vitest / check:i18n / check:i18n:keys / check:routes / build 全绿；
  另用无头 Chrome 对四种入口做了**真实站点**核对 —— ①无参数且无最近记录 → `Overview`（兜底，嵌入 src = `…/views/Superstore/Overview`）；
  ②同一浏览器先打开 Product 再进无参数 → `Product`（上次打开）；③不存在的 UUID → `Overview`（兜底）；④`?view=abc` → **不跳转**（旧链接兼容）；且页面上不再出现那句提示。

## ✅ v0.13.0 — Tableau 站点用户与角色 / 定时计划运行情况（2026-10-09）

- ✅ **`/t/{slug}/tableau/users`（站点用户与角色）**：读 `GET /sites/{id}/users`（自动翻页、pageSize=100），
  关键词（登录名/展示名/邮箱）与站点角色筛选、三种空态；对每个用户可用**二次确认弹窗**改站点角色
  （`PUT /sites/{id}/users/{user-id}`，只带 `siteRole` 一个字段）。7 个可分配角色收在一处常量表
  （`lib/tableau-site-roles.ts`，刻意不含 Server 专有的 `ServerAdministrator`；保留旧站点仍在用的 `ExplorerCanPublish`），
  失败按 Tableau 错误码（409014 席位不足 / 400012 组内最低角色 / 400013 无效角色 / 403009 改自己或 Guest / 401002 未授权）给专属文案。
- ✅ **`/t/{slug}/tableau/schedules`（定时计划运行情况，只读）**：三块数据 —— 提取刷新任务（频率人话化 + 下次运行 + 连续失败次数徽章）、
  后台作业（状态/类型/耗时，**对象名按需展开才取** `GET /jobs/{id}`，避免逐行 N+1）、订阅计划（空态正常显示）。
  筛选栏：任务按 id 搜；作业按状态/类型筛（选项由数据里出现过的取值生成，不预置 Tableau 没说过的词汇表）。
- 🎯 **关键决策（都留了理由在代码注释里）**：
  1. **Tableau 是唯一数据源**：站点用户**不镜像**进本地 `org-store`（那是模板的演示账号），「同步」= 重新取一次 REST；
  2. **按能力域申请 JWT scope**（content / site-users / site-tasks），而不是一张全权限令牌 —— 减少无谓暴露，且各域 401/限流互不拖累；
     但**这不是安全边界**：纯前端把密钥内联进 bundle，能拿到产物的人本就能自签任意 scope；
  3. **写入不做乐观更新**：站点角色是许可证属性，服务端可能因席位拒绝，"先显示成功再回滚"会让管理员误以为已改好；
  4. **不自加时间窗、不截断条数**：作业保留期由 Tableau 决定（官方 REST 引用页未承诺任何保留期）；
  5. **固定阈值只有分页 pageSize=100**（Tableau 默认值，已与用户确认）；不轮询，只有手动「同步」+ 5 分钟 staleTime。
- 🔬 **对线上实测（只读 + 一次不改变数据的探测）**：演示站点用户 2 个（`wyp@vizwise.cn` = SiteAdministratorCreator、`dong@vizwise.cn` = Viewer）；
  `/tasks/extractRefreshes` 1 条（每日 23:30、连续失败 5 次）；`/jobs` 4 条 run_flow；`/subscriptions` 0 条；
  **`/schedules` 在 Tableau Cloud 不可用**（403 "此站点不支持管理员计划"），故计划信息一律从任务内联的 schedule 读。
  写通路只做过**授权探测**（以非法 `siteRole` 提交，回 400013 = 鉴权已过、校验失败、数据未变），**未做任何真实写入**（用户明确要求不动线上数据）。
- ✅ **验证**：tsc / eslint（0 error，未新增告警）/ build / vitest（108 项）/ check:i18n / check:i18n:keys / check:routes 全绿；
  另用无头 Chrome（`--dump-dom --virtual-time-budget`）对两页做了**真实数据**核对：用户页 2 行 + 角色原文 + 「You」行禁用改角色 + 筛选/重置；
  计划页 1 条任务（内容名解析为真实工作簿名、`Daily at 23:30`、`5 failures in a row`）、4 条作业（`Flow run`）、订阅空态、
  表头标题取自权限目录、两页均无未翻译 key；改角色弹窗（默认角色、角色说明、Apply role、自身警告）与作业详情（对象名 / 进度 / 完成码）已渲染核对。
- ⚠️ **已知边界**：改角色入口只管"站点角色"，不改姓名/邮箱/口令（站点管理员通过 REST 本就改不了这些）；
  `page.tableau.users` 默认 fail-closed，团队岗位需要时在 `/permissions` 勾选。

## ✅ v0.12.0（2026-10-09）— 登录页模板（3 种样式）+ 联合登录配置（/login、/config/login）

- ✅ **登录页 `/login`（裸布局：不套 App shell、不走权限门禁）**，三种样式可在配置页切换：
  `centered-card`（默认：品牌标识 + 用户名/密码/验证码 + 第三方入口）/ `split-hero`（左 2/3 宣传图 + 右 1/3 面板，
  窄屏收起宣传图）/ `fullscreen-card`（全屏背景图 + 居中卡片 + 遮罩）
- ✅ **登录内容只有一份**（`features/login/login-form.tsx`），模板只负责摆版面；注册表 `templates/registry.tsx` +
  `LOGIN_TEMPLATES` 目录，**新增样式 = 一个文件 + 两行登记**（漏登记 tsc 报错）
- ✅ **路由级版面开关**：`__root.tsx` 扩展 TanStack Router 的 `StaticDataRouteOption`，路由用
  `staticData: { layout: 'bare' }` 声明跳出 shell —— 版面归属是路由元信息，root 不认识具体路径
- ✅ **`/config/login`（`page.config.login`，fail-closed 仅系统管理员）**：样式选择（线框缩略图）、宣传图 URL + 实时缩略图、
  GitHub / Google 公开参数（开关 / Client ID / 授权端点 / 回调 / scope）、实时预检、恢复默认二次确认、新标签页预览
- ✅ **领域层 `src/lib/login.ts`**（纯函数，不依赖 React）：模板目录、provider 目录、脏数据归一化、预检规则
  （error 拦保存 / warning 放行）、状态推导、宣传图解析；`src/lib/login.test.ts` 22 项（含「配置里不含 secret」的安全不变量）
- ✅ **内置宣传图 `public/login-hero.svg`**（离线可用）+ 远程图**加载失败自动退回内置图**
- ✅ **`pnpm check:login`**（`scripts/check-login.mjs`）：规则断言 + **7 项真实 Chrome 用例**（保存→整页刷新→登录页换版面、
  provider 开关与宣传图传到模板、校验不通过不写盘、点第三方入口只提示不跳转、恢复默认回出厂值、`/login` 无侧栏/头部、
  localStorage 无 secret 字段），已接入 CI 的 ui-checks
- ✅ **边界（有意为之）**：不做鉴权（纯前端伪造登录态是安全剧场）、不拦截任何页面、验证码只占位不校验、
  **不收集 Client Secret**（前端存 Secret 等于公开）、本轮不拼 OAuth 跳转链接；接后端契约见 `docs/login-setup.md`
- ✅ 同时并入：`/config` 落点链改为 SMTP → 登录页 → 团队首页；`check-route-catalog` 白名单新增
  「登录前页面」判定与 `/login` 的豁免留痕
- ✅ 验证：tsc / lint（0 error）/ build / vitest（75 项）/ check:i18n / check:i18n:keys / check:routes /
  **check:login（规则断言 + 7/7 页面用例）** 全绿；三种样式与配置页用无头 Chrome 截图逐张核对（含 390px 窄屏）
- ✅ 版本同步 0.12.0（package.json / `src/config/app.ts` / README / PROGRESS / CHANGELOG）

## ✅ v0.11.1（2026-10-08）— 组件总览页（/components）+ 窄屏侧栏宽度修复 + 内容 padding 收紧

- ✅ **组件总览页 `/components`**（`page.components`，跨团队、默认授权给 member；侧边栏 Config → Components）：
  公共件清单 + 实时预览，10 章 / 36 条 —— App shell 规格与主题 token 两章讲"每个页面都要遵守的数值与颜色"，
  其余八章（布局 / 操作 / 表单 / 数据 / 筛选 / 浮层 / 反馈 / 配套 hook）逐条给出 import 路径、一句话用途与
  **可交互预览**（筛选栏含计数与重置、表单失焦才报错、弹窗/抽屉/toast 可点开），关键件附用法片段
- ✅ **`src/config/component-catalog.ts`（唯一数据源）**：纯数据模块、node 脚本可直接 import；
  加一个公共件 = 加一行 +（可选）一个预览组件，章节与顺序由目录驱动
- ✅ **`src/config/component-catalog.test.ts`**：目录不变量进 `pnpm test`（CI 第一段）—— id 唯一、
  每个 `descKey` 都在词典里、`importPath` 指向真实模块、`src/components/ui/*` 原语全部已登记（外壳件白名单写明理由）
- ✅ **规格数值单一来源**：`SIDEBAR_WIDTH` / `SIDEBAR_WIDTH_ICON` / `MOBILE_BREAKPOINT` 改为导出，组件页直接 import
- ✅ **修：窄屏抽屉比桌面侧栏还宽** —— 移动端 `w-(--sidebar-width)` 被 `SheetContent` 自带的
  `data-[side=left]:w-3/4`（特异度 0,2,0 > 0,1,0）盖掉，实际宽度变成 75vw（≥640px 再被 `sm:max-w-sm` 截到 384px），
  而桌面端只有 11rem。修法：宽度类加 `!` + 移动端与桌面共用同一常量（删掉 `SIDEBAR_WIDTH_MOBILE`）；
  无头 Chrome 实测 767px 视口 **384px → 176px**
- ✅ **修：`/teams` 描述列把页面顶宽** —— 补 `whitespace-normal` + `break-words`（1152px 视口实测溢出 35px）
- ✅ **改：主体内容 padding 减半** `p-4 md:p-8` → `p-2 md:p-4`（顶栏同步 `px-2 md:px-4`，窄屏左边缘不再错开 8px）
- ✅ 同时并入：pnpm 11.28.2 → **12.9.1**（CI 同版本，lock 头部新增 `packageManagerDependencies`）、
  **默认团队不可冻结**（铁律 4 扩展）、移除 `My default` / `Current` 徽章、
  只读提示文案统一为 "Only System Admin can …"、开发地址统一 `127.0.0.1:5174`
- ✅ 验证：tsc / lint（0 error）/ build / vitest（53 项）/ check:i18n / check:i18n:keys / check:routes /
  check:filters / check:permissions（真实 Chrome 15/15）全绿；`/components` 用无头 Chrome 实测渲染 10 章 / 36 条
- ✅ 版本同步 0.11.1（package.json / `src/config/app.ts` / README / PROGRESS / CHANGELOG）

## ✅ v0.11.0（2026-10-07）— 依赖版本巡检 + 每周定时检查

- ✅ **`scripts/check-versions.mjs`（`pnpm check:versions`）**：把 `package.json` 里全部依赖逐个跟 registry 的 `latest` 比对，
  并判断 latest 是否**仍在声明范围内** —— 以此区分「`pnpm update` 即可」（范围内）与「要改 `package.json`、可能有破坏性变更」（跨范围）。
  `npm:` 别名依赖按**别名真实目标包**查 registry、按**别名声**读 `node_modules`（两者不同名，混用会读错版本）。
  零第三方依赖（自带最小 semver 实现）；registry 依次取 `--registry` → `npm_config_registry` → 项目/用户 `.npmrc` → npmjs.org；
  40 个依赖约 1 秒跑完；`--md` / `--json` 供文档与周报，`--strict` 在有跨范围升级时退出码 1（0 正常 / 2 脚本自身出错）。
- ✅ **已知暂缓登记**：`package.json` → `checkVersions.hold`（包名 → 理由）。`@types/node` 的 `24 → 26` major 是**故意的**
  （类型线不高于 Node 24 运行时），登记后不再计入「待升级」，改为单独列出 —— 否则每周都会重复误报同一个假警报。
- ✅ **首次巡检（2026-10-04）**：40 个依赖，待升级 **8**，全部在声明范围内（eslint / globals / lucide-react、
  @tanstack/react-query 三件套、shadcn、vite，均为 minor 或 patch），**跨范围 0、major 0**。
- ⏭️ **组件本体漂移另算**：`node_modules/.bin/shadcn add <组件> --diff` 可看 `src/components/ui/*` 与上游 registry 的差异
  （**实测只读**，不会改文件）。当前它对 `button.tsx` 建议把 `import { cn } from "@/lib/utils"` 改成 `from "cn"` ——
  这是**本项目故意的本地约定**，所以该命令只能作参考，不作升级依据。
- ✅ **定时检查**：DSH 会话内每周六 21:00（Asia/Shanghai）触发一次巡检提醒，产出简报并**等确认后再动手**（不自动升级）。
- ✅ 验证：`pnpm check:versions` 实跑（40 依赖 / registry 可达 / 报告可读）✅；本轮随版本一起跑 tsc / lint / build / check:i18n / check:i18n:keys / check:routes / test 全绿
- ✅ 版本同步 0.11.0（package.json / `src/config/app.ts` / README / PROGRESS / CHANGELOG）

## ✅ v0.10.1（2026-10-04）— 默认团队不可删除 + 冻结开关进编辑弹窗 + 修漏键

- ✅ **默认团队（第一个团队）不可删除**：`defaultTeamId()`/`isDefaultTeam()` + `deleteTeam()` 护栏；
  `/teams` 行内删除按钮 disabled + 原因提示；系统级 `Default` 徽章与「我的默认团队」`My default` 徽章区分开
- ✅ **团队编辑对话框新增 `Suspended` 开关**（走 `setTeamSuspended`，顺带重算 activeTeamId）
- ✅ **反向漏键检查** `scripts/check-i18n-keys.mjs`（已接入 CI）：扫 `t('literal')` 是否都在词典里（`check:i18n` 抓不到这类）
- ✅ **修 12 个漏键**：`teams.slug*` 6 个（含过时的 `slugHint` 文案）、`views.tableauUrl/copyUrl/copied/copyFailed`、
  `settings.language`（改用 `profile.language`）
- ✅ 验证：tsc / lint / build / check:i18n(516) / check-i18n-keys(381) ✅ + store 单测 ✅ + 无头 Chrome 端到端 ✅
- ✅ 版本同步 0.10.1（package.json / `src/config/app.ts` / README / PROGRESS / CHANGELOG）

## ✅ v0.10.0（2026-09-23）— 列表筛选栏公共件 + Users 页筛选

- ✅ **公共筛选件** `src/components/filter-bar.tsx`：`FilterBar`（容器：结果计数 + 「有筛选才出现」的重置按钮）、
  `FilterSearch`（带一键清空的搜索框）、`FilterSelect`（字段名 + 当前值的下拉，首项恒为 All）——
  与 `action-bar.tsx` / `form-field.tsx` 同级，**其它列表页直接复用**
- ✅ **筛选状态 hook** `src/hooks/use-list-filters.ts`：`values / set / reset / activeCount / isFiltered / isDirty`
  （默认值只取一次快照；「重置」的目标值与「未筛选」的定义收在一处）
- ✅ **/users 筛选**：登录名搜索（包含匹配、大小写不敏感）+ 状态（Active / Frozen）+ 团队（**按成员关系命中**，不分岗位）；
  三者可叠加，右侧显示 `Showing X of Y` 与「重置筛选」
- ✅ **第三种空态**：有账号但被筛掉 →「No users match the current filters.」+ 一键重置（与「还没有账号」「无权限」严格区分）
- ✅ **i18n**：新增 `filters.*` 命名空间（all / search / clearSearch / clearAll / clearAllHint / showing）+ `users.searchPlaceholder|filterTeam|noMatch`
- ✅ **校验脚本** `scripts/check-filters.mjs`（`pnpm check:filters`）：静态自检（公共件 i18n key、状态选项与文案一一对应）
  + 7 项页面用例（搜索口径 / 组合筛选 / 计数 / 重置 / 三种空态 / 非管理员视角 / 宽窄屏几何断言）
- ✅ 验证：`tsc -b` / `pnpm lint`（0 error）/ `vite build` / `pnpm check:i18n`（461 keys）/ `pnpm check:filters`（7/7）全绿
- ✅ 版本五处同步 0.10.0（package.json / `src/config/app.ts` / README / PROGRESS / CHANGELOG）

### 工具链与依赖同步（2026-10-01 补记，并入未发布的 0.10.0）

- ✅ **TS 7 原生编译器刷新**：`@typescript/native` → `npm:typescript@7.1.0-dev.20260930.4`（原 `7.1.0-dev.20260918.1`）；
  `tsc6` 线（`typescript` → `npm:@typescript/typescript6@6.0.2`）**不动** —— typescript-eslint 的 peer 仍是
  `>=4.8.4 <6.1.0`，**不支持 TS 7，别名结构必须保留**，升级 TS 7 只能动 `@typescript/native`
- ✅ **依赖小版本升级（9 项，全部在 range 内）**：@tanstack/react-router 1.170.38→1.170.41、
  @tanstack/router-plugin 1.168.40→1.168.42、@tanstack/react-query / -devtools / eslint-plugin-query
  5.103.1→5.104.0、vite 8.3.0→8.3.1、lucide-react 1.47.0→1.49.0、react-i18next 17.0.14→17.0.15、
  typescript-eslint 8.70.0→8.71.0（**保持精确锁定**，不改成 `^`）
- ✅ **`@types/node` 26 → 24 线**（`^24.19.0`）：与运行时和 CI 的 Node 24 对齐。原先装 26 的类型却跑在 Node 24 上，
  等于允许写出「类型检查通过、运行时炸」的代码；类型线**不应高于**最低支持的运行时
- ✅ **pnpm 版本收敛**：`package.json` 新增 `"packageManager": "pnpm@11.28.2"`，`ci.yml` 的 `version: 11`
  → `11.28.2`（原先本地 corepack 是 11.10.0、CI 浮动到 11 线最新，两边不一致）
- ✅ **依赖面全量核对（39 项）**：**没有任何包存在更高的大版本**（react 19 / vite 8 / tailwind 4 / eslint 10 /
  i18next 26 / TanStack 1.x·5.x 均已是当前大版本）；`radix-ui` 的 `next` 是 `1.7.0-rc` 预发布，跳过
- ✅ 验证：`tsc -b --force` ✅ / `pnpm lint` ✅（0 error，16 条既有 fast-refresh warning）/ `pnpm build` ✅
  （vite 8.3.1，2491 modules）；另**实测** TS `7.0.2` 稳定版对本项目同样零诊断（保留「7.1 正式版未发布时可回落稳定版」的退路，本次未采用）

### 通用起点：站点绑定 env 化 + 接入文档（2026-10-01 补记，并入未发布的 0.10.0）

- ✅ **品牌可 fork**：Help 用例改为**从 `src/config/app.ts` 读期望值**（原先写死 `xilejun` / `xilejun.com`，
  任何改品牌的 fork 跑 `check:permissions` 必然红）；`APP_WEBSITE_LABEL` 改为由 `APP_WEBSITE` 派生。
  **实测**：改品牌 + 换站点后重新构建，Help 用例仍 ✅。
- ✅ **站点绑定 7 项全部 env 化**：`VITE_TABLEAU_SERVER_URL` / `_SITE_NAME` / `_SITE_CONTENT_URL` /
  `_EMBED_USER` / `_PROJECT` / `_API_VERSION` / `_API_BASE`（原先只有 3 个凭据变量，其余六项硬编码在
  `src/config/tableau.ts` 与 `vite.config.ts` —— 同一个 serverUrl 两份拷贝，改一处忘一处）。
  `vite.config.ts` 改用 `loadEnv`，与运行时**同源读取同一份 `.env`**。
- ✅ **项目过滤缺省规则修正**：演示站点默认 `Samples`；**配了自己的站点则默认不过滤** ——
  原先新人接上自己的站点只会看到 2 个工作簿，且界面上无从归因。
- ✅ **`/help` 新增「Environment check」卡**：显示实际生效的站点、凭据来源（演示 / `.env`）、项目过滤与代理路径；
  `check:permissions` 的 Help 用例已覆盖，并支持 `EXPECT_TABLEAU_SITE_SOURCE` / `EXPECT_TABLEAU_PROJECT`
  两个可选严格断言（用来证明 `.env` 覆盖改变的是**运行时行为**）。
- ✅ 新增 **`docs/tableau-setup.md`**（Connected App 创建 / 域名白名单 / 访问级别 vs REST / 排查表 / 安全边界）
  与 **`deploy/nginx.conf.example`**（REST 反代：`proxy_ssl_server_name`、`Host` 覆盖、SSE 段预留）；
  README 新增「配置自己的 Tableau 站点」「部署」两节，修掉重复的 `## 路线图` 标题并刷新路线图。
- ✅ **公开线移除内部功能宣传**：Help 页原有一条 *Processing flow atlas*（文案点名 FOC / AMRO / clean-layer）
  和一条指向 `docs/flow-page-conventions.md` 的文档入口 —— 两者在公开线都不存在（只在 custom 分支）。
  路径守卫只管路径、管不住文案，这条靠人守；已在 `FEATURES` / `DOCS` 与 i18n 中移除并加注释说明。
- ⏭️ **custom 分支需要对应动作**：Help 页的 flows 卡片与 `docs/flow-page-conventions.md` 入口要在 custom 侧自己维护
  （否则同步 main 后 custom 的 Help 页会少这两项）。

### AI 应用起点（2026-10-01 补记，并入未发布的 0.10.0）

- ✅ **抽象层 `src/lib/ai/`**：`types`（`AiProvider` + `AiError` 错误分类与 `retryable` 语义）、
  `config`（留空 `VITE_AI_PROXY_URL` 即演示模式）、`demo`（零配置演示 provider，输出确定便于断言）、
  `deepseek`（OpenAI 兼容 SSE 流式客户端，**只认同源代理、不带 Key**）、`index`（`resolveAiProvider()`）。
- ✅ **`src/lib/env.ts`**（新）：抽出 `configured / envValue / envOptional`，`tableau.ts` 复用（去掉重复实现）。
  注释写明**为什么不做通用的按名取值** —— Vite 只内联静态引用。
- ✅ **`/ai` 页面 + `use-ai-chat`**：流式渲染、Stop、Retry、Clear、错误分级；失败移除空占位、取消保留内容。
- ✅ **一行接入权限体系**：`page.ai`（global / 新分组 `ai` / 默认授权 member）；
  侧边栏与权限页的分组文案由 `Record<NavGroup, string>` 强制补齐（tsc 报错即提醒，无需靠记忆）。
- ✅ **配置与文档**：`vite-env.d.ts` 3 个变量、`.env.example` 新增「③ AI 能力」段、
  `/help` 自检卡新增 AI 行、`docs/ai-integration.md`（契约 / nginx / 20 行 Node 网关 / 验收清单 / 排查表）、
  Help 文档入口 3 → 4 条。
- ✅ **用例**：新增「AI 页默认授权给成员 + 演示 provider 流式回复」（真实浏览器断言）；
  并修掉「补齐默认授权」把**缺口数写死为 4** 的问题（新增页面后立刻误报）→ 改为从 `ROUTE_CATALOG` 动态计算。
- ⚠️ **Key 边界的落实方式**：前端只发同源代理请求；`docs/ai-integration.md` 与 `.env.example` 都写明
  "Key 只能放网关，`.env` 的值会内联进 bundle"。**没有**任何默认 Key、也没有可用的兜底凭据。

### 起点信誉：静态断言进 CI + 用例跨平台 + 路由级分割 + 单测（2026-10-01 补记，并入未发布的 0.10.0）

- ✅ **`scripts/check-route-catalog.mjs`（`pnpm check:routes`）**：路由文件 ↔ `ROUTE_CATALOG` 一致性。
  路由守卫是 fail-open 的，漏登记 = 静默权限盲区；脚本同时抓「未登记路由」「目录死条目」「白名单腐烂」。
  纯静态、**已进 CI 阻塞步骤**；反向验证过（改坏路径 → 两条都报出来）。
- ✅ **路由级代码分割**：`tanstackRouter({ autoCodeSplitting: true })`，路由文件零改动，
  入口 chunk **1.14MB → 419KB（gzip 133KB）**，Tableau SDK 隔离到按需加载的 views chunk（337KB）。
- ✅ **CDP 用例跨平台**：4 个脚本的 Chrome 路径从硬编码 macOS 改为 `resolveChrome()`
  （`CHROME_PATH` → macOS / Debian-Ubuntu / chromium 常见路径），找不到时给出候选清单。
- ✅ **CI**：主 job 新增 `check:routes` 与 `pnpm test`（静态、阻塞）；
  新增 `ui-checks` job（advisory / `continue-on-error`）跑**全部四套**浏览器用例。
- ⚠️ **`ui-checks` 为什么仍是 advisory**：① 首次在 Linux 上跑，`check:filters` 的几何断言依赖字体渲染；
  ② `check:permissions` 的假通过用例**已于 v0.11.0 修好**（改用 acme_hq 里活跃的 viewer + `switchUser` 断言身份，
  本地 15/15 全绿）—— 只剩字体渲染一条待观察，跑绿几次后即可去掉 `continue-on-error`。
- ✅ **单元测试**：vitest + `pnpm test`（45 用例，0.9s）：环境变量口径、权限通配与作用域语义、
  目录不变量（含**每条 labelKey 是否有文案**）、SMTP 规则与归一化。
- ✅ **社区文件**：CONTRIBUTING / SECURITY / ISSUE_TEMPLATE ×2 / PR 模板。
- ✅ **README 双语**：新增 `README.en.md`，中英互链；同步页面表、脚本表、路线图。
- ✅ **已闭环（v0.11.0）**：`check:permissions` 那条「切到冻结用户 Carol White」的用例已修 ——
  三处改用 acme_hq 里**活跃**的 viewer（Bob Martin），并让 `switchUser` 在切换后**核实身份真的变了**
  （被冻结账号菜单项是 disabled，不核实就会拿上一个身份继续断言）。本地 15/15 全绿。

**刻意的边界**（接后端/后续页面时按需改）：

- **只搜登录名**，不搜展示名与邮箱（登录名是账号主键口径，见 [docs/org-rules.md](./docs/org-rules.md)）；
  要扩到展示名，改 `users.tsx` 里 `visibleUsers` 的那一行判断即可，控件不用动；
- **筛选是视图态**：默认不进 URL（刷新回默认）。要「可分享 / 刷新不丢」时把同一组受控组件接到
  `useSearch` + `navigate({ search })`，公共件本身不用改（已写进 [docs/ui-conventions.md](./docs/ui-conventions.md) §5）；
- 目前只有 `/users` 接入（本版就是为后续列表页立的公共件），未顺带给 `/teams`、Tableau 列表页加筛选。

  并判断 latest 是否**仍在声明范围内** —— 以此区分「`pnpm update` 即可」（范围内）与「要改 `package.json`、可能有破坏性变更」（跨范围）。
  `npm:` 别名依赖按**别名真实目标包**查 registry、按**别名声**读 `node_modules`（两者不同名，混用会读错版本）。
  零第三方依赖（自带最小 semver 实现）；registry 依次取 `--registry` → `npm_config_registry` → 项目/用户 `.npmrc` → npmjs.org；
  40 个依赖约 1 秒跑完；`--md` / `--json` 供文档与周报，`--strict` 在有跨范围升级时退出码 1。
- ✅ **已知暂缓登记**：`package.json` → `checkVersions.hold`（包名 → 理由）。`@types/node` 的 `24 → 26` major 是**故意的**
  （类型线不高于 Node 24 运行时），登记后不再计入「待升级」，改为单独列出 —— 否则每周都会重复误报同一个假警报。
- ✅ **首次巡检（2026-10-04）**：40 个依赖，待升级 **8**，全部在声明范围内（eslint / globals / lucide-react、
  @tanstack/react-query 三件套、shadcn、vite，均为 minor 或 patch），**跨范围 0、major 0**。
- ⏭️ **组件本体漂移另算**：`node_modules/.bin/shadcn add <组件> --diff` 可看 `src/components/ui/*` 与上游 registry 的差异
  （**实测只读**，不会改文件）。当前它对 `button.tsx` 建议把 `import { cn } from "@/lib/utils"` 改成 `from "cn"` ——
  这是**本项目故意的本地约定**，所以该命令只能作参考，不作升级依据。
- ✅ **定时检查**：DSH 会话内每周六 21:00（Asia/Shanghai）触发一次巡检提醒，产出简报并**等确认后再动手**（不自动升级）。

---

## ✅ v0.9.0（2026-09-21）— 团队冻结 + 用户冻结 + 用户必须归属团队

- ✅ **团队冻结**（`OrgTeam.suspended`）：仅系统管理员可进入——切换器对非管理员隐藏、`setActiveTeam` 拒绝、
  `/t/$teamSlug` 守卫给 `TeamSuspended` 兜底页；`/teams` 行内 `PauseCircle`/`Play` 一键冻结/解冻 + `Suspended` 徽章；
  冻结后自动重算 `activeTeamId`（不会停在进不去的团队）
- ✅ **用户冻结**（`freezeUser`，即 `status: disabled`）：无法登录（`setCurrentUser` 拒绝 + 用户菜单禁用并标 `Frozen`）；
  `/users` 行内 `Ban`/`CircleCheck` 一键冻结/解冻；护栏：不能冻结自己、不能冻结最后一名可用管理员
- ✅ **归属不变量**（每个用户至少一个团队）：新建用户默认入**当前团队**(viewer)；无团队可拒绝创建；
  唯一团队不可移除；含「唯一团队成员」的团队不可删除（确认框列出人数）；`persist.migrate` v2→v3 给老数据补归属
- ✅ 新增 `docs/org-rules.md`（三条铁律 + 拦截点 + 接后端映射 + 自查清单）
- ✅ 验证：tsc / lint(0 error) / build / check:i18n(452 keys) ✅；store 单测 20 项 ✅；无头 Chrome 端到端 7 组场景 ✅
- ✅ 版本五处同步 0.9.0（package.json / `src/config/app.ts` / 侧边栏 / README / PROGRESS / CHANGELOG）

## ✅ v0.8.1（2026-09-21）— 侧栏团队切换器只保留团队名称

- ✅ 去掉左上角 team 名称旁的 **default 星标**（窄侧栏挤压标题）；下拉列表内的 `★ Default` 徽章保留
- ✅ 去掉左上角的 **team 说明文字**（原第二行 description）；名称单行 `truncate`
- ✅ 验证：`tsc -b` / `pnpm lint` / `vite build` / `check:i18n` + 无头 Chrome 断言侧栏仅剩名称（说明文字不再出现在 DOM）
- ✅ 版本五处同步 0.8.1（package.json / `src/config/app.ts` / 侧边栏 / PROGRESS.md / CHANGELOG.md）

## ✅ v0.8.0（2026-09-21）— Users 页补齐登录名与重置口令，状态口径收敛

来自 order-center 那条线的回灌（只回灌与后端无关的部分，模板保持纯前端开箱即跑）：

- ✅ **账号新增「登录名」**（`OrgUser.username`）：列表新增一列、新建表单必填、
  唯一性校验（`usernameIssue`，大小写不敏感，与后端 `USERNAME_PATTERN` 同口径）
- ✅ **「重置口令」独立入口 + `ResetPasswordDialog`**：管理员重置不需要旧口令、
  两次输入 + 最短 8 位；**口令不进前端状态**（演示态只记 `passwordUpdatedAt` 时间戳）
- ✅ **状态口径收敛为 `active` / `disabled`**（去掉 `invited` / `inactive`）：
  接后端时类型不用改；旧 localStorage 数据由 `persist.migrate` v1→v2 自动迁移
- ✅ 空态区分「无权限」与「真的没有账号」（原先两者都显示「No users yet」）
- ✅ 版本五处同步 0.8.0（package.json / `src/config/app.ts` / 侧边栏 / PROGRESS.md / CHANGELOG.md）

**未搬**（刻意）：api 层 / session-store / team-store / AuthContext（要后端才有意义）、
`RefreshBar` / `PageToolbar`（模板里没有这两个通用件）。详见 CHANGELOG 的 0.8.0 一节。

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
| 3 | 依赖安装 | `pnpm install` 成功，关键版本：**typescript 7.1.0-dev.20260815.1（next 标签，自 7.0.2 升级）**、vite 8.2.1、react 19.2.8、tailwindcss 4.3.3、@tanstack/react-router 1.170.29、@tanstack/router-plugin 1.168.32、i18next 26.3.6（**骨架期快照**；各依赖此后已多次升级，TS 现锁 7.1.0-dev.20260930.4，见 v0.10.0 的「工具链与依赖同步」） |
| 4 | 环境问题修复 | ① npm 缓存目录 root 权限损坏 → 用 `npm_config_cache=/tmp/npmcache` 绕过（后该目录也损坏，npm 查询改用 curl 直查 registry）；② pnpm dlx 缓存被沙箱拦截 → 改为本地安装 shadcn CLI（4.18.0）；③ `pnpm-workspace.yaml` 占位文件修复为 `allowBuilds: '@swc/core': true`，SWC postinstall 正常 |
| 5 | 定位 shadcn 4.18 变更 | 新版 CLI 的 `-b` 参数从"基础色（slate）"改为"组件库选择"：`radix | base | aria`——需用 `-b radix`；init 另需 `-p nova` 预设（默认交互式弹菜单） |
| 6 | 版本/范围调整 | TypeScript 切到 **7.1.0-dev.\***（next 标签，**现锁 7.1.0-dev.20261009.1**；升级开发版**只能动 `@typescript/native`**，命令见「日常开发命令」——写 `pnpm add -D typescript@next` 会把 lint 用的 TS 6 API 别名线顶掉）；i18n 范围收敛为**仅 en-US**（zh-CN / zh-TW / ja-JP 后期扩展），index.html lang=en |
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

1. 等 typescript-eslint 支持 TS 7（上游 [#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940) 关闭）后**去掉 TS 6 别名线**：
   把 `typescript` 换回 `typescript@^7`，`tsc6` 与 `@typescript/native` 两套合一；在此之前别名结构不能删；
2. 多语言扩展（zh-CN / zh-TW / ja-JP）：新增 `src/i18n/locales/<lang>/common.json` + i18n 配置加资源；
3. 组件补充（如 data-table、form 等）、真实数据层（mock → API/DB）；
4. 其它列表页接入筛选栏公共件（`/teams`、Tableau 的 workbooks / views / favorites / recents）——
   控件与状态 hook 已就绪，页面只需写「筛什么、怎么匹配 + 第三种空态」。

## 🚧 阻塞点（Blockers）

- **npm 缓存损坏**（机器级，2026-10-01 复查仍存在）：`~/.npm` 含 root 属主文件导致 `EPERM ... _cacache`，绕行目录 `/tmp/npmcache` 也已损坏；
  **npm 命令（`npm view` / `npm audit` 等）一律不可用**。绕法：查版本用 `node` 直连 registry（`fetch("https://registry.npmmirror.com/<pkg>")`），
  pnpm 有独立 store（`.pnpm-store/` 在项目内）不受影响。永久修复：`sudo chown -R 502:20 ~/.npm`（需用户自己操作）。
- **`pnpm audit` 在 npmmirror 上不可用**：`ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS`（镜像不实现 `/-/npm/v1/security/advisories/bulk`）。
  要做安全审计需临时指定官方源：`pnpm audit --registry=https://registry.npmjs.org`。**本项目的依赖漏洞状态因此尚未核验过**。
- **`pnpm dlx` 被沙箱拦截**：`EPERM mkdir ~/Library/Caches/pnpm/dlx`（缓存目录在工作区外）。
  需要试跑某个包的 CLI 时，改用「下 tarball 到工作区内临时目录 + 直接执行」（本次验证 TS 7.0.2 稳定版即用此法）。
- **corepack 装 packageManager 指定的版本要绕官方源**：`packageManager: pnpm@11.28.2` 加好后，
  corepack 默认去 `registry.npmjs.org` 下载，本机被 TLS 代理拦截（`ERR_TLS_CERT_ALTNAME_INVALID`，证书是 IP 自签）。
  绕法：`COREPACK_NPM_REGISTRY=https://registry.npmmirror.com pnpm --version`（装一次即入 `~/.cache/node/corepack`，之后正常使用）。
- **`pnpm check:permissions` 的「切到冻结用户」假通过（2026-10-01 记录 → v0.11.0 已修）**：失败的用例是
  「整列「Clear」→ viewer 只剩底座页面」，根因**不在应用**而在用例 —— 它 `switchUser('Carol White')`，
  而 Carol 的种子状态是 `status: 'disabled'`（**刻意保留，用于演示冻结用户**），
  `setCurrentUser` 按设计拒绝切换（`org-store.ts:524`），用例未察觉切换失败就继续断言，
  于是断言落在 Admin 身份上。**连带影响**：另两处同样切到 Carol 的用例
  （`check-permissions.mjs:491`「重置全部授权」、`:532`「补齐默认授权」）因此变成**假通过**。
  **修法（已实施）**：把这三处换成 acme_hq 里**活跃的** viewer（Bob Martin，`userId=3`），并让 `switchUser`
  在切换后核实身份真的变了（失败即抛错，不再静默用旧身份跑断言）。另有两点曾加剧它长期没被发现：**CI 不跑这套用例**，
  且 4 个 CDP 脚本硬编码 `/Applications/Google Chrome.app/...`（ubuntu runner 起不来）—— 这两点已在 2026-10-01 修掉
  （`resolveChrome()` + `ui-checks` job 已跑起来，才暴露出本条）。
- **typescript-eslint 不支持 TS 7**（上游 [#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)，8.71.0 的 peer 仍是 `>=4.8.4 <6.1.0`）：
  **`pnpm lint` 已可用**（靠「TS 6 API 并行」别名结构，见 package.json），代价是**必须保留两条 TS 线**；
  在上游支持前，不要试图合并成单一 `typescript` 依赖。
- ~~沙箱权限~~（已解决）：当前会话工作区即项目目录，workspace-write 模式已覆盖全部写入。

## 日常开发命令

```bash
cd /Users/xilejun/dsh-projects/shadcn-admin-cn

pnpm dev          # 开发服务器（http://127.0.0.1:5174）
pnpm build        # 类型检查（tsc -b）+ 生产构建
pnpm check:i18n   # 校验语言词典 key 对齐（当前 en-US）
pnpm check:filters # 列表筛选栏（静态自检 + 7 项页面用例；需先 pnpm build）
pnpm typecheck    # 仅类型检查
pnpm lint         # ESLint（走 TS 6 API 别名线 `tsc6`，不是 `tsc`）

# 添加新组件（radix 库 + nova 预设；根 tsconfig.json 已有 @ 别名映射）
pnpm exec shadcn add -y <component-name>

# 升级 TS 7 原生编译器（开发版）：必须动 @typescript/native 这个别名，
# 不能写 pnpm add -D typescript@next —— 那会把 lint 用的 TS 6 API 别名线顶掉
pnpm add -D --save-exact "@typescript/native@npm:typescript@next"
./node_modules/.bin/tsc --version   # 确认版本，然后 pnpm typecheck
```

**工具链版本核对**（改动任一版本号时四处对齐）：`package.json` 的 `packageManager` ↔ `.github/workflows/ci.yml` 的 `version`；
`@types/node` 大版本 ↔ 本地/CI 的 Node 大版本（`.github/workflows/ci.yml` 的 `node-version`）。