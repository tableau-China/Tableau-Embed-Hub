#!/usr/bin/env node
/**
 * check-bundle.mjs — 产物体积预算门禁（node scripts/check-bundle.mjs）
 *
 * 为什么需要：CI 里 build 成功只证明「能编译」，不证明「产物没失控」。本项目纯前端，
 * 首屏体积是用户体验的硬约束；一次误引入大依赖（整包 lodash / moment / 图标全量导入）
 * 不会报错，只会悄悄把 bundle 撑大。这个脚本把体积变成可失败的门槛。
 *
 * 校验项：
 *  1. dist/assets/*.js 逐个输出 raw + gzip 体积清单（按 gzip 降序）
 *  2. 总 JS gzip ≤ MAX_TOTAL_GZIP_KB
 *  3. 单文件 raw ≤ MAX_FILE_RAW_MB
 *  4. **首屏静态 JS gzip ≤ MAX_INITIAL_GZIP_KB**：读 dist/.vite/manifest.json，
 *     从 index.html 入口沿 `imports`（静态依赖）递归求闭包；路由懒加载的 chunk
 *     只出现在 `dynamicImports` 里，不计入首屏 —— 这条才是代码分割真正要看的数据。
 *
 * 依赖：已构建的 dist/（pnpm build）。
 * 用法：node scripts/check-bundle.mjs
 * 退出码：0 在预算内；1 超预算或 dist 不存在。
 *
 * 阈值纪律：**随代码分割进展只降不升**。调高阈值需要说明理由（新增了什么必要依赖）
 * 并同步更新本注释与 PROGRESS.md，不要为了让 CI 变绿而放宽。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

/** 总 JS gzip 预算（KB）——只降不升（含所有懒加载 chunk；代码分割后会有 chunk 拆分开销） */
const MAX_TOTAL_GZIP_KB = 550
/** 单文件 raw 预算（MB）——只降不升 */
const MAX_FILE_RAW_MB = 2.0
/** 首屏静态 JS gzip 预算（KB）——只降不升；v0.10.0 代码分割后基线约 218 KB */
const MAX_INITIAL_GZIP_KB = 260

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ASSETS_DIR = join(ROOT, 'dist', 'assets')
const MANIFEST_PATH = join(ROOT, 'dist', '.vite', 'manifest.json')

const KB = 1024
const MB = 1024 * 1024

function fmtKb(bytes) {
  return `${(bytes / KB).toFixed(1)} KB`
}

function main() {
  let names
  try {
    names = readdirSync(ASSETS_DIR)
  } catch {
    console.error(
      '[bundle] dist/assets 不存在，请先构建产物：\n' +
        '  node_modules/.bin/tsc -b && node_modules/.bin/vite build   # 等价于 pnpm build\n' +
        '构建完成后再运行 node scripts/check-bundle.mjs',
    )
    process.exit(1)
  }

  const files = names
    .filter((name) => name.endsWith('.js'))
    .map((name) => {
      const path = join(ASSETS_DIR, name)
      const raw = statSync(path).size
      const gzip = gzipSync(readFileSync(path), { level: 9 }).length
      return { name, raw, gzip }
    })
    .sort((a, b) => b.gzip - a.gzip)

  if (files.length === 0) {
    console.error('[bundle] dist/assets 下没有 .js 产物，构建结果异常。请先运行 pnpm build。')
    process.exit(1)
  }

  const totalRaw = files.reduce((sum, f) => sum + f.raw, 0)
  const totalGzip = files.reduce((sum, f) => sum + f.gzip, 0)

  console.log(`[bundle] dist/assets/*.js 体积清单（gzip level 9，共 ${files.length} 个文件）`)
  const nameWidth = Math.max(...files.map((f) => f.name.length), 4)
  const rawWidth = Math.max(...files.map((f) => fmtKb(f.raw).length), 6)
  console.log(`  ${'文件'.padEnd(nameWidth)}  ${'raw'.padStart(rawWidth)}  ${'gzip'.padStart(8)}`)
  for (const f of files) {
    console.log(`  ${f.name.padEnd(nameWidth)}  ${fmtKb(f.raw).padStart(rawWidth)}  ${fmtKb(f.gzip).padStart(8)}`)
  }
  console.log(
    `  ${'合计'.padEnd(nameWidth)}  ${fmtKb(totalRaw).padStart(rawWidth)}  ${fmtKb(totalGzip).padStart(8)}` +
      `  （gzip 预算 ${MAX_TOTAL_GZIP_KB} KB，已用 ${((totalGzip / (MAX_TOTAL_GZIP_KB * KB)) * 100).toFixed(1)}%）`,
  )

  /** 首屏静态闭合：entry + 递归 imports（不含 dynamicImports） */
  let initialGzip = 0
  let initialRaw = 0
  let initialChunks = 0
  const initialFiles = []
  try {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    const entry = Object.entries(manifest).find(([, value]) => value.isEntry)
    if (!entry) throw new Error('manifest 里没有 isEntry 入口')
    const seen = new Set()
    const walk = (key) => {
      if (!key || seen.has(key)) return
      seen.add(key)
      const item = manifest[key]
      if (!item) return
      for (const imp of item.imports ?? []) walk(imp)
    }
    walk(entry[0])
    for (const key of seen) {
      const item = manifest[key]
      if (!item?.file?.endsWith('.js')) continue
      const path = join(ROOT, 'dist', item.file)
      const raw = statSync(path).size
      const gzip = gzipSync(readFileSync(path), { level: 9 }).length
      initialRaw += raw
      initialGzip += gzip
      initialChunks += 1
      initialFiles.push({ name: item.file.split('/').pop(), raw, gzip })
    }
    initialFiles.sort((a, b) => b.gzip - a.gzip)
    console.log(
      `\n[bundle] 首屏静态 JS（entry + imports，共 ${initialChunks} 个 chunk）：` +
        `raw ${fmtKb(initialRaw)} / gzip ${fmtKb(initialGzip)}` +
        `（预算 ${MAX_INITIAL_GZIP_KB} KB，已用 ${((initialGzip / (MAX_INITIAL_GZIP_KB * KB)) * 100).toFixed(1)}%）`,
    )
    for (const f of initialFiles.slice(0, 5)) {
      console.log(`  ${f.name.padEnd(nameWidth)}  ${fmtKb(f.raw).padStart(rawWidth)}  ${fmtKb(f.gzip).padStart(8)}`)
    }
  } catch (error) {
    console.error(
      `\n[bundle] 无法计算首屏体积：${error instanceof Error ? error.message : String(error)}\n` +
        '请确认 vite.config.ts 已开启 build.manifest，并重新构建。',
    )
    process.exit(1)
  }

  const failures = []
  if (totalGzip > MAX_TOTAL_GZIP_KB * KB) {
    failures.push(
      `总 JS gzip ${fmtKb(totalGzip)} 超过预算 ${fmtKb(MAX_TOTAL_GZIP_KB * KB)}` +
        `（超出 ${fmtKb(totalGzip - MAX_TOTAL_GZIP_KB * KB)}）`,
    )
  }
  if (initialGzip > MAX_INITIAL_GZIP_KB * KB) {
    failures.push(
      `首屏静态 JS gzip ${fmtKb(initialGzip)} 超过预算 ${fmtKb(MAX_INITIAL_GZIP_KB * KB)}` +
        `（超出 ${fmtKb(initialGzip - MAX_INITIAL_GZIP_KB * KB)}）—— 检查是否又把重页面/大依赖静态 import 了`,
    )
  }
  for (const f of files) {
    if (f.raw > MAX_FILE_RAW_MB * MB) {
      failures.push(
        `单文件 ${f.name} raw ${fmtKb(f.raw)} 超过预算 ${MAX_FILE_RAW_MB.toFixed(1)} MB` +
          `（超出 ${fmtKb(f.raw - MAX_FILE_RAW_MB * MB)}）`,
      )
    }
  }

  if (failures.length > 0) {
    console.error('\n[bundle] FAIL：体积超出预算（阈值只降不升）')
    for (const f of failures) console.error(`  ✗ ${f}`)
    process.exit(1)
  }

  console.log('\n[bundle] PASS：产物体积在预算内（阈值只降不升）')
  process.exit(0)
}

main()
