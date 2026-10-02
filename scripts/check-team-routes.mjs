#!/usr/bin/env node
/**
 * check-team-routes.mjs — 团队 slug 路由校验（node scripts/check-team-routes.mjs）
 *
 * 背景：v0.5.0 起团队身份进入 URL（/t/{slug}/...），团队作用域数据（收藏/最近）
 * 按 URL 中的 slug 分区。这类「重定向 + URL 权威性」的行为无法靠 tsc 保证，
 * 只能靠真实浏览器验证。
 *
 * 校验项：
 *  1. / 重定向到当前团队的 /t/{slug}
 *  2. 旧扁平路径（/workbooks、/views…）重定向到团队作用域路径（含 search 透传）
 *  3. /t/{slug}/... 直接可达，且侧边栏链接全部带当前 slug
 *  4. 未知 slug → 「Team not found」兜底页
 *  5. 非成员访问他团队 → 「No access」兜底页
 *  6. 收藏数据按 URL 团队分区（team-1 的收藏不出现在 acme_analytics 下）
 *  7. 跨团队页面（/users、/teams、/profile、/config/smtp）保持无 slug
 *
 * 依赖：已构建的 dist/（pnpm build）+ 本机 Google Chrome。
 * 用法：node scripts/check-team-routes.mjs
 * 退出码：0 全部通过；1 存在失败。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const PORT = 4319
const DEBUG_PORT = 9333
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
/** 项目根目录（Chrome profile 必须落在可写目录，系统 tmpdir 在沙箱下不可写） */
const ROOT = fileURLToPath(new URL('..', import.meta.url))

const children = []
function cleanup() {
  for (const c of children) {
    // 先 SIGTERM 让它正常收尾，随后立刻补 SIGKILL：Chrome 偶尔会忽略 SIGTERM / 还在刷 profile，
    // 一旦它活过脚本退出，调试端口就被残留进程占着，下一轮会连到旧实例（见 assertPortsFree）。
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
 * 为什么必须有这道闸：调试端口若被上一轮残留的 Chrome 占用，本脚本会连到那个旧实例
 * （它停在别的页面、别的构建产物上），表现成「十几个用例一起失败」这种极难定位的假故障。
 * 宁可立刻报错，也不要给出不可信的通过/失败报告。
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
          `请先执行 \`pkill -f "remote-debugging-port=${port}"\` 后重跑。`,
      )
    }
  }
}

/** 轮询等待：fn 返回真值即结束 */
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

/** 页面快照：URL / 文本 / 链接（团队作用域链接用来验证导航前缀） */
const pageState = `(() => ({
  path: location.pathname + location.search,
  text: document.body.innerText,
  teamLinks: [...document.querySelectorAll('a[href^="/t/"]')].map(a => a.getAttribute('href')),
  allLinks: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
}))()`

/**
 * 导航并等待渲染稳定。
 * 不做固定 sleep：先在「连续两次采样一致且链接数 > 0」时判定 React 已挂载，
 * 再按用例期望（URL / 文本）轮询等客户端重定向落地。
 */
async function navigate(cdp, path, expect = {}) {
  await cdp.send('Page.navigate', { url: `${BASE}${path}` })

  let lastSig = null
  await waitFor(
    `${path} 渲染完成`,
    async () => {
      const sig = await cdp.evaluate(
        `JSON.stringify([document.querySelectorAll('a[href]').length, document.body.innerText.length])`,
      )
      if (sig === lastSig && JSON.parse(sig)[0] > 0) return true
      lastSig = sig
      return false
    },
    { timeout: 20000 },
  )

  await waitFor(
    `${path} 满足期望`,
    async () => {
      const s = await cdp.evaluate(pageState)
      if (expect.expectPath && s.path !== expect.expectPath) return false
      for (const n of expect.contains ?? []) if (!s.text.includes(n)) return false
      return true
    },
    { timeout: 12000 },
  )
}

const CASES = [
  {
    name: '/ 重定向到当前团队首页',
    path: '/',
    expectPath: '/t/acme_hq',
    contains: ['Dashboard'],
  },
  {
    name: '/workbooks 旧路径 → /t/acme_hq/workbooks',
    path: '/workbooks',
    expectPath: '/t/acme_hq/workbooks',
    contains: ['Workbooks'],
  },
  {
    name: '/views 旧路径保留 search 参数',
    path: '/views?view=abc',
    expectPath: '/t/acme_hq/views?view=abc',
  },
  {
    name: '团队作用域页面直达',
    path: '/t/acme_analytics/recents',
    expectPath: '/t/acme_analytics/recents',
    contains: ['Recents'],
  },
  {
    name: '未知 slug → Team not found',
    path: '/t/no-such-team/workbooks',
    expectPath: '/t/no-such-team/workbooks',
    contains: ['Team not found', 'no-such-team'],
  },
  {
    name: '跨团队管理页不带 slug，侧边栏回退 activeTeamId',
    path: '/users',
    expectPath: '/users',
    contains: ['Users'],
    // 管理页 URL 无 slug，但侧边栏仍需可用的团队链接 → 回退 activeTeamId（种子默认 team 1 = acme_hq）
    expectTeamPrefix: '/t/acme_hq',
  },
  {
    name: '跨团队管理页不带 slug（/teams）',
    path: '/teams',
    expectPath: '/teams',
    contains: ['Teams'],
  },
  {
    // v0.7.0：原 /settings 实为「个人资料」，改名 /profile，入口在左下角用户菜单
    name: '跨团队页面不带 slug（/profile）',
    path: '/profile',
    expectPath: '/profile',
    contains: ['Profile'],
  },
  {
    name: '跨团队页面嵌套路径不带 slug（/config/smtp）',
    path: '/config/smtp',
    expectPath: '/config/smtp',
    contains: ['SMTP server'],
  },
  {
    name: '/config 重定向到 config/smtp',
    path: '/config',
    expectPath: '/config/smtp',
  },
  {
    name: '侧边栏链接带当前团队 slug',
    path: '/t/acme_analytics/workbooks',
    expectPath: '/t/acme_analytics/workbooks',
    contains: ['Workbooks'],
    expectTeamPrefix: '/t/acme_analytics',
  },
  {
    name: '收藏按 URL 团队分区（team-1 数据不出现在 acme_analytics）',
    path: '/t/acme_analytics/favorites',
    before: async (page) => {
      await page.evaluate(
        `localStorage.setItem('shadcn-admin-cn:favorites:team-1', JSON.stringify([{workbook:'W1',view:'V1',accessedAt:'2026-01-01T00:00:00.000Z'}]))`,
      )
    },
    expectPath: '/t/acme_analytics/favorites',
    contains: ['No favorites yet'],
  },
  {
    name: '同一份数据在 acme_hq 下可见（URL → 分区 key 生效）',
    path: '/t/acme_hq/favorites',
    before: async (page) => {
      await page.evaluate(
        `localStorage.setItem('shadcn-admin-cn:favorites:team-1', JSON.stringify([{workbook:'W1',view:'V1',accessedAt:'2026-01-01T00:00:00.000Z'}]))`,
      )
    },
    expectPath: '/t/acme_hq/favorites',
    contains: ['V1'],
  },
  {
    name: '切换身份后落到新用户的默认团队（UserMenu）',
    path: '/t/acme_hq',
    expectPath: '/t/acme_hq',
    // Dave Kim（id=5）仅属于 Acme Data Platform 且为默认团队
    expectPathAfter: '/t/acme_data_platform',
    after: async (page) => {
      await clickMenuItem(page, '[data-slot="sidebar-footer"] button', 'Dave Kim')
    },
  },
  {
    name: '非成员访问他团队 → No access 兜底页',
    path: '/t/acme_hq',
    before: async (page) => {
      // 先以 Admin 身份停在 /t/acme_hq，再切到 Dave Kim（不属于该团队）
      await clickMenuItem(page, '[data-slot="sidebar-footer"] button', 'Dave Kim')
      await delay(300)
    },
    expectPath: '/t/acme_hq',
    contains: ["don't have access"],
  },
  {
    name: '切换团队 = 切换 URL 前缀并保留同级子路径（TeamSwitcher 点击）',
    path: '/t/acme_hq/workbooks',
    expectPath: '/t/acme_hq/workbooks',
    expectPathAfter: '/t/acme_analytics/workbooks',
    after: async (page) => {
      await clickMenuItem(page, '[data-slot="sidebar-header"] button', 'Acme Analytics')
    },
  },
]

const results = []

/**
 * 打开 Radix 下拉并点选菜单项。
 * Radix DropdownMenuTrigger 响应 pointerdown，菜单渲染在 portal 中，按可见文本选择。
 */
async function clickMenuItem(page, triggerSelector, itemText) {
  await page.evaluate(`(() => {
    const trigger = document.querySelector(${JSON.stringify(triggerSelector)})
    if (!trigger) throw new Error('未找到下拉触发器：' + ${JSON.stringify(triggerSelector)})
    trigger.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, button: 0, pointerType: 'mouse',
    }))
  })()`)
  await delay(400)
  const clicked = await page.evaluate(`(() => {
    const items = [...document.querySelectorAll('[role="menuitem"]')]
    const target = items.find((el) => el.textContent.includes(${JSON.stringify(itemText)}))
    if (!target) return items.map((el) => el.textContent.trim())
    target.click()
    return 'ok'
  })()`)
  if (clicked !== 'ok') {
    throw new Error(`下拉菜单未找到「${itemText}」，实际菜单项：${JSON.stringify(clicked)}`)
  }
}

async function runCase(cdp, c) {
  const failures = []

  // 落回同源页面并清空持久化（回到种子状态），避免用例间互相污染。
  // 注意：必须先导航到站点 —— about:blank 是 opaque origin，访问 localStorage 会抛 SecurityError。
  await navigate(cdp, '/t/acme_hq', { expectPath: '/t/acme_hq' })
  await cdp.evaluate(`localStorage.clear()`)
  await navigate(cdp, '/t/acme_hq', { expectPath: '/t/acme_hq' })
  if (c.before) await c.before(cdp)

  let state
  try {
    await navigate(cdp, c.path, c)
    if (c.after) {
      await c.after(cdp)
      await waitFor(
        `${c.name} 交互后 URL 更新`,
        async () => (await cdp.evaluate('location.pathname + location.search')) === c.expectPathAfter,
        { timeout: 8000 },
      )
    }
    state = await cdp.evaluate(pageState)
  } catch (err) {
    // 期望未达成时先拿到实际状态，产出可读的失败信息而不是只报超时
    state = await cdp.evaluate(pageState).catch(() => null)
    if (!state) {
      results.push({ name: c.name, failures: [err.message] })
      return
    }
  }

  // after 交互会改变 URL：此时以 expectPathAfter 为最终断言目标
  const expectedPath = c.expectPathAfter ?? c.expectPath
  if (expectedPath && state.path !== expectedPath) {
    failures.push(`URL 期望 ${expectedPath}，实际 ${state.path}`)
  }
  for (const needle of c.contains ?? []) {
    if (!state.text.includes(needle)) failures.push(`页面文本缺少「${needle}」`)
  }
  if (c.expectTeamPrefix) {
    // 前缀匹配：团队首页链接就是 `/t/{slug}` 本身，其余为 `/t/{slug}/xxx`
    const prefix = c.expectTeamPrefix
    const bad = state.teamLinks.filter(
      (h) => h !== prefix && !h.startsWith(`${prefix}/`),
    )
    if (bad.length) failures.push(`侧边栏存在非当前团队链接：${bad.slice(0, 3).join(', ')}`)
    if (state.teamLinks.length === 0) failures.push('侧边栏没有任何团队作用域链接')
  }
  if (c.expectNoTeamLinks) {
    const bad = state.allLinks.filter((h) => h.startsWith('/t/'))
    if (bad.length) failures.push(`管理页不该出现团队链接：${bad.slice(0, 3).join(', ')}`)
  }

  results.push({ name: c.name, failures })
}

async function main() {
  await assertPortsFree()

  const vite = spawn(
    'node_modules/.bin/vite',
    // 显式 --host 127.0.0.1：默认只监听 IPv6 的 ::1，会让 IPv4 探活失败
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

  let failed = 0
  for (const r of results) {
    if (r.failures.length === 0) {
      console.log(`  ✅ ${r.name}`)
    } else {
      failed++
      console.log(`  ❌ ${r.name}`)
      for (const f of r.failures) console.log(`       ${f}`)
    }
  }
  console.log(`\n[team-routes] ${results.length - failed}/${results.length} 通过`)

  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('[team-routes] 运行失败：', err.message)
  cleanup()
  process.exit(1)
})
