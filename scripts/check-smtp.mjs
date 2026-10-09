#!/usr/bin/env node
/**
 * check-smtp.mjs — SMTP 配置校验（node scripts/check-smtp.mjs）
 *
 * 分两段：
 *  1. **纯函数断言**：直接 import `src/lib/smtp.ts` 跑校验表 —— 覆盖「哪些组合该报错 / 该提醒 /
 *     该通过」与归一化、传输层映射、状态推导。不需要浏览器，秒级返回，改规则立刻能验。
 *  2. **页面行为用例（CDP）**：/config/smtp 的表单填值、预设回填、保存、刷新后回读，
 *     并**直接检查 localStorage** —— 证明密码确实没有落盘（这是页面上对用户的承诺）。
 *
 * 依赖：已构建的 dist/（pnpm build）+ 本机 Google Chrome。
 * 用法：pnpm build && node scripts/check-smtp.mjs
 * 退出码：0 全部通过；1 存在失败。
 *
 * 注：CDP 极简客户端与 check-permissions.mjs / check-team-routes.mjs 有意重复
 *（各自独立可跑），端口与它们错开，避免并行/残留实例互抢。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import {
  DEFAULT_SMTP_CONFIG,
  ENCRYPTION_LABEL_PREFIX,
  SMTP_ENCRYPTION_PORTS,
  SMTP_PRESETS,
  encryptionLabelKey,
  isSmtpEmpty,
  normalizeSmtpConfig,
  presetForHost,
  smtpErrors,
  smtpFieldIssues,
  smtpStatus,
  smtpWarnings,
  transportForEncryption,
  validateSmtpConfig,
} from '../src/lib/smtp.ts'

const PORT = 4322
const DEBUG_PORT = 9335
const BASE = `http://127.0.0.1:${PORT}`
/**
 * Chrome 可执行文件 —— **跨平台探测**。
 *
 * 原先这里硬编码 macOS 的路径，导致这套用例在 Linux / CI 上根本起不来（这也正是它长期只在
 * 本机跑、坏了没人发现的原因之一）。现在：优先 CHROME_PATH 环境变量，其次按平台找常见安装位置
 * （GitHub 的 ubuntu runner 自带 /usr/bin/google-chrome）。
 */
function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
    '/usr/bin/google-chrome', // Debian / Ubuntu（含 GitHub Actions runner）
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ].filter(Boolean)
  const found = candidates.find((p) => existsSync(p))
  if (!found) {
    throw new Error(
      '未找到 Chrome。请设置 CHROME_PATH 指向可执行文件，或安装 google-chrome / chromium。已尝试：' +
        candidates.join('、'),
    )
  }
  return found
}

const CHROME = resolveChrome()
const ROOT = fileURLToPath(new URL('..', import.meta.url))

const children = []
function cleanup() {
  for (const c of children) {
    // 先 SIGTERM 让它正常收尾，随后立刻补 SIGKILL：Chrome 偶尔会忽略 SIGTERM / 还在刷 profile，
    // 一旦它活过脚本退出，调试端口就被残留进程占着，下一轮会连到旧实例（见 assertPortsFree）。
    // 临时 profile 是可抛弃的，强杀没有副作用。
    try {
      c.kill('SIGTERM')
      c.kill('SIGKILL')
    } catch {
      /* ignore */
    }
  }
}

/**
 * 端口自检：**预览端口或调试端口被占用时立刻退出并说明原因**。
 *
 * 为什么必须有这道闸：调试端口若被上一轮残留的 Chrome 占用，本脚本会兴高采烈地连到那个
 * 旧实例（它停在别的页面、别的构建产物上），表现成「十几个用例一起失败」这种极难定位的
 * 假故障 —— 本项目踩过一次（见 CHANGELOG 0.6.0 的排查记录）。宁可立刻报错，也不要给出
 * 一份不可信的通过/失败报告。
 */
async function assertPortsFree() {
  for (const port of [PORT, DEBUG_PORT]) {
    let occupied = false
    try {
      await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) })
      occupied = true
    } catch {
      /* 连不上 = 空闲 */
    }
    if (occupied) {
      throw new Error(
        `端口 ${port} 已被占用，本脚本不会连接陌生实例。` +
          `请先执行 \`pkill -f "port=${port}"\`（调试端口则用 pkill -f "remote-debugging-port=${port}"）后重跑。`,
      )
    }
  }
}

/* ============================== 1. 纯函数断言 ============================== */

const failures = []
/** 断言 helper：不引入测试框架，输出保持与其它 check 脚本同风格 */
function check(name, condition, detail = '') {
  if (!condition) failures.push(`${name}${detail ? `：${detail}` : ''}`)
}

/** 连接参数齐全的一组合法配置（各用例在此基础上改一个字段） */
const GOOD = {
  host: 'smtp.qq.com',
  port: 465,
  encryption: 'ssl',
  username: 'noreply@qq.com',
  fromEmail: 'noreply@qq.com',
  fromName: 'Admin',
}

/** 某组合的校验结果摘要 */
function summarize(config, hasPassword = true) {
  const checks = validateSmtpConfig({ config, hasPassword })
  return {
    checks,
    errors: smtpErrors(checks).map((c) => c.id),
    warnings: smtpWarnings(checks).map((c) => c.id),
    passes: checks.filter((c) => c.level === 'pass').map((c) => c.id),
  }
}

// —— 空配置：host / fromEmail 报错，其余给提醒，且状态为 empty ——
{
  const r = summarize(DEFAULT_SMTP_CONFIG, false)
  check('空配置应报 host/fromEmail 两个 error', r.errors.join() === 'host,fromEmail', r.errors.join())
  check('空配置应提醒 username', r.warnings.includes('username'), r.warnings.join())
  check('空配置每项恒产出一条检查（7 项）', r.checks.length === 7, String(r.checks.length))
  check('空配置状态为 empty', smtpStatus({ config: DEFAULT_SMTP_CONFIG, hasPassword: false }) === 'empty')
}

// —— 齐全配置：无 error 无 warning，状态 ready ——
{
  const r = summarize(GOOD, true)
  check('齐全配置不应有 error', r.errors.length === 0, r.errors.join())
  check('齐全配置不应有 warning', r.warnings.length === 0, r.warnings.join())
  check('齐全配置状态为 ready', smtpStatus({ config: GOOD, hasPassword: true }) === 'ready')
  check(
    '无密码时状态降级为 incomplete',
    smtpStatus({ config: GOOD, hasPassword: false }) === 'incomplete',
  )
}

// —— 单字段异常：逐条钉住错误归类 ——
const badCases = [
  ['带协议头的主机名 → hostHasScheme', { host: 'https://smtp.example.com' }, 'error', 'host'],
  ['带路径的主机名 → hostHasScheme', { host: 'smtp.example.com/api' }, 'error', 'host'],
  ['含空格的主机名 → hostChars', { host: 'smtp example.com' }, 'error', 'host'],
  ['单标签主机名 → hostIntranet 提醒', { host: 'mail' }, 'warning', 'host'],
  ['端口越界 → portRange', { port: 70000 }, 'error', 'port'],
  ['端口为 0 → portRange', { port: 0 }, 'error', 'port'],
  ['465 配 STARTTLS → portWantsSsl 提醒', { port: 465, encryption: 'starttls' }, 'warning', 'port'],
  ['587 配 SSL → portWantsStarttls 提醒', { port: 587, encryption: 'ssl' }, 'warning', 'port'],
  ['明文加密 → encryptionNone 提醒', { encryption: 'none', port: 2525 }, 'warning', 'encryption'],
  ['用户名含空格 → usernameWhitespace', { username: 'a b@qq.com' }, 'error', 'username'],
  ['用户名留空 → usernameMissing 提醒', { username: '' }, 'warning', 'username'],
  ['发件人格式非法 → fromInvalid', { fromEmail: 'noreply' }, 'error', 'fromEmail'],
  ['发件人留空 → fromRequired', { fromEmail: '' }, 'error', 'fromEmail'],
]
for (const [name, patch, level, id] of badCases) {
  const r = summarize({ ...GOOD, ...patch }, true)
  const hit = r.checks.find((c) => c.id === id)
  check(`${name}`, hit !== undefined && hit.level === level, `实际 ${hit ? hit.level : '无该项'}`)
}

// —— 端口 25 的专用提醒（其余检查都通过时）——
{
  const r = summarize({ ...GOOD, host: 'smtp.example.com', port: 25, encryption: 'none' }, true)
  const port = r.checks.find((c) => c.id === 'port')
  check('25 端口应提醒出网被封', port?.level === 'warning' && port.messageKey === 'smtp.check.port25Blocked', port?.messageKey)
}

// —— 密码相关：有用户名无密码 / 无用户名有密码 ——
{
  const missing = summarize(GOOD, false)
  check(
    '有用户名却无密码 → passwordMissing 提醒',
    missing.warnings.includes('password') &&
      missing.checks.find((c) => c.id === 'password')?.messageKey === 'smtp.check.passwordMissing',
  )
  const orphan = summarize({ ...GOOD, username: '' }, true)
  check(
    '无用户名却有密码 → passwordWithoutUsername 提醒',
    orphan.checks.find((c) => c.id === 'password')?.messageKey === 'smtp.check.passwordWithoutUsername',
  )
}

// —— 服务商参考值比对：命中预设但端口/加密不同 ——
{
  const mismatch = summarize({ ...GOOD, port: 587, encryption: 'starttls' }, true)
  const provider = mismatch.checks.find((c) => c.id === 'provider')
  check(
    'smtp.qq.com 用 587/STARTTLS → providerMismatch 提醒',
    provider?.level === 'warning' && provider.messageKey === 'smtp.check.providerMismatch',
    provider?.messageKey,
  )
  check('providerMismatch 带服务商与官方参数', provider?.params?.provider === 'QQ Mail' && provider?.params?.port === 465)
  const custom = summarize({ ...GOOD, host: 'smtp.example.com' }, true)
  check(
    '自定义主机 → providerCustom（pass，不做比对）',
    custom.checks.find((c) => c.id === 'provider')?.messageKey === 'smtp.check.providerCustom',
  )
}

// —— 字段级问题映射：error 优先于 warning，pass 不产生条目 ——
{
  const issues = smtpFieldIssues(validateSmtpConfig({ config: { ...GOOD, host: '' }, hasPassword: true }))
  check('字段级问题指向 host', issues.host?.level === 'error' && issues.host.messageKey === 'smtp.check.hostRequired')
  check('pass 的字段不产生条目（port/fromEmail 不在其中）', issues.port === undefined && issues.fromEmail === undefined)
}

// —— 归一化：脏数据（空格、非法枚举、字符串端口、非字符串字段）—— 
{
  const n = normalizeSmtpConfig({
    host: '  smtp.163.com  ',
    port: 'oops',
    encryption: 'weird',
    username: 42,
    fromEmail: ' a@b.com ',
  })
  check('归一化：host 去空格', n.host === 'smtp.163.com', n.host)
  check('归一化：非法端口回落到加密方式的惯用端口', n.port === SMTP_ENCRYPTION_PORTS.starttls, String(n.port))
  check('归一化：非法加密方式回落到 starttls', n.encryption === 'starttls', n.encryption)
  check('归一化：非字符串字段变空串', n.username === '', JSON.stringify(n.username))
  check('归一化：fromEmail 去空格', n.fromEmail === 'a@b.com', n.fromEmail)
  check('归一化：null / undefined 都得到出厂默认', isSmtpEmpty(normalizeSmtpConfig(null)) && isSmtpEmpty(normalizeSmtpConfig(undefined)))
  check(
    '归一化：合法数据原样保留',
    JSON.stringify(normalizeSmtpConfig(GOOD)) === JSON.stringify(GOOD),
    JSON.stringify(normalizeSmtpConfig(GOOD)),
  )
}

// —— 传输层映射（接后端时要与 nodemailer 一致）——
{
  const ssl = transportForEncryption('ssl')
  const starttls = transportForEncryption('starttls')
  const none = transportForEncryption('none')
  check('ssl → secure:true / requireTLS:false', ssl.secure === true && ssl.requireTLS === false)
  check('starttls → secure:false / requireTLS:true', starttls.secure === false && starttls.requireTLS === true)
  check('none → 两者皆 false', none.secure === false && none.requireTLS === false)
}

// —— 预设数据自检：host 唯一、端口在范围、key 与词典前缀一致 ——
{
  check('预设 host 不重复', new Set(SMTP_PRESETS.map((p) => p.host)).size === SMTP_PRESETS.length)
  check('预设 id 不重复', new Set(SMTP_PRESETS.map((p) => p.id)).size === SMTP_PRESETS.length)
  for (const p of SMTP_PRESETS) {
    check(
      `预设 ${p.id} 的端口与加密方式自洽`,
      p.port === SMTP_ENCRYPTION_PORTS[p.encryption],
      `${p.port} vs ${SMTP_ENCRYPTION_PORTS[p.encryption]}`,
    )
    check(`预设 ${p.id} 的凭据文案 key 前缀正确`, p.hintKey.startsWith('smtp.presetCredential.'), p.hintKey)
    check(`预设 ${p.id} 能被 presetForHost 命中`, presetForHost(p.host)?.id === p.id)
    check(`预设 ${p.id} 的加密方式文案 key 存在`, encryptionLabelKey(p.encryption).startsWith(ENCRYPTION_LABEL_PREFIX))
  }
}

/* ============================== 2. 页面行为用例 ============================== */

/** 极简 CDP 客户端（Node 24 内置 WebSocket） */
function connectCDP(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const pending = new Map()
    let seq = 0

    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id)
        pending.delete(msg.id)
        if (msg.error) rej(new Error(JSON.stringify(msg.error)))
        else res(msg.result)
      }
    })
    ws.addEventListener('error', () => reject(new Error('CDP WebSocket 连接失败')))

    const send = (method, params = {}) =>
      new Promise((res, rej) => {
        const id = ++seq
        pending.set(id, { resolve: res, reject: rej })
        ws.send(JSON.stringify({ id, method, params }))
      })

    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (r.exceptionDetails) {
        const detail =
          r.exceptionDetails.exception?.description ??
          r.exceptionDetails.exception?.value ??
          r.exceptionDetails.text
        throw new Error(`页面执行异常：${detail}`)
      }
      return r.result.value
    }

    ws.addEventListener('open', () => resolve({ send, evaluate, close: () => ws.close() }))
  })
}

async function waitFor(label, fn, { timeout = 15000, interval = 150 } = {}) {
  const deadline = Date.now() + timeout
  let lastErr = null
  while (Date.now() < deadline) {
    try {
      const v = await fn()
      if (v) return v
    } catch (err) {
      lastErr = err
    }
    await delay(interval)
  }
  throw new Error(`等待超时：${label}${lastErr ? `（最后错误：${lastErr.message}）` : ''}`)
}

async function navigate(cdp, path) {
  await cdp.send('Page.navigate', { url: `${BASE}${path}` })
  let lastSig = null
  await waitFor(
    `${path} 渲染完成`,
    async () => {
      const sig = await cdp.evaluate(
        `JSON.stringify([document.querySelectorAll('a[href]').length, document.body.innerText.length])`,
      )
      if (sig === lastSig && JSON.parse(sig)[1] > 0) return true
      lastSig = sig
      return false
    },
    { timeout: 20000 },
  )
}

/** 给 React 受控输入赋值：走原生 setter + input 事件，否则 React 收不到变更 */
async function setInput(page, selector, value) {
  const res = await page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return 'missing'
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.focus()
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    return 'ok'
  })()`)
  if (res !== 'ok') throw new Error(`未找到输入框：${selector}`)
  await delay(120)
}

async function inputValue(page, selector) {
  return page.evaluate(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.value : null })()`,
  )
}

async function clickSelector(page, selector) {
  const res = await page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return 'missing'
    if (el.disabled) return 'disabled'
    el.click()
    return 'ok'
  })()`)
  if (res !== 'ok') throw new Error(`点击失败（${res}）：${selector}`)
  await delay(250)
}

/** 按文案点按钮（保存 / 清除密码 / 重置） */
async function clickButtonByText(page, text) {
  const res = await page.evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})
    if (!btn) return 'missing:' + [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).join(' | ')
    if (btn.disabled) return 'disabled'
    btn.click()
    return 'ok'
  })()`)
  if (res !== 'ok') throw new Error(`点击「${text}」失败：${res}`)
  await delay(250)
}

const CASES = [
  {
    name: '系统管理员可达 /config/smtp，预检清单恒有 7 项、初始状态为未配置',
    path: '/config/smtp',
    custom: async (page) => {
      const out = []
      const status = await page.evaluate(
        `document.querySelector('[data-smtp-status]')?.getAttribute('data-smtp-status')`,
      )
      if (status !== 'empty') out.push(`初始状态应为 empty，实际 ${status}`)
      const checks = await page.evaluate(`document.querySelectorAll('[data-smtp-checks] li').length`)
      if (checks !== 7) out.push(`预检清单应为 7 项，实际 ${checks}`)
      const presets = await page.evaluate(`document.querySelectorAll('[data-smtp-preset]').length`)
      if (presets !== SMTP_PRESETS.length) out.push(`服务商预设按钮应有 ${SMTP_PRESETS.length} 个，实际 ${presets}`)
      // 初始（未碰过字段）不应满屏红字：错误只在碰过字段或点过保存后出现
      const issues = await page.evaluate(`document.querySelectorAll('[data-smtp-issue]').length`)
      if (issues !== 0) out.push(`刚进入页面不应显示字段级错误，实际 ${issues} 处`)
      const text = await page.evaluate('document.body.innerText')
      for (const needle of ['SMTP server', 'Configuration check', 'Provider reference']) {
        if (!text.includes(needle)) out.push(`页面文本缺少「${needle}」`)
      }
      return out
    },
  },
  {
    // 不设 path：before 里的交互状态（表单改动）必须留在当前页面被断言，不能再导航一次
    name: '点服务商预设回填 host/port/加密方式',
    before: async (page) => clickSelector(page, '[data-smtp-preset="qq"]'),
    custom: async (page) => {
      const out = []
      const host = await inputValue(page, '#smtp-host')
      const port = await inputValue(page, '#smtp-port')
      if (host !== 'smtp.qq.com') out.push(`host 应为 smtp.qq.com，实际 ${host}`)
      if (port !== '465') out.push(`port 应为 465，实际 ${port}`)
      const mode = await page.evaluate(`document.querySelector('#smtp-encryption')?.textContent?.trim()`)
      if (mode !== 'SSL/TLS') out.push(`加密方式应为 SSL/TLS，实际 ${mode}`)
      return out
    },
  },
  {
    name: '字段级校验：清空 host → 失焦报错、点保存拦截且不落盘',
    before: async (page) => {
      await clickSelector(page, '[data-smtp-preset="gmail"]')
      await setInput(page, '#smtp-username', 'noreply@gmail.com')
      await setInput(page, '#smtp-password', 'app-password-here')
      await setInput(page, '#smtp-from', 'noreply@gmail.com')
      await setInput(page, '#smtp-host', '')
    },
    custom: async (page) => {
      const out = []
      // 1) 碰过的字段立即显示错误（FormField 的说明行带 data-field-message / data-field-level 钩子）
      const issue = await page.evaluate(
        `document.querySelector('[data-field-message="smtp-host"]')?.textContent?.trim()`,
      )
      if (!issue || !issue.includes('Host is required')) out.push(`host 字段应显示必填错误，实际：${issue}`)
      const level = await page.evaluate(
        `document.querySelector('[data-field-message="smtp-host"]')?.getAttribute('data-field-level')`,
      )
      if (level !== 'error') out.push(`host 说明行的级别应为 error，实际 ${level}`)

      // 2) 保存按钮**不应**因为校验错误而置灰：点一下要能统一揭示错误（否则用户点不动也看不到原因）
      const saveDisabled = await page.evaluate(`(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save changes')
        return btn ? btn.disabled : null
      })()`)
      if (saveDisabled !== false) out.push('有改动时保存按钮不应禁用（校验错误应通过点击后的提示暴露）')

      await clickButtonByText(page, 'Save changes')
      await delay(300)
      const text = await page.evaluate('document.body.innerText')
      if (!text.includes('blocking error')) out.push('点保存应弹出「存在阻断性错误」的提示')
      const persisted = await page.evaluate(`localStorage.getItem('tableau-embed-hub:config')`)
      if (persisted !== null) out.push(`校验未通过时不应写入配置，实际写入：${persisted}`)

      const checks = await page.evaluate(`document.querySelectorAll('[data-smtp-checks] li').length`)
      if (checks !== 7) out.push(`预检清单应保持 7 项，实际 ${checks}`)
      return out
    },
  },
  {
    // 保留 path：before 保存后由 runCase 再导航一次 —— 相当于整页硬刷新，正是要验的场景
    name: '保存后刷新：连接参数回读，密码不落盘',
    path: '/config/smtp',
    before: async (page) => {
      await clickSelector(page, '[data-smtp-preset="163"]')
      await setInput(page, '#smtp-username', 'noreply@163.com')
      await setInput(page, '#smtp-password', 'super-secret-code')
      await setInput(page, '#smtp-from', 'noreply@163.com')
      await setInput(page, '#smtp-from-name', 'tableau-embed-hub')
      await clickButtonByText(page, 'Save changes')
      await delay(300)
      // 随后的 runCase 会再导航一次（整页重新加载）—— 验证持久化真的写盘、且只写了非敏感字段
    },
    custom: async (page) => {
      const out = []
      const host = await inputValue(page, '#smtp-host')
      const port = await inputValue(page, '#smtp-port')
      const username = await inputValue(page, '#smtp-username')
      const from = await inputValue(page, '#smtp-from')
      const fromName = await inputValue(page, '#smtp-from-name')
      const password = await inputValue(page, '#smtp-password')
      if (host !== 'smtp.163.com') out.push(`刷新后 host 应为 smtp.163.com，实际 ${host}`)
      if (port !== '465') out.push(`刷新后 port 应为 465，实际 ${port}`)
      if (username !== 'noreply@163.com') out.push(`刷新后 username 未回读：${username}`)
      if (from !== 'noreply@163.com') out.push(`刷新后发件人未回读：${from}`)
      if (fromName !== 'tableau-embed-hub') out.push(`刷新后发件人名称未回读：${fromName}`)
      if (password !== '') out.push('刷新后密码输入框应为空（密码不落盘）')

      const raw = await page.evaluate(`localStorage.getItem('tableau-embed-hub:config')`)
      if (raw === null) out.push('localStorage 里没有 tableau-embed-hub:config')
      else {
        if (/password/i.test(raw)) out.push(`持久化数据里出现了 password 字段：${raw}`)
        if (!raw.includes('smtp.163.com')) out.push(`持久化数据里缺少主机名：${raw}`)
      }
      return out
    },
  },
  {
    // 不设 path：密码只存在于内存，整页刷新就会丢 —— 必须留在同一页断言
    name: '会话内已保存密码：显示「密码在内存中」并可清除',
    before: async (page) => {
      await clickSelector(page, '[data-smtp-preset="gmail"]')
      await setInput(page, '#smtp-username', 'noreply@gmail.com')
      await setInput(page, '#smtp-password', 'app-password-here')
      await setInput(page, '#smtp-from', 'noreply@gmail.com')
      await clickButtonByText(page, 'Save changes')
      await delay(300)
    },
    custom: async (page) => {
      const out = []
      const text = await page.evaluate('document.body.innerText')
      if (!text.includes('Password in memory')) out.push('保存后应显示「Password in memory」徽章')
      const status = await page.evaluate(
        `document.querySelector('[data-smtp-status]')?.getAttribute('data-smtp-status')`,
      )
      if (status !== 'ready') out.push(`配置齐全 + 有密码时状态应为 ready，实际 ${status}`)
      await clickSelector(page, '[data-smtp-action="clear-password"]')
      const after = await page.evaluate('document.body.innerText')
      if (after.includes('Password in memory')) out.push('点「清除密码」后不应再显示内存密码徽章')
      return out
    },
  },
  {
    // 不设 path：确认框必须留在同一页里操作
    name: '重置需二次确认，确认后回到出厂默认',
    before: async (page) => {
      await clickSelector(page, '[data-smtp-preset="outlook"]')
      await setInput(page, '#smtp-from', 'noreply@example.com')
      await clickButtonByText(page, 'Save changes')
      await delay(200)
      await clickSelector(page, '[data-smtp-action="reset"]')
      await delay(300)
    },
    custom: async (page) => {
      const out = []
      const dialog = await page.evaluate(
        `document.querySelector('[role="dialog"]')?.innerText ?? ''`,
      )
      if (!dialog.includes('Reset the SMTP configuration?')) out.push('重置应先弹出确认框（不做 window.confirm）')
      const confirmed = await page.evaluate(`(() => {
        const btn = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === 'Reset configuration')
        if (!btn) return 'missing'
        btn.click()
        return 'ok'
      })()`)
      if (confirmed !== 'ok') out.push(`确认框里未找到「Reset configuration」按钮：${confirmed}`)
      await delay(400)
      const host = await inputValue(page, '#smtp-host')
      const port = await inputValue(page, '#smtp-port')
      if (host !== '') out.push(`重置后 host 应为空，实际 ${host}`)
      if (port !== String(SMTP_ENCRYPTION_PORTS.starttls)) out.push(`重置后 port 应为 587，实际 ${port}`)
      const raw = await page.evaluate(`localStorage.getItem('tableau-embed-hub:config')`)
      if (raw !== null && raw.includes('smtp.office365.com')) {
        out.push(`重置后持久化数据仍保留旧主机名：${raw}`)
      }
      return out
    },
  },
]

const results = []

async function runCase(cdp, c) {
  const caseFailures = []
  // 每个用例从干净状态开始：清空持久化后重新加载
  await navigate(cdp, '/config/smtp')
  await cdp.evaluate(`localStorage.clear()`)
  await navigate(cdp, '/config/smtp')
  try {
    if (c.before) await c.before(cdp)
    if (c.path !== undefined) await navigate(cdp, c.path)
    if (c.custom) caseFailures.push(...(await c.custom(cdp)))
  } catch (err) {
    caseFailures.push(err.message)
  }
  results.push({ name: c.name, failures: caseFailures })
}

async function main() {
  await assertPortsFree()

  const vite = spawn(
    'node_modules/.bin/vite',
    ['preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: 'ignore' },
  )
  children.push(vite)
  await waitFor('vite preview 就绪', async () => (await fetch(BASE)).ok)

  const userDataDir = mkdtempSync(join(ROOT, '.tmp-chrome-'))
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--no-sandbox',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1440,900',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-extensions',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  children.push(chrome)

  const target = await waitFor('Chrome CDP 目标', async () => {
    const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()
    return list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
  })

  const cdp = await connectCDP(target.webSocketDebuggerUrl)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  for (const c of CASES) {
    try {
      await runCase(cdp, c)
    } catch (err) {
      results.push({ name: c.name, failures: [err.message] })
    }
  }

  cdp.close()
  // 先结束浏览器再删临时 profile：Chrome 仍在写盘时 rmSync 会抛 ENOTEMPTY，
  // 而这属于清理步骤 —— 绝不能因此把已经跑出来的用例结果一起丢掉。
  cleanup()
  await delay(500)
  try {
    rmSync(userDataDir, { recursive: true, force: true })
  } catch {
    /* 临时目录清理失败不影响校验结论（下次运行会新建） */
  }

  let failed = failures.length
  console.log('\n[SMTP] 校验规则断言：' + (failures.length === 0 ? 'PASS' : 'FAIL'))
  for (const f of failures) console.log('  ✗ ' + f)

  for (const r of results) {
    if (r.failures.length === 0) {
      console.log(`  ✓ ${r.name}`)
    } else {
      failed += r.failures.length
      console.log(`  ✗ ${r.name}`)
      for (const f of r.failures) console.log('      ' + f)
    }
  }

  if (failed > 0) {
    console.log(
      `\n[SMTP] FAILED：${CASES.length - results.filter((r) => r.failures.length).length}/${CASES.length} 页面用例通过，共 ${failed} 处失败`,
    )
    cleanup()
    process.exit(1)
  }
  console.log(`\n[SMTP] OK：规则断言 + ${CASES.length} 项页面用例全部通过`)
  cleanup()
  process.exit(0)
}

main().catch((err) => {
  console.error('[SMTP] 运行失败：' + err.message)
  cleanup()
  process.exit(1)
})
