#!/usr/bin/env node
/**
 * capture-readme-shots.mjs — 为 README / 宣传物料生成页面截图（node scripts/capture-readme-shots.mjs）
 *
 * 为什么要有这个脚本：README 里的截图如果靠手工截，改一次 UI 就全部过期且没人知道是哪一版截的。
 * 这里把它做成**可重跑的一次性命令**：`pnpm build` 后跑一次，`docs/images/` 里的图与当前构建产物一致。
 *
 * 依赖：已构建的 dist/（`pnpm build`）+ 本机 Google Chrome。
 * 用法：pnpm build && node scripts/capture-readme-shots.mjs
 * 输出：docs/images/<name>.png（1440×900 视口 @2x 设备像素，浅色主题）
 * 退出码：0 全部成功；1 有页面没截到。
 *
 * 注：CDP 极简客户端与其它 check 脚本有意重复（各自独立可跑）；端口与它们错开，
 *     避免并行 / 残留实例互抢。要加图就往 SHOTS 里加一行。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const PORT = 4336
const DEBUG_PORT = 9349
const BASE = `http://127.0.0.1:${PORT}`

/** 视口与像素密度：README 在 GitHub 上按 ~1440 逻辑宽显示，2x 供高清屏与公众号取图 */
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2 }

/**
 * 要截的页面（**与 README 里引用的图一一对应**，多一张都会让 README 与素材脱节）。
 * - `path`  路由（默认团队 slug 为种子数据里的 `acme_hq`，默认用户是系统管理员）
 * - `ready` 额外的就绪判据（返回 true 才截），用来等异步数据渲染完
 * - `wait`  截图前额外等待毫秒数（列表 / 图表类页面留出渲染时间）
 */
const SHOTS = [
  {
    name: 'dashboard',
    path: '/t/acme_hq',
    wait: 2500,
    ready: `!/加载中|Loading/.test(document.body.innerText)`,
  },
  { name: 'users', path: '/users', wait: 900, ready: `document.querySelectorAll('tbody tr').length > 0` },
  { name: 'permissions', path: '/permissions', wait: 900, ready: `document.querySelectorAll('tbody tr').length > 0` },
  { name: 'login', path: '/login', wait: 600 },
]

/**
 * Chrome 可执行文件 —— **跨平台探测**（优先 CHROME_PATH，其次按平台找常见安装位置）。
 */
function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
    '/usr/bin/google-chrome', // Debian / Ubuntu
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
const OUT_DIR = join(ROOT, 'docs', 'images')

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
 * 兜底清理：undici 的 socket 报错（本机见过 `setTypeOfService EINVAL`）可能在 await 之外抛出，
 * 那样 `main().catch` 接不到，进程直接退出 —— 预览服务器会变成孤儿进程占住端口，
 * 让下一次运行报出「端口已被占用」这种与真实原因无关的假故障。宁可多一层兜底。
 */
function bail(err) {
  console.error(`[capture] 无法完成：${err?.message ?? err}`)
  cleanup()
  process.exit(1)
}
process.on('uncaughtException', bail)
process.on('unhandledRejection', bail)

/** 端口自检：被上一轮残留实例占着就立刻报错，绝不连陌生实例（会截到旧构建产物） */
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
          `请先执行 pkill 清理残留进程（预览进程搜 "--port ${port}"，调试端口搜 "remote-debugging-port=${port}"）后重跑。`,
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

async function waitFor(label, fn, { timeout = 20000, interval = 150 } = {}) {
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

async function main() {
  await assertPortsFree()
  mkdirSync(OUT_DIR, { recursive: true })

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
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      '--force-color-profile=srgb',
      '--hide-scrollbars',
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
  // 浅色主题 + 固定视口：截图必须与主题无关（headless 默认 prefers-color-scheme 可能随机器变）
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }],
  })
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    deviceScaleFactor: VIEWPORT.deviceScaleFactor,
    mobile: false,
  })

  const failed = []
  for (const shot of SHOTS) {
    const file = join(OUT_DIR, `${shot.name}.png`)
    try {
      await cdp.send('Page.navigate', { url: `${BASE}${shot.path}` })
      await delay(400)
      if (shot.ready) {
        await waitFor(`${shot.path} 就绪`, () => cdp.evaluate(`(() => (${shot.ready}))()`), {
          timeout: 25000,
        })
      }
      // 等字体就绪：否则截图里可能出现回退字体（Geist 未加载完）
      await cdp.evaluate('document.fonts.ready.then(() => true)')
      await delay(shot.wait ?? 600)

      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      })
      writeFileSync(file, Buffer.from(data, 'base64'))
      const { size } = statSync(file)
      console.log(`  ✓ ${shot.path} → docs/images/${shot.name}.png（${(size / 1024).toFixed(0)} KB）`)
    } catch (err) {
      failed.push(`${shot.path}：${err.message}`)
      console.log(`  ✗ ${shot.path} — ${err.message}`)
    }
  }

  cdp.close()
  cleanup()
  await delay(500)
  try {
    rmSync(userDataDir, { recursive: true, force: true })
  } catch {
    /* 临时目录清理失败不影响截图结论（下次运行会新建） */
  }

  if (failed.length > 0) {
    console.log(`\n[capture] FAILED：${SHOTS.length - failed.length}/${SHOTS.length} 张成功`)
    process.exit(1)
  }
  console.log(`\n[capture] PASS：${SHOTS.length}/${SHOTS.length} 张已写入 docs/images/`)
}

main().catch(bail)
