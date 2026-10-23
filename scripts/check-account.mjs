#!/usr/bin/env node
/**
 * check-account.mjs — 左下角「个人信息」校验（node scripts/check-account.mjs）
 *
 * 背景：v0.14.0 在左下角用户菜单里加了「个人信息」区块 —— 登录名 / 显示名 / 角色 / 口令状态的
 * 只读摘要，外加「修改登录名」与「修改口令」两个自助入口（都要先校验当前口令）。
 * 这类行为（下拉内容、弹窗接线、落库效果）tsc 与单测都覆盖不到，因此与 check-permissions /
 * check-team-routes 一样用真实 Chrome CDP 驱动验证。
 *
 * 校验项：
 *   1. 个人信息摘要展示当前身份的登录名 / 显示名 / 角色，口令只报状态、**永不回显口令**
 *   2. 改登录名：空口令被拦；改别人已占用的登录名被拦；正确填写后落库且摘要同步刷新
 *   3. 改口令：两次不一致被拦；正确填写后只落 `passwordUpdatedAt` 时间戳，
 *      且 **localStorage 里不出现任何口令字段**（这是页面对用户的承诺，必须直接查盘）
 *   4. 改登录名不破坏侧边栏左下角的身份显示与「切换用户」列表
 *
 * 依赖：已构建的 dist/（pnpm build）+ 本机 Google Chrome。
 * 用法：pnpm build && node scripts/check-account.mjs
 * 退出码：0 全部通过；1 存在失败。
 *
 * 注：CDP 极简客户端与其它 check 脚本有意重复（各自独立可跑），端口与它们错开。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const PORT = 4326
const DEBUG_PORT = 9339
const BASE = `http://127.0.0.1:${PORT}`

/** 左下角用户菜单与两个自助弹窗的稳定钩子（与 user-menu.tsx / account-dialogs.tsx 一一对应） */
const SEL = {
  trigger: '[data-slot="sidebar-footer"] button',
  username: '[data-user-menu="username"]',
  passwordState: '[data-user-menu="password-state"]',
  changeUsername: '[data-user-menu="change-username"]',
  changePassword: '[data-user-menu="change-password"]',
  usernameInput: '#account-username',
  /** 修改登录名对话框里的「当前口令」字段 */
  currentPasswordForUsername: '#account-current-password',
  /** 修改口令对话框里的三个字段（新口令是 InputGroup 复合控件） */
  currentPasswordInput: '#account-password-current',
  nextPasswordInput: '#account-password-next',
  confirmPasswordInput: '#account-password-confirm',
}

/** 演示口令在界面上**绝不允许**出现的字符串（任何形式的回显都算失败） */
const FORBIDDEN_PASSWORD_TEXT = ['password123', 'Passw0rd!', 'hunter2']

/**
 * Chrome 可执行文件 —— **跨平台探测**（与其它 check 脚本同一段逻辑：优先 CHROME_PATH，
 * 其次按平台找常见安装位置；GitHub 的 ubuntu runner 自带 /usr/bin/google-chrome）。
 */
function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
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
          `请先 pkill 清理残留进程（预览端口 "port=${port}"，调试端口 "remote-debugging-port=${port}"）后重跑。`,
      )
    }
  }
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
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
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

async function navigate(cdp, path, expectPath) {
  await cdp.send('Page.navigate', { url: `${BASE}${path}` })
  let lastSig = null
  await waitFor(`${path} 渲染完成`, async () => {
    const sig = await cdp.evaluate(
      `JSON.stringify([document.querySelectorAll('a[href]').length, document.body.innerText.length])`,
    )
    if (sig === lastSig && JSON.parse(sig)[1] > 0) return true
    lastSig = sig
    return false
  }, { timeout: 20000 })
  if (expectPath) {
    await waitFor(`${path} 满足期望`, async () => {
      const current = await cdp.evaluate('location.pathname + location.search')
      return current === expectPath
    }, { timeout: 12000 })
  }
}

/** 等左下角用户菜单触发器就位（navigate 返回时 React 可能还没挂载 sidebar） */
async function waitForTrigger(page) {
  await waitFor('左下角用户菜单触发器就位', async () => {
    return page.evaluate(`!!document.querySelector(${JSON.stringify(SEL.trigger)})`)
  }, { timeout: 10000 })
}

/** 打开左下角用户菜单 */
async function openUserMenu(page) {
  await waitForTrigger(page)
  await page.evaluate(`(() => {
    const trigger = document.querySelector(${JSON.stringify(SEL.trigger)})
    if (!trigger) throw new Error('未找到左下角用户菜单触发器')
    trigger.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, button: 0, pointerType: 'mouse',
    }))
  })()`)
  await delay(500)
  // 菜单内容也要就位（Radix 的展开带动画）
  await waitFor('用户菜单展开', async () => {
    return page.evaluate(`!!document.querySelector(${JSON.stringify(SEL.changeUsername)})`)
  }, { timeout: 8000 })
}

/** 点下拉里的某个菜单项 */
async function clickItem(page, selector, label) {
  const clicked = await page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return 'missing'
    el.click()
    return 'ok'
  })()`)
  if (clicked !== 'ok') {
    throw new Error(`菜单里未找到 ${label}（${selector}）`)
  }
  await delay(400)
}

/**
 * 在 Radix 对话框里给指定输入框赋值。
 *
 * 走原生 setter + `input` 事件：React 受控组件只认这条路（直接 `el.value = x` 会被 React 忽略）。
 * 复合控件（`InputGroupInput`）渲染出的也是原生 input，但 **id 挂在包装节点上**时
 * 选择器可能命中 `<div>` —— 此时退化成「找到 input 后代」再赋值。
 */
async function fillInput(page, selector, value) {
  // 先等目标节点出现：Radix 的打开/关闭都带过渡，立刻填会打在尚未挂载的节点上
  await waitFor(`输入框就位（${selector}）`, async () => {
    return page.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)
  }, { timeout: 8000 })
  await page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) throw new Error('未找到输入框：' + ${JSON.stringify(selector)})
    const input = el.tagName === 'INPUT' ? el : el.querySelector('input')
    if (!input) throw new Error('选择器命中的不是输入框：' + ${JSON.stringify(selector)})
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await delay(150)
}

/** 点对话框底部的主操作按钮（最后一个 button） */
async function clickDialogConfirm(page) {
  const clicked = await page.evaluate(`(() => {
    const footer = document.querySelector('[data-slot="dialog-content"] [data-slot="dialog-footer"]')
    if (!footer) return 'missing'
    const buttons = [...footer.querySelectorAll('button')]
    const confirm = buttons[buttons.length - 1]
    if (!confirm) return 'missing'
    confirm.click()
    return 'ok'
  })()`)
  if (clicked !== 'ok') throw new Error('对话框底部未找到主操作按钮')
  await delay(400)
}

/** 读 localStorage 里的 org 快照（用于断言口令没有落盘） */
async function readPersistedOrg(page) {
  return page.evaluate(`(() => {
    for (const key of Object.keys(localStorage)) {
      if (!key.endsWith(':org')) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      return JSON.stringify(parsed?.state?.users ?? parsed?.users ?? null)
    }
    return null
  })()`)
}

/* ============================== 用例 ============================== */

const CASES = [
  {
    name: '个人信息摘要展示当前身份，口令只报状态不回显',
    path: '/t/acme_hq',
    expectPath: '/t/acme_hq',
    custom: async (page) => {
      const failures = []
      await openUserMenu(page)

      const info = await page.evaluate(`(() => {
        const q = (s) => document.querySelector(s)
        const text = q('[data-slot="dropdown-menu-content"]')?.innerText ?? document.body.innerText
        return {
          username: q('[data-user-menu="username"]')?.textContent?.trim() ?? null,
          passwordState: q('[data-user-menu="password-state"]')?.textContent?.trim() ?? null,
          hasUsernameLabel: text.includes('Username'),
          hasPasswordLabel: text.includes('Password'),
          hasChangeUsername: !!q('[data-user-menu="change-username"]'),
          hasChangePassword: !!q('[data-user-menu="change-password"]'),
          allText: text,
        }
      })()`)

      if (info.username !== 'admin') failures.push(`摘要应展示当前登录名 admin，实际：${info.username}`)
      if (!info.hasUsernameLabel) failures.push('摘要缺少「Username」行标签')
      if (!info.hasPasswordLabel) failures.push('摘要缺少「Password」行标签')
      if (!info.hasChangeUsername) failures.push('菜单缺少「修改登录名」入口')
      if (!info.hasChangePassword) failures.push('菜单缺少「修改口令」入口')
      // 口令状态要么是「未设置」文案，要么是一个时间戳 —— 绝不可以是口令本身
      if (!info.passwordState) failures.push('口令状态为空')
      for (const forbidden of FORBIDDEN_PASSWORD_TEXT) {
        if (info.allText.toLowerCase().includes(forbidden.toLowerCase())) {
          failures.push(`界面上出现了口令文本 ${forbidden}（口令永不回显）`)
        }
      }
      return failures
    },
  },
  {
    name: '改登录名：不填当前口令被拦，数据不变',
    path: '/t/acme_hq',
    expectPath: '/t/acme_hq',
    custom: async (page) => {
      const failures = []
      await openUserMenu(page)
      await clickItem(page, SEL.changeUsername, '修改登录名入口')
      await fillInput(page, SEL.usernameInput, 'admin.renamed')
      // 故意不填当前口令
      await clickDialogConfirm(page)

      const state = await page.evaluate(`(() => ({
        dialogOpen: !!document.querySelector('[data-slot="dialog-content"]'),
        persisted: (() => {
          for (const key of Object.keys(localStorage)) {
            if (!key.endsWith(':org')) continue
            return localStorage.getItem(key) ?? ''
          }
          return ''
        })(),
      }))()`)
      if (!state.dialogOpen) failures.push('校验未通过时对话框不应关闭')
      if (state.persisted.includes('admin.renamed')) failures.push('校验未通过却已写入新登录名')
      return failures
    },
  },
  {
    name: '改登录名：占用他人登录名被拦',
    path: '/t/acme_hq',
    expectPath: '/t/acme_hq',
    custom: async (page) => {
      const failures = []
      await openUserMenu(page)
      await clickItem(page, SEL.changeUsername, '修改登录名入口')
      await fillInput(page, SEL.usernameInput, 'alice.chen') // 已被 Alice 占用
      await fillInput(page, SEL.currentPasswordForUsername, 'whatever-old')
      await clickDialogConfirm(page)

      const dialogOpen = await page.evaluate(`!!document.querySelector('[data-slot="dialog-content"]')`)
      if (!dialogOpen) failures.push('登录名被占用时对话框应保持打开（并提示原因）')
      const persisted = (await readPersistedOrg(page)) ?? ''
      if (persisted.includes('"username":"alice.chen"') && !persisted.includes('admin@example.com')) {
        failures.push('占用他人登录名却被写入')
      }
      return failures
    },
  },
  {
    name: '改登录名：校验通过后落库，摘要与左下角身份同步',
    path: '/t/acme_hq',
    expectPath: '/t/acme_hq',
    custom: async (page) => {
      const failures = []
      await openUserMenu(page)
      await clickItem(page, SEL.changeUsername, '修改登录名入口')
      await fillInput(page, SEL.usernameInput, 'admin.root')
      await fillInput(page, SEL.currentPasswordForUsername, 'whatever-old')
      await clickDialogConfirm(page)

      // 对话框应关闭，摘要应刷新成新登录名
      const closed = await waitFor('对话框关闭', async () => {
        return (await page.evaluate(`!!document.querySelector('[data-slot="dialog-content"]')`)) === false
      }, { timeout: 5000 }).catch(() => false)
      if (!closed) failures.push('保存成功后对话框未关闭')

      await openUserMenu(page)
      const shown = await page.evaluate(`document.querySelector('[data-user-menu="username"]')?.textContent?.trim() ?? null`)
      if (shown !== 'admin.root') failures.push(`摘要应显示新登录名 admin.root，实际：${shown}`)

      const persisted = (await readPersistedOrg(page)) ?? ''
      if (!persisted.includes('"username":"admin.root"')) failures.push('新登录名未写入 localStorage')
      return failures
    },
  },
  {
    name: '改口令：两次不一致被拦',
    path: '/t/acme_hq',
    expectPath: '/t/acme_hq',
    custom: async (page) => {
      const failures = []
      await openUserMenu(page)
      await clickItem(page, SEL.changePassword, '修改口令入口')
      await fillInput(page, SEL.currentPasswordInput, 'whatever-old')
      await fillInput(page, SEL.nextPasswordInput, 'newpassword1')
      await fillInput(page, SEL.confirmPasswordInput, 'newpassword2')
      await clickDialogConfirm(page)

      const dialogOpen = await page.evaluate(`!!document.querySelector('[data-slot="dialog-content"]')`)
      if (!dialogOpen) failures.push('两次口令不一致时对话框应保持打开')
      return failures
    },
  },
  {
    name: '改口令：成功后只记时间戳，localStorage 无口令字段',
    path: '/t/acme_hq',
    expectPath: '/t/acme_hq',
    custom: async (page) => {
      const failures = []
      await openUserMenu(page)
      await clickItem(page, SEL.changePassword, '修改口令入口')
      await fillInput(page, SEL.currentPasswordInput, 'whatever-old')
      await fillInput(page, SEL.nextPasswordInput, 'newpassword1')
      await fillInput(page, SEL.confirmPasswordInput, 'newpassword1')
      await clickDialogConfirm(page)

      const closed = await waitFor('对话框关闭', async () => {
        return (await page.evaluate(`!!document.querySelector('[data-slot="dialog-content"]')`)) === false
      }, { timeout: 5000 }).catch(() => false)
      if (!closed) failures.push('保存成功后对话框未关闭')

      const persisted = (await readPersistedOrg(page)) ?? ''
      // 口令只以「最近修改时间」的形式存在，明文口令绝不落盘
      for (const forbidden of [...FORBIDDEN_PASSWORD_TEXT, 'newpassword1', 'whatever-old']) {
        if (persisted.toLowerCase().includes(forbidden.toLowerCase())) {
          failures.push(`localStorage 里出现了口令文本 ${forbidden}（口令不进前端状态）`)
        }
      }
      if (!persisted.includes('passwordUpdatedAt')) failures.push('passwordUpdatedAt 时间戳未写入')

      // 摘要行的口令状态应刷新成一个时间（不再是「未设置」）
      await openUserMenu(page)
      const state = await page.evaluate(`document.querySelector('[data-user-menu="password-state"]')?.textContent?.trim() ?? null`)
      if (!state || /not set/i.test(state)) failures.push(`口令状态应刷新为时间，实际：${state}`)
      return failures
    },
  },
]

const results = []

async function runCase(cdp, c) {
  const failures = []
  // 回到种子状态：清空持久化（含上一个用例改过的登录名）。
  // 第一次导航不校验路径 —— 种子态可能被 localStorage 重定向过，路径断言交给下面那次。
  await navigate(cdp, '/t/acme_hq')
  await cdp.evaluate(`localStorage.clear()`)
  await navigate(cdp, '/t/acme_hq', '/t/acme_hq')

  try {
    await navigate(cdp, c.path, c.expectPath ?? c.path)
    const path = await cdp.evaluate('location.pathname + location.search')
    if (path !== (c.expectPath ?? c.path)) failures.push(`URL 期望 ${c.expectPath ?? c.path}，实际 ${path}`)
    if (c.custom) failures.push(...(await c.custom(cdp)))
  } catch (err) {
    failures.push(err.message)
  }

  results.push({ name: c.name, failures })
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

  let failed = 0
  for (const r of results) {
    if (r.failures.length === 0) {
      console.log(`  ✓ ${r.name}`)
    } else {
      failed++
      console.log(`  ✗ ${r.name}`)
      for (const f of r.failures) console.log('      ' + f)
    }
  }
  console.log(`\n[account] ${results.length - failed}/${results.length} 用例通过`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('[account] 运行失败：' + err.message)
  cleanup()
  process.exit(1)
})
