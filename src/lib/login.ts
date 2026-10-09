/**
 * 登录页配置的领域层（纯函数 + 常量）—— 与 `src/lib/smtp.ts` 同构，
 * **不依赖 React / zustand / window**，因此 `scripts/check-login.mjs` 与 vitest 都能直接 import 本文件跑断言。
 *
 * 这里管两件事：
 *   1. **登录样式**（`LOGIN_TEMPLATES` 目录）：页面按 id 从注册表取组件，新增样式只加一个模板文件；
 *   2. **第三方联合登录**（`OAUTH_PROVIDERS` 目录 + 每个 provider 的**公开**参数）。
 *
 * ## 边界（本模板是纯前端，两条都要说在前面）
 *
 * - **登录页目前只是 UI 模板**：提交不做鉴权、验证码不校验（见 docs/login-setup.md）。
 *   接后端时替换 `src/features/login/login-form.tsx` 的提交处即可，本文件的形状不用改。
 * - **provider 配置不收集 Client Secret**：浏览器里保存 Secret 毫无安全性可言 ——
 *   它必然随 bundle 发给所有人，而 OAuth 的授权码换 token 本来就必须在后端做。
 *   因此「启用但没填 Client ID」只是 **warning**（按钮先做展示），不是 error，不会拦住保存。
 *
 * 文案一律以 **i18n key + params** 返回（本文件不引入 i18next），翻译在页面里做；
 * key 用字面量写在目录里，`login.test.ts` 负责断言它们真的存在于词典 —— 这样动态取值也不会漏键。
 */

/* ============================== 登录样式（模板目录） ============================== */

/** 登录样式 id（= 模板注册表的键，见 src/features/login/templates/registry.tsx） */
export type LoginTemplateId = 'centered-card' | 'split-hero' | 'fullscreen-card'

export interface LoginTemplateMeta {
  id: LoginTemplateId
  /** 样式名 i18n key（字面量，便于用例断言存在） */
  nameKey: string
  /** 一句话说明 i18n key */
  descriptionKey: string
  /** 是否用到宣传图（配置页据此提示「宣传图」字段对哪些样式生效） */
  usesHeroImage: boolean
}

/** 登录样式目录：顺序即配置页的展示顺序 */
export const LOGIN_TEMPLATES: readonly LoginTemplateMeta[] = [
  {
    id: 'centered-card',
    nameKey: 'loginConfig.template.centeredCard',
    descriptionKey: 'loginConfig.template.centeredCardHint',
    usesHeroImage: false,
  },
  {
    id: 'split-hero',
    nameKey: 'loginConfig.template.splitHero',
    descriptionKey: 'loginConfig.template.splitHeroHint',
    usesHeroImage: true,
  },
  {
    id: 'fullscreen-card',
    nameKey: 'loginConfig.template.fullscreenCard',
    descriptionKey: 'loginConfig.template.fullscreenCardHint',
    usesHeroImage: true,
  },
]

/** 出厂样式：最简的居中卡片（不依赖任何图片资源） */
export const DEFAULT_LOGIN_TEMPLATE: LoginTemplateId = 'centered-card'

/** 取样式元信息（id 已过 normalize，必然命中；兜底返回第一项以防目录被改空） */
export function loginTemplateMeta(id: LoginTemplateId): LoginTemplateMeta {
  return LOGIN_TEMPLATES.find((t) => t.id === id) ?? LOGIN_TEMPLATES[0]
}

/* ============================== 第三方联合登录（provider 目录） ============================== */

export type OAuthProviderId = 'github' | 'google'

export interface OAuthProviderMeta {
  id: OAuthProviderId
  /** provider 品牌名（品牌名不翻译） */
  name: string
  /**
   * 官方授权端点（公开信息，可被配置覆盖 —— 自建 GitHub Enterprise / 私有部署需要改域名）。
   * ⚠️ 当前模板**不实现跳转**：这个值只是先按公开参数存下来，供后端/后续版本使用。
   */
  authorizeUrl: string
  /** 官方文档建议的默认 scope（空格分隔；最小可用集，不申请用不到的权限） */
  scopes: string
}

/** provider 目录：**新增第三方登录 = 在这里加一行**（页面与配置页都从目录派生） */
export const OAUTH_PROVIDERS: readonly OAuthProviderMeta[] = [
  {
    id: 'github',
    name: 'GitHub',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    scopes: 'read:user user:email',
  },
  {
    id: 'google',
    name: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: 'openid email profile',
  },
]

/** provider 配置：**只有公开参数**（无 secret，见文件头） */
export interface OAuthProviderConfig {
  /** 是否在登录页显示该入口 */
  enabled: boolean
  /** OAuth Client ID（公开；与 Client Secret 不同，后者绝不进前端） */
  clientId: string
  /** 授权端点（默认取目录里的官方地址，可覆盖） */
  authorizeUrl: string
  /** 回调地址（由**后端**接收授权码；前端此处只做记录） */
  redirectUri: string
  /** 申请的 scope（空格分隔） */
  scopes: string
}

export type OAuthProviderField = 'clientId' | 'authorizeUrl' | 'redirectUri' | 'scopes'

/** 可挂到具体输入框的字段（heroImageUrl 是页面级字段，provider 字段带 provider 前缀） */
export type LoginField = 'heroImageUrl' | `${OAuthProviderId}.${OAuthProviderField}`

export interface LoginConfig {
  /** 登录样式 */
  template: LoginTemplateId
  /** 宣传图 URL：空 = 用内置默认图；支持 https 外链或站内绝对路径 */
  heroImageUrl: string
  /** 每个 provider 的公开参数（目录里没登记的 key 在 normalize 时丢弃） */
  providers: Record<OAuthProviderId, OAuthProviderConfig>
}

/** 内置宣传图（public/ 下，离线可用、不依赖任何外链） */
export const DEFAULT_HERO_IMAGE_URL = '/login-hero.svg'

/** 某 provider 的出厂配置：启用 + 官方端点与 scope 预填，Client ID / 回调留空待填 */
function defaultProviderConfig(meta: OAuthProviderMeta): OAuthProviderConfig {
  return {
    enabled: true,
    clientId: '',
    authorizeUrl: meta.authorizeUrl,
    redirectUri: '',
    scopes: meta.scopes,
  }
}

/** 按目录生成一个完整的 provider 记录 */
function providerRecord(build: (meta: OAuthProviderMeta) => OAuthProviderConfig): Record<OAuthProviderId, OAuthProviderConfig> {
  const record = {} as Record<OAuthProviderId, OAuthProviderConfig>
  for (const meta of OAUTH_PROVIDERS) record[meta.id] = build(meta)
  return record
}

/**
 * 出厂配置：最简样式 + 内置宣传图 + GitHub/Google 两个入口。
 *
 * 两个 provider **默认启用**（登录页开箱就能看到第三方入口，符合「模板」的演示目的），
 * 但 Client ID 为空 —— 于是预检给出 warning（不是 error），保存不会被拦。
 */
export const DEFAULT_LOGIN_CONFIG: LoginConfig = {
  template: DEFAULT_LOGIN_TEMPLATE,
  heroImageUrl: '',
  providers: providerRecord((meta) => defaultProviderConfig(meta)),
}

/* ============================== 归一化 ============================== */

/**
 * 归一化的**入参契约**：字段一律按 `unknown` 收。
 *
 * 它的输入本来就不是可信类型 —— localStorage 里可能是上一版本的形状、被手改过的 JSON，
 * 或者别的应用写进来的同名键。写成 `Partial<LoginConfig>` 会让「收脏数据」变成类型谎言，
 * 也会逼着每个调用点先做一次假断言。真正的兜底在函数体内的 `str` / `bool` 与目录白名单里。
 */
export interface LoginConfigInput {
  template?: unknown
  heroImageUrl?: unknown
  providers?: Record<string, unknown>
}


function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * 归一化：**任何输入都返回一份形状完整、可安全渲染的配置**。
 *
 * 反序列化（localStorage 里可能是旧版本 / 脏数据）与保存都走它：
 *   - 未知 template → 出厂样式；
 *   - 未知 provider key → 丢弃（目录增删后旧数据自动收敛）；
 *   - 缺失字段 → 该 provider 的出厂值；
 *   - 类型不对（数字 / null / 对象）→ 退回家底值，绝不把脏值透传给 UI。
 */
export function normalizeLoginConfig(input?: LoginConfigInput | null): LoginConfig {
  const source = input ?? {}
  const template = LOGIN_TEMPLATES.some((t) => t.id === source.template)
    ? (source.template as LoginTemplateId)
    : DEFAULT_LOGIN_TEMPLATE

  const rawProviders = source.providers ?? {}

  return {
    template,
    heroImageUrl: str(source.heroImageUrl),
    providers: providerRecord((meta) => {
      const fallback = defaultProviderConfig(meta)
      const raw = rawProviders[meta.id]
      if (!raw || typeof raw !== 'object') return fallback
      const provider = raw as Record<string, unknown>
      return {
        enabled: bool(provider.enabled, fallback.enabled),
        clientId: str(provider.clientId, fallback.clientId),
        authorizeUrl: str(provider.authorizeUrl, fallback.authorizeUrl),
        redirectUri: str(provider.redirectUri, fallback.redirectUri),
        scopes: str(provider.scopes, fallback.scopes),
      }
    }),
  }
}

/**
 * provider 字段 → 表单标签 i18n key。
 *
 * 配置页的**表单标签**与**预检清单行标签**共用这一份映射：两处各写一串字面量，
 * 改文案时必然漏一处（清单里写「Client ID」、表单里写「Client ID (OAuth)」这种漂移很难被 review 抓住）。
 */
export const OAUTH_FIELD_LABEL_KEYS: Record<OAuthProviderField, string> = {
  clientId: 'loginConfig.clientId',
  authorizeUrl: 'loginConfig.authorizeUrl',
  redirectUri: 'loginConfig.redirectUri',
  scopes: 'loginConfig.scopes',
}

/** 宣传图的实际地址：配置为空时用内置图（模板组件只认这个函数，不各自判空） */
export function resolveHeroImageUrl(config: LoginConfig): string {
  return config.heroImageUrl === '' ? DEFAULT_HERO_IMAGE_URL : config.heroImageUrl
}

/**
 * 两份配置是否逐字段相等（配置页用它判断「有未保存改动」）。
 *
 * 字段就这么些，手写比较即可 —— 为这点事引一个深度比较库不值得；
 * 而且显式列出字段还有个好处：**新增字段时会被提醒**（漏了会让「有改动」的判断失灵，
 * 表现为保存按钮永远灰着）。
 */
export function sameLoginConfig(a: LoginConfig, b: LoginConfig): boolean {
  if (a.template !== b.template) return false
  if (a.heroImageUrl !== b.heroImageUrl) return false
  return OAUTH_PROVIDERS.every(({ id }) => {
    const x = a.providers[id]
    const y = b.providers[id]
    return (
      x.enabled === y.enabled &&
      x.clientId === y.clientId &&
      x.authorizeUrl === y.authorizeUrl &&
      x.redirectUri === y.redirectUri &&
      x.scopes === y.scopes
    )
  })
}

/** 是否仍是出厂配置（配置页据此显示「使用默认」而不是「已保存」） */
export function isDefaultLoginConfig(config: LoginConfig): boolean {
  return sameLoginConfig(config, DEFAULT_LOGIN_CONFIG)
}

/* ============================== 校验（预检清单） ============================== */

export type LoginCheckLevel = 'error' | 'warning' | 'pass'

/** 一项预检结果：level + i18n key + 可选 params（文案由页面翻译） */
export interface LoginCheck {
  /** 稳定检查项 id：`heroImageUrl` | `<provider>.<field>` | `<provider>.enabled` */
  id: string
  level: LoginCheckLevel
  messageKey: string
  params?: Record<string, string | number>
  /** 该项对应的输入框（用于字段级 issue 接线） */
  field?: LoginField
}

/** http(s) 绝对地址 */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/** 回调地址允许的形态：https 外链，或 http（本地后端调试），或站内绝对路径 */
function isRedirectUriLike(value: string): boolean {
  return isHttpUrl(value) || value.startsWith('/')
}

/**
 * 预检清单 —— **保存（拦 error）与页面清单用的是同一份规则**（同 SMTP 的做法，不会两边漂移）。
 *
 * 规则口径：
 *   - 宣传图空 = 用内置图（pass，不是「未配置」）；
 *   - 启用中的 provider：Client ID / 回调 / scope 缺失 → **warning**（当前模板不跳转，先做展示）；
 *     授权端点不是 https → **error**（明文端点会把授权码暴露在链路上，这条不能放行）；
 *     回调地址不是 http(s) 也不是站内路径 → **error**（拼出来的地址一定不可用）；
 *   - 未启用的 provider → 一条 pass，提示它当前不参与登录页。
 */
export function validateLoginConfig(config: LoginConfig): LoginCheck[] {
  const checks: LoginCheck[] = []

  // ① 宣传图
  if (config.heroImageUrl === '') {
    checks.push({ id: 'heroImageUrl', level: 'pass', messageKey: 'loginConfig.check.heroDefault', field: 'heroImageUrl' })
  } else if (isHttpUrl(config.heroImageUrl) || config.heroImageUrl.startsWith('/')) {
    checks.push({ id: 'heroImageUrl', level: 'pass', messageKey: 'loginConfig.check.heroOk', field: 'heroImageUrl' })
  } else {
    checks.push({ id: 'heroImageUrl', level: 'error', messageKey: 'loginConfig.check.heroInvalid', field: 'heroImageUrl' })
  }

  // ② 各 provider
  for (const meta of OAUTH_PROVIDERS) {
    const provider = config.providers[meta.id]
    const params = { provider: meta.name }
    const field = (name: OAuthProviderField): LoginField => `${meta.id}.${name}`

    if (!provider.enabled) {
      checks.push({
        id: `${meta.id}.enabled`,
        level: 'pass',
        messageKey: 'loginConfig.check.providerDisabled',
        params,
      })
      continue
    }

    checks.push(
      provider.clientId === ''
        ? { id: `${meta.id}.clientId`, level: 'warning', messageKey: 'loginConfig.check.clientIdMissing', params, field: field('clientId') }
        : { id: `${meta.id}.clientId`, level: 'pass', messageKey: 'loginConfig.check.clientIdOk', params, field: field('clientId') },
    )

    if (provider.authorizeUrl === '') {
      checks.push({ id: `${meta.id}.authorizeUrl`, level: 'error', messageKey: 'loginConfig.check.authorizeUrlRequired', params, field: field('authorizeUrl') })
    } else if (!/^https:\/\//i.test(provider.authorizeUrl)) {
      checks.push({ id: `${meta.id}.authorizeUrl`, level: 'error', messageKey: 'loginConfig.check.authorizeUrlHttps', params, field: field('authorizeUrl') })
    } else {
      checks.push({ id: `${meta.id}.authorizeUrl`, level: 'pass', messageKey: 'loginConfig.check.authorizeUrlOk', params, field: field('authorizeUrl') })
    }

    if (provider.redirectUri === '') {
      checks.push({ id: `${meta.id}.redirectUri`, level: 'warning', messageKey: 'loginConfig.check.redirectUriMissing', params, field: field('redirectUri') })
    } else if (!isRedirectUriLike(provider.redirectUri)) {
      checks.push({ id: `${meta.id}.redirectUri`, level: 'error', messageKey: 'loginConfig.check.redirectUriInvalid', params, field: field('redirectUri') })
    } else {
      checks.push({ id: `${meta.id}.redirectUri`, level: 'pass', messageKey: 'loginConfig.check.redirectUriOk', params, field: field('redirectUri') })
    }

    checks.push(
      provider.scopes === ''
        ? { id: `${meta.id}.scopes`, level: 'warning', messageKey: 'loginConfig.check.scopesMissing', params, field: field('scopes') }
        : { id: `${meta.id}.scopes`, level: 'pass', messageKey: 'loginConfig.check.scopesOk', params, field: field('scopes') },
    )
  }

  return checks
}

export function loginErrors(checks: readonly LoginCheck[]): LoginCheck[] {
  return checks.filter((c) => c.level === 'error')
}

export function loginWarnings(checks: readonly LoginCheck[]): LoginCheck[] {
  return checks.filter((c) => c.level === 'warning')
}

/** 字段 → 当前 issue（error 优先于 warning），供 FormField 的 issue 接线 */
export function loginFieldIssues(checks: readonly LoginCheck[]): Partial<Record<LoginField, LoginCheck>> {
  const issues: Partial<Record<LoginField, LoginCheck>> = {}
  for (const check of checks) {
    if (check.level === 'pass' || !check.field) continue
    const current = issues[check.field]
    if (!current || (current.level === 'warning' && check.level === 'error')) {
      issues[check.field] = check
    }
  }
  return issues
}

export type LoginStatus = 'pristine' | 'ready' | 'incomplete'

/**
 * 状态推导：
 *   pristine   —— 一个字都没改过（显示「使用默认」）
 *   incomplete —— 有阻断性错误（保存会被拦）
 *   ready      —— 有改动且无阻断性错误
 */
export function loginStatus(config: LoginConfig): LoginStatus {
  if (isDefaultLoginConfig(config)) return 'pristine'
  return loginErrors(validateLoginConfig(config)).length > 0 ? 'incomplete' : 'ready'
}
