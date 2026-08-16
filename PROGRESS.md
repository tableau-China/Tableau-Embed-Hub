# shadcn-admin-cn 项目进度（PROGRESS）

> 更新于 2026-08-16 ｜ 项目根目录：`/Users/xilejun/WorkBuddy/ds_Harness/shadcn_admin_cn`

## 项目概况

- **目标**：从零构建管理后台模板（React 19 + TypeScript 7 + Vite 8 + Tailwind CSS v4 + shadcn/ui(Radix) + TanStack Router），包含 shadcn-admin 的全部基础功能，**不含** Tableau / AI / 多团队功能；i18n 当前仅 **en-US**，中文/日文后期扩展。
- **关键决策**：跳过 shadcn-admin 模板（无 Sat Naing 署名义务）、TypeScript 7.1.0-dev（next 开发版，验证未来升级，正式版发布后直接升级）、Vite 8.2.1 最新稳定、i18n 当前仅 en-US（zh-CN / zh-TW / ja-JP 后期扩展）。
- **注意**：用户原指定路径 `/Users/xilejun/ds_Harness/shadcn_admin_cn` 不存在，实际目录在 `/Users/xilejun/WorkBuddy/ds_Harness/shadcn_admin_cn`。
- **版本记录**：每个版本的变更/问题/待办记入 **CHANGELOG.md**（含版本对照表）；版本号需与 package.json、侧边栏显示、PROGRESS.md 交叉核对（当前 **0.2.1**）。

---

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