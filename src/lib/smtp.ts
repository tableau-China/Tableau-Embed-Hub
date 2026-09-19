/**
 * SMTP 配置的领域层（纯函数 + 常量）—— **不依赖 React / zustand / window**，
 * 与 `config/permissions.ts` 同构：`scripts/check-smtp.mjs` 直接 import 本文件做校验表断言。
 *
 * 为什么把校验放在纯函数里而不是页面组件里：
 *   1. 保存（拦错误）与「预检清单」（完整报告）用的是**同一份规则**，不会两边漂移；
 *   2. 文案一律以 i18n key + params 形式返回（本文件不引入 i18next），页面负责翻译；
 *   3. 可被 node 脚本直接跑表格断言，不必开浏览器。
 *
 * 与 pg-explorer 的差异（有意为之，见 CHANGELOG）：
 *   - pg-explorer 用 `secure: boolean` 单开关，这里用**三态加密方式**（none / starttls / ssl）——
 *     布尔开关无法表达 STARTTLS（先明文连接再用 STARTTLS 升级），而这正是 587 端口的常态；
 *   - pg-explorer 在服务端用 nodemailer `transporter.verify()` 做真实握手。纯前端模板没有后端、
 *     浏览器也无法开 TCP 连接，因此本文件的「预检」只做**配置层面**的校验（格式 + 端口/加密一致性 +
 *     服务商参考值比对），真实握手必须放到服务端（`src/features/config/smtp-config-page.tsx` 顶部有说明）。
 */

/* ============================== 类型 ============================== */

/**
 * 加密方式（三态，对齐 nodemailer 的映射）：
 *   none     → 明文（25 端口；仅限可信内网 relay）
 *   starttls → 先连明文、再 STARTTLS 升级（587 端口，最常用）
 *   ssl      → 连接即 TLS（465 端口，隐式 TLS）
 */
export type SmtpEncryption = 'none' | 'starttls' | 'ssl'

/** 加密方式 → nodemailer 传输配置（接后端时直接照抄，避免两端理解不一致） */
export interface SmtpTransportShape {
  secure: boolean
  requireTLS: boolean
}

export interface SmtpConfig {
  /** SMTP 服务器地址（只填主机名，不带协议与路径） */
  host: string
  /** 端口 1–65535 */
  port: number
  encryption: SmtpEncryption
  /** 认证用户名（多数服务商即邮箱地址；留空 = 匿名投递，仅限内网 relay） */
  username: string
  /** 发件人地址（信封 From，多数服务商要求与认证账号一致或在其白名单内） */
  fromEmail: string
  /** 发件人显示名（可选） */
  fromName: string
}

/** 校验清单里可挂到具体输入框的字段（password 不在 SmtpConfig 内，单独列出） */
export type SmtpField = keyof SmtpConfig | 'password'

export type SmtpCheckLevel = 'error' | 'warning' | 'pass'

/** 一项预检结果：level + i18n key + 可选 params（文案由页面翻译） */
export interface SmtpCheck {
  /** 稳定检查项 id（host / port / encryption / username / password / fromEmail / provider） */
  id: string
  level: SmtpCheckLevel
  messageKey: string
  params?: Record<string, string | number>
  /** 该项对应的输入框；全局项（provider）为 undefined */
  field?: SmtpField
}

/* ============================== 常量与默认值 ============================== */

/** 加密方式的展示顺序（表单下拉顺序，也是校验清单顺序） */
export const SMTP_ENCRYPTIONS: readonly SmtpEncryption[] = ['starttls', 'ssl', 'none']

/** 加密方式 → 惯用端口（切换加密方式时用它推导端口） */
export const SMTP_ENCRYPTION_PORTS: Record<SmtpEncryption, number> = {
  none: 25,
  starttls: 587,
  ssl: 465,
}

/** 出厂默认配置：587 + STARTTLS（覆盖面最广的组合） */
export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  host: '',
  port: SMTP_ENCRYPTION_PORTS.starttls,
  encryption: 'starttls',
  username: '',
  fromEmail: '',
  fromName: '',
}

export interface SmtpPreset {
  id: string
  /** 服务商名（品牌名，不翻译） */
  name: string
  host: string
  port: number
  encryption: SmtpEncryption
  /** 凭据说明的 i18n key（授权码 / 应用专用密码 / 账号密码） */
  hintKey: string
}

/**
 * 常见服务商参考值（真实参数以服务商最新文档为准）：配置页的「服务商预设」下拉与参考表
 * 共用这一份数据 —— 点了预设即回填 host / port / encryption，参考表不再手写第二份。
 * 多数服务商同时支持 465/SSL 与 587/STARTTLS，这里给出各自文档里的首选值。
 */
export const SMTP_PRESETS: readonly SmtpPreset[] = [
  {
    id: 'qq',
    name: 'QQ Mail',
    host: 'smtp.qq.com',
    port: 465,
    encryption: 'ssl',
    hintKey: 'smtp.presetCredential.qq',
  },
  {
    id: '163',
    name: '163 Mail',
    host: 'smtp.163.com',
    port: 465,
    encryption: 'ssl',
    hintKey: 'smtp.presetCredential.163',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    encryption: 'starttls',
    hintKey: 'smtp.presetCredential.gmail',
  },
  {
    id: 'aliyun-qiye',
    name: 'Alibaba Mail (Enterprise)',
    host: 'smtp.qiye.aliyun.com',
    port: 465,
    encryption: 'ssl',
    hintKey: 'smtp.presetCredential.aliyunQiye',
  },
  {
    id: 'tencent-exmail',
    name: 'Tencent Exmail',
    host: 'smtp.exmail.qq.com',
    port: 465,
    encryption: 'ssl',
    hintKey: 'smtp.presetCredential.tencentExmail',
  },
  {
    id: 'outlook',
    name: 'Microsoft 365 / Outlook',
    host: 'smtp.office365.com',
    port: 587,
    encryption: 'starttls',
    hintKey: 'smtp.presetCredential.outlook',
  },
]

/** 加密方式 → 传输层形状（`secure` = 连接即 TLS；`requireTLS` = 明文连接后强制 STARTTLS 升级） */
export function transportForEncryption(encryption: SmtpEncryption): SmtpTransportShape {
  return {
    secure: encryption === 'ssl',
    requireTLS: encryption === 'starttls',
  }
}

/** 按 host 命中服务商预设（大小写与首尾空格不敏感） */
export function presetForHost(host: string): SmtpPreset | undefined {
  const normalized = host.trim().toLowerCase()
  if (normalized === '') return undefined
  return SMTP_PRESETS.find((p) => p.host === normalized)
}

/** 按 id 命中服务商预设（下拉选择用） */
export function presetById(id: string): SmtpPreset | undefined {
  return SMTP_PRESETS.find((p) => p.id === id)
}

/** 是否「看起来还什么都没配」——用于页面上的初始态提示 */
export function isSmtpEmpty(config: SmtpConfig): boolean {
  return config.host.trim() === '' && config.fromEmail.trim() === ''
}

/* ============================== 归一化 ============================== */

/**
 * 归一化配置：localStorage 里的脏数据（旧版本、手工改过、非法加密方式）都要能安全落地，
 * 与 `normalizeGrants` 同样的思路 —— 反序列化时不因脏数据让 UI 崩。
 */
export function normalizeSmtpConfig(input?: Partial<SmtpConfig> | null): SmtpConfig {
  const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
  if (input === undefined || input === null || typeof input !== 'object') {
    return { ...DEFAULT_SMTP_CONFIG }
  }
  const encryption = SMTP_ENCRYPTIONS.includes(input.encryption as SmtpEncryption)
    ? (input.encryption as SmtpEncryption)
    : DEFAULT_SMTP_CONFIG.encryption
  const port =
    typeof input.port === 'number' && Number.isInteger(input.port) && input.port >= 1 && input.port <= 65535
      ? input.port
      : SMTP_ENCRYPTION_PORTS[encryption]
  return {
    host: str(input.host),
    port,
    encryption,
    username: str(input.username),
    fromEmail: str(input.fromEmail),
    fromName: str(input.fromName),
  }
}

/* ============================== 校验 ============================== */

export interface SmtpValidationInput {
  config: SmtpConfig
  /**
   * 当前是否已有可用密码（页面上「用户刚输入了」或「本会话已保存的」都算）。
   * 密码本身不落在配置文件里，因此它作为独立入参传入。
   */
  hasPassword: boolean
}

/** 务实的邮箱格式校验：够拦住常见笔误，又不至于拒绝国内企业邮的合法地址 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

/** 主机名允许字符（字母数字、点、连字符、下划线；不含协议、端口、路径、空格） */
const HOST_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/

/**
 * 加密方式展示名的 i18n key 前缀（`smtp.encryption` 是表单字段标签，模式文案放在 `smtp.encryptionMode.*`）。
 * 导出前缀而不是让页面自己拼字符串：校验结果里 `params.mode` 放的就是这类 key，
 * 页面据此判断「这个参数还要再翻译一次」，两边共用同一个常量才不会写歪。
 */
export const ENCRYPTION_LABEL_PREFIX = 'smtp.encryptionMode.'

/** 加密方式 → 展示名 i18n key */
export function encryptionLabelKey(encryption: SmtpEncryption): string {
  return `${ENCRYPTION_LABEL_PREFIX}${encryption}`
}

/**
 * 配置预检：返回**每一项检查**（pass / warning / error），顺序稳定 —— 页面据此渲染清单，
 * 保存按钮只看其中的 error（warning 允许保存，但会在清单里提醒）。
 *
 * 检查项（每项恒产出一条，便于清单完整展示）：
 *   host        服务器地址（必填 / 不得带协议与路径 / 字符合法性 / 单标签主机名提醒）
 *   port        端口（范围 / 与加密方式的一致性 / 25 端口出网被封提醒）
 *   encryption  加密方式（none 明文提醒）
 *   username    认证用户名（留空提醒：多数服务商必须认证）
 *   password    密码/授权码（有用户名却无密码提醒）
 *   fromEmail   发件人地址（必填 + 格式）
 *   provider    与服务商参考值比对（host 命中预设但与官方端口/加密不一致时提醒）
 */
export function validateSmtpConfig({ config, hasPassword }: SmtpValidationInput): SmtpCheck[] {
  const checks: SmtpCheck[] = []
  const host = config.host.trim()
  const port = config.port
  const encryption = config.encryption
  const username = config.username.trim()
  const fromEmail = config.fromEmail.trim()

  /* —— host —— */
  if (host === '') {
    checks.push({
      id: 'host',
      level: 'error',
      messageKey: 'smtp.check.hostRequired',
      field: 'host',
    })
  } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(host) || host.includes('/')) {
    checks.push({
      id: 'host',
      level: 'error',
      messageKey: 'smtp.check.hostHasScheme',
      field: 'host',
    })
  } else if (!HOST_RE.test(host)) {
    // 含空格或非法字符（HOST_RE 已把首尾/中间的空格排除在外）
    checks.push({
      id: 'host',
      level: 'error',
      messageKey: 'smtp.check.hostChars',
      field: 'host',
    })
  } else if (!host.includes('.')) {
    checks.push({
      id: 'host',
      level: 'warning',
      messageKey: 'smtp.check.hostIntranet',
      params: { host },
      field: 'host',
    })
  } else {
    checks.push({ id: 'host', level: 'pass', messageKey: 'smtp.check.hostOk', field: 'host' })
  }

  /* —— port —— */
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    checks.push({
      id: 'port',
      level: 'error',
      messageKey: 'smtp.check.portRange',
      field: 'port',
    })
  } else if (port === 465 && encryption !== 'ssl') {
    checks.push({
      id: 'port',
      level: 'warning',
      messageKey: 'smtp.check.portWantsSsl',
      params: { port, mode: encryptionLabelKey(encryption) },
      field: 'port',
    })
  } else if ((port === 587 || port === 25) && encryption === 'ssl') {
    checks.push({
      id: 'port',
      level: 'warning',
      messageKey: 'smtp.check.portWantsStarttls',
      params: { port },
      field: 'port',
    })
  } else if (port === 25) {
    checks.push({
      id: 'port',
      level: 'warning',
      messageKey: 'smtp.check.port25Blocked',
      field: 'port',
    })
  } else {
    checks.push({ id: 'port', level: 'pass', messageKey: 'smtp.check.portOk', field: 'port' })
  }

  /* —— encryption —— */
  if (encryption === 'none') {
    checks.push({
      id: 'encryption',
      level: 'warning',
      messageKey: 'smtp.check.encryptionNone',
      field: 'encryption',
    })
  } else {
    checks.push({
      id: 'encryption',
      level: 'pass',
      messageKey: 'smtp.check.encryptionOk',
      params: { mode: encryptionLabelKey(encryption) },
      field: 'encryption',
    })
  }

  /* —— username —— */
  if (username === '') {
    checks.push({
      id: 'username',
      level: 'warning',
      messageKey: 'smtp.check.usernameMissing',
      field: 'username',
    })
  } else if (/\s/.test(config.username)) {
    checks.push({
      id: 'username',
      level: 'error',
      messageKey: 'smtp.check.usernameWhitespace',
      field: 'username',
    })
  } else {
    checks.push({ id: 'username', level: 'pass', messageKey: 'smtp.check.usernameOk', field: 'username' })
  }

  /* —— password —— */
  if (username !== '' && !hasPassword) {
    checks.push({
      id: 'password',
      level: 'warning',
      messageKey: 'smtp.check.passwordMissing',
      field: 'password',
    })
  } else if (username === '' && hasPassword) {
    checks.push({
      id: 'password',
      level: 'warning',
      messageKey: 'smtp.check.passwordWithoutUsername',
      field: 'password',
    })
  } else {
    checks.push({
      id: 'password',
      level: 'pass',
      messageKey: hasPassword ? 'smtp.check.passwordOk' : 'smtp.check.passwordNotNeeded',
      field: 'password',
    })
  }

  /* —— fromEmail —— */
  if (fromEmail === '') {
    checks.push({
      id: 'fromEmail',
      level: 'error',
      messageKey: 'smtp.check.fromRequired',
      field: 'fromEmail',
    })
  } else if (!EMAIL_RE.test(fromEmail)) {
    checks.push({
      id: 'fromEmail',
      level: 'error',
      messageKey: 'smtp.check.fromInvalid',
      field: 'fromEmail',
    })
  } else {
    checks.push({ id: 'fromEmail', level: 'pass', messageKey: 'smtp.check.fromOk', field: 'fromEmail' })
  }

  /* —— provider：命中预设但与官方参考值不一致 —— */
  const preset = presetForHost(host)
  if (!preset) {
    checks.push({
      id: 'provider',
      level: 'pass',
      messageKey: 'smtp.check.providerCustom',
    })
  } else if (preset.port !== port || preset.encryption !== encryption) {
    checks.push({
      id: 'provider',
      level: 'warning',
      messageKey: 'smtp.check.providerMismatch',
      params: {
        provider: preset.name,
        port: preset.port,
        mode: encryptionLabelKey(preset.encryption),
      },
    })
  } else {
    checks.push({
      id: 'provider',
      level: 'pass',
      messageKey: 'smtp.check.providerOk',
      params: { provider: preset.name },
    })
  }

  return checks
}

/** 清单里的 error（拦保存的唯一依据） */
export function smtpErrors(checks: readonly SmtpCheck[]): SmtpCheck[] {
  return checks.filter((c) => c.level === 'error')
}

/** 清单里的 warning（允许保存，但页面上要提示） */
export function smtpWarnings(checks: readonly SmtpCheck[]): SmtpCheck[] {
  return checks.filter((c) => c.level === 'warning')
}

/**
 * 字段 → 该字段的首条问题（error 优先，其次 warning）——页面据此把提示挂在输入框下方。
 * 已经 pass 的字段不产生条目（不给每个框都挂一行绿字，避免噪声）。
 */
export function smtpFieldIssues(checks: readonly SmtpCheck[]): Partial<Record<SmtpField, SmtpCheck>> {
  const out: Partial<Record<SmtpField, SmtpCheck>> = {}
  const ranked = [...checks].sort((a, b) => (a.level === 'error' ? -1 : 0) - (b.level === 'error' ? -1 : 0))
  for (const check of ranked) {
    if (!check.field || check.level === 'pass') continue
    const current = out[check.field]
    if (current === undefined || (current.level === 'warning' && check.level === 'error')) {
      out[check.field] = check
    }
  }
  return out
}

/** 配置状态：empty（全新）/ incomplete（有错或有缺项）/ ready（无 error 且凭据齐备） */
export type SmtpStatus = 'empty' | 'incomplete' | 'ready'

export function smtpStatus({ config, hasPassword }: SmtpValidationInput): SmtpStatus {
  if (isSmtpEmpty(config)) return 'empty'
  const checks = validateSmtpConfig({ config, hasPassword })
  if (smtpErrors(checks).length > 0) return 'incomplete'
  return hasPassword ? 'ready' : 'incomplete'
}
