# shadcn-admin-cn

基于 shadcn/ui + Tailwind CSS v4 + Radix UI 从零构建的管理后台模板（当前仅英文，多语言后期扩展）。

> 当前状态：Phase 1 进行中 —— 布局、多团队工作区（含团队冻结）、全局用户（含用户冻结）、页面级权限、个人资料、系统配置（SMTP）与帮助页已就绪；i18n 当前仅 en-US。

## 版本

当前版本：**0.9.0** ｜ 变更记录见 [CHANGELOG.md](./CHANGELOG.md)（含遗留问题与待办，跨文件核对：package.json / 侧边栏 / PROGRESS.md）

## 技术栈

| 层 | 选型 | 版本 |
| --- | --- | --- |
| 框架 | React | 19.x |
| 语言 | TypeScript | 7.1.0-dev（原生编译器，开发版验证，正式版发布后升级） |
| 构建 | Vite | 8.x |
| 样式 | Tailwind CSS v4 + shadcn/ui（new-york） | 4.x |
| 组件底层 | Radix UI | 最新 |
| 路由 | TanStack Router（文件路由） | 1.x |
| 数据请求 | TanStack Query | 5.x |
| 国际化 | i18next + react-i18next | 26.x（当前仅 en-US，后期扩展） |

## 快速开始

```bash
pnpm install
pnpm dev
```

## 凭据配置（Tableau Connected App）

- **开箱即用**：未配置环境变量时，应用自动使用内置的混淆开发凭据（仅供开发演示，控制台会输出提示）。
- **覆盖方式**（推荐，用于自有凭据）：复制 `.env.example` 为 `.env`，填入 Tableau Cloud → 已连接应用中的 `clientId` / `secretId` / `secretValue`。`.env` 已被 `.gitignore` 排除，不会进入 git。
- ⚠️ **安全边界**：本应用为纯前端，凭据（含内置混淆值）构建后会内联进 JS bundle，混淆仅防明文扫描、**不构成加密**。真正的访问控制依赖 Tableau Cloud 后台的 Connected App 域名白名单、访问级别限制与密钥轮换；如需彻底隐藏密钥，请将 JWT 签发迁移到后端。

## 页面与入口

| 页面 | 路由 | 入口 | 默认可见角色 |
| --- | --- | --- | --- |
| 工作区（Dashboard / Favorites / Recents / Workbooks / Views） | `/t/{slug}/...` | 侧边栏 General | 团队成员（按岗位） |
| 用户 / 团队 / 权限 | `/users`、`/teams`、`/permissions` | 侧边栏 Settings | 成员（权限页仅系统管理员） |
| 个人资料 | `/profile` | **左下角用户菜单** | 全体成员（v0.7.0 起由 `/settings` 改名） |
| SMTP 邮件服务 | `/config/smtp` | 侧边栏 Config | 仅系统管理员（fail-closed） |
| 帮助 / 关于 | `/help` | 侧边栏 Config（排在 SMTP 之后） | 全体成员（核心功能、开发者、版本号） |

## 脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 类型检查（tsc -b）+ 生产构建 |
| `pnpm lint` | ESLint 检查 |
| `pnpm typecheck` | 仅类型检查 |
| `pnpm check:i18n` | 校验语言词典 key 对齐（当前仅 en-US） |
| `pnpm check:team-routes` | 团队 slug 路由校验（Chrome CDP，16 用例；需先 `pnpm build`） |
| `pnpm check:permissions` | 页面权限校验（目录静态自检 + 12 用例；需先 `pnpm build`） |
| `pnpm check:smtp` | SMTP 配置校验（规则断言 + 6 项页面用例；需先 `pnpm build`） |

## 前端开发约定（v0.7.0 起）

新增页面/表单请直接用通用件，不要各自发明版面与接线（完整说明见 [docs/ui-conventions.md](./docs/ui-conventions.md)）：

| 通用件 | 作用 |
| --- | --- |
| `PageContainer` | 页面根容器：全站页面宽度一致（**不要在页面级写 `max-w-*`**） |
| `FormGrid` / `FormField` | 表单栅格与字段（label/`aria-invalid`/`aria-describedby`/说明行一次接好；窄栏加在表单上而非页面上） |
| `useFormTouch` | 校验显示时机：失焦才报该字段、点保存后全报（**主操作不要因校验错误而置灰**） |
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

## 系统配置（v0.7.0 起）

`/config/smtp` 提供标准的 SMTP 配置：服务商预设（QQ / 163 / Gmail / 阿里企业邮 / 腾讯企业邮 / Microsoft 365）一键回填、7 项实时预检（错误拦保存、提醒放行）、密码留空即保持原密码、重置带二次确认。

> ⚠️ **密码不落盘**：本模板是纯前端，浏览器侧「加密后存 localStorage」的密钥必然随 bundle 一起发出，等于安全剧场 —— 因此只持久化非敏感字段，密码仅存内存（刷新需重填）。接入后端后应改为服务端加密存储、接口只回 `hasPassword`。
>
> ⚠️ **预检 ≠ 真实连通性**：浏览器开不了 SMTP 套接字，真实握手（EHLO → STARTTLS → AUTH）必须服务端执行（`nodemailer` 的 `transporter.verify()`）。

## 路线图

## 路线图

- [x] Phase 0：脚手架 + TS 7 工具链验证 + i18n 框架（en-US）+ CI
- [ ] Phase 1：布局（侧边栏/头部）+ Dashboard/Users/Tasks/Settings 页面 + mock 数据层范式
- [ ] Phase 2（可选）：SQLite 后端（Drizzle）+ 双库（SQLite/Postgres）CI 矩阵
- [ ] 发布 v1：纯前端可运行模板 + 中文文档 + 演示站

## 许可

MIT License

