#!/usr/bin/env node
/**
 * check-account.mjs — 左下角「个人信息」校验（node scripts/check-account.mjs）
 *
 * 背景：v0.14.2 起「我是谁」收敛到 /profile 一页：
 *   - 左下角用户菜单**只留一个「Profile」入口**（不再平铺账号摘要、不再有改登录名/改口令菜单项）；
 *   - /profile 展示完整用户详情（显示名称 / 登录名 / 邮箱 / 角色 / 状态 / 团队），
 *     并承载「改显示名称」「改登录名」「改口令」三个自助动作（后两个默认折叠、展开后才可提交）。
 * 这类行为（下拉内容、跳转、折叠展开、落库效果）tsc 与单测都覆盖不到，
 * 因此与 check-permissions / check-team-routes 一样用真实 Chrome CDP 驱动验证。
 *
 * 校验项：
 *   1. 左下角菜单只有 Profile 入口，点开后到 /profile，且**页面上**能看到完整详情
 *   2. 菜单里没有账号摘要、改登录名、改口令三个旧入口（v0.14.2 明确移除）
 *   3. /profile 上改显示名称落库并同步刷新横幅与侧边栏
 *   4. 改登录名（折叠区展开后）：占名被拦；通过后落库并同步
 *   5. 改口令（折叠区展开后）：两次不一致被拦；通过后只落 `passwordUpdatedAt` 时间戳，
 *      且 **localStorage 里不出现任何口令字段**（这是页面对用户的承诺，必须直接查盘）
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

/**
 * 稳定钩子（与 user-menu.tsx / profile-page.tsx / account-dialogs.tsx 一一对应）
 *
 * 注意 v0.14.2 的语义变化：`data-user-menu="username"` / `"password-state"` 现在只在
 * 个人资料页 `/profile` 上（菜单里的摘要已移除），`change-username` / `change-password` 这两个
 * 菜单项已删除 —— 下面把它们留在常量里，正是为了让用例能断言「它们不再存在」。
 */
const SEL = {
  trigger: '[data-slot="sidebar-footer"] button',
  menuProfile: '[data-user-menu="profile"]',
  username: '[data-user-menu="username"]',
  passwordState: '[data-user-menu="password-state"]',
  /** v0.14.0 的旧菜单项：v0.14.2 已移除，用例断言其不存在 */
  changeUsername: '[data-user-menu="change-username"]',
  changePassword: '[data-user-menu="change-password"]',
  /** /profile 上的折叠区：点「修改」展开表单 */
  editUsername: '[data-profile-action="edit-username"]',
  /** 口令行是「输入框 + 按钮」直接改，没有展开动作 */
  passwordSubmit: '[data-profile-action="change-password-submit"]',
  displayName: '[data-profile="display-name"]',
  profileNameInput: '#profile-name',
  usernameInput: '#account-username',
  /** 修改登录名对话框里的「当前口令」字段 */
  currentPasswordForUsername: '#account-current-password',
  /** 修改口令对话框里的三个字段（新口令是 InputGroup 复合控件） */
  nextPasswordInput: '#account-password-inline-next',
  confirmPasswordInput: '#account-password-inline-confirm',
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
    return page.evaluate(`!!document.querySelector(${JSON.stringify(SEL.menuProfile)})`)
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

/**
 * 点 /profile 上当前可见表单的主操作按钮（保存）。
 *
 * v0.14.3 起四项资料合并在同一张卡里：
 *   - 显示名称 / 邮箱的保存按钮就在那张卡里，**页面上只有一个 Save**；
 *   - 登录名 / 口令展开后，按钮在 `[data-profile-row]` 内部。
 * 所以作用域取「展开的那一行」优先，找不到再退回整页的 Save。
 */
async function clickProfileSave(page) {
  /**
   * 优先点「当前展开的那一行」里的保存按钮（改登录名的表单把按钮放在折叠区内），
   * 但展开区的判据必须是**折叠容器本身**（[data-profile-row]），不能是「含 input」——
   * 登录名行的 #profile-username 是常驻只读输入框，用它做判据会把范围错误地锁到
   * 口令行，导致卡片底部的「Save changes」永远找不到（曾因此误报「未找到保存按钮」）。
   * 兜底：全页找 Save 按钮（显示名称 / 邮箱的保存条在卡片底部，不在任何折叠区内）。
   */
  const clicked = await page.evaluate(`(() => {
    const inRow = [...document.querySelectorAll('[data-profile-row]')]
      .flatMap((r) => [...r.querySelectorAll('button')])
      .filter((b) => /save/i.test(b.textContent ?? '')).pop()
    const anywhere = [...document.querySelectorAll('button')]
      .filter((b) => /save/i.test(b.textContent ?? '')).pop()
    const save = inRow ?? anywhere
    if (!save) return 'missing'
    save.click()
    return 'ok'
  })()`)
  if (clicked !== 'ok') throw new Error('/profile 上未找到保存按钮')
  await delay(400)
}

/** 点口令区的「Change password」按钮 */
async function clickPasswordSubmit(page) {
  const clicked = await page.evaluate(`(() => {
    const btn = document.querySelector('[data-profile-action="change-password-submit"]')
    if (!btn) return 'missing'
    btn.click()
    return 'ok'
  })()`)
  if (clicked !== 'ok') throw new Error('未找到「Change password」按钮')
  await delay(400)
}

/* ============================== 用例 ============================== */

/** /profile 上的入口辅助：点菜单 → Profile，等跳到 /profile 且页面就位 */
async function gotoProfileFromMenu(page) {
  await openUserMenu(page)
  await clickItem(page, SEL.menuProfile, 'Profile 入口')
  await waitFor('/profile 就位', async () => {
    const ok = await page.evaluate(`(() => {
      return location.pathname === '/profile' && !!document.querySelector('[data-profile="display-name"]')
    })()`)
    return ok
  }, { timeout: 10000 })
}

/** 展开 /profile 上的某个折叠区（改登录名 / 改口令） */
async function expandSection(page, selector, label) {
  const clicked = await page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return 'missing'
    el.click()
    return 'ok'
  })()`)
  if (clicked !== 'ok') throw new Error(`/profile 上未找到 ${label}（${selector}）`)
  await delay(350)
}

const CASES = [
  {
    name: '左下角菜单只有 Profile + Help 入口，不再展开账号摘要与改密码/改登录名',
    path: '/t/acme_hq',
    expectPath: '/t/acme_hq',
    custom: async (page) => {
      const failures = []
      await openUserMenu(page)

      const info = await page.evaluate(`(() => {
        const q = (s) => document.querySelector(s)
        const text = q('[data-slot="dropdown-menu-content"]')?.innerText ?? ''
        return {
          hasProfile: !!q('[data-user-menu="profile"]'),
          hasUsernameSummary: !!q('[data-user-menu="username"]'),
          hasPasswordState: !!q('[data-user-menu="password-state"]'),
          hasChangeUsername: !!q('[data-user-menu="change-username"]'),
          hasChangePassword: !!q('[data-user-menu="change-password"]'),
          hasHelp: !!q('[data-user-menu="help"]'),
          helpHref: q('[data-user-menu="help"]')?.getAttribute('href') ?? null,
          profileBeforeHelp: (() => {
            const p = q('[data-user-menu="profile"]')
            const h = q('[data-user-menu="help"]')
            return !p || !h ? null : !!(p.compareDocumentPosition(h) & 4) // 4 = DOCUMENT_POSITION_FOLLOWING
          })(),
          text,
        }
      })()`)

      if (!info.hasProfile) failures.push('菜单缺少 Profile 入口')
      if (info.profileBeforeHelp === false) failures.push('Help 应排在 Profile 之后')
      if (!info.hasHelp) failures.push('菜单缺少 Help 入口（v0.14.4 起移到 Profile 下面）')
      if (info.helpHref !== '/help') failures.push(`Help 入口应指向 /help，实际 ${info.helpHref}`)
      if (info.hasUsernameSummary) failures.push('菜单里仍有登录名摘要（v0.14.2 起应只在 /profile 展示）')
      if (info.hasPasswordState) failures.push('菜单里仍有口令状态摘要（v0.14.2 起应只在 /profile 展示）')
      if (info.hasChangeUsername) failures.push('菜单里仍有「修改登录名」入口（应移到 /profile）')
      if (info.hasChangePassword) failures.push('菜单里仍有「修改口令」入口（应移到 /profile）')
      if (/Change password/i.test(info.text)) failures.push('菜单文本里出现了 Change password')
      for (const forbidden of FORBIDDEN_PASSWORD_TEXT) {
        if (info.text.toLowerCase().includes(forbidden.toLowerCase())) {
          failures.push(`菜单里出现了口令文本 ${forbidden}（口令永不回显）`)
        }
      }
      return failures
    },
  },
  {
    name: '点 Profile 打开个人资料页，展示完整用户详情',
    path: '/t/acme_hq',
    expectPath: '/t/acme_hq',
    custom: async (page) => {
      const failures = []
      await gotoProfileFromMenu(page)

      const info = await page.evaluate(`(() => {
        const q = (s) => document.querySelector(s)
        const text = document.body.innerText
        return {
          path: location.pathname,
          displayName: q('[data-profile="display-name"]')?.textContent?.trim() ?? null,
          // [data-user-menu="username"] 是只读 <input>：值在 .value，textContent 恒为空串
          username: q('[data-user-menu="username"]')?.value?.trim() || null,
          passwordState: q('[data-user-menu="password-state"]')?.textContent?.trim() ?? null,
          hasNameInput: !!q('#profile-name'),
          hasEmailInput: !!q('#profile-email'),
          hasEditUsername: !!q('[data-profile-action="edit-username"]'),
          hasUsernameReadonly: (() => {
            const host = q('#profile-username')
            const el = host?.tagName === 'INPUT' ? host : host?.querySelector('input')
            return !!el && (el.readOnly || el.disabled)
          })(),
          hasPasswordInput: !!q('#account-password-inline-next'),
          hasPasswordSubmit: !!q('[data-profile-action="change-password-submit"]'),
          hasManageUsers: /Manage users/i.test(text),
          /** 卡片数：四块资料必须同在一张卡里（v0.14.3 合并），页面只该剩下「Your details」+「Teams」两张 */
          cardTitles: [...document.querySelectorAll('[data-slot="card-title"]')].map((el) => el.textContent.trim()),
          /**
           * 页面里字段的 DOM 顺序（用于断言「登录名 → 显示名称 → 邮箱」）。
           * 不能先 map 成 id 再对字符串调 getAttribute —— 那样必然抛 TypeError。
           * 这里直接按「选择器列出的元素 + 文档顺序」取 id。
           */
          order: ['profile-username', 'profile-name', 'profile-email']
            .map((id) => document.getElementById(id))
            .filter((el) => el !== null)
            .map((el) => el.id),
          // 折叠态下不应已经渲染表单输入框
          hasUsernameForm: !!q('#account-username'),
          text,
        }
      })()`)

      if (info.path !== '/profile') failures.push(`应跳到 /profile，实际 ${info.path}`)
      if (!info.displayName) failures.push('缺少显示名称横幅')
      if (info.username !== 'admin') failures.push(`详情应展示登录名 admin，实际：${info.username}`)
      if (!info.passwordState) failures.push('详情应展示口令状态（最近修改时间 / 未设置）')
      if (!info.hasNameInput) failures.push('缺少「显示名称」可编辑字段')
      if (!info.hasEmailInput) failures.push('缺少「邮箱」字段')
      if (!info.hasEditUsername) failures.push('缺少「修改登录名」入口')
      if (!info.hasUsernameReadonly) failures.push('username 应排在前面且只读（不可直接编辑）')
      if (!info.hasPasswordInput) failures.push('口令区应直接渲染口令输入框（行内改密）')
      if (!info.hasPasswordSubmit) failures.push('缺少「Change password」按钮')
      if (info.hasManageUsers) failures.push('不应再有 Manage users 链接（v0.14.3 移除）')
      if (info.cardTitles.length !== 2) {
        failures.push(`应只剩「Your details」与「Teams」两张卡，实际：${info.cardTitles.join(' / ')}`)
      }
      // 视觉顺序：显示名称 → 登录名(修改) → 邮箱 → 口令(修改)
      const expected = ['profile-username', 'profile-name', 'profile-email']
      if (JSON.stringify(info.order) !== JSON.stringify(expected)) {
        failures.push(`字段顺序应为 ${expected.join(' → ')}，实际 ${info.order.join(' → ')}`)
      }
      if (info.hasUsernameForm) failures.push('改登录名应默认折叠（展开前不应渲染表单）')
      // 角色 / 状态以徽标出现（文案随词典，弱断言：不空即可）
      if (!/admin/i.test(info.text)) failures.push('详情应展示全局角色')
      if (!/active/i.test(info.text)) failures.push('详情应展示账号状态')
      if (!/Teams/i.test(info.text)) failures.push('详情应展示团队归属区块')
      return failures
    },
  },
  {
    name: '个人资料页：改显示名称落库，横幅与侧边栏同步',
    path: '/profile',
    expectPath: '/profile',
    custom: async (page) => {
      const failures = []
      await fillInput(page, SEL.profileNameInput, 'Admin Renamed')
      await clickProfileSave(page)

      const shown = await waitFor('横幅刷新为新显示名称', async () => {
        return page.evaluate(`document.querySelector('[data-profile="display-name"]')?.textContent?.trim() === 'Admin Renamed'`)
      }, { timeout: 5000 }).catch(() => false)
      if (!shown) failures.push('首页横幅未刷新为新的显示名称')

      const sidebar = await page.evaluate(`document.querySelector('[data-slot="sidebar-footer"]')?.innerText ?? ''`)
      if (!sidebar.includes('Admin Renamed')) failures.push('侧边栏左下角未同步新的显示名称')

      const persisted = (await readPersistedOrg(page)) ?? ''
      if (!persisted.includes('"name":"Admin Renamed"')) failures.push('新显示名称未写入 localStorage')
      return failures
    },
  },
  {
    name: '改登录名：展开后不填当前口令被拦，数据不变',
    path: '/profile',
    expectPath: '/profile',
    custom: async (page) => {
      const failures = []
      await expandSection(page, SEL.editUsername, '修改登录名入口')
      await fillInput(page, SEL.usernameInput, 'admin.renamed')
      // 故意不填当前口令
      await clickProfileSave(page)

      const raw = (await readPersistedOrg(page)) ?? ''
      if (raw.includes('admin.renamed')) failures.push('校验未通过却已写入新登录名')
      return failures
    },
  },
  {
    name: '改登录名：占用他人登录名被拦',
    path: '/profile',
    expectPath: '/profile',
    custom: async (page) => {
      const failures = []
      await expandSection(page, SEL.editUsername, '修改登录名入口')
      await fillInput(page, SEL.usernameInput, 'alice.chen') // 已被 Alice 占用
      await fillInput(page, SEL.currentPasswordForUsername, 'whatever-old')
      await clickProfileSave(page)

      const stillOpen = await page.evaluate(`!!document.querySelector('#account-username')`)
      if (!stillOpen) failures.push('登录名被占用时表单应保持展开（并提示原因）')
      const persisted = (await readPersistedOrg(page)) ?? ''
      if (persisted.includes('"username":"alice.chen"') && !persisted.includes('admin@example.com')) {
        failures.push('占用他人登录名却被写入')
      }
      return failures
    },
  },
  {
    name: '改登录名：校验通过后落库，页面收起并同步',
    path: '/profile',
    expectPath: '/profile',
    custom: async (page) => {
      const failures = []
      await expandSection(page, SEL.editUsername, '修改登录名入口')
      await fillInput(page, SEL.usernameInput, 'admin.root')
      await fillInput(page, SEL.currentPasswordForUsername, 'whatever-old')
      await clickProfileSave(page)

      const collapsed = await waitFor('表单收起', async () => {
        return (await page.evaluate(`!!document.querySelector('#account-username')`)) === false
      }, { timeout: 5000 }).catch(() => false)
      if (!collapsed) failures.push('保存成功后折叠区未收起')

      // 只读 <input> 的值在 .value，textContent 恒为空串
      const shown = await page.evaluate(`document.querySelector('[data-user-menu="username"]')?.value?.trim() || null`)
      if (shown !== 'admin.root') failures.push(`详情应显示新登录名 admin.root，实际：${shown}`)

      const persisted = (await readPersistedOrg(page)) ?? ''
      if (!persisted.includes('"username":"admin.root"')) failures.push('新登录名未写入 localStorage')
      return failures
    },
  },
  {
    name: '改口令：行内输入 → 两次不一致被拦',
    path: '/profile',
    expectPath: '/profile',
    custom: async (page) => {
      const failures = []
      await fillInput(page, SEL.nextPasswordInput, 'newpassword1')
      await fillInput(page, SEL.confirmPasswordInput, 'newpassword2')
      await clickPasswordSubmit(page)
      const persisted = (await readPersistedOrg(page)) ?? ''
      if (persisted.includes('passwordUpdatedAt')) failures.push('两次口令不一致却写入了 passwordUpdatedAt')
      return failures
    },
  },
  {
    name: '改口令：行内一致后只记时间戳，localStorage 无口令字段',
    path: '/profile',
    expectPath: '/profile',
    custom: async (page) => {
      const failures = []
      await fillInput(page, SEL.nextPasswordInput, 'newpassword1')
      await fillInput(page, SEL.confirmPasswordInput, 'newpassword1')
      await clickPasswordSubmit(page)

      await waitFor('口令状态刷新', async () => {
        const s = await page.evaluate(`document.querySelector('[data-user-menu="password-state"]')?.textContent?.trim() ?? null`)
        return s && !/not set/i.test(s)
      }, { timeout: 5000 }).catch(() => false)

      const persisted = (await readPersistedOrg(page)) ?? ''
      for (const forbidden of [...FORBIDDEN_PASSWORD_TEXT, 'newpassword1', 'whatever-old']) {
        if (persisted.toLowerCase().includes(forbidden.toLowerCase())) {
          failures.push(`localStorage 里出现了口令文本 ${forbidden}（口令不进前端状态）`)
        }
      }
      if (!persisted.includes('passwordUpdatedAt')) failures.push('passwordUpdatedAt 时间戳未写入')

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
