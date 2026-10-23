# 部署指南（Deployment）

> 适用：Tableau Embed Hub（纯静态 SPA）。本文覆盖构建、Docker/nginx、Tableau REST 反代、
> AI 代理、错误上报、健康检查、回滚与安全边界。
> 相关：`deploy/nginx.conf.example`（网关样例）、`deploy/nginx.container.conf`（容器内配置）、
> `docs/ops-runbook.md`（发布/故障处置）。

## 1. 先理解架构边界

| 能力 | 运行位置 | 说明 |
| --- | --- | --- |
| 前端 SPA | 任意静态托管 / nginx / CDN | 构建产物 `dist/`，无 Node 运行时 |
| Tableau REST | **同源反代** → Tableau Cloud/Server | 浏览器直连会被 CORS 拦；必须配 `/tableau-proxy` |
| Tableau 嵌入 | iframe **直连** Tableau | 不走反代；需在 Connected App 白名单里加本站域名 |
| AI 对话 | 同源网关（可选） | 厂商 API Key **只能**放网关；前端只配 `VITE_AI_PROXY_URL` |
| 错误上报 | 可选的公网收集端点 | 只发 errorId/message/stack/route/version/UA，不含 query/hash |
| SMTP | 前端配置 + 预检 | 浏览器不能发 SMTP，真实发信必须服务端；当前为配置页/预检 |

> ⚠️ **`VITE_*` 是构建期内联**：换站点/凭据/收集端点都要重新构建，不能运行时改；
> 且值会进入 JS bundle，**任何 secret 都不能放 `VITE_*`**。

## 2. 环境变量

复制 `.env.example` 为 `.env`（已 gitignore）。所有变量可选，留空使用内置演示值。

| 变量 | 用途 | 是否敏感 |
| --- | --- | --- |
| `VITE_TABLEAU_SERVER_URL` | 站点地址（协议 + 主机） | 否 |
| `VITE_TABLEAU_SITE_NAME` / `VITE_TABLEAU_SITE_CONTENT_URL` | 站点名 / URL 中的 `/t/<slug>` | 否 |
| `VITE_TABLEAU_EMBED_USER` | JWT 的嵌入用户名 | 否（演示级） |
| `VITE_TABLEAU_PROJECT` | 只显示某项目（留空=全部） | 否 |
| `VITE_TABLEAU_API_VERSION` | REST 版本（Tableau 每年更新） | 否 |
| `VITE_TABLEAU_API_BASE` | 同源反代前缀，默认 `/tableau-proxy` | 否 |
| `VITE_TABLEAU_CLIENT_ID` / `SECRET_ID` / `SECRET_VALUE` | Connected App 凭据 | ⚠️ 纯前端无法保密 |
| `VITE_AI_PROXY_URL` / `VITE_AI_MODEL` | 同源 AI 网关（留空=演示 provider） | 否 |
| `VITE_ERROR_REPORT_URL` | 错误收集端点（留空=不上报） | 否 |

### 环境矩阵

| 环境 | Tableau | AI | 错误上报 | 前端 |
| --- | --- | --- | --- | --- |
| dev | `.env` 或内置演示 | 演示 provider | 关闭 | Vite dev server（5174） |
| staging | 测试站点 + 测试 Connected App | 测试网关 | 开启（测试收集器） | 静态产物 / Docker |
| prod | 正式站点 + 正式 Connected App | 正式网关 | 开启 | Docker/nginx + CDN |

## 3. 构建

```bash
pnpm install --frozen-lockfile
pnpm build          # tsc -b + vite build → dist/
pnpm test           # 纯函数用例
pnpm check:bundle   # 体积门禁（需先 build；读 dist/.vite/manifest.json）
```

产物：`dist/index.html`、`dist/assets/*.[hash].js|css`、`dist/.vite/manifest.json`。

## 4. Docker

```bash
docker build -t tableau-embed-hub:0.14.0 \
  --build-arg VITE_TABLEAU_SERVER_URL=https://your-site.online.tableau.com \
  --build-arg VITE_TABLEAU_SITE_NAME=your_site \
  --build-arg VITE_TABLEAU_SITE_CONTENT_URL=your_site \
  --build-arg VITE_TABLEAU_EMBED_USER=embed@example.com \
  --build-arg VITE_TABLEAU_CLIENT_ID=... \
  --build-arg VITE_TABLEAU_SECRET_ID=... \
  --build-arg VITE_TABLEAU_SECRET_VALUE=... \
  --build-arg VITE_ERROR_REPORT_URL=https://errors.example.com/collect \
  .

docker run --rm -p 8080:80 tableau-embed-hub:0.14.0
curl -fsS http://127.0.0.1:8080/healthz   # → ok
```

- 运行阶段只用 nginx；`deploy/nginx.container.conf` 已含 SPA 回退/缓存/安全头/healthz。
- **REST 反代不在容器配置里写死站点域名**：在编排层（Ingress/外层 nginx/网关）配置
  `/tableau-proxy`，或自行用 envsubst 生成配置后挂载。路径必须与 `VITE_TABLEAU_API_BASE` 一致。
- 嵌入 iframe 直连 Tableau，需要在 Tableau Connected App 白名单加入**本站域名**。

## 5. nginx / 网关

参考 `deploy/nginx.conf.example`（最小反代样例）与 `deploy/nginx.container.conf`（静态托管）：

- `/` → `try_files $uri $uri/ /index.html`（`/login`、`/t/{slug}/...` 深链接刷新不 404）；
- `/assets/` → `Cache-Control: public, max-age=31536000, immutable`；
- `index.html` → `no-cache`（发版/回滚即时生效）；
- `/healthz` → 200（liveness，仅表示 nginx 存活）；
- `/tableau-proxy/` → `proxy_pass https://<站点>`，`Host` 必须覆盖为 Tableau 主机，
  开启 `proxy_ssl_server_name`，超时 ≥ 120s；
- `/.vite/` → 403（不公开构建清单）。

### CSP 注意

默认 CSP 只放行 `*.online.tableau.com` / `*.tableau.com`。若你的 Tableau 是**自有域名**
（如 `tableau.company.com`），必须在 `frame-src` 与 `connect-src` 里补上该域名；
AI 网关若为同源（`/ai-proxy`）无需额外放行。`style-src` 保留 `'unsafe-inline'`
是因为 React 组件使用内联样式；`frame-ancestors 'self'` 默认只允许同源嵌入本应用。

## 6. 健康检查与监控

| 项 | 做法 |
| --- | --- |
| liveness | `GET /healthz`（nginx 固定 200） |
| 外部 uptime | UptimeRobot / BetterStack 等监控 `/healthz` + 首页 |
| 前端错误 | 设置 `VITE_ERROR_REPORT_URL`，接自建 collector 或 Sentry（错误页/全局异常均带 errorId） |
| 发布验证 | 首页、`/login`、`/t/{slug}/workbooks`、`/t/{slug}/views`、`/t/{slug}/ai`、`/permissions` |

错误上报负载（固定契约）：

```json
{
  "errorId": "E-1A2B3C4D5E",
  "message": "...",
  "stack": "...",
  "route": "/t/acme/workbooks",
  "version": "0.13.4",
  "userAgent": "...",
  "timestamp": "2026-10-18T09:00:00.000Z",
  "context": { "source": "route-error" }
}
```

`route` 只含 pathname（已脱敏，不含 query/hash）。`sendBeacon` 使用
`Content-Type: text/plain;charset=UTF-8`（body 仍是 JSON，避免跨域预检导致静默丢包），
收集端请忽略 Content-Type、按 JSON 解析。

## 7. 回滚

- 镜像按 `x.y.z` 与 `sha-<short>` 双 tag 推送；回滚 = 重新部署旧 tag。
- 静态托管：`releases/<version>/` 归档，CDN/负载均衡切回旧前缀。
- `index.html` 必须 no-cache，否则回滚后浏览器仍拿旧入口。
- 回滚后清一次 CDN 的 `index.html` 缓存（assets 带 hash，无需清）。
- localStorage 键前缀由 `src/lib/storage-migration.ts` 管理；跨大版本回滚前先确认数据结构兼容。

## 8. 安全边界（务必读）

- 纯前端项目：Connected App 凭据、AI key、SMTP 密码都**不能**在前端真正保密。
  Tableau 侧请用 Connected App 域名白名单 + 最小权限 + 密钥轮换；需要彻底隐藏时把
  JWT 签发与 REST 调用迁到后端。
- 前端权限矩阵只控制可见性，**不是安全边界**；接入后端后每个接口必须再鉴权。
- AI 厂商 API Key 只能放同源网关；前端 `VITE_AI_PROXY_URL` 不应直连厂商。
- 生产必须启用 HTTPS；CSP/安全头见第 5 节。
