# 接入你自己的 Tableau Cloud 站点

> 目标：把模板从「内置演示站点」切到你自己的站点，**只改 `.env`，不改代码**。
> 配完在应用内打开 `/help` → 「Environment check」卡片核对实际生效的值。

## 铁律（先读这三条）

1. **这是纯前端应用**：`.env` 里的值会在**构建时内联进 JS bundle**。站点地址、站点名、嵌入用户属于"可以公开"的信息；Connected App 的 `secretValue` **不是** —— 它会随 bundle 发出去，只能靠 Tableau 后台的白名单与轮换兜底（见文末「安全边界」）。
2. **REST 请求必须经同源反代**：Tableau Cloud REST API 不支持 CORS（无 `ACAO` 头、`OPTIONS` 预检 405）。开发环境由 `vite.config.ts` 自动代理；生产环境必须自己配（样例：`deploy/nginx.conf.example`）。嵌入 iframe **不**走代理，直连站点。
3. **改了 `.env` 必须重新构建**：这些值不是运行时读取的。

## 五分钟接入

```bash
cp .env.example .env      # .env 已被 .gitignore 排除
# 1) 填「站点绑定」三项：SERVER_URL / SITE_NAME / SITE_CONTENT_URL
# 2) 填「凭据」三项：CLIENT_ID / SECRET_ID / SECRET_VALUE（来源见下一节）
pnpm dev                  # 打开 /help 核对 Environment check 卡片
```

`.env` 全部字段：

| 变量 | 必填 | 说明 | 缺省 |
| --- | --- | --- | --- |
| `VITE_TABLEAU_SERVER_URL` | 是 | 站点地址（协议 + 主机），如 `https://eu-west-1a.online.tableau.com` | 演示站点 |
| `VITE_TABLEAU_SITE_NAME` | 是 | 后台的 Site name | 演示站点 |
| `VITE_TABLEAU_SITE_CONTENT_URL` | 是 | 地址栏 `/t/<这一段>/` 的值（注意**不是** Site name，两者常不同） | 演示站点 |
| `VITE_TABLEAU_EMBED_USER` | 是 | 签发 JWT 用的嵌入用户 | 演示用户 |
| `VITE_TABLEAU_CLIENT_ID` / `_SECRET_ID` / `_SECRET_VALUE` | 是 | Connected App 凭据 | 内置演示凭据 |
| `VITE_TABLEAU_PROJECT` | 否 | 只显示某个项目（REST 侧 `filter=projectName:eq:`） | 演示站点默认 `Samples`；**配了自己的站点则默认不过滤** |
| `VITE_TABLEAU_FALLBACK_VIEW` | 否 | 「点击 Views 且地址里没指定视图」时的固定兜底视图 UUID（优先打开"上次打开的视图"）。**换站点时务必改成自己站点上的视图 UUID** | 演示站点上的 `Superstore/Overview` |
| `VITE_TABLEAU_API_VERSION` | 否 | REST API 版本 | `3.23` |
| `VITE_TABLEAU_API_BASE` | 否 | REST 同源代理前缀 | `/tableau-proxy` |

## 拿到 Connected App 凭据

1. 登录 Tableau Cloud → 右上头像 → **设置（Settings）** → **已连接应用（Connected Apps）** → **新建连接的应用**。
2. 记下 **Client ID** 与 **Secret ID**；**Secret Value 只显示一次**，当场复制。
3. **访问级别**：选"仅限特定项目"或"所有项目"。⚠️ 该限制**只作用于嵌入工作流**，对 REST API 无效（官方文档：REST 授权时可忽略访问级别与域允许列表）—— 所以模板里还有一层应用侧的项目过滤 `VITE_TABLEAU_PROJECT`，它**也只是前端过滤，不是安全边界**。
4. **域名白名单（Trusted Sites）**：把应用部署的域名（以及本地开发的 `http://127.0.0.1:5174`）加进去，否则嵌入会被拒。
5. 嵌入用户（`VITE_TABLEAU_EMBED_USER`）：JWT 里会带上它，嵌入内容以该用户的权限呈现。

## 为什么要有 `/tableau-proxy`

| 场景 | 行为 |
| --- | --- |
| 嵌入视图（iframe） | 浏览器直连 Tableau，**不受 CORS 影响** |
| REST（工作簿/视图列表、缩略图、`auth/signin`） | 浏览器 → 同源 `/tableau-proxy` → Tableau，绕开 CORS |
| 开发环境 | `vite.config.ts` 按 `.env` 的 `SERVER_URL` / `API_BASE` 自动代理 |
| 生产环境 | **必须自己配**，见 `deploy/nginx.conf.example`（含 `proxy_ssl_server_name`、`Host` 覆盖等要点） |

部署形态：`pnpm build` 产出的 `dist/` 是纯静态资源，丢到任何静态托管 + 一个反代即可。

## 站点管理页与它需要的 scope（0.13 起）

两个页面直接操作**整个 Tableau 站点**（与团队无关，团队只是导航归属）：

| 页面 | 路由 | 能做什么 |
| --- | --- | --- |
| 站点用户与角色 | `/t/{slug}/tableau/users` | 读站点全部用户；**改站点角色**（本应用唯一的写操作） |
| 定时计划运行情况 | `/t/{slug}/tableau/schedules` | 只读：提取刷新任务 / 后台作业 / 订阅计划 |

REST 传输层（`src/lib/tableau-rest.ts`）按**能力域**各申请一条 JWT，而不是一张全权限令牌：

| 能力域 | JWT scope | 用到的方法 |
| --- | --- | --- |
| `content` | `tableau:content:read` + `tableau:views:*` + `tableau:workbooks:*`（与 0.7.0 起完全一致） | 工作簿 / 视图 / 预览图 |
| `site-users` | `tableau:users:*` | `GET /sites/{id}/users`、`PUT /sites/{id}/users/{user-id}` |
| `site-tasks` | `tableau:tasks:read` + `tableau:jobs:read` | `GET /sites/{id}/tasks/extractRefreshes`、`GET /sites/{id}/jobs`、`GET /sites/{id}/jobs/{job-id}`、`GET /sites/{id}/subscriptions` |

这些取值不是猜的（2026-10 对演示站点实测 + 官方引用页核对）：

- **写角色必须用通配 `tableau:users:*`**：细粒度的 `tableau:users:update` 是 API 3.27（2025-12）才加的，本项目默认 API 版本 3.23。
  实测：只给 `users:read` 时 `PUT` 返回 `401002`；给通配后鉴权通过（用一个**非法** `siteRole` 探测会得到 `400013` 校验错误，说明已经过了鉴权，且数据不会被改动）。
- **调用者必须是站点管理员**（Tableau 明文要求）：列用户与改角色都由嵌入用户的站点角色决定。实测演示站点的嵌入用户是 `SiteAdministratorCreator`，所以可用；
  换成 Viewer 账号后这两页会显示失败原因（不会静默空白）。
- **不能改自己的许可证角色**：Tableau 固定回 `403/403009`。页面因此把"你"那一行的改角色入口禁掉，避免一次注定失败的往返。
- **Tableau Cloud 没有 `/schedules`**：实测 `403`（"此站点不支持管理员计划"）。计划信息只能从每个提取刷新任务内联的 `schedule` 节点读。
- **作业保留期由 Tableau 决定**：官方 REST 引用页没有承诺任何保留期，本应用**不自加时间窗**（少猜一个阈值，就少一次"为什么看不到上周的失败"）。
- **`/jobs` 的行里没有对象名**：对象名要 `GET /sites/{id}/jobs/{job-id}` 才拿得到，页面按需取（展开某一行时才请求，避免逐行 N+1）。

⚠️ **按域申请 scope 只减少无谓暴露，不是安全边界**：纯前端把 Connected App 密钥内联进 bundle，能拿到产物的人本就能自行签发任意 scope 的 JWT。
真正的边界仍是 Tableau 后台（域名白名单 / 访问级别 / 密钥轮换）+ 把签发搬到后端（见文末「安全边界」）。

## 排查表

| 现象 | 原因与处理 |
| --- | --- |
| 列表页报 CORS / 预检 405 | 生产没配反代，或反代路径与 `VITE_TABLEAU_API_BASE` 不一致 |
| 登录 401 / 403 | `CLIENT_ID` / `SECRET_ID` / `SECRET_VALUE` 不匹配；或 Connected App 被禁用；或嵌入用户无权限 |
| 嵌入区域白屏、控制台报域名不在白名单 | Connected App 的 Trusted Sites 没加当前域名（含端口/协议） |
| REST 404 | `VITE_TABLEAU_SITE_CONTENT_URL` 填成了 Site name；或 `VITE_TABLEAU_API_VERSION` 过旧 |
| **只看到 2 个工作簿** | 还在演示站点（默认过滤 `Samples`）。配了自己的站点后默认不再过滤；若仍要看全，清空 `VITE_TABLEAU_PROJECT` |
| 429 / 请求排队 | Tableau 限流。模板对 `signin` 失败刻意不重试（避免重试风暴），业务请求 `retry: 1` |
| 改了 `.env` 没生效 | 没有重新构建；或变量名拼错（`VITE_` 前缀必须保留） |
| 站点用户/计划页报 401 或"未授权" | 嵌入用户的站点角色不是站点管理员，或（改角色时）scope 不是通配 `tableau:users:*` |
| 站点用户页显示"Tableau rejects changing your own licence role" | 你改的是自己（JWT 的 `sub`）—— Tableau 固定回 403009，换另一个站点管理员账号操作 |
| 计划页任务行的内容是 uuid 而不是工作簿名 | 该 workbook 按 id 取不到（已删除 / 无权限）。页面会显示 id 并在悬停提示里说明 |
| 点 Views 得到一个空白嵌入框 | 兜底视图 UUID（`VITE_TABLEAU_FALLBACK_VIEW`）在你自己的站点上不存在 —— 换成自己站点上真实存在的视图 UUID |
| 站点上没有任何作业记录 | 保留期由 Tableau 决定，不是本应用的过滤；去 Tableau 后台的"后台作业"页核对 |

## 安全边界（务必读完）

- **纯前端没有秘密**：无论 `.env` 还是内置凭据，构建后都内联进 bundle，拿到产物即可还原 JWT 签发所需的一切。模板对此不做加密（那只会是安全剧场），而是：
  - 用 Connected App（官方为"浏览器内签发 JWT"设计的机制）而不是账号密码；
  - 令牌短时效（5 分钟）+ 定时刷新；
  - 真正的边界放在 Tableau 后台：**域名白名单 + 访问级别 + 密钥轮换**。
- **要做真正受控的访问**：把 JWT 签发搬到后端（模板保留 `src/lib/tableau-jwt.ts` 的接口形状，替换实现即可），前端只拿短期令牌。
- **权限与数据**：本模板的页面权限是**可见性控制**，不是授权（详见 `README.md` 的「页面权限」一节）。
