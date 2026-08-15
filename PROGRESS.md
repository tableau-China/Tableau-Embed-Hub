# shadcn-admin-cn 项目进度（PROGRESS）

> 更新于 2026-08-16 ｜ 项目根目录：`/Users/xilejun/WorkBuddy/ds_Harness/shadcn_admin_cn`

## 项目概况

- **目标**：从零构建管理后台模板（React 19 + TypeScript 7 + Vite 8 + Tailwind CSS v4 + shadcn/ui(Radix) + TanStack Router），包含 shadcn-admin 的全部基础功能，**不含** Tableau / AI / 多团队功能；i18n 当前仅 **en-US**，中文/日文后期扩展。
- **关键决策**：跳过 shadcn-admin 模板（无 Sat Naing 署名义务）、TypeScript 7.1.0-dev（next 开发版，验证未来升级，正式版发布后直接升级）、Vite 8.2.1 最新稳定、i18n 当前仅 en-US（zh-CN / zh-TW / ja-JP 后期扩展）。
- **注意**：用户原指定路径 `/Users/xilejun/ds_Harness/shadcn_admin_cn` 不存在，实际目录在 `/Users/xilejun/WorkBuddy/ds_Harness/shadcn_admin_cn`。

---

## ✅ 已完成（Done）

| # | 事项 | 说明 |
| --- | --- | --- |
| 1 | 方案评估 | 确定从 shadcn/ui + Tailwind + Radix 从零重建，避开老仓库（pg-explorer）的密钥历史与版权污染 |
| 2 | 骨架文件 | 写入 14 个基础文件：package.json、tsconfig×3、vite.config.ts、index.html、.gitignore、README.md、LICENSE（MIT）、eslint.config.js、.github/workflows/ci.yml、scripts/check-i18n.mjs、src/index.css、src/vite-env.d.ts |
| 3 | 依赖安装 | `pnpm install` 成功，关键版本：**typescript 7.1.0-dev.20260815.1（next 标签，自 7.0.2 升级）**、vite 8.2.1、react 19.2.8、tailwindcss 4.3.3、@tanstack/react-router 1.170.29、@tanstack/router-plugin 1.168.32、i18next 26.3.6 |
| 4 | 环境问题修复 | ① npm 缓存目录 root 权限损坏 → 用 `npm_config_cache=/tmp/npmcache` 绕过；② pnpm dlx 缓存被沙箱拦截 → 改为本地安装 shadcn CLI（4.18.0）；③ `pnpm-workspace.yaml` 占位文件修复为 `allowBuilds: '@swc/core': true`，SWC postinstall 正常 |
| 5 | 定位 shadcn 4.18 变更 | 新版 CLI 的 `-b` 参数从"基础色（slate）"改为"组件库选择"：`radix | base | aria`——需用 `-b radix`（本项目要求 Radix 组件） |
| 6 | 版本/范围调整 | TypeScript 切到 **7.1.0-dev.\***（next 标签，现锁 7.1.0-dev.20260815.1，升级开发版用 `pnpm add -D typescript@next`）；i18n 范围收敛为**仅 en-US**（zh-CN / zh-TW / ja-JP 后期扩展），index.html lang=en，check-i18n 无语言目录时改为跳过 |
| 7 | TS7 工具链适配 | ① tsconfig.app.json 删除 TS7 已移除的 `baseUrl`（paths 改相对解析），`pnpm typecheck` ✅；② 修复骨架期漏装的 `@tanstack/eslint-plugin-query`（lint 原报 ERR_MODULE_NOT_FOUND）；③ 实测 typescript-eslint 8.67.0 与 canary 8.67.1-alpha.4 均硬性拒绝 TS 7（上游 #10940），`pnpm lint` 暂不可用 |

## 🔄 进行中（Doing）

| # | 事项 | 状态 |
| --- | --- | --- |
| 1 | shadcn init（`-b radix`） | ⏸ 暂停——权限升级被拒绝，等待用户批准或手动执行 |
| 2 | shadcn add 19 个基础组件（sidebar/breadcrumb/collapsible/separator/sheet/tooltip/input/label/button/card/dropdown-menu/select/table/dialog/avatar/badge/skeleton/tabs/switch/sonner/command） | ⏸ 依赖 #1 |
| 3 | 应用代码：TanStack Router 文件路由 + 布局（侧边栏/头部）+ 主题切换 + i18n 框架（**仅 en-US**，多语言后期扩展） | ⏳ 待 #1/#2 完成 |
| 4 | 工具链验证：`pnpm build` / `pnpm check:i18n` 全绿；lint 暂缓（CI 已注释该步骤，待 typescript-eslint 支持 TS 7 后恢复，见阻塞点③） | ⏳ 待 #3 完成 |
| 5 | `git init` + 首次提交 | ⏳ 待 #4 完成 |

## ⏭️ 下一步（Next）

1. 完成 shadcn init/add（见下方手动命令）；
2. 编写应用代码（路由、布局、i18n、主题）；
3. 验证 build/lint/i18n，git 首次提交；
4. 推 GitHub（公开仓库，历史干净）。

## 🚧 阻塞点（Blockers）

- **沙箱权限**：目标目录在会话工作区（`/Users/xilejun/CodeBuddy/pg-explorer`）之外，每次写入需要批准 `danger-full-access` 权限升级；最近一次（shadcn init）升级请求被拒绝。
- **npm 缓存损坏**（机器级）：`~/.npm` 含 root 属主文件导致 EPERM，绕行目录 `/tmp/npmcache` 也已损坏；npm 查询改用 curl 直查 registry（如 `curl -s https://registry.npmjs.org/typescript`）；pnpm 有独立 store，`pnpm install` 不受影响。永久修复：`sudo chown -R 502:20 ~/.npm`（需用户自己操作）。
- **typescript-eslint 不兼容 TS 7**（上游）：8.67.0 与 canary 8.67.1-alpha.4 均硬性拒绝（"typescript-eslint does not support TS 7.0"），官方跟踪 [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)；`pnpm lint` 暂无法运行。**已决策：CI 暂缓 lint 步骤**（ci.yml 已注释并附恢复说明）；待上游支持后升级 typescript-eslint 并恢复。

## 手动执行命令（可选，若用户想自己跑）

```bash
cd /Users/xilejun/WorkBuddy/ds_Harness/shadcn_admin_cn
export npm_config_cache=/tmp/npmcache

# 1. 初始化 shadcn/ui（Radix 组件库）
pnpm exec shadcn init -y -b radix

# 2. 添加基础组件
pnpm exec shadcn add -y sidebar breadcrumb collapsible separator sheet tooltip input label button card dropdown-menu select table dialog avatar badge skeleton tabs switch sonner command

# 3. 验证（lint 暂缓，见阻塞点③）
pnpm build
pnpm check:i18n
# pnpm lint   # 待 typescript-eslint 支持 TS 7 后恢复
```

