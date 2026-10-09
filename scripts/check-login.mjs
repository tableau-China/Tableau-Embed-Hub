#!/usr/bin/env node
/**
 * check-login.mjs — 登录页功能校验（node scripts/check-login.mjs）
 *
 * 分两段（与 check-smtp.mjs 同构）：
 *
 *  1. **纯函数断言**：直接 import `src/lib/login.ts` 跑规则表 —— 目录不变量、脏数据归一化、
 *     预检规则（哪些组合报错 / 提醒 / 通过）、状态推导、宣传图地址解析。秒级返回，改规则立刻能验。
 *  2. **页面行为用例（CDP）**：/config/login 改配置 → 保存 → 整页刷新 → /login 真的换了样子；
 *     provider 开关与宣传图地址一路传到模板；校验不通过时**不写盘**；
 *     点第三方入口只提示不跳转；恢复默认回出厂值。
 *     并**直接检查 localStorage**：证明配置里没有任何 secret 字段（这是页面上对用户的承诺）。
 *
 * 依赖：已构建的 dist/（pnpm build）+ 本机 Google Chrome。
 * 用法：pnpm build && node scripts/check-login.mjs
 * 退出码：0 全部通过；1 存在失败。
 *
 * 注：CDP 极简客户端与其它 check 脚本有意重复（各自独立可跑），端口与它们错开，
 *     避免并行 / 残留实例互抢。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import {
  DEFAULT_HERO_IMAGE_URL,
  DEFAULT_LOGIN_CONFIG,
  DEFAULT_LOGIN_TEMPLATE,
  LOGIN_TEMPLATES,
  OAUTH_PROVIDERS,
  loginErrors,
  loginStatus,
  normalizeLoginConfig,
  resolveHeroImageUrl,
  sameLoginConfig,
  validateLoginConfig,
} from '../src/lib/login.ts'

const PORT = 4324
const DEBUG_PORT = 9337
const BASE = `http://127.0.0.1:${PORT}`

/** 已保存样式 / 宣传图 / provider 开关的稳定选择器（与配置页的 data-* 钩子一一对应） */
const SEL = {
  status: '[data-login-status]',
  templateOption: (id) => `[data-login-template-option="${id}"]`,
  providerSwitch: (id) => `[data-login-provider-enable="${id}"]`,
  heroInput: '#login-hero-image',
  checks: '[data-login-checks] li',
  reset: '[data-login-action="reset"]',
}

/**
 * Chrome 可执行文件 —— **跨平台探测**（与其它 check 脚本同一段逻辑：优先 CHROME_PATH，
 * 其次按平台找常见安装位置；GitHub 的 ubuntu runner 自带 /usr/bin/google-chrome）。
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
    try {
      c.kill('SIGTERM')
      c.kill('SIGKILL')
    } catch {
      /* ignore */
    }
  }
}

/**
 * 端口自检：预览端口或调试端口被占用时立刻退出。
 *
 * 调试端口若被上一轮残留的 Chrome 占着，本脚本会连到那个旧实例（停在别的页面、别的构建产物上），
 * 表现成"一堆用例同时失败"这种极难定位的假故障。宁可立刻报错，也不要给出不可信的报告。
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
          `请先执行 pkill 清理残留进程（预览端口用 "port=${port}"，调试端口用 "remote-debugging-port=${port}"）后重跑。`,
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

// —— 目录不变量 ——
check('登录样式 id 不重复', new Set(LOGIN_TEMPLATES.map((t) => t.id)).size === LOGIN_TEMPLATES.length)
check(
  '默认样式在目录里',
  LOGIN_TEMPLATES.some((t) => t.id === DEFAULT_LOGIN_TEMPLATE),
  DEFAULT_LOGIN_TEMPLATE,
)
check('第三方 provider 目录非空', OAUTH_PROVIDERS.length > 0)
check('provider id 不重复', new Set(OAUTH_PROVIDERS.map((p) => p.id)).size === OAUTH_PROVIDERS.length)
for (const meta of OAUTH_PROVIDERS) {
  check(`provider ${meta.id} 的授权端点必须是 https`, meta.authorizeUrl.startsWith('https://'), meta.authorizeUrl)
  check(`provider ${meta.id} 必须有默认 scope`, meta.scopes.trim() !== '')
  check(`provider ${meta.id} 必须有品牌名`, meta.name.trim() !== '', meta.name)
}

// —— 归一化：脏数据必须收敛成可渲染的形状 ——
{
  const dirty = normalizeLoginConfig({
    template: 'not-a-template',
    heroImageUrl: 42,
    providers: { wechat: { enabled: true }, github: { enabled: 'yes', clientId: null } },
  })
  check('未知样式回落到默认样式', dirty.template === DEFAULT_LOGIN_TEMPLATE, dirty.template)
  check('非字符串宣传图地址被丢弃', dirty.heroImageUrl === '', dirty.heroImageUrl)
  check(
    '未知 provider 键被丢弃',
    Object.keys(dirty.providers).sort().join() === OAUTH_PROVIDERS.map((p) => p.id).sort().join(),
    Object.keys(dirty.providers).join(),
  )
  check('脏 enabled 退回出厂布尔值', dirty.providers.github.enabled === true)
  check('null clientId 退回空串', dirty.providers.github.clientId === '')
  check('undefined 输入 = 出厂配置', sameLoginConfig(normalizeLoginConfig(undefined), DEFAULT_LOGIN_CONFIG))
}

// —— 预检规则 ——
{
  const base = validateLoginConfig(DEFAULT_LOGIN_CONFIG)
  check('出厂配置没有阻断性错误', loginErrors(base).length === 0, loginErrors(base).map((c) => c.id).join())
  check('出厂配置状态为 pristine', loginStatus(DEFAULT_LOGIN_CONFIG) === 'pristine')

  const badHero = validateLoginConfig({ ...DEFAULT_LOGIN_CONFIG, heroImageUrl: 'not a url' })
  check('非法宣传图地址报 error', loginErrors(badHero).some((c) => c.id === 'heroImageUrl'))

  const httpEndpoint = validateLoginConfig(
    normalizeLoginConfig({ providers: { github: { authorizeUrl: 'http://github.com/login/oauth/authorize' } } }),
  )
  check('明文授权端点报 error', loginErrors(httpEndpoint).some((c) => c.id === 'github.authorizeUrl'))

  const noEndpoint = validateLoginConfig(normalizeLoginConfig({ providers: { github: { authorizeUrl: '' } } }))
  check('空授权端点报 error', loginErrors(noEndpoint).some((c) => c.id === 'github.authorizeUrl'))

  const disabled = validateLoginConfig(normalizeLoginConfig({ providers: { github: { enabled: false } } }))
  check('未启用的 provider 不再提醒 Client ID', !disabled.some((c) => c.id === 'github.clientId'))

  const changed = { ...DEFAULT_LOGIN_CONFIG, template: 'split-hero' }
  check('改了样式但无 error → ready', loginStatus(changed) === 'ready')
  check('有 error → incomplete', loginStatus({ ...changed, heroImageUrl: 'nope' }) === 'incomplete')
}

// —— 宣传图解析 ——
check('空配置取内置图', resolveHeroImageUrl(DEFAULT_LOGIN_CONFIG) === DEFAULT_HERO_IMAGE_URL)
check(
  '配置了地址就取配置值',
  resolveHeroImageUrl({ ...DEFAULT_LOGIN_CONFIG, heroImageUrl: 'https://x/y.png' }) === 'https://x/y.png',
)
check('内置图确实存在于 public/', existsSync(join(ROOT, 'public', DEFAULT_HERO_IMAGE_URL.replace(/^\//, ''))))

// —— 安全不变量：配置里不许出现任何密钥字段（对用户的承诺，用断言兜住）——
{
  const serialized = JSON.stringify(DEFAULT_LOGIN_CONFIG)
  check('出厂配置不含 secret / password', !/secret|password/i.test(serialized), serialized)
  check('sameLoginConfig 对 provider 字段改动敏感', !sameLoginConfig(
    DEFAULT_LOGIN_CONFIG,
    { ...DEFAULT_LOGIN_CONFIG, providers: { ...DEFAULT_LOGIN_CONFIG.providers, google: { ...DEFAULT_LOGIN_CONFIG.providers.google, enabled: false } } },
  ))
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

/** 按文案点按钮（保存 / 放弃 / 恢复默认） */
async function clickButtonByText(page, text) {
  const res = await page.evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})
    if (!btn) return 'missing:' + [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).join(' | ')
    if (btn.disabled) {
      return 'disabled:' + [...document.querySelectorAll('button')]
        .map((b) => b.textContent.trim() + (b.disabled ? '(disabled)' : ''))
        .join(' | ')
    }
    btn.click()
    return 'ok'
  })()`)
  if (res !== 'ok') throw new Error(`点击「${text}」失败：${res}`)
  await delay(250)
}

/** 断言小工具：把「期望值不符」收成一行输出 */
function expectEq(out, label, actual, expected) {
  if (actual !== expected) out.push(`${label} 应为 ${expected}，实际 ${actual}`)
}

const CASES = [
  {
    name: '/config/login 可达：三个样式、两个 provider、预检清单齐备且无字段级报错',
    path: '/config/login',
    custom: async (page) => {
      const out = []
      expectEq(out, '初始状态', await page.evaluate(`document.querySelector('${SEL.status}')?.getAttribute('data-login-status')`), 'pristine')
      expectEq(
        out,
        '样式选项数',
        await page.evaluate(`document.querySelectorAll('[data-login-template-option]').length`),
        LOGIN_TEMPLATES.length,
      )
      expectEq(
        out,
        'provider 开关数',
        await page.evaluate(`document.querySelectorAll('[data-login-provider-enable]').length`),
        OAUTH_PROVIDERS.length,
      )
      expectEq(
        out,
        '预检清单项数',
        await page.evaluate(`document.querySelectorAll('${SEL.checks}').length`),
        validateLoginConfig(DEFAULT_LOGIN_CONFIG).length,
      )
      // 刚进页面不应满屏红字（错误只在碰过字段或点过保存后出现）
      expectEq(
        out,
        '初始字段级 error 数',
        await page.evaluate(`document.querySelectorAll('[data-field-level="error"]').length`),
        0,
      )
      const text = await page.evaluate('document.body.innerText')
      for (const needle of ['GitHub', 'Google', 'Configuration check']) {
        if (!text.includes(needle)) out.push(`页面文本缺少「${needle}」`)
      }
      const preview = await page.evaluate(
        `(() => { const a = document.querySelector('a[href="/login"]'); return a ? a.getAttribute('target') : null })()`,
      )
      expectEq(out, '预览入口 target', preview, '_blank')
      return out
    },
  },
  {
    name: '选样式 + 填宣传图 → 保存 → 整页刷新后回读，且落盘数据里没有 secret',
    path: '/config/login',
    before: async (page) => {
      await clickSelector(page, SEL.templateOption('split-hero'))
      await setInput(page, SEL.heroInput, 'https://cdn.example.com/hero.png')
      await clickButtonByText(page, 'Save changes')
      await delay(300)
    },
    custom: async (page) => {
      const out = []
      expectEq(
        out,
        '重新加载后 split-hero 仍选中',
        await page.evaluate(`document.querySelector('${SEL.templateOption('split-hero')}')?.getAttribute('aria-pressed')`),
        'true',
      )
      expectEq(out, '宣传图地址回读', await inputValue(page, SEL.heroInput), 'https://cdn.example.com/hero.png')
      expectEq(out, '保存后状态', await page.evaluate(`document.querySelector('${SEL.status}')?.getAttribute('data-login-status')`), 'ready')

      const raw = await page.evaluate(`localStorage.getItem('tableau-embed-hub:config')`)
      if (!raw) out.push('保存后 localStorage 里应有 tableau-embed-hub:config')
      else {
        if (!raw.includes('split-hero')) out.push(`持久化数据里缺少样式 id：${raw}`)
        if (!raw.includes('cdn.example.com')) out.push(`持久化数据里缺少宣传图地址：${raw}`)
        if (/secret|password/i.test(raw)) out.push(`持久化数据里出现了敏感字段：${raw}`)
      }
      return out
    },
  },
  {
    name: '/login 是裸布局（无侧边栏/头部）、默认居中卡片、不需要任何权限',
    path: '/login',
    custom: async (page) => {
      const out = []
      expectEq(
        out,
        '默认样式',
        await page.evaluate(`document.querySelector('[data-login-template]')?.getAttribute('data-login-template')`),
        DEFAULT_LOGIN_TEMPLATE,
      )
      expectEq(
        out,
        'App shell 元素数（侧边栏 + 头部）',
        await page.evaluate(
          `document.querySelectorAll('[data-slot="sidebar"]').length + document.querySelectorAll('header').length`,
        ),
        0,
      )
      expectEq(
        out,
        '第三方入口数',
        await page.evaluate(`document.querySelectorAll('[data-login-provider]').length`),
        OAUTH_PROVIDERS.length,
      )
      expectEq(
        out,
        '验证码占位图形数',
        await page.evaluate(`document.querySelectorAll('[data-captcha-placeholder]').length`),
        1,
      )
      expectEq(
        out,
        '居中卡片不应渲染宣传图',
        await page.evaluate(`document.querySelectorAll('[data-login-hero]').length`),
        0,
      )
      return out
    },
  },
  {
    name: '关掉 Google + 换成全屏样式 → /login 只剩 GitHub 入口，背景图用配置地址',
    path: '/login',
    before: async (page) => {
      await clickSelector(page, SEL.templateOption('fullscreen-card'))
      await clickSelector(page, SEL.providerSwitch('google'))
      await setInput(page, SEL.heroInput, 'https://cdn.example.com/bg.png')
      await clickButtonByText(page, 'Save changes')
      await delay(300)
    },
    custom: async (page) => {
      const out = []
      expectEq(
        out,
        '登录页样式',
        await page.evaluate(`document.querySelector('[data-login-template]')?.getAttribute('data-login-template')`),
        'fullscreen-card',
      )
      expectEq(
        out,
        'Google 入口数',
        await page.evaluate(`document.querySelectorAll('[data-login-provider="google"]').length`),
        0,
      )
      expectEq(
        out,
        'GitHub 入口数',
        await page.evaluate(`document.querySelectorAll('[data-login-provider="github"]').length`),
        1,
      )
      expectEq(
        out,
        '宣传图地址',
        await page.evaluate(`document.querySelector('[data-login-hero]')?.getAttribute('data-login-hero')`),
        'https://cdn.example.com/bg.png',
      )
      return out
    },
  },
  {
    // 不设 path：before 里的改动必须留在当前页面被断言（设了 path 会在 before 之后整页重载，
    // 草稿被打回「已保存」值，于是保存按钮变灰、用例看到的是另一回事）
    name: '授权端点清空 → 字段级 error + 点保存被拦且不写盘',
    before: async (page) => {
      await setInput(page, '#login-github-authorize-url', '')
    },
    custom: async (page) => {
      const out = []
      expectEq(
        out,
        '授权端点字段级别',
        await page.evaluate(
          `document.querySelector('[data-field-message="login-github-authorize-url"]')?.getAttribute('data-field-level')`,
        ),
        'error',
      )
      // 保存按钮**不应**因为校验错误而置灰（否则用户点不动、也看不到原因）
      expectEq(
        out,
        '保存按钮 disabled',
        await page.evaluate(`(() => {
          const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save changes')
          return btn ? String(btn.disabled) : 'missing'
        })()`),
        'false',
      )

      const before = await page.evaluate(`localStorage.getItem('tableau-embed-hub:config')`)
      await clickButtonByText(page, 'Save changes')
      await delay(300)
      const text = await page.evaluate('document.body.innerText')
      if (!text.includes('blocking error')) out.push('点保存应弹出「存在阻断性错误」的提示')
      expectEq(out, '校验未通过时的落盘状态', await page.evaluate(`localStorage.getItem('tableau-embed-hub:config')`), before)
      return out
    },
  },
  {
    name: '点第三方入口：只提示「尚未接入」，不发生跳转（本模板不拼 OAuth 链接）',
    path: '/login',
    custom: async (page) => {
      const out = []
      await clickSelector(page, '[data-login-provider="github"]')
      await delay(400)
      const toast = await page.evaluate(`document.querySelector('[data-sonner-toast]')?.innerText ?? ''`)
      if (!toast.includes('GitHub')) out.push(`应弹出含 provider 名的说明 toast，实际：「${toast}」`)
      expectEq(out, '点击后仍应停留在登录页', await page.evaluate('location.pathname'), '/login')
      return out
    },
  },
  {
    name: '恢复默认需二次确认；确认后回到出厂状态（样式 / 宣传图 / provider 开关）',
    before: async (page) => {
      await clickSelector(page, SEL.templateOption('split-hero'))
      await clickSelector(page, SEL.providerSwitch('google'))
      await setInput(page, SEL.heroInput, 'https://cdn.example.com/hero.png')
      await clickButtonByText(page, 'Save changes')
      await delay(250)
      await clickSelector(page, SEL.reset)
      await delay(300)
    },
    custom: async (page) => {
      const out = []
      const dialog = await page.evaluate(`document.querySelector('[role="dialog"]')?.innerText ?? ''`)
      if (!dialog.includes('Restore default login configuration?')) out.push('恢复默认应先弹二次确认（不做 window.confirm）')
      const confirmed = await page.evaluate(`(() => {
        const btn = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === 'Yes, restore defaults')
        if (!btn) return 'missing'
        btn.click()
        return 'ok'
      })()`)
      if (confirmed !== 'ok') out.push(`确认框里未找到确认按钮：${confirmed}`)
      await delay(400)

      expectEq(out, '恢复默认后状态', await page.evaluate(`document.querySelector('${SEL.status}')?.getAttribute('data-login-status')`), 'pristine')
      expectEq(out, '恢复默认后宣传图地址', await inputValue(page, SEL.heroInput), '')
      expectEq(
        out,
        '恢复默认后 Google 开关',
        await page.evaluate(`document.querySelector('${SEL.providerSwitch('google')}')?.getAttribute('data-state')`),
        'checked',
      )
      expectEq(
        out,
        '恢复默认后默认样式选中',
        await page.evaluate(
          `document.querySelector('${SEL.templateOption(DEFAULT_LOGIN_TEMPLATE)}')?.getAttribute('aria-pressed')`,
        ),
        'true',
      )
      return out
    },
  },
]

const results = []

async function runCase(cdp, c) {
  const caseFailures = []
  // 每个用例从干净状态开始：清空持久化后重新加载配置页
  await navigate(cdp, '/config/login')
  await cdp.evaluate(`localStorage.clear()`)
  await navigate(cdp, '/config/login')
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
  console.log('\n[login] 规则断言：' + (failures.length === 0 ? 'PASS' : 'FAIL'))
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
      `\n[login] FAILED：${CASES.length - results.filter((r) => r.failures.length).length}/${CASES.length} 页面用例通过，共 ${failed} 处失败`,
    )
    cleanup()
    process.exit(1)
  }
  console.log(`\n[login] OK：规则断言 + ${CASES.length} 项页面用例全部通过`)
  cleanup()
  process.exit(0)
}

main().catch((err) => {
  console.error('[login] 运行失败：' + err.message)
  cleanup()
  process.exit(1)
})
