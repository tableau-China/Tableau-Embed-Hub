# Changelog（变更记录）

> 每次版本变更在此记录。**跨文件检查**：版本号需与 `package.json`、侧边栏版本显示、`PROGRESS.md`、本文件四者保持一致。

## 版本对照表

| 版本 | package.json | 侧边栏显示 | PROGRESS.md | CHANGELOG 条目 | 日期 |
| --- | --- | --- | --- | --- | --- |
| 0.1.0 | ✅ `0.1.0` | ✅ `v0.1.0` | ✅ 已同步 | ✅ [本节](#010---2026-08-16) | 2026-08-16 |

> 约定：新版本发布时，先升 `package.json` 的 `version`，再更新本表与下方条目。

## [0.1.0] - 2026-08-16

首个可运行版本：管理后台模板骨架（含全部基础页面）。

### Added（新增）

- **技术栈**：Vite 8.2.1 + React 19.2.8 + TypeScript 7.1.0-dev + Tailwind CSS v4 + shadcn/ui（radix-nova 预设）+ TanStack Router / Query + i18next
- **shadcn/ui**：init + 24 个组件（sidebar / breadcrumb / collapsible / separator / sheet / tooltip / input / label / button / card / dropdown-menu / select / table / dialog / avatar / badge / skeleton / tabs / switch / sonner / command / toggle 等）
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

## [0.2.0] - YYYY-MM-DD

### Added / Changed / Fixed / Known Issues / TODO

-->
