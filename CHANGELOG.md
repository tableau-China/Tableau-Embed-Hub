# Changelog（变更记录）

> 每次版本变更在此记录。**跨文件检查**：版本号需与 `package.json`、侧边栏版本显示、`PROGRESS.md`、本文件四者保持一致。

## 版本对照表

| 版本 | package.json | 侧边栏显示 | PROGRESS.md | CHANGELOG 条目 | 日期 |
| --- | --- | --- | --- | --- | --- |
| 0.2.0 | ✅ `0.2.0` | ✅ `v0.2.0` | ✅ 已同步 | ✅ [本节](#020---2026-08-16) | 2026-08-16 |
| 0.1.0 | ✅ `0.1.0` | ✅ `v0.1.0` | ✅ 已同步 | ✅ [本节](#010---2026-08-16) | 2026-08-16 |

> 约定：新版本发布时，先升 `package.json` 的 `version`，再更新本表与下方条目。

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
- **Workbooks 列表未受"访问级别:Samples"限制**：已连接应用的访问级别/域允许列表**仅作用于嵌入工作流**（[官方文档](https://help.tableau.com/current/online/zh-cn/connected_apps_direct.htm)：REST API 授权配置时可忽略），JWT 也没有项目级 claim（注册 claim 仅 kid/iss/alg/sub/aud/exp/iat/jti/scp），故 REST 列表仍返回全部 15 个工作簿。修复：`tableau.ts` 新增 `restrictedProjectName: 'Samples'`，`fetchWorkbooks` 追加 `filter=projectName:eq:Samples` 查询参数（实测 `/projects/{id}/workbooks` 端点在 Cloud 3.23 返回 404 不可用，`filter=projectId:eq:` 亦被拒，`projectName` filter 为可用方案）→ 列表仅返回 Samples 的 2 个工作簿（Superstore、World Indicators）

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
## [0.2.0] - YYYY-MM-DD
### Added / Changed / Fixed / Known Issues / TODO
-->
