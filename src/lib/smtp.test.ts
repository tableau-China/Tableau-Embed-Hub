import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SMTP_CONFIG,
  SMTP_PRESETS,
  isSmtpEmpty,
  normalizeSmtpConfig,
  presetForHost,
  smtpErrors,
  smtpStatus,
  smtpWarnings,
  validateSmtpConfig,
} from './smtp'

/**
 * SMTP 校验规则的**纯函数**用例（`src/lib/smtp.ts`）。
 *
 * 分工：这里只钉"什么算错误、什么算提醒、缺省端口怎么定"这类规则；
 * 「失焦才报错 / 保存被拦 / 密码不落盘」这些**交互行为**由 `check:smtp` 用真实浏览器驱动。
 * 规则层跑在毫秒级，改文案或改端口表时能立刻发现问题。
 */
const VALID = {
  host: 'smtp.example.com',
  port: 587,
  encryption: 'starttls' as const,
  username: 'mailer@example.com',
  fromEmail: 'mailer@example.com',
  fromName: 'Admin',
}

describe('validateSmtpConfig', () => {
  it('恒有 7 项预检，且 id 稳定', () => {
    const checks = validateSmtpConfig({ config: DEFAULT_SMTP_CONFIG, hasPassword: false })
    expect(checks).toHaveLength(7)
    expect(checks.map((c) => c.id)).toEqual([
      'host',
      'port',
      'encryption',
      'username',
      'password',
      'fromEmail',
      'provider',
    ])
  })

  it('未配置时 host 报错（空值不能保存）', () => {
    const errors = smtpErrors(validateSmtpConfig({ config: DEFAULT_SMTP_CONFIG, hasPassword: false }))
    expect(errors.map((c) => c.id)).toContain('host')
  })

  it('合法配置没有错误项', () => {
    const errors = smtpErrors(validateSmtpConfig({ config: VALID, hasPassword: true }))
    expect(errors).toEqual([])
  })

  it('有用户名却没密码 → 只是提醒，不是错误（允许"保持原密码"）', () => {
    const checks = validateSmtpConfig({ config: VALID, hasPassword: false })
    expect(smtpErrors(checks)).toEqual([])
    expect(smtpWarnings(checks).map((c) => c.id)).toContain('password')
  })

  it('每条预检都带 i18n key（页面只翻译，不写死文案）', () => {
    for (const check of validateSmtpConfig({ config: VALID, hasPassword: true })) {
      expect(check.messageKey.startsWith('smtp.')).toBe(true)
    }
  })

  it('错误项能定位到具体输入框（field），全局项除外', () => {
    const checks = validateSmtpConfig({ config: { ...VALID, host: '' }, hasPassword: true })
    const host = checks.find((c) => c.id === 'host')!
    expect(host.level).toBe('error')
    expect(host.field).toBe('host')
    const provider = checks.find((c) => c.id === 'provider')!
    expect(provider.field).toBeUndefined()
  })
})

describe('normalizeSmtpConfig（缺省与纠偏）', () => {
  it('空输入落回默认配置', () => {
    expect(normalizeSmtpConfig()).toEqual(DEFAULT_SMTP_CONFIG)
    expect(normalizeSmtpConfig(null)).toEqual(DEFAULT_SMTP_CONFIG)
  })

  it('缺端口时按加密方式取缺省端口', () => {
    expect(normalizeSmtpConfig({ host: 'h', encryption: 'ssl' }).port).toBe(465)
    expect(normalizeSmtpConfig({ host: 'h', encryption: 'starttls' }).port).toBe(587)
  })

  it('合法端口原样保留（非 465/587 的自定义端口也算合法）', () => {
    expect(normalizeSmtpConfig({ port: 2525 }).port).toBe(2525)
    expect(normalizeSmtpConfig({ port: 1 }).port).toBe(1)
    expect(normalizeSmtpConfig({ port: 65535 }).port).toBe(65535)
  })

  it('非整数端口（含字符串）一律落回该加密方式的缺省端口', () => {
    // 本函数只接受**真正的数字**：localStorage 里的脏数据不能带进状态。
    // 表单里的字符串→数字转换由页面负责（见 smtp-config-page.tsx 的 draft 归一化），
    // 所以这里对字符串的期望是"落回缺省"，而不是"帮忙转一下"。
    expect(normalizeSmtpConfig({ port: '2525' as unknown as number }).port).toBe(587)
    expect(normalizeSmtpConfig({ port: 25.5 }).port).toBe(587)
    expect(normalizeSmtpConfig({ port: Number.NaN }).port).toBe(587)
  })

  it('非法端口落回该加密方式的缺省值', () => {
    expect(normalizeSmtpConfig({ port: 0 as number, encryption: 'ssl' }).port).toBe(465)
    expect(normalizeSmtpConfig({ port: 99999 as number }).port).toBe(587)
  })

  it('非法加密方式落回缺省（不因脏数据崩）', () => {
    const config = normalizeSmtpConfig({ encryption: 'nonsense' as unknown as 'ssl' })
    expect(config.encryption).toBe(DEFAULT_SMTP_CONFIG.encryption)
  })

  it('字段两侧空白被去掉', () => {
    const config = normalizeSmtpConfig({ host: '  smtp.example.com  ', username: '  u  ' })
    expect(config.host).toBe('smtp.example.com')
    expect(config.username).toBe('u')
  })
})

describe('isSmtpEmpty / smtpStatus', () => {
  it('默认配置算"未配置"', () => {
    expect(isSmtpEmpty(DEFAULT_SMTP_CONFIG)).toBe(true)
    expect(smtpStatus({ config: DEFAULT_SMTP_CONFIG, hasPassword: false })).toBeTruthy()
  })

  it('填了主机就不算空', () => {
    expect(isSmtpEmpty({ ...DEFAULT_SMTP_CONFIG, host: 'smtp.example.com' })).toBe(false)
  })
})

describe('presetForHost', () => {
  it('常见服务商主机能命中预设', () => {
    const preset = SMTP_PRESETS[0]!
    expect(presetForHost(preset.host)?.id).toBe(preset.id)
  })

  it('未知主机返回 undefined（不硬塞预设）', () => {
    expect(presetForHost('smtp.nonexistent.example')).toBeUndefined()
  })

  it('预设的端口与加密方式自洽（465↔ssl / 587↔starttls）', () => {
    for (const preset of SMTP_PRESETS) {
      if (preset.port === 465) expect(preset.encryption, `${preset.id} 465 应为 ssl`).toBe('ssl')
      if (preset.port === 587)
        expect(preset.encryption, `${preset.id} 587 应为 starttls`).toBe('starttls')
    }
  })
})
