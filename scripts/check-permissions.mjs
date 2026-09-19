#!/usr/bin/env node
/**
 * check-permissions.mjs — 页面权限校验（node scripts/check-permissions.mjs）
 *
 * 背景：路由权限的「入口是否消失 / 直达 URL 是否被拦 / 底座页面是否锁死」属于
 * 组合行为（导航过滤 + 布局守卫 + store 强制规则），tsc 只能保证类型，保证不了行为，
 * 因此和 check-team-routes.mjs 一样用真实浏览器驱动验证。
 *
 * 校验项：
 *  1. 目录静态自检：key 唯一、defaultRoles 合法、required 条目对其适用角色恒有授权、
 *     旧权限键（page.settings → page.profile）在归一化时被迁移
 *  2. /permissions 只有系统管理员可达；普通成员直达 → 无权页（且侧边栏无入口）
 *  3. 矩阵结构：每行角色数 = ROLE_KEYS；系统管理员列与底座页面不可点
 *  4. 取消勾选 → 侧边栏入口消失 + 直达 URL 被拦（两条路径都要失效）
 *  5. 通配授权的匹配语义（`page.<分支>.*` 命中子键、不命中分支自身；本线不预置通配，故只在静态自检里钉）
 *  6. 整列「All / Clear」与「恢复默认」行为正确
 *  7. Config 分组（fail-closed 只给系统管理员）与 Profile（navHidden，入口在用户菜单）
 *     两处「入口不在侧边栏常规位置」的页面，其可见性与直达拦截仍受权限体系约束
 *
 * 依赖：已构建的 dist/（pnpm build）+ 本机 Google Chrome。
 * 用法：pnpm build && node scripts/check-permissions.mjs
 * 退出码：0 全部通过；1 存在失败。
 *
 * 注：CDP 极简客户端与 check-team-routes.mjs 有意重复（各自独立可跑），
 * 不改动那份已通过的 17 用例套件。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import {
  ACTION_CATALOG,
  DEFAULT_GRANTS,
  EDITABLE_ROLES,
  LOCKED_ROLES,
  ROLE_KEYS,
  ROUTE_CATALOG,
  applicableRoles,
  isAdminOnly,
  matchesGrant,
  normalizeGrants,
  withDefaultRoles,
} from '../src/config/permissions.ts'

const PORT = 4321
const DEBUG_PORT = 9334
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
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

/* ============================== 1. 目录静态自检 ============================== */

const staticFailures = []

if (ACTION_CATALOG.length > 0) {
  staticFailures.push('本版尚未落地按钮级权限，ACTION_CATALOG 应为空（如已落地请更新本脚本）')
}

const seenKeys = new Set()
for (const entry of ROUTE_CATALOG) {
  if (seenKeys.has(entry.key)) staticFailures.push(`权限键重复：${entry.key}`)
  seenKeys.add(entry.key)
  if (!entry.key.startsWith('page.')) {
    staticFailures.push(`路由权限键应以 page. 开头：${entry.key}`)
  }
  for (const role of entry.defaultRoles) {
    if (!EDITABLE_ROLES.includes(role)) {
      staticFailures.push(`${entry.key} 的 defaultRoles 含不可编辑角色：${role}`)
    }
  }
}

// 新增页面 fail-closed 的保证：defaultRoles 未覆盖的角色，默认矩阵里确实没有该键
for (const role of EDITABLE_ROLES) {
  for (const entry of ROUTE_CATALOG) {
    const declared = entry.defaultRoles.includes(role)
    const granted = DEFAULT_GRANTS[role].some((g) => matchesGrant(g, entry.key))
    if (declared && !granted) {
      staticFailures.push(`默认矩阵与 defaultRoles 不一致：${role} 应含 ${entry.key}`)
    }
    if (!declared && !entry.required && granted) {
      staticFailures.push(`默认矩阵与 defaultRoles 不一致：${role} 不应含 ${entry.key}`)
    }
  }
}

// 底座页面：其适用角色在默认矩阵里必须恒有授权
for (const entry of ROUTE_CATALOG) {
  if (!entry.required) continue
  for (const role of applicableRoles(entry)) {
    if (!DEFAULT_GRANTS[role].some((g) => matchesGrant(g, entry.key))) {
      staticFailures.push(`底座页面 ${entry.key} 缺少默认授权角色：${role}`)
    }
  }
  // 底座页面是「出口」，若只有系统管理员能开，普通用户会被困住
  if (isAdminOnly(entry)) {
    staticFailures.push(`底座页面不能是 admin-only：${entry.key}`)
  }
}
// 通配语义（本线不预置通配授权，因此这条语义只能在这里钉住）：
//   page.<分支>.* 命中该分支下的子键，但**不含**分支自身 —— 避免「授了 page.x.* 就等于给了 page.x」
{
  if (!matchesGrant('page.workbooks.*', 'page.workbooks.create')) {
    staticFailures.push('通配应命中分支下的子键（page.workbooks.* → page.workbooks.create）')
  }
  if (matchesGrant('page.workbooks.*', 'page.workbooks')) {
    staticFailures.push('通配不应命中分支自身（page.workbooks.* ⊅ page.workbooks）')
  }
}

if (LOCKED_ROLES.length !== 1 || LOCKED_ROLES[0] !== 'system-admin') {
  staticFailures.push(`锁死角色应只含 system-admin，实际：${LOCKED_ROLES.join(',')}`)
}

// 页面改名的一次性迁移：持久化矩阵里的旧键必须在归一化时被改写成新键，
// 否则老用户浏览器里的 `page.settings` 变成死数据，新页面按 fail-closed 直接消失。
{
  const migrated = normalizeGrants({
    'system-admin': ['*'],
    member: ['page.settings'],
    'team-admin': [],
    analyst: [],
    viewer: [],
  })
  if (!migrated.member.includes('page.profile')) {
    staticFailures.push('旧权限键 page.settings 应迁移为 page.profile（normalizeGrants 未生效）')
  }
  if (migrated.member.includes('page.settings')) {
    staticFailures.push('归一化后不应保留已废弃的 page.settings')
  }
}

// 「补齐默认授权」与「重置全部授权」**不等价**，这一对最容易被误读成「取消 / 保存」，故钉住语义：
//   补齐 = 并集（保留手工授权，只补目录声明的默认键）；重置 = 覆盖（整表拉回 DEFAULT_GRANTS，手工项全丢）
const unionProbe = withDefaultRoles({
  'system-admin': ['*'],
  member: ['page.users'],
  'team-admin': ['page.custom.*'],
  analyst: [],
  viewer: [],
})
if (!unionProbe.member.includes('page.users')) {
  staticFailures.push('补齐默认授权应保留手工授权（并集语义），实际被删除')
}
if (!unionProbe['team-admin'].includes('page.custom.*')) {
  staticFailures.push('补齐默认授权应保留通配授权（并集语义），实际被删除')
}
if (!unionProbe.analyst.includes('page.dashboard')) {
  staticFailures.push('补齐默认授权应补上目录声明的默认键（analyst ← page.dashboard）')
}

/* ============================== 2. 浏览器用例 ============================== */

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

const pageState = `(() => ({
  path: location.pathname + location.search,
  text: document.body.innerText,
  allLinks: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
}))()`

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

async function navigate(cdp, path, expect = {}) {
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

  if (expect.expectPath) {
    await waitFor(
      `${path} 满足期望`,
      async () => (await cdp.evaluate('location.pathname + location.search')) === expect.expectPath,
      { timeout: 12000 },
    )
  }
}

/** 打开 Radix 下拉并点选菜单项（与 check-team-routes.mjs 同法） */
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
  await delay(400)
}

/** 以某身份继续（先切换身份，随后由用例再次导航到目标 URL） */
async function switchUser(page, name) {
  await clickMenuItem(page, '[data-slot="sidebar-footer"] button', name)
}

/** 只打开左下角用户菜单（不点任何菜单项），用于断言菜单里的入口 */
async function openUserMenu(page) {
  await page.evaluate(`(() => {
    const trigger = document.querySelector('[data-slot="sidebar-footer"] button')
    if (!trigger) throw new Error('未找到左下角用户菜单触发器')
    trigger.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, button: 0, pointerType: 'mouse',
    }))
  })()`)
  await delay(400)
}

/** 打开权限页并点一个单元格 */
async function toggleCell(page, role, key) {
  await navigate(page, '/permissions', { expectPath: '/permissions' })
  await clickSelector(page, `[data-perm-role="${role}"][data-perm-key="${key}"]`)
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
  await delay(300)
}

/** 在弹窗里点按钮（重置需要二次确认） */
async function clickDialogButton(page, text) {
  const res = await page.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]')
    if (!dialog) return 'no-dialog'
    const btn = [...dialog.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(text)}))
    if (!btn) return 'no-button: ' + [...dialog.querySelectorAll('button')].map((b) => b.textContent.trim()).join(' | ')
    btn.click()
    return 'ok'
  })()`)
  if (res !== 'ok') throw new Error(`弹窗内点击「${text}」失败：${res}`)
  await delay(400)
}

/** 读取单元格状态（Radix Checkbox 是 button[role=checkbox]） */
async function cellState(page, role, key) {
  return page.evaluate(`(() => {
    const el = document.querySelector('[data-perm-role="${role}"][data-perm-key="${key}"]')
    if (!el) return null
    return { checked: el.getAttribute('aria-checked') === 'true', disabled: el.hasAttribute('disabled') }
  })()`)
}

const CASES = [
  {
    name: '权限页可达（系统管理员）且矩阵结构完整',
    path: '/permissions',
    contains: ['Page permissions', 'Roles × pages', 'Base page'],
    custom: async (page) => {
      const failures = []
      // 以「团队作用域的 workbooks 行」为样本：可勾选列数 = 适用角色 + 锁定的系统管理员
      const expectedCells =
        applicableRoles(ROUTE_CATALOG.find((e) => e.key === 'page.workbooks')).length +
        LOCKED_ROLES.length
      const cells = await page.evaluate(
        `document.querySelectorAll('[data-perm-key="page.workbooks"]').length`,
      )
      if (cells !== expectedCells) {
        failures.push(`workbooks 行的可勾选列数应为 ${expectedCells}（适用角色 + 系统管理员），实际 ${cells}`)
      }
      const rows = await page.evaluate(
        `new Set([...document.querySelectorAll('[data-perm-key]')].map(el => el.getAttribute('data-perm-key'))).size`,
      )
      if (rows !== ROUTE_CATALOG.length) {
        failures.push(`矩阵行数应为 ${ROUTE_CATALOG.length}，实际 ${rows}`)
      }
      const note = await page.evaluate(
        `document.body.innerText.includes('New pages default to system-administrator-only')`,
      )
      if (!note) failures.push('缺少「新页面 fail-closed」说明')

      // 本页没有保存语义：勾选即时生效 + 页面明确说明；不允许出现任何 Save 按钮
      const saveButtons = await page.evaluate(
        `[...document.querySelectorAll('button')].filter((b) => /save/i.test(b.textContent)).length`,
      )
      if (saveButtons > 0) failures.push('权限页不应出现「保存」类按钮（勾选即时生效）')
      const autoNote = await page.evaluate(
        `document.body.innerText.includes('there is no Save button')`,
      )
      if (!autoNote) failures.push('缺少「即时生效、无需保存」的说明')
      // 没有真缺口时，「补齐默认授权」不该出现（否则与页尾重置又形成一对像「取消/保存」的按钮）
      const fill = await page.evaluate(
        `!!document.querySelector('[data-perm-action="apply-defaults"]')`,
      )
      if (fill) failures.push('默认状态（无真缺口）下不该出现「补齐默认授权」按钮')
      const adminOnly = await page.evaluate(`document.body.innerText.includes('Admin only')`)
      if (!adminOnly) failures.push('page.permissions 行应标记为 Admin only（设计上只给系统管理员）')
      return failures
    },
  },
  {
    name: '系统管理员列与底座页面不可编辑',
    path: '/permissions',
    custom: async (page) => {
      const failures = []
      const admin = await cellState(page, 'system-admin', 'page.workbooks')
      if (!admin?.disabled) failures.push('系统管理员列的勾选框应禁用')
      const required = await cellState(page, 'member', 'page.teams')
      if (!required?.disabled) failures.push('底座页面（/teams）的勾选框应禁用')
      if (!required?.checked) failures.push('底座页面应恒为已勾选')
      // 作用域不匹配的单元格应为「不适用」，而不是可勾选的空框
      const na = await page.evaluate(
        `!!document.querySelector('[data-perm-na="team-admin:page.users"]')`,
      )
      if (!na) failures.push('团队岗位列 × 管理页 应显示为不适用')
      return failures
    },
  },
  {
    name: '普通成员直达权限页 → 无权页，且侧边栏无入口',
    path: '/permissions',
    before: async (page) => {
      await navigate(page, '/t/acme_hq', { expectPath: '/t/acme_hq' })
      await switchUser(page, 'Alice Chen')
    },
    contains: ["don't have access to this page", 'is not enabled for your role'],
    linkAbsent: '/permissions',
  },
  {
    name: '取消 analyst 的 Workbooks → 侧边栏入口消失 + 直达 URL 被拦',
    path: '/t/acme_hq/workbooks',
    before: async (page) => {
      await toggleCell(page, 'analyst', 'page.workbooks')
      await navigate(page, '/t/acme_hq', { expectPath: '/t/acme_hq' })
      await switchUser(page, 'Alice Chen')
    },
    contains: ["don't have access to this page", 'is not enabled for your role'],
    linkAbsent: '/t/acme_hq/workbooks',
    linkPresent: '/t/acme_hq/views',
  },
  {
    name: '整列「All」恢复 team-admin 的全部团队页面入口',
    path: '/t/acme_analytics/workbooks',
    before: async (page) => {
      await navigate(page, '/permissions', { expectPath: '/permissions' })
      // 先清空该列（侧边栏入口全部消失），再用「All」一键恢复 → 证明 All 是逐条显式授权
      await clickSelector(page, '[data-perm-action="clear-team-admin"]')
      await clickSelector(page, '[data-perm-action="select-all-team-admin"]')
      await switchUser(page, 'Bob Martin')
    },
    expectPath: '/t/acme_analytics/workbooks',
    linkPresent: '/t/acme_analytics/views',
  },
  {
    name: '整列「Clear」→ viewer 只剩底座页面（团队首页），其余入口消失',
    path: '/t/acme_hq',
    before: async (page) => {
      await navigate(page, '/permissions', { expectPath: '/permissions' })
      await clickSelector(page, '[data-perm-action="clear-viewer"]')
      await switchUser(page, 'Carol White')
    },
    contains: ['Dashboard'],
    linkAbsent: '/t/acme_hq/workbooks',
    linkPresent: '/t/acme_hq',
  },
  {
    name: '「重置全部授权」需二次确认，确认后 viewer 的入口还原',
    path: '/t/acme_hq/workbooks',
    before: async (page) => {
      await navigate(page, '/permissions', { expectPath: '/permissions' })
      await clickSelector(page, '[data-perm-action="clear-viewer"]')
      // 重置是危险操作：点按钮只弹确认框，必须再确认一次（避免被当成「保存」）
      await clickSelector(page, '[data-perm-action="reset"]')
      await clickDialogButton(page, 'Reset everything')
      await switchUser(page, 'Carol White')
    },
    linkPresent: '/t/acme_hq/workbooks',
  },
  {
    name: '「补齐默认授权」只对真缺口出现（模拟升级新增页面），点击后补上默认授权',
    path: '/t/acme_hq/workbooks',
    before: async (page) => {
      // 模拟「升级后新增页面」：三个团队岗位的持久化矩阵里都只有底座页面，于是
      // favorites/recents/workbooks/views 四行没有任何角色能打开 —— 这正是 fail-closed 的状态，
      // 也是「补齐默认授权」存在的唯一理由（只清空某一个角色不算缺口：其他角色仍能打开该页）。
      await page.evaluate(`localStorage.setItem('shadcn-admin-cn:permissions', JSON.stringify({
        state: { grants: {
          'system-admin': ['*'],
          member: ['page.users', 'page.teams', 'page.profile', 'page.help'],
          'team-admin': ['page.dashboard'],
          analyst: ['page.dashboard'],
          viewer: ['page.dashboard'],
        } },
        version: 1,
      }))`)
      await navigate(page, '/permissions', { expectPath: '/permissions' })

      const failures = []
      const state = await page.evaluate(`(() => {
        const fill = document.querySelector('[data-perm-action="apply-defaults"]')
        return {
          fillLabel: fill ? fill.textContent.trim() : null,
          noRole: (document.body.innerText.match(/No role/g) ?? []).length,
          checked: document.querySelector('[data-perm-role="viewer"][data-perm-key="page.workbooks"]')
            ?.getAttribute('aria-checked'),
        }
      })()`)
      if (!state.fillLabel) failures.push('存在真缺口时「补齐默认授权」按钮应出现')
      else if (!state.fillLabel.includes('4')) {
        failures.push(`补齐按钮应标出缺口数 4（favorites/recents/workbooks/views 四行无人可开），实际文案：${state.fillLabel}`)
      }
      if (state.noRole < 4) failures.push(`应有 4 行标记「No role」，实际 ${state.noRole}`)
      if (state.checked !== 'false') failures.push('viewer 的 workbooks 此刻应未被授权')

      await clickSelector(page, '[data-perm-action="apply-defaults"]')
      await switchUser(page, 'Carol White')
      if (failures.length > 0) throw new Error(failures.join('；'))
    },
    linkPresent: '/t/acme_hq/workbooks',
  },
  {
    // Config 分组的页面 defaultRoles 为空 = fail-closed：入口与直达两条路径都要失效
    name: 'Config 菜单只对系统管理员可见（fail-closed），成员直达 /config/smtp 被拦',
    path: '/config/smtp',
    before: async (page) => {
      await navigate(page, '/t/acme_hq', { expectPath: '/t/acme_hq' })
      await switchUser(page, 'Alice Chen')
    },
    contains: ["don't have access to this page", 'is not enabled for your role'],
    linkAbsent: '/config/smtp',
  },
  {
    // 与上一条对照：Help 默认授权给 member（说明书人人可看），Config 则 fail-closed 只给管理员
    name: 'Help 页对所有成员可见（默认授权），并展示版本号与开发者',
    path: '/help',
    before: async (page) => {
      await navigate(page, '/t/acme_hq', { expectPath: '/t/acme_hq' })
      await switchUser(page, 'Alice Chen')
    },
    contains: ['shadcn-admin-cn', 'Core features', 'xilejun', 'xilejun.com', 'v'],
    linkPresent: '/help',
    custom: async (page) => {
      const failures = []
      const version = await page.evaluate(
        `document.querySelector('[data-help-version]')?.textContent?.trim()`,
      )
      if (!/^v\d+\.\d+\.\d+$/.test(version ?? '')) {
        failures.push(`帮助页应显示版本号（vX.Y.Z），实际：${version}`)
      }
      const features = await page.evaluate(
        `document.querySelectorAll('[data-help-features] li').length`,
      )
      if (features < 6) failures.push(`核心功能条目过少（应为 8 条），实际 ${features}`)
      const website = await page.evaluate(
        `document.querySelector('[data-help-website]')?.getAttribute('href')`,
      )
      if (website !== 'https://xilejun.com') {
        failures.push(`开发者站点链接应为 https://xilejun.com，实际：${website}`)
      }
      return failures
    },
  },
  {
    name: '系统管理员侧边栏出现 Config 分组与 SMTP 入口',
    path: '/t/acme_hq',
    contains: ['Config', 'SMTP'],
    linkPresent: '/config/smtp',
  },
  {
    // 侧边栏顺序属于「产品决定」而非样式细节，用用例钉住：Config 分组内 Help 必须在 SMTP 之后
    name: '侧边栏 Config 分组内 Help 排在 SMTP 之后',
    path: '/t/acme_hq',
    custom: async (page) => {
      const order = await page.evaluate(`(() => {
        const groups = [...document.querySelectorAll('[data-slot="sidebar-group"]')]
        const target = groups.find(
          (g) => g.querySelector('[data-slot="sidebar-group-label"]')?.textContent?.trim() === 'Config',
        )
        if (!target) return null
        return [...target.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
      })()`)
      if (order === null) return ['侧边栏里未找到 Config 分组']
      if (order.indexOf('/config/smtp') === -1 || order.indexOf('/help') === -1) {
        return [`Config 分组应同时含 /config/smtp 与 /help，实际：${JSON.stringify(order)}`]
      }
      if (order.indexOf('/help') !== order.indexOf('/config/smtp') + 1) {
        return [`Help 应紧跟 SMTP 之后，实际顺序：${JSON.stringify(order)}`]
      }
      return []
    },
  },
  {
    // Profile 是 navHidden 页面：入口不在侧边栏，但权限判定照旧（这里是「能打开」的一半）
    name: '个人资料入口在左下角用户菜单，侧边栏没有 /profile',
    path: '/t/acme_hq',
    linkAbsent: '/profile',
    custom: async (page) => {
      const failures = []
      await openUserMenu(page)
      const present = await page.evaluate(
        `!!document.querySelector('[data-user-menu="profile"]')`,
      )
      if (!present) return ['左下角用户菜单里未找到 Profile 入口']
      await clickSelector(page, '[data-user-menu="profile"]')
      const path = await waitFor(
        '点击 Profile 后跳到 /profile',
        async () => {
          const current = await page.evaluate('location.pathname')
          return current === '/profile' ? current : null
        },
        { timeout: 8000 },
      ).catch(() => null)
      if (path !== '/profile') {
        failures.push(`点击 Profile 后应到 /profile，实际 ${await page.evaluate('location.pathname')}`)
        return failures
      }
      const text = await page.evaluate('document.body.innerText')
      if (!text.includes('Profile')) failures.push('个人资料页未渲染出标题')
      // 顺带守住两件事：① 表单真的绑定了**当前登录身份**（不是占位演示表单）；
      // ② FormField 的 id 注入在真实页面里生效（#profile-name / #profile-email 必须存在）。
      // 刻意与身份解耦：拿侧边栏底部的用户名做参照（本用例不切身份，跑在种子管理员上）。
      const filled = await page.evaluate(`(() => ({
        sidebarName: document.querySelector('[data-slot="sidebar-footer"] button span.font-semibold')?.textContent?.trim() ?? null,
        name: document.querySelector('#profile-name')?.value ?? null,
        email: document.querySelector('#profile-email')?.value ?? null,
      }))()`)
      if (filled.name === null || filled.name !== filled.sidebarName) {
        failures.push(`资料页姓名应预填当前身份（${filled.sidebarName}），实际：${JSON.stringify(filled)}`)
      }
      if (filled.email === null || !filled.email.includes('@')) {
        failures.push(`资料页邮箱应预填当前身份，实际：${JSON.stringify(filled)}`)
      }
      return failures
    },
  },
]

/** 结果收集 */
const results = []

async function runCase(cdp, c) {
  const failures = []

  // 回到种子状态：清空持久化（含权限矩阵与身份）
  await navigate(cdp, '/t/acme_hq', { expectPath: '/t/acme_hq' })
  await cdp.evaluate(`localStorage.clear()`)
  await navigate(cdp, '/t/acme_hq', { expectPath: '/t/acme_hq' })

  try {
    if (c.before) await c.before(cdp)
    await navigate(cdp, c.path, c)

    // 内容页挂载可能晚于首帧：先等期望文本出现，避免读到半渲染快照。
    // 等不到不算错在这里 —— 交给下面统一的文本断言报出实际缺失内容。
    if ((c.contains ?? []).length > 0) {
      await waitFor(
        `${c.name} 页面文本就绪`,
        async () => {
          const text = await cdp.evaluate('document.body.innerText')
          return (c.contains ?? []).every((n) => text.includes(n))
        },
        { timeout: 10000, interval: 250 },
      ).catch(() => null)
    }

    const state = await cdp.evaluate(pageState)
    const expectedPath = c.expectPath ?? c.path
    if (state.path !== expectedPath) {
      failures.push(`URL 期望 ${expectedPath}，实际 ${state.path}`)
    }
    for (const needle of c.contains ?? []) {
      if (!state.text.includes(needle)) failures.push(`页面文本缺少「${needle}」`)
    }
    if (c.linkAbsent && state.allLinks.includes(c.linkAbsent)) {
      failures.push(`侧边栏不应出现：${c.linkAbsent}`)
    }
    if (c.linkPresent && !state.allLinks.includes(c.linkPresent)) {
      failures.push(`侧边栏应出现：${c.linkPresent}（实际团队链接：${state.allLinks.filter((h) => h.startsWith('/t/')).join(', ')}）`)
    }
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
  console.log('\n[权限] 目录静态自检：' + (staticFailures.length === 0 ? 'PASS' : 'FAIL'))
  for (const f of staticFailures) console.log('  ✗ ' + f)
  failed += staticFailures.length

  for (const r of results) {
    if (r.failures.length === 0) {
      console.log(`  ✓ ${r.name}`)
    } else {
      failed += r.failures.length
      console.log(`  ✗ ${r.name}`)
      for (const f of r.failures) console.log('      ' + f)
    }
  }

  const total = CASES.length + 1
  if (failed > 0) {
    console.log(`\n[权限] FAILED：${CASES.length - results.filter((r) => r.failures.length).length}/${CASES.length} 用例通过，共 ${failed} 处失败`)
    cleanup()
    process.exit(1)
  }
  console.log(`\n[权限] OK：${total} 项全部通过（${ROUTE_CATALOG.length} 个路由 × ${ROLE_KEYS.length} 个角色）`)
  cleanup()
  process.exit(0)
}

main().catch((err) => {
  console.error('[权限] 运行失败：' + err.message)
  cleanup()
  process.exit(1)
})
