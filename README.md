# Tableau Embed Hub

> English version: [README.en.md](./README.en.md)

开源的多团队管理后台 + **Tableau 嵌入可视化**起点：把 Tableau Cloud / Tableau Server 的工作簿与视图嵌进你自己的产品 ——
团队作用域路由、页面级权限、i18n、AI 对话页与部署样例都已在位。基于 shadcn/ui + Tailwind CSS v4 + Radix UI 从零构建（不是别的模板的 fork）。

> ⚠️ **非官方项目**：与 Salesforce, Inc. 无隶属、授权或赞助关系；Tableau 与 Tableau Cloud 是 Salesforce, Inc. 的商标（详见 [THIRD-PARTY.md](./THIRD-PARTY.md)）。
> 软件按「现状」提供，不附带任何担保，也不提供支持承诺 —— 使用者需自行遵守 Salesforce 的相关条款。
> ⚠️ **凭据边界**：纯前端应用，`.env` 与内置演示凭据**都会被内联进构建产物**，部署前请先读 [SECURITY.md](./SECURITY.md)。

> 当前状态：Phase 1–2 已完成；**Phase 3「通用起点」**（站点绑定全部走 `.env` + 部署样例 + 环境自检）与
> **Phase 4「AI 起点」**（`/ai` 页面 + 零配置演示 provider + 代理契约）已就绪；i18n 当前仅 en-US。

## 版本

当前版本：**0.13.0** ｜ 变更记录见 [CHANGELOG.md](./CHANGELOG.md)（含遗留问题与待办，跨文件核对：package.json / 侧边栏 / PROGRESS.md）

## 技术栈

| 层 | 选型 | 版本 |
| --- | --- | --- |
| 框架 | React | 19.x |
| 语言 | TypeScript | 7.1.0-dev.20260930.4（原生编译器；lint 另走 TS 6 API 别名，见下） |
| 构建 | Vite | 8.x |
| 样式 | Tailwind CSS v4 + shadcn/ui（new-york） | 4.x |
| 组件底层 | Radix UI | 最新 |
| 路由 | TanStack Router（文件路由） | 1.x |
| 数据请求 | TanStack Query | 5.x |
| 国际化 | i18next + react-i18next | 26.x（当前仅 en-US，后期扩展） |
| 包管理 | pnpm | 12.9.1（`package.json` 的 `packageManager` 锁定，CI 同版本） |
| 运行时 | Node.js | 24（本地与 CI 一致，`@types/node` 对齐 24 线） |

> **TypeScript 为什么装了两份**：`@typescript/native` → `npm:typescript@7.1.0-dev…` 提供 `tsc`，
> `typecheck` / `build` 用它（TS 7 原生编译器）；`typescript` → `npm:@typescript/typescript6@6.0.2`
> 提供 `tsc6`，**只**给 typescript-eslint 解析用 —— 其 peer 范围是 `>=4.8.4 <6.1.0`，尚不支持 TS 7
> （上游 [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)），
> 所以**这两条线都要留着**，升级 TS 7 要动 `@typescript/native`，不要动 `typescript`。

## 快速开始

```bash
pnpm install
pnpm dev
```

## 配置自己的 Tableau 站点

**只改 `.env`，不用改代码。** 完整步骤（含 Connected App 创建、域名白名单、排查表）见
[docs/tableau-setup.md](./docs/tableau-setup.md)。

```bash
cp .env.example .env      # .env 已被 .gitignore 排除
# 填「站点绑定」三项 + 「凭据」三项，然后重新构建
```

| 你想要 | 改哪里 |
| --- | --- |
| 换站点（地址 / Site name / 站点内容 URL / 嵌入用户） | `.env` 的 `VITE_TABLEAU_SERVER_URL` / `_SITE_NAME` / `_SITE_CONTENT_URL` / `_EMBED_USER` |
| 换 Connected App 凭据 | `.env` 的 `VITE_TABLEAU_CLIENT_ID` / `_SECRET_ID` / `_SECRET_VALUE` |
| 只显示某个项目 / 取消项目过滤 | `.env` 的 `VITE_TABLEAU_PROJECT`（留空 = 不过滤） |
| REST 代理路径（要和生产反代一致） | `.env` 的 `VITE_TABLEAU_API_BASE`（默认 `/tableau-proxy`） |
| REST API 版本 | `.env` 的 `VITE_TABLEAU_API_VERSION`（默认 `3.23`） |
| 品牌名 / 开发者 / 站点链接 | `src/config/app.ts`（唯一来源，测试也读它） |

- **开箱即用**：什么都不配也能跑 —— 应用使用内置的**演示站点 + 演示凭据**（仅供演示）。
- **看当前生效值**：应用内 `/help` → 「Environment check」卡片会显示站点、凭据来源（演示 / `.env`）、项目过滤与代理路径。
- ⚠️ **安全边界**：纯前端应用，`.env` 与内置凭据**构建后都会内联进 JS bundle**，混淆只防明文扫描、**不构成加密**。真正的访问控制依赖 Tableau Cloud 后台的 Connected App 域名白名单、访问级别限制与密钥轮换；如需彻底隐藏密钥，请把 JWT 签发迁移到后端。

## 部署

`pnpm build` 产出纯静态资源（`dist/`），可直接丢给任意静态托管；**唯一必须自己配的是 REST 反代**（Tableau Cloud REST 不支持 CORS）：

1. 把 `dist/` 交给静态托管（CDN / nginx / S3+CDN 均可）；
2. 按 [deploy/nginx.conf.example](./deploy/nginx.conf.example) 把 `/tableau-proxy` 反代到你的站点（路径要与 `VITE_TABLEAU_API_BASE` 一致）；
3. 在 Connected App 里把生产域名加进 Trusted Sites。

> 嵌入用的 iframe 直连 Tableau，**不经过**反代；反代只服务 REST（列表、缩略图、`auth/signin`）。
> 前端路由是 history 模式，静态托管需配置「未命中回退到 `index.html`」。

## 页面与入口

| 页面 | 路由 | 入口 | 默认可见角色 |
| --- | --- | --- | --- |
| 工作区（Dashboard / Favorites / Recents / Workbooks / Views） | `/t/{slug}/...` | 侧边栏 General | 团队成员（按岗位） |
| Tableau 站点用户与角色 | `/t/{slug}/tableau/users` | 侧边栏 General | **仅系统管理员**（fail-closed；它写的是站点级角色） |
| Tableau 定时计划运行情况 | `/t/{slug}/tableau/schedules` | 侧边栏 General | 团队成员（按岗位，只读） |

> 点侧边栏 **Views**、或直接打开 `/t/{slug}/views`（不带参数）时的落点：**上次打开的视图** →
> 解析不到就用固定兜底视图（`VITE_TABLEAU_FALLBACK_VIEW`，缺省是演示站点上的 `Superstore/Overview`）。
> 带 `?workbook=` / `?view=` 参数的链接仍按参数打开（旧链接行为不变）。
| AI 对话 | `/ai` | 侧边栏 AI | 全体成员（未配代理时走内置演示 provider） |
| 用户 / 团队 / 权限 | `/users`、`/teams`、`/permissions` | 侧边栏 Settings | 成员（权限页仅系统管理员） |
| 个人资料 | `/profile` | **左下角用户菜单** | 全体成员（v0.7.0 起由 `/settings` 改名） |
| SMTP 邮件服务 | `/config/smtp` | 侧边栏 Config | 仅系统管理员（fail-closed） |
| 登录页 | `/login` | 直达 / 配置页的「Open preview」 | **无需权限**（登录前页面，裸布局） |
| 登录页配置 | `/config/login` | 侧边栏 Config | 仅系统管理员（fail-closed） |
| 帮助 / 关于 | `/help` | 侧边栏 Config（**分组最末，排在 Components 之后**） | 全体成员（核心功能、开发者、版本号、第三方版权与商标） |

## 脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 类型检查（tsc -b）+ 生产构建 |
| `pnpm lint` | ESLint 检查 |
| `pnpm typecheck` | 仅类型检查 |
| `pnpm test` | 纯函数用例（vitest：权限语义 / 目录不变量 / SMTP 规则 / 环境变量口径，毫秒级、不需要浏览器） |
| `pnpm check:i18n` | 校验语言词典 key 对齐（当前仅 en-US） |
| `pnpm check:routes` | 路由文件 ↔ 权限目录一致性（路由守卫是 fail-open 的，漏登记 = 权限盲区；纯静态、已进 CI） |
| `pnpm check:team-routes` | 团队 slug 路由校验（Chrome CDP，16 用例；需先 `pnpm build`） |
| `pnpm check:permissions` | 页面权限校验（目录静态自检 + 用例；需先 `pnpm build`） |
| `pnpm check:filters` | 列表筛选栏校验（i18n/选项来源静态自检 + 7 项页面用例，含宽窄屏几何断言；需先 `pnpm build`） |
| `pnpm check:smtp` | SMTP 配置校验（规则断言 + 6 项页面用例；需先 `pnpm build`） |
| `pnpm check:login` | 登录页校验（领域层规则断言 + 7 项页面用例：换样式 / provider 开关 / 校验拦截 / 恢复默认；需先 `pnpm build`） |

## 前端开发约定（v0.7.0 起）

新增页面/表单请直接用通用件，不要各自发明版面与接线（完整说明见 [docs/ui-conventions.md](./docs/ui-conventions.md)）：

| 通用件 | 作用 |
| --- | --- |
| `PageContainer` | 页面根容器：全站页面宽度一致（**不要在页面级写 `max-w-*`**） |
| `FormGrid` / `FormField` | 表单栅格与字段（label/`aria-invalid`/`aria-describedby`/说明行一次接好；窄栏加在表单上而非页面上） |
| `useFormTouch` | 校验显示时机：失焦才报该字段、点保存后全报（**主操作不要因校验错误而置灰**） |
| `FilterBar` / `FilterSearch` / `FilterSelect` + `useListFilters` | 列表页筛选栏：搜索 / 下拉 / 结果计数 / 一键重置（**有筛选才出现重置**；空态要区分「没数据」与「被筛掉」） |
| `NoteCallout` | 说明 / 注意事项块（info / warning 两种语气） |
| `DescriptionList` | 「标签 + 值」摘要 |
| `ActionBar` / `ActionButtons` | 操作按钮（主操作恒在最右，窄屏堆叠） |

两条被踩过的坑：① 表格的 `TableHead`/`TableCell` 默认 `whitespace-nowrap`，长文案列要显式
`whitespace-normal` 并给列宽，否则表格会顶宽整页（`SidebarInset`/`main` 已有 `min-w-0` 兜底，
过宽内容改为在卡片内部滚动）；② 复合控件（`Select`/`InputGroup`）不落 DOM，`FormField` 传
`injectProps={false}` 并自行把 `id`/`aria-*` 写到真实节点上。

## 页面权限（v0.6.0 起）

角色 × 路由的页面级权限：在 `/permissions` 按角色勾选可访问的页面（默认只有系统管理员可见该页），侧边栏入口过滤与 URL 直达拦截同时生效。路由目录集中在 `src/config/permissions.ts`，**新增页面只登记一行**即可进入这套体系（详见 [docs/route-permissions.md](./docs/route-permissions.md)）。按钮级权限本版仅预留 `action.*` 命名空间，未实现。

入口不在侧边栏的页面（如 Profile：`navHidden: true`）同样登记在目录里并按 `useCan()` 过滤入口 —— 入口换位置不产生权限盲区。

> ⚠️ 前端权限只控制可见性与直达，**不是安全边界**；接入后端后必须由接口再校验一次。

## AI 对话（v0.10.0 起）

`/ai` 是一个能跑的对话页，provider 只在一处可换（`src/lib/ai`）。**零配置时**走内置演示 provider
（本地流式、不发任何请求）；把 `VITE_AI_PROXY_URL` 指向一个同源网关（实现 OpenAI 兼容的
`POST /chat/completions` 流式接口 —— DeepSeek / OpenAI / 多数网关都符合）即可换成真实模型。

> ⚠️ **API Key 绝不进前端**：`.env` 里的值会内联进 bundle，所以页面只发同源代理请求、不带任何 Key。
> 契约、nginx 样例与约 20 行 Node 网关见 [docs/ai-integration.md](./docs/ai-integration.md)。

## 系统配置（v0.7.0 起）

`/config/smtp` 提供标准的 SMTP 配置：服务商预设（QQ / 163 / Gmail / 阿里企业邮 / 腾讯企业邮 / Microsoft 365）一键回填、7 项实时预检（错误拦保存、提醒放行）、密码留空即保持原密码、重置带二次确认。

> ⚠️ **密码不落盘**：本模板是纯前端，浏览器侧「加密后存 localStorage」的密钥必然随 bundle 一起发出，等于安全剧场 —— 因此只持久化非敏感字段，密码仅存内存（刷新需重填）。接入后端后应改为服务端加密存储、接口只回 `hasPassword`。
>
> ⚠️ **预检 ≠ 真实连通性**：浏览器开不了 SMTP 套接字，真实握手（EHLO → STARTTLS → AUTH）必须服务端执行（`nodemailer` 的 `transporter.verify()`）。

## 登录页（v0.12.0 起）

`/config/login` 选登录样式（`centered-card` / `split-hero` / `fullscreen-card`）、配宣传图，
并管理 GitHub / Google 第三方入口的**公开参数**；`/login` 按配置渲染，可直达、可预览。

> ⚠️ **登录页这一版是 UI 模板**：`/login` **不拦截**任何页面、不创建会话（纯前端伪造登录态是安全剧场）；
> 验证码是占位；**不收集 Client Secret**（前端存 Secret 等于公开）。接后端的完整契约
>（会话 / 验证码 / OAuth 回调）见 [docs/login-setup.md](./docs/login-setup.md)。

## 路线图

- [x] Phase 0：脚手架 + TS 7 工具链验证 + i18n 框架（en-US）+ CI
- [x] Phase 1：布局（侧边栏/头部）+ 工作区页面（Dashboard / Tableau 四页）+ 组织管理（用户 / 团队 / 权限）+ 个人资料 + Config（SMTP）+ 帮助页 + 前端通用件
- [x] Phase 2：列表筛选栏公共件（`/users` 先行）+ 依赖与工具链对齐
- [x] Phase 3：**通用起点**（站点绑定全部 env 化 / 部署样例 / 环境自检 / 英文 README）
- [x] Phase 4：**AI 应用起点**（`src/lib/ai` 抽象 + 流式客户端 + 零配置演示 provider + `/ai` 页面 + 代理契约）
- [ ] Phase 5（可选）：SQLite 后端（Drizzle）+ 双库（SQLite/Postgres）CI 矩阵；JWT 签发下沉到后端
- [ ] 发布 v1：纯前端可运行模板 + 中英双语文档 + 演示站

## 许可

MIT License

