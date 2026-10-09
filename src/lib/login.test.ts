import { describe, expect, it } from 'vitest'

import common from '@/i18n/locales/en-US/common.json'
import {
  DEFAULT_HERO_IMAGE_URL,
  DEFAULT_LOGIN_CONFIG,
  DEFAULT_LOGIN_TEMPLATE,
  LOGIN_TEMPLATES,
  OAUTH_PROVIDERS,
  isDefaultLoginConfig,
  loginErrors,
  loginFieldIssues,
  loginStatus,
  loginTemplateMeta,
  loginWarnings,
  normalizeLoginConfig,
  resolveHeroImageUrl,
  validateLoginConfig,
  type LoginConfig,
} from './login'

/** 逐层取 i18n key 并确认叶子是字符串（与 permissions.test.ts 同一做法：目录里的动态 key 也要真的存在） */
function hasI18nKey(key: string): boolean {
  let node: unknown = common
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return false
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string'
}

/** 深度扫描配置里所有 key 名，用于「不含任何密钥字段」的兜底断言 */
function allKeys(value: unknown, out: string[] = []): string[] {
  if (value === null || typeof value !== 'object') return out
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out.push(k)
    allKeys(v, out)
  }
  return out
}

describe('目录不变量', () => {
  it('模板 id 唯一，默认模板在目录里', () => {
    const ids = LOGIN_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(DEFAULT_LOGIN_TEMPLATE)
  })

  it('provider id 唯一，且 GitHub / Google 都在目录里', () => {
    const ids = OAUTH_PROVIDERS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(['github', 'google'])
  })

  it('目录里的文案 key 都存在于词典', () => {
    for (const t of LOGIN_TEMPLATES) {
      expect(hasI18nKey(t.nameKey), t.nameKey).toBe(true)
      expect(hasI18nKey(t.descriptionKey), t.descriptionKey).toBe(true)
    }
  })

  it('provider 的官方端点都是 https', () => {
    for (const p of OAUTH_PROVIDERS) {
      expect(p.authorizeUrl.startsWith('https://'), p.authorizeUrl).toBe(true)
    }
  })
})

describe('normalizeLoginConfig（脏数据收敛）', () => {
  it('undefined / null 都返回出厂配置', () => {
    expect(normalizeLoginConfig()).toEqual(DEFAULT_LOGIN_CONFIG)
    expect(normalizeLoginConfig(null)).toEqual(DEFAULT_LOGIN_CONFIG)
  })

  it('未知模板 → 出厂模板', () => {
    expect(normalizeLoginConfig({ template: 'nope' }).template).toBe(DEFAULT_LOGIN_TEMPLATE)
  })

  it('未知 provider key 被丢弃，缺失字段补出厂值', () => {
    const config = normalizeLoginConfig({
      providers: { wechat: { enabled: true }, github: { clientId: 'abc' } },
    })
    expect(Object.keys(config.providers).sort()).toEqual(['github', 'google'])
    expect(config.providers.github.clientId).toBe('abc')
    // 只覆盖 clientId，其余字段应保持出厂值
    expect(config.providers.github.authorizeUrl).toBe(DEFAULT_LOGIN_CONFIG.providers.github.authorizeUrl)
    expect(config.providers.google).toEqual(DEFAULT_LOGIN_CONFIG.providers.google)
  })

  it('类型不对的字段退回家底值（不把脏值透传给 UI）', () => {
    const config = normalizeLoginConfig({
      heroImageUrl: 42,
      providers: { github: { enabled: 'yes', clientId: null, scopes: { a: 1 } } },
    })
    expect(config.heroImageUrl).toBe('')
    expect(config.providers.github.enabled).toBe(true)
    expect(config.providers.github.clientId).toBe('')
    expect(config.providers.github.scopes).toBe(DEFAULT_LOGIN_CONFIG.providers.github.scopes)
  })

  it('字符串字段一律 trim（避免复制粘贴带进来的空格）', () => {
    const config = normalizeLoginConfig({ heroImageUrl: '  https://cdn.example.com/a.png  ' })
    expect(config.heroImageUrl).toBe('https://cdn.example.com/a.png')
  })
})

describe('validateLoginConfig（预检规则）', () => {
  it('出厂配置：没有 error，只有「未填 Client ID」的 warning', () => {
    const checks = validateLoginConfig(DEFAULT_LOGIN_CONFIG)
    expect(loginErrors(checks)).toHaveLength(0)
    const warnings = loginWarnings(checks)
    // 出厂状态：Client ID 与回调地址都还空着（两者都只是 warning，不拦保存）
    expect(warnings.map((c) => c.id).sort()).toEqual([
      'github.clientId',
      'github.redirectUri',
      'google.clientId',
      'google.redirectUri',
    ])
  })

  it('宣传图：空 = 用内置图（pass）；站内路径 / https 都通过；其它形态报 error', () => {
    const level = (heroImageUrl: string) =>
      validateLoginConfig({ ...DEFAULT_LOGIN_CONFIG, heroImageUrl }).find((c) => c.id === 'heroImageUrl')!
    expect(level('').level).toBe('pass')
    expect(level('').messageKey).toBe('loginConfig.check.heroDefault')
    expect(level('/images/hero.png').level).toBe('pass')
    expect(level('https://cdn.example.com/hero.png').level).toBe('pass')
    expect(level('cdn.example.com/hero.png').level).toBe('error')
  })

  it('授权端点必须 https：明文端点报 error 且挂到该字段', () => {
    const checks = validateLoginConfig(
      normalizeLoginConfig({ providers: { github: { authorizeUrl: 'http://github.com/login/oauth/authorize' } } }),
    )
    const check = checks.find((c) => c.id === 'github.authorizeUrl')!
    expect(check.level).toBe('error')
    expect(check.field).toBe('github.authorizeUrl')
  })

  it('授权端点留空报 error（不能让按钮指向空地址）', () => {
    const checks = validateLoginConfig(normalizeLoginConfig({ providers: { github: { authorizeUrl: '' } } }))
    expect(checks.find((c) => c.id === 'github.authorizeUrl')!.level).toBe('error')
  })

  it('回调地址：留空只提醒；既不是 http(s) 也不是站内路径才报 error', () => {
    const missing = validateLoginConfig(DEFAULT_LOGIN_CONFIG).find((c) => c.id === 'github.redirectUri')!
    expect(missing.level).toBe('warning')
    const invalid = validateLoginConfig(
      normalizeLoginConfig({ providers: { github: { redirectUri: 'callback' } } }),
    ).find((c) => c.id === 'github.redirectUri')!
    expect(invalid.level).toBe('error')
    const local = validateLoginConfig(
      normalizeLoginConfig({ providers: { github: { redirectUri: 'http://localhost:3000/callback' } } }),
    ).find((c) => c.id === 'github.redirectUri')!
    expect(local.level).toBe('pass')
  })

  it('scope 留空只提醒（不拦保存）', () => {
    const check = validateLoginConfig(
      normalizeLoginConfig({ providers: { google: { scopes: '' } } }),
    ).find((c) => c.id === 'google.scopes')!
    expect(check.level).toBe('warning')
  })

  it('未启用的 provider 只产出一条 pass，且不再提醒 Client ID', () => {
    const checks = validateLoginConfig(normalizeLoginConfig({ providers: { github: { enabled: false } } }))
    expect(checks.find((c) => c.id === 'github.enabled')!.level).toBe('pass')
    expect(checks.some((c) => c.id === 'github.clientId')).toBe(false)
  })

  it('loginFieldIssues：同一字段 error 优先于 warning', () => {
    const checks = validateLoginConfig(
      normalizeLoginConfig({ providers: { github: { clientId: '', redirectUri: 'callback' } } }),
    )
    const issues = loginFieldIssues(checks)
    expect(issues['github.clientId']!.level).toBe('warning')
    expect(issues['github.redirectUri']!.level).toBe('error')
    expect(issues.heroImageUrl).toBeUndefined() // pass 不进 issues
  })
})

describe('状态与派生值', () => {
  it('出厂配置 = pristine；改了样式但无 error = ready；有 error = incomplete', () => {
    expect(loginStatus(DEFAULT_LOGIN_CONFIG)).toBe('pristine')
    const changed: LoginConfig = { ...DEFAULT_LOGIN_CONFIG, template: 'split-hero' }
    expect(loginStatus(changed)).toBe('ready')
    expect(loginStatus({ ...changed, heroImageUrl: 'nope' })).toBe('incomplete')
  })

  it('isDefaultLoginConfig 对改动敏感（含 provider 字段）', () => {
    expect(isDefaultLoginConfig(DEFAULT_LOGIN_CONFIG)).toBe(true)
    expect(isDefaultLoginConfig({ ...DEFAULT_LOGIN_CONFIG, providers: { ...DEFAULT_LOGIN_CONFIG.providers, google: { ...DEFAULT_LOGIN_CONFIG.providers.google, enabled: false } } })).toBe(false)
  })

  it('宣传图地址：空取内置图，非空取配置值', () => {
    expect(resolveHeroImageUrl(DEFAULT_LOGIN_CONFIG)).toBe(DEFAULT_HERO_IMAGE_URL)
    expect(resolveHeroImageUrl({ ...DEFAULT_LOGIN_CONFIG, heroImageUrl: 'https://x/y.png' })).toBe('https://x/y.png')
  })

  it('loginTemplateMeta 对未知 id 兜底到目录首项（不抛异常）', () => {
    expect(loginTemplateMeta('nope' as never).id).toBe(LOGIN_TEMPLATES[0].id)
  })
})

describe('安全不变量（对用户的承诺，用用例兜住）', () => {
  it('配置结构与归一化结果里没有任何密钥字段', () => {
    const keys = allKeys(normalizeLoginConfig()).map((k) => k.toLowerCase())
    for (const key of keys) {
      expect(key.includes('secret'), key).toBe(false)
      expect(key.includes('password'), key).toBe(false)
      expect(key.includes('token'), key).toBe(false)
    }
  })
})
