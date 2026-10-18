# 运维 Runbook（发布 / 故障处置）

> 配套：[deployment.md](./deployment.md)（架构、环境变量、构建与部署）。目标是**任何一次发布/故障都有固定动作**，不靠记忆。

## 1. 发布前检查清单

- [ ] `pnpm install --frozen-lockfile` 成功；本地 Node 24、pnpm 与 `packageManager` 一致
- [ ] `pnpm test`、`pnpm lint`、`pnpm build` 全绿
- [ ] `pnpm check:bundle` 通过（首屏静态 JS ≤ 260 KB gzip、总量 ≤ 550 KB、单测文件 raw ≤ 2 MB）
- [ ] `pnpm check:i18n` / `check:i18n:keys` / `check:versions` 通过
- [ ] 目标环境 `.env`/build-args 已核对（尤其 `VITE_TABLEAU_SERVER_URL`、`VITE_TABLEAU_API_BASE`、`VITE_ERROR_REPORT_URL`）
- [ ] Connected App 白名单包含**本次部署域名**
- [ ] 网关 `/tableau-proxy` 与 `VITE_TABLEAU_API_BASE` 一致且已 `nginx -t`
- [ ] 镜像/静态产物已按版本打 tag（`x.y.z` + `sha-<short>`）
- [ ] 回滚版本（上一个镜像 tag / 静态目录）已确认可用

## 2. 发布后验证（5 分钟）

- [ ] `GET /healthz` → `ok`
- [ ] 首页、`/login` 可打开（无白屏/控制台 5xx）
- [ ] `/t/{slug}/workbooks` 列表能加载（REST 反代链路通）
- [ ] 打开一个视图，iframe 能嵌入（Connected App 白名单 + JWT 链路通）
- [ ] `/permissions` 能按角色看到矩阵；切换用户后可见性符合预期
- [ ] `/t/{slug}/ai`（如启用）能返回流式响应
- [ ] 错误上报：触发一次测试错误端到端（或检查收集端有心跳）
- [ ] 浏览器 Network 里静态资源为 200 且 `index.html` 为 `no-cache`

## 3. 故障排查

### 3.1 白屏 / 页面崩溃

1. 看页面是否显示**错误页 + Error ID**（v0.13.3+ 有全局 ErrorBoundary）。
2. 记录 Error ID，在错误收集端点/日志里按 `errorId` 查完整 stack、route、version。
3. 若错误页都未出现（浏览器直接白屏）：看 Console 是否有语法/资源加载错误；
   确认 `index.html` 引用的 `assets/*` 是否存在（发版缺文件/缓存错乱）。
4. 临时处置：回滚到上一个镜像 tag；清理 CDN 的 `index.html` 缓存后刷新。

### 3.2 登录/身份异常

- 检查 `/login` 是否在路由白名单（`staticData.layout = 'bare'` 的页面不经过权限门禁）。
- 登录失败先看 Network 与 localStorage 前缀（`tableau-embed-hub:`）；跨版本回滚时确认
  `src/lib/storage-migration.ts` 的兼容逻辑。
- 页面权限：前端只控制可见性，真实权限以服务端/Tableau 为准。

### 3.3 Workbooks/Views 列表 404 / CORS

- 确认网关 `/tableau-proxy/` 已启用且路径与 `VITE_TABLEAU_API_BASE` 一致；
- 确认 `proxy_set_header Host $proxy_host`（Tableau 按 Host 路由）；
- 用 `curl -i -X POST https://<本站>/tableau-proxy/api/<ver>/auth/signin` 验证反代；
- 只有嵌入 iframe 才需要 Connected App 域名白名单，REST 反代不解决白名单问题。

### 3.4 嵌入失败（iframe 空白 / 报错）

- 先确认是**资源未到**还是**认证被拒**：看 Console/Network 里 Tableau 的请求与错误码；
- Connected App 白名单是否包含当前域名（协议 + 端口都必须一致）；
- JWT 是否过期（前端每 4 分钟刷新）；系统时间偏差过大也会导致签名失败；
- CSP `frame-src` 是否包含站点域名（自有域名需手动补）。

### 3.5 AI 对话失败

- `VITE_AI_PROXY_URL` 留空 = 演示 provider（本地流式，不请求外部）；生产应指向同源网关；
- 网关需实现 OpenAI 兼容的 `POST /chat/completions`（`stream: true`）；
- 厂商 Key 只在网关；若 401/429，先查网关日志而不是前端。

### 3.6 体积门禁失败

- 先看 `pnpm check:bundle` 输出：首屏超限 → 检查是否把重页面/大依赖静态 import；
  总量超限 → 看新增依赖；禁止直接抬阈值，先做路由级懒加载或移除依赖。

## 4. 回滚步骤

1. 确认要回滚的版本 tag（镜像 `x.y.z` / `sha-<short>` 或静态目录 `releases/<version>/`）；
2. 切换部署（容器编排改 image tag / 网关指向旧目录）；
3. `index.html` 缓存必须失效（no-cache + CDN purge），assets 带 hash 可保留；
4. 执行第 2 节验证；确认 `/healthz`、登录、Workbooks、嵌入；
5. 在 CHANGELOG/PROGRESS 记录回滚原因与后续动作。

## 5. 事故记录模板

| 项 | 内容 |
| --- | --- |
| 时间 | |
| 版本/镜像 tag | |
| 现象 | （白屏 / 接口 5xx / 嵌入失败…） |
| Error ID / 日志链接 | |
| 影响面 | |
| 临时处置 | （回滚/降级/开关） |
| 根因 | |
| 后续动作 | （测试/门禁补齐） |
