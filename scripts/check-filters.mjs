#!/usr/bin/env node
/**
 * check-filters.mjs — 列表筛选器校验（node scripts/check-filters.mjs）
 *
 * 背景：筛选栏是**公共件**（components/filter-bar.tsx），它的价值在于「所有列表页长得一样、
 * 行为一样」。这类约定 tsc 管不了、单测也测不到（组合行为在浏览器里），因此分两段验：
 *
 *  1. **静态自检**：公共件与 /users 用到的 i18n key 是否都在词典里；页面的筛选选项来源
 *     （`USER_STATUSES` / `USER_STATUS_LABEL_KEYS`）是否一一对应 ——
 *     「加了新状态却忘了加文案」只有这一层拦得住。
 *  2. **页面行为用例（CDP）**：/users 筛选栏的搜索（包含匹配、大小写不敏感、一键清空）、
 *     状态与团队下拉、组合筛选、结果计数、「重置筛选」，以及**三种空态互不混淆**
 *     （没有账号 / 反正被筛掉了 / 无权限）。
 *
 * 依赖：已构建的 dist/（pnpm build）+ 本机 Google Chrome。
 * 用法：pnpm build && node scripts/check-filters.mjs
 * 退出码：0 全部通过；1 存在失败。
 *
 * 注：CDP 极简客户端与 check-smtp.mjs / check-permissions.mjs / check-team-routes.mjs
 * 有意重复（各自独立可跑），端口与它们错开，避免并行/残留实例互抢。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { USER_STATUSES, USER_STATUS_LABEL_KEYS } from '../src/stores/org-store.ts'

const PORT = 4323
const DEBUG_PORT = 9336
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

const SEARCH_INPUT = '[data-filter-search] input'
const STATUS_SELECT = '[data-filter-select="user-filter-status"]'
const TEAM_SELECT = '[data-filter-select="user-filter-team"]'
const RESET_BUTTON = '[data-filter-action="reset"]'

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
 * 端口自检：调试端口若被上一轮残留的 Chrome 占用，本脚本会连到旧实例（停在别的构建产物上），
 * 表现成「一堆用例同时失败」的假故障。宁可立刻报错，也不要给出不可信的报告。
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

/* ============================== 1. 静态自检 ============================== */

const failures = []
/** 断言 helper：不引入测试框架，输出与其它 check 脚本同风格 */
function check(name, condition, detail = '') {
  if (!condition) failures.push(`${name}${detail ? `：${detail}` : ''}`)
}

/** 词典（en-US）摊平成 `a.b.c` → 文案 */
function flatten(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...acc, ...flatten(v, key) }
    acc[key] = v
    return acc
  }, {})
}

const dictionary = flatten(
  JSON.parse(readFileSync(join(ROOT, 'src', 'i18n', 'locales', 'en-US', 'common.json'), 'utf8')),
)

// 公共筛选件（filter-bar.tsx）自己在用的 key —— 少一个就会在界面上渲染出裸 key
for (const key of [
  'filters.all',
  'filters.search',
  'filters.clearSearch',
  'filters.clearAll',
  'filters.clearAllHint',
  'filters.showing',
]) {
  check(`词典缺少公共筛选件文案 ${key}`, typeof dictionary[key] === 'string' && dictionary[key] !== '')
}
// 结果计数文案必须带两个插值占位符，否则会渲染出「Showing  of 」
for (const token of ['{{shown}}', '{{total}}']) {
  check(`filters.showing 缺少占位符 ${token}`, String(dictionary['filters.showing'] ?? '').includes(token))
}

// /users 页面新增的 key
for (const key of ['users.searchPlaceholder', 'users.filterTeam', 'users.noMatch']) {
  check(`词典缺少 /users 筛选文案 ${key}`, typeof dictionary[key] === 'string' && dictionary[key] !== '')
}

// 筛选选项来源与文案一一对应：状态下拉的选项就是 USER_STATUSES，文案就是 USER_STATUS_LABEL_KEYS
{
  const labelled = Object.keys(USER_STATUS_LABEL_KEYS)
  check(
    'USER_STATUSES 与 USER_STATUS_LABEL_KEYS 的取值不一致',
    USER_STATUSES.length === labelled.length && USER_STATUSES.every((s) => labelled.includes(s)),
    `状态：${USER_STATUSES.join()}；文案键：${labelled.join()}`,
  )
  for (const status of USER_STATUSES) {
    const key = USER_STATUS_LABEL_KEYS[status]
    check(
      `状态 ${status} 的文案 ${key} 不在词典里`,
      typeof dictionary[key] === 'string' && dictionary[key] !== '',
    )
  }
}

/* ============================== 2. 页面行为用例 ============================== */

/** 极简 CDP 客户端（Node 内置 WebSocket） */
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

/**
 * 打开 Radix Select 并点选一项（`role="option"`）。
 * Radix 的 Trigger 响应 **pointerdown**（不是 click），所以必须先派发 PointerEvent；
 * 列表项本身有 onClick，程序化 click 即可命中。
 */
async function selectOption(page, triggerSelector, optionText) {
  await page.evaluate(`(() => {
    const trigger = document.querySelector(${JSON.stringify(triggerSelector)})
    if (!trigger) throw new Error('未找到下拉触发器：' + ${JSON.stringify(triggerSelector)})
    trigger.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, button: 0, pointerType: 'mouse',
    }))
  })()`)
  await delay(350)
  const clicked = await page.evaluate(`(() => {
    const items = [...document.querySelectorAll('[role="option"]')]
    const target = items.find((el) => el.textContent.trim() === ${JSON.stringify(optionText)})
      ?? items.find((el) => el.textContent.includes(${JSON.stringify(optionText)}))
    if (!target) return items.map((el) => el.textContent.trim())
    target.click()
    return 'ok'
  })()`)
  if (clicked !== 'ok') {
    throw new Error(`下拉未找到「${optionText}」，实际选项：${JSON.stringify(clicked)}`)
  }
  await delay(300)
}

/** 打开左下角用户菜单并点选身份（演示态「登录」） */
async function switchUser(page, name) {
  await page.evaluate(`(() => {
    const trigger = document.querySelector('[data-slot="sidebar-footer"] button')
    if (!trigger) throw new Error('未找到左下角用户菜单触发器')
    trigger.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, button: 0, pointerType: 'mouse',
    }))
  })()`)
  await delay(400)
  const clicked = await page.evaluate(`(() => {
    const items = [...document.querySelectorAll('[role="menuitem"]')]
    const target = items.find((el) => el.textContent.includes(${JSON.stringify(name)}))
    if (!target) return items.map((el) => el.textContent.trim())
    target.click()
    return 'ok'
  })()`)
  if (clicked !== 'ok') throw new Error(`用户菜单未找到「${name}」，实际菜单项：${JSON.stringify(clicked)}`)
  await delay(500)
}

/* ------------------------------ 读取页面状态 ------------------------------ */

/** 当前渲染出来的用户行（`data-user-row` 上就是登录名，顺序即表格顺序） */
async function rowUsernames(page) {
  return page.evaluate(
    `[...document.querySelectorAll('[data-user-row]')].map((el) => el.getAttribute('data-user-row'))`,
  )
}

/** 工具栏是否显示了「重置筛选」 */
async function resetVisible(page) {
  return page.evaluate(`!!document.querySelector(${JSON.stringify(RESET_BUTTON)})`)
}

/** 结果计数文案（未筛选时不应存在） */
async function summaryText(page) {
  return page.evaluate(
    `document.querySelector('[data-filter-summary]')?.textContent?.trim() ?? null`,
  )
}

/** 空态类型：'none'（没有账号）/ 'filtered'（被筛掉）/ null（有行） */
async function emptyKind(page) {
  return page.evaluate(
    `document.querySelector('[data-user-empty]')?.getAttribute('data-user-empty') ?? null`,
  )
}

async function bodyText(page) {
  return page.evaluate('document.body.innerText')
}

/** 行集合断言：顺序无关，便于用「期望集合」表达意图 */
function expectRows(actual, expected, label) {
  const a = [...actual].sort()
  const e = [...expected].sort()
  if (a.length !== e.length || a.some((v, i) => v !== e[i])) {
    return `${label}：期望 ${expected.length} 行 ${JSON.stringify(e)}，实际 ${actual.length} 行 ${JSON.stringify(a)}`
  }
  return null
}

/* ------------------------------ 用例 ------------------------------ */

const CASES = [
  {
    name: '初始态：筛选栏就位但不抢戏（无结果计数、无重置按钮）',
    path: '/users',
    custom: async (page) => {
      const out = []
      const bar = await page.evaluate(`document.querySelectorAll('[data-filter-bar]').length`)
      if (bar !== 1) out.push(`筛选栏应恰好 1 个，实际 ${bar}`)
      const active = await page.evaluate(
        `document.querySelector('[data-filter-bar]')?.getAttribute('data-filter-active')`,
      )
      if (active !== '0') out.push(`未筛选时 data-filter-active 应为 0，实际 ${active}`)

      const search = await page.evaluate(`document.querySelector(${JSON.stringify(SEARCH_INPUT)})?.placeholder ?? null`)
      if (search !== 'Search username…') out.push(`搜索框占位文案应为「Search username…」，实际 ${search}`)

      // 触发器上是「字段名 + 当前值」：下拉收起后仍要知道这一格筛的是什么字段
      const statusTrigger = await page.evaluate(
        `document.querySelector(${JSON.stringify(STATUS_SELECT)})?.innerText?.replace(/\\s+/g, ' ').trim() ?? null`,
      )
      if (!statusTrigger?.includes('Status') || !statusTrigger?.includes('All')) {
        out.push(`状态下拉触发器应显示「Status All」，实际「${statusTrigger}」`)
      }
      const teamTrigger = await page.evaluate(
        `document.querySelector(${JSON.stringify(TEAM_SELECT)})?.innerText?.replace(/\\s+/g, ' ').trim() ?? null`,
      )
      if (!teamTrigger?.includes('Team') || !teamTrigger?.includes('All')) {
        out.push(`团队下拉触发器应显示「Team All」，实际「${teamTrigger}」`)
      }

      const rows = await rowUsernames(page)
      out.push(expectRows(rows, ['admin', 'alice.chen', 'bob.martin', 'carol.white', 'dave.kim', 'eve.torres'], '未筛选时应看到全部 6 个账号') ?? '')
      if (await resetVisible(page)) out.push('未筛选时不应出现「重置筛选」按钮（无处发力的按钮不该出现）')
      if ((await summaryText(page)) !== null) out.push('未筛选时不应出现结果计数')
      if ((await emptyKind(page)) !== null) out.push('未筛选时不应出现空态行')
      // 触发器必须带 a11y 名称，且**包含当前值**（aria-label 会盖掉可见文本）
      const statusLabel = await page.evaluate(
        `document.querySelector(${JSON.stringify(STATUS_SELECT)})?.getAttribute('aria-label')`,
      )
      if (statusLabel !== 'Status: All') out.push(`状态下拉的 aria-label 应为「Status: All」，实际「${statusLabel}」`)
      return out.filter(Boolean)
    },
  },
  {
    name: '搜索登录名：包含匹配 + 大小写不敏感 + 一键清空',
    before: async (page) => setInput(page, SEARCH_INPUT, 'alice'),
    custom: async (page) => {
      const out = []
      out.push(expectRows(await rowUsernames(page), ['alice.chen'], '搜索 alice 应只剩 1 行') ?? '')
      const summary = await summaryText(page)
      if (summary !== 'Showing 1 of 6') out.push(`结果计数应为「Showing 1 of 6」，实际「${summary}」`)
      if (!(await resetVisible(page))) out.push('有筛选生效时应出现「重置筛选」按钮')

      // 搜的是登录名（主键口径），不是展示名：搜展示名「Alice Chen」不该命中
      await setInput(page, SEARCH_INPUT, 'Alice Chen')
      out.push(expectRows(await rowUsernames(page), [], '搜索应只认登录名，不认展示名') ?? '')
      if ((await emptyKind(page)) !== 'filtered') out.push('无匹配时应渲染 filtered 空态')

      // 大小写不敏感（登录名本身即大小写不敏感的账号口径）
      await setInput(page, SEARCH_INPUT, 'ALICE.CHEN')
      out.push(expectRows(await rowUsernames(page), ['alice.chen'], '搜索应大小写不敏感') ?? '')

      // 部分匹配 + 命中多人
      await setInput(page, SEARCH_INPUT, 'a')
      const many = await rowUsernames(page)
      if (many.length <= 1) out.push(`搜索 "a" 应命中多个账号，实际 ${JSON.stringify(many)}`)

      // 清空按钮（有内容时才出现）→ 回到全量
      const clearButtons = await page.evaluate(
        `document.querySelectorAll('[data-filter-search] button').length`,
      )
      if (clearButtons !== 1) out.push(`搜索框右侧应有 1 个清空按钮，实际 ${clearButtons}`)
      await clickSelector(page, '[data-filter-search] button')
      out.push(expectRows(await rowUsernames(page), ['admin', 'alice.chen', 'bob.martin', 'carol.white', 'dave.kim', 'eve.torres'], '清空搜索后应回到全量') ?? '')
      const value = await inputValue(page, SEARCH_INPUT)
      if (value !== '') out.push(`清空后搜索框应为空，实际「${value}」`)
      if (await resetVisible(page)) out.push('清空后没有筛选生效，不应再显示「重置筛选」')
      return out.filter(Boolean)
    },
  },
  {
    name: '无匹配：空态与「还没有账号」分开，且有一键重置出口',
    before: async (page) => setInput(page, SEARCH_INPUT, 'zzz-no-such-user'),
    custom: async (page) => {
      const out = []
      out.push(expectRows(await rowUsernames(page), [], '无匹配合账号应为 0 行') ?? '')
      if ((await emptyKind(page)) !== 'filtered') out.push('应渲染 data-user-empty="filtered" 空态')
      const text = await bodyText(page)
      if (!text.includes('No users match the current filters.')) {
        out.push('空态文案应为「No users match the current filters.」')
      }
      if (text.includes('No users yet')) out.push('「被筛掉」不应复用「还没有用户」的文案（含义不同）')
      if (text.includes('Only system administrators can manage users.')) {
        out.push('系统管理员不应看到「无权限」文案')
      }
      // 空态里的重置按钮（与工具栏的重置文案相同，用 data 钩子区分，别点到另一个）
      await clickSelector(page, '[data-user-empty-reset]')
      out.push(expectRows(await rowUsernames(page), ['admin', 'alice.chen', 'bob.martin', 'carol.white', 'dave.kim', 'eve.torres'], '空态里点重置应回到全量') ?? '')
      const value = await inputValue(page, SEARCH_INPUT)
      if (value !== '') out.push(`重置后搜索框应清空，实际「${value}」`)
      if ((await emptyKind(page)) !== null) out.push('重置后不应再有空态行')
      return out.filter(Boolean)
    },
  },
  {
    name: '状态筛选（Frozen）与团队筛选叠加取交集',
    before: async (page) => selectOption(page, STATUS_SELECT, 'Frozen'),
    custom: async (page) => {
      const out = []
      out.push(expectRows(await rowUsernames(page), ['carol.white', 'eve.torres'], 'Frozen 应只剩两个冻结账号') ?? '')
      const summary = await summaryText(page)
      if (summary !== 'Showing 2 of 6') out.push(`结果计数应为「Showing 2 of 6」，实际「${summary}」`)

      // 叠加团队：Frozen ∩ Acme Analytics = 空（两个冻结账号都不在 Analytics）
      await selectOption(page, TEAM_SELECT, 'Acme Analytics')
      out.push(expectRows(await rowUsernames(page), [], 'Frozen + Analytics 的交集应为空') ?? '')
      if ((await emptyKind(page)) !== 'filtered') out.push('交集为空时应渲染 filtered 空态')

      // 换一个团队：Frozen ∩ Data Platform = Eve
      await selectOption(page, TEAM_SELECT, 'Acme Data Platform')
      out.push(expectRows(await rowUsernames(page), ['eve.torres'], 'Frozen + Data Platform 应只剩 eve.torres') ?? '')
      const summary2 = await summaryText(page)
      if (summary2 !== 'Showing 1 of 6') out.push(`叠加两个筛选后计数应为「Showing 1 of 6」，实际「${summary2}」`)

      // 重置：两个筛选一起回到默认，控件也回到 All
      await clickSelector(page, RESET_BUTTON)
      out.push(expectRows(await rowUsernames(page), ['admin', 'alice.chen', 'bob.martin', 'carol.white', 'dave.kim', 'eve.torres'], '重置后应回到全量') ?? '')
      const statusTrigger = await page.evaluate(
        `document.querySelector(${JSON.stringify(STATUS_SELECT)})?.innerText?.replace(/\\s+/g, ' ').trim()`,
      )
      if (!statusTrigger?.includes('All')) out.push(`重置后状态下拉应回到 All，实际「${statusTrigger}」`)
      const teamTrigger = await page.evaluate(
        `document.querySelector(${JSON.stringify(TEAM_SELECT)})?.innerText?.replace(/\\s+/g, ' ').trim()`,
      )
      if (!teamTrigger?.includes('All')) out.push(`重置后团队下拉应回到 All，实际「${teamTrigger}」`)
      if (await resetVisible(page)) out.push('重置后不应再显示「重置筛选」')
      return out.filter(Boolean)
    },
  },
  {
    name: '团队筛选按成员关系命中（不区分岗位），筛选后行内动作仍在',
    before: async (page) => selectOption(page, TEAM_SELECT, 'Acme Data Platform'),
    custom: async (page) => {
      const out = []
      // Data Platform 的 4 个人岗位各不相同（team-admin / viewer / analyst / viewer）——
      // 按岗位过滤的话这里就会少人，因此这组期望值同时也是「口径 = 成员关系」的证据
      out.push(
        expectRows(
          await rowUsernames(page),
          ['admin', 'alice.chen', 'dave.kim', 'eve.torres'],
          'Data Platform 应有 4 名成员',
        ) ?? '',
      )
      // 筛选只是视图层：行内操作按钮（管理员 5 个/行）不该少
      const buttons = await page.evaluate(
        `[...document.querySelectorAll('[data-user-row]')].map((row) => row.querySelectorAll('button').length)`,
      )
      if (buttons.some((n) => n !== 5)) out.push(`筛选后每行应仍有 5 个操作按钮，实际 ${JSON.stringify(buttons)}`)
      // 表头列数不因筛选变化（管理员 7 列）
      const heads = await page.evaluate(`document.querySelectorAll('thead th').length`)
      if (heads !== 7) out.push(`系统管理员表头应为 7 列，实际 ${heads}`)
      return out.filter(Boolean)
    },
  },
  {
    name: '非管理员同样能用筛选（只读视角不受影响）',
    before: async (page) => {
      await switchUser(page, 'Alice Chen')
      await navigate(page, '/users')
      await selectOption(page, STATUS_SELECT, 'Frozen')
    },
    custom: async (page) => {
      const out = []
      const bar = await page.evaluate(`document.querySelectorAll('[data-filter-bar]').length`)
      if (bar !== 1) out.push(`非管理员也应看到筛选栏，实际 ${bar} 个`)
      out.push(expectRows(await rowUsernames(page), ['carol.white', 'eve.torres'], '非管理员筛 Frozen 应同样剩两行') ?? '')
      const text = await bodyText(page)
      if (!text.includes('Only system administrators can add, edit or delete users.')) {
        out.push('非管理员应看到只读提示')
      }
      const buttons = await page.evaluate(
        `[...document.querySelectorAll('[data-user-row]')].map((row) => row.querySelectorAll('button').length)`,
      )
      if (buttons.some((n) => n !== 0)) out.push(`非管理员行内不应有操作按钮，实际 ${JSON.stringify(buttons)}`)
      const heads = await page.evaluate(`document.querySelectorAll('thead th').length`)
      if (heads !== 6) out.push(`非管理员表头应为 6 列，实际 ${heads}`)
      return out.filter(Boolean)
    },
  },
  {
    /*
     * 版式用例（几何断言，本项目自 v0.4.1 起的做法）：筛选栏是**公共件**，
     * 它的排版一旦走样，所有列表页一起走样 —— 而「三个控件是否同一行、窄屏是否堆叠、
     * 有没有把页面顶出横向滚动条」tsc 与单测都看不见，只能量真实盒模型。
     */
    name: '版式：宽屏单行对齐、窄屏纵向堆叠，且不产生横向滚动条',
    path: '/users',
    custom: async (page) => {
      const out = []
      const setViewport = async (width) => {
        await page.send('Emulation.setDeviceMetricsOverride', {
          width,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false,
        })
        await delay(300)
      }
      const geometry = async () =>
        page.evaluate(`(() => {
          const rect = (sel) => {
            const el = document.querySelector(sel)
            if (!el) return null
            const r = el.getBoundingClientRect()
            return {
              top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right),
              width: Math.round(r.width), height: Math.round(r.height),
            }
          }
          return {
            bar: rect('[data-filter-bar]'),
            search: rect('[data-filter-search]'),
            status: rect('[data-filter-select="user-filter-status"]'),
            team: rect('[data-filter-select="user-filter-team"]'),
            overflow: document.documentElement.scrollWidth - window.innerWidth,
          }
        })()`)

      await setViewport(1440)
      const wide = await geometry()
      if (!wide.search || !wide.status || !wide.team) {
        out.push('筛选控件缺失，无法量版式')
      } else {
        const tops = new Set([wide.search.top, wide.status.top, wide.team.top])
        if (tops.size !== 1) {
          out.push(`1440 宽三个控件应在同一行，实际 top = ${JSON.stringify([wide.search.top, wide.status.top, wide.team.top])}`)
        }
        if (!(wide.search.right <= wide.status.left + 1 && wide.status.right <= wide.team.left + 1)) {
          out.push('1440 宽的控件顺序应为 搜索 → 状态 → 团队（左到右）')
        }
        const heights = new Set([wide.search.height, wide.status.height, wide.team.height])
        if (heights.size !== 1) {
          out.push(`三个控件应等高（同一套 h-8 尺寸），实际 ${JSON.stringify([...heights])}`)
        }
        if (wide.bar && wide.bar.height > wide.search.height * 2) {
          out.push(`1440 宽筛选栏应只有一行，实际高 ${wide.bar.height}px（单个控件 ${wide.search.height}px）`)
        }
      }
      if (wide.overflow > 0) out.push(`1440 宽不应出现横向滚动条，实际溢出 ${wide.overflow}px`)

      await setViewport(390)
      const narrow = await geometry()
      if (narrow.search && narrow.status && narrow.team) {
        if (!(narrow.search.top < narrow.status.top && narrow.status.top < narrow.team.top)) {
          out.push('窄屏（390）三个控件应纵向堆叠')
        }
        if (Math.abs(narrow.search.width - narrow.team.width) > 1) {
          out.push(`窄屏控件应等宽铺满，实际 搜索 ${narrow.search.width}px / 团队 ${narrow.team.width}px`)
        }
      }
      if (narrow.overflow > 0) out.push(`窄屏不应出现横向滚动条，实际溢出 ${narrow.overflow}px`)

      // 还原视口，避免影响其它用例的假定宽度
      await setViewport(1440)
      return out.filter(Boolean)
    },
  },
]

const results = []

async function runCase(cdp, c) {
  const caseFailures = []
  // 每个用例都从「种子数据 + 系统管理员身份」开始：清空持久化后重新加载
  await navigate(cdp, '/users')
  await cdp.evaluate(`localStorage.clear()`)
  await navigate(cdp, '/users')
  try {
    if (c.before) await c.before(cdp)
    if (c.path !== undefined) await navigate(cdp, c.path)
    // filter(Boolean)：用例里的 expectRows 成功时返回 null，收尾一律滤掉空消息，
    // 免得「通过」被当成一条空白失败记进来
    if (c.custom) caseFailures.push(...(await c.custom(cdp)).filter(Boolean))
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
  cleanup()
  await delay(500)
  try {
    rmSync(userDataDir, { recursive: true, force: true })
  } catch {
    /* 临时目录清理失败不影响校验结论（下次运行会新建） */
  }

  let failed = failures.length
  console.log('\n[Filters] 静态自检：' + (failures.length === 0 ? 'PASS' : 'FAIL'))
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
      `\n[Filters] FAILED：${CASES.length - results.filter((r) => r.failures.length).length}/${CASES.length} 页面用例通过，共 ${failed} 处失败`,
    )
    cleanup()
    process.exit(1)
  }
  console.log(`\n[Filters] OK：静态自检 + ${CASES.length} 项页面用例全部通过`)
  cleanup()
  process.exit(0)
}

main().catch((err) => {
  console.error('[Filters] 运行失败：' + err.message)
  cleanup()
  process.exit(1)
})
