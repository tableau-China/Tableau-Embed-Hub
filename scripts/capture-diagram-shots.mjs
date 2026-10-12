#!/usr/bin/env node
/**
 * capture-diagram-shots.mjs — 为图表生成 PNG 截图
 * 用法：node scripts/capture-diagram-shots.mjs
 * 输出：docs/images/<name>.png（900×N 视口 @2x 设备像素）
 */
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const DEBUG_PORT = 9350 // 与其他脚本错开

const DIAGRAMS = [
  { name: 'architecture', html: 'docs/diagrams/architecture.html', viewport: { width: 900, height: 500, deviceScaleFactor: 2 } },
  { name: 'multi-tenant', html: 'docs/diagrams/multi-tenant.html', viewport: { width: 900, height: 540, deviceScaleFactor: 2 } },
  { name: 'permissions-matrix', html: 'docs/diagrams/permissions.html', viewport: { width: 900, height: 580, deviceScaleFactor: 2 } },
  { name: 'tableau-flow', html: 'docs/diagrams/tableau-flow.html', viewport: { width: 900, height: 600, deviceScaleFactor: 2 } },
]

function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean)
  const found = candidates.find((p) => existsSync(p))
  if (!found) {
    throw new Error('未找到 Chrome。请设置 CHROME_PATH 或安装 google-chrome / chromium')
  }
  return found
}

const CHROME = resolveChrome()
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = join(ROOT, 'docs', 'images')

const children = []
function cleanup() {
  for (const c of children) {
    try { c.kill('SIGTERM'); c.kill('SIGKILL') } catch {}
  }
}
process.on('uncaughtException', (err) => { console.error(err); cleanup(); process.exit(1) })
process.on('unhandledRejection', (err) => { console.error(err); cleanup(); process.exit(1) })

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
    ws.addEventListener('error', () => reject(new Error('CDP 连接失败')))

    const send = (method, params = {}) =>
      new Promise((res, rej) => {
        const id = ++seq
        pending.set(id, { resolve: res, reject: rej })
        ws.send(JSON.stringify({ id, method, params }))
      })

    const close = () => ws.close()

    ws.addEventListener('open', () => resolve({ send, close }))
  })
}

async function main() {
  console.log('[capture-diagrams] 启动 Chrome（无头模式）...')
  
  // 创建临时用户数据目录
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const userDataDir = mkdtempSync(join(tmpdir(), 'chrome-'))
  
  const chromeProc = spawn(
    CHROME,
    [
      '--headless',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      'about:blank'
    ],
    { stdio: 'ignore' }
  )
  children.push(chromeProc)

  // 等待 Chrome 启动
  let retries = 0
  let versionResp
  while (retries < 20) {
    await delay(300)
    try {
      versionResp = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`, { signal: AbortSignal.timeout(2000) })
      break
    } catch {
      retries++
    }
  }
  if (!versionResp) {
    throw new Error('Chrome 启动超时')
  }
  const { webSocketDebuggerUrl } = await versionResp.json()

  const { send: sendCDP, close: closeCDP } = await connectCDP(webSocketDebuggerUrl)

  await sendCDP('Target.setDiscoverTargets', { discover: true })

  let failed = 0
  for (const diagram of DIAGRAMS) {
    const htmlPath = join(ROOT, diagram.html)
    if (!existsSync(htmlPath)) {
      console.error(`  ❌ ${diagram.html} 不存在`)
      failed++
      continue
    }

    console.log(`[capture-diagrams] 截图 ${diagram.name}...`)

    const fileUrl = `file://${htmlPath}`
    const { targetId } = await sendCDP('Target.createTarget', { url: fileUrl })
    const targetResp = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)
    const targets = await targetResp.json()
    const target = targets.find((t) => t.id === targetId)
    if (!target?.webSocketDebuggerUrl) {
      console.error(`  ❌ 无法获取 target ${targetId} 的 WS URL`)
      failed++
      continue
    }

    const { send: sendPage, close: closePage } = await connectCDP(target.webSocketDebuggerUrl)

    await sendPage('Emulation.setDeviceMetricsOverride', {
      width: diagram.viewport.width,
      height: diagram.viewport.height,
      deviceScaleFactor: diagram.viewport.deviceScaleFactor,
      mobile: false,
    })
    await sendPage('Page.enable')

    await delay(1000) // 等字体加载

    const { data } = await sendPage('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const pngPath = join(OUT_DIR, `${diagram.name}.png`)
    writeFileSync(pngPath, Buffer.from(data, 'base64'))
    console.log(`  ✅ ${pngPath}`)

    closePage()
    await sendCDP('Target.closeTarget', { targetId })
  }

  closeCDP()
  cleanup()
  
  // 清理临时目录
  try {
    rmSync(userDataDir, { recursive: true, force: true })
  } catch {}

  if (failed > 0) {
    console.error(`[capture-diagrams] ${failed} 张图截取失败`)
    process.exit(1)
  } else {
    console.log('[capture-diagrams] ✨ 全部完成')
  }
}

main().catch((err) => {
  console.error('[capture-diagrams] 错误:', err)
  cleanup()
  process.exit(1)
})
