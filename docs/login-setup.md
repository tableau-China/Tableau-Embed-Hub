# 登录页与联合登录（Login）

> v0.12.0 起。相关文件：`src/lib/login.ts`（领域层）、`src/features/login/`（页面与模板）、
> `src/features/config/login-config-page.tsx`（配置页）、`src/routes/login.tsx`、`scripts/check-login.mjs`。

## 1. 这一版做了什么、没做什么

| 做了 | 说明 |
| --- | --- |
| 三种登录样式 | `centered-card`（默认）/ `split-hero` / `fullscreen-card`，在 `/config/login` 切换，配置本地持久化 |
| 第三方联合登录入口 | 按配置的启用状态渲染 GitHub / Google 按钮（品牌标识为内联 SVG） |
| 宣传图 | 内置 `public/login-hero.svg`（离线可用），可在配置页填 URL 覆盖；远程图加载失败**自动退回内置图** |
| 配置页 | `/config/login`（权限键 `page.config.login`，fail-closed：默认只有系统管理员可见） |
| 校验 | 领域层规则断言 + 7 项真实浏览器用例（`pnpm check:login`） |

| 没做（有意为之） | 原因 |
| --- | --- |
| 真实鉴权 / 会话 | 本模板**没有后端**。纯前端伪造登录态是安全剧场（和「SMTP 密码不落盘」同一条原则） |
| 拦截未登录用户 | `/login` 可直达、可预览，但**不改变任何路由准入** —— 现有页面照旧打开即用 |
| 验证码生成与校验 | 前端生成的验证码可被绕过，服务端校验才是唯一有意义的做法 |
| OAuth 跳转 | 本轮只做「配置 + 入口」；`openid` 之外的授权码换 token 必须由服务端完成，链接也在那时拼 |
| 收集 Client Secret | 纯前端模板里它必然随 bundle 发给所有人 |

## 2. 快速开始

```bash
pnpm dev            # 登录页 http://127.0.0.1:5174/login
                    # 配置页 http://127.0.0.1:5174/config/login（默认只有系统管理员可见）
pnpm build && pnpm check:login   # 领域层断言 + 7 项页面用例（需本机 Chrome）
```

## 3. 三种登录样式

| id | 版面 | 用宣传图 |
| --- | --- | --- |
| `centered-card` | 居中卡片：品牌标识 + 登录框（用户名 / 密码 / 验证码）+ 第三方入口 | 否（**默认**） |
| `split-hero` | 左侧 **2/3** 宣传图 + 右侧 **1/3** 登录面板；窄屏（< lg）收起宣传图、表单居中 | 是 |
| `fullscreen-card` | 全屏背景图 + 居中卡片（图上压一层遮罩保证对比度） | 是 |

样式与配置的对应关系在 `src/lib/login.ts` 的 `LOGIN_TEMPLATES`，组件在
`src/features/login/templates/`，注册表是 `templates/registry.tsx`。

## 4. 配置项与存储

```ts
interface LoginConfig {
  template: LoginTemplateId                       // 三种样式之一
  heroImageUrl: string                            // 空 = 用内置宣传图；支持 https 外链或站内绝对路径
  providers: Record<OAuthProviderId, {
    enabled: boolean                              // 是否在登录页显示该入口
    clientId: string                              // 公开标识（不是密钥）
    authorizeUrl: string                          // 授权端点（默认取 provider 官方地址，可覆盖自建部署）
    redirectUri: string                           // 回调地址，由**后端**接收授权码
    scopes: string                                // 空格分隔
  }>
}
```

配置存在 localStorage 的 `tableau-embed-hub:config`（与 SMTP 同一份），**全部是非敏感字段**
（`config-store.ts` 的 `partialize` 落地，`check:login` 会断言落盘数据里没有 `secret` / `password`）。

### 预检规则（`validateLoginConfig`）

| 级别 | 条件 | 后果 |
| --- | --- | --- |
| error | 宣传图地址既不是 `https://…` 也不是 `/…` | 拦保存 |
| error | 授权端点为空、或不是 `https://` 开头（明文端点会把授权码暴露在链路上） | 拦保存 |
| error | 回调地址既不是 `http(s)://…` 也不是站内绝对路径 | 拦保存 |
| warning | 启用中的 provider 没填 Client ID | 放行（当前模板不跳转，按钮先做展示） |
| warning | 回调地址 / scope 为空 | 放行 |
| pass | 宣传图留空（用内置图） | 放行 |

**设计取舍**：样式与宣传图的改动不该被 OAuth 的 warning 拦住 —— 否则「只想换个版式」的用户会被迫先编一个 Client ID。

## 5. 新增一个登录样式（三步）

1. 写 `src/features/login/templates/<your-template>.tsx`：接收 `{ config, heroImageUrl }`，
   里面渲染 `<LoginForm config={config} className="max-w-sm" />`（**登录内容只有这一份**，不要抄第二遍）；
2. 在 `templates/registry.tsx` 的 `LOGIN_TEMPLATE_COMPONENTS` 登记一行（漏了 tsc 报错）；
3. 在 `src/lib/login.ts` 的 `LOGIN_TEMPLATES` 加一条（`nameKey` / `descriptionKey` 写 i18n key，
   `login.test.ts` 会断言它们真的存在于词典）。配置页的选项与线框缩略图会自动多一项。

## 6. 新增一个第三方 provider（两处）

1. `src/lib/login.ts` 的 `OAUTH_PROVIDERS` 加一行（id / 品牌名 / 官方授权端点 / 默认 scope）；
2. `src/features/login/brand-icons.tsx` 的 `OAUTH_ICONS` 配品牌标识（`Record<OAuthProviderId, …>`，
   漏了 tsc 报错）。

`OAuthProviderId` 是字面量联合，上面两处补完，配置页表单、登录页入口、预检清单都会自动带上它。

## 7. 接后端的契约（这一节是给实现后端的人看的）

前端只负责**展示与配置**，下面三组接口由你自己的服务端实现。建议路径：

### 7.1 会话

| 方法 | 路径 | 请求 | 响应 |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | `{ username, password, captchaId?, captchaCode? }` | `Set-Cookie: session=…; HttpOnly; Secure; SameSite=Lax`（**不要**把 token 交给 JS） |
| GET | `/api/auth/me` | — | `{ id, name, email, roles, isSystemAdmin }` 或 401 |
| POST | `/api/auth/logout` | — | 204（服务端销毁会话） |

### 7.2 验证码

| 方法 | 路径 | 响应 |
| --- | --- | --- |
| GET | `/api/auth/captcha` | `{ captchaId, image }`（image 为 data URL 或 URL；`captchaId` 与服务端那份答案绑定） |
| — | 登录请求携带 | `captchaId` + `captchaCode`，**服务端校验**：一次性、有有效期、失败次数限流 |

> 前端这一版渲染的是**占位图形**（`data-captcha-placeholder`），不生成、不校验 —— 别把它的存在当成校验已经做了。

### 7.3 联合登录（OAuth 2.0 授权码流程）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/auth/oauth/{provider}/start` | 服务端生成 `state`（存服务端/签名 Cookie）后 302 到 `authorizeUrl`（带 `client_id` / `redirect_uri` / `scope`） |
| GET | `/api/auth/oauth/{provider}/callback` | 校验 `state` → 用 **client_secret** 换 access token（这一步只能在服务端）→ 建立本站会话 → 302 回登录页或首页 |

前端配置页收集的 `clientId` / `authorizeUrl` / `redirectUri` / `scopes` 正是 `start` 需要的输入；
`client_secret` **不进前端配置**，放服务端环境变量。

### 7.4 前端要改的三处

1. `src/features/login/login-form.tsx` 的 `handleSubmit`：调 `POST /api/auth/login`，成功后就地跳转；
2. 同文件的验证码区：把占位图形换成 `GET /api/auth/captcha` 的图片，并带上 `captchaId`；
3. 同文件的第三方按钮：换成 `window.location.assign('/api/auth/oauth/' + id + '/start')`。

若还要「未登录一律跳 `/login`」：在会话接口就绪后再加路由守卫（`__root.tsx` / `beforeLoad`），
并把它做成**显式开关**——本版不做，是因为在没有后端的前提下做出来的门禁只是观感，容易被误当成真实鉴权。

## 8. 校验

```bash
pnpm build && pnpm check:login
```

- 第一段（秒级、不用浏览器）：目录不变量、脏数据归一化、预检规则、状态推导、内置图存在性、
  **配置里不含 secret**；
- 第二段（真实 Chrome）：`/config/login` 改配置 → 保存 → 整页刷新 → `/login` 真的换版面；
  provider 开关与宣传图地址一路传到模板；校验不通过时**不写盘**；点第三方入口只提示不跳转；
  恢复默认回出厂值；`/login` 是裸布局（无侧边栏/头部）。
