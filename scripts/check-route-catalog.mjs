#!/usr/bin/env node
/**
 * check-route-catalog.mjs — 路由文件 ↔ 权限目录 一致性断言
 *   node scripts/check-route-catalog.mjs   （或 pnpm check:routes）
 *
 * 为什么需要：路由守卫是 **fail-open** 的 —— `ROUTE_CATALOG` 里没有登记的路径一律放行
 * （见 `src/components/route-guard.tsx:100` 与 `src/hooks/use-permissions.ts` 的
 * `allowed: entry ? can(entry.key) : true`）。于是"新建了页面文件、忘了在目录登记"会**静默**
 * 产生一个不受权限约束的页面：它不出现在侧边栏、也不出现在权限页，但 URL 直达可访问。
 * `docs/route-permissions.md` 承诺的"新增页面只登记一行即可进入体系"，反面就是这个缺口。
 *
 * 本脚本只读源码文本、不启动浏览器，因此可以放进 CI 常跑（与需要 Chrome 的 check:permissions 互补）。
 *
 * 退出码：0 一致；1 存在不一致。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ROUTE_CATALOG } from '../src/config/permissions.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ROUTES_DIR = join(ROOT, 'src', 'routes')

/**
 * 允许「有路由文件但不在权限目录」的路径白名单。
 *
 * 判定标准：**它不是一个有内容的页面** —— 要么只渲染 `<Outlet/>`（布局），
 * 要么 `beforeLoad` 里就 `throw redirect(...)`（重定向桩 / 分支首页），要么是 404 兜底。
 * 新增条目时必须先确认这一点，否则就是把一个页面排除在权限体系之外。
 */
const ALLOWED_WITHOUT_CATALOG = new Map([
  ['/$', '404 兜底页（未匹配任何路由）'],
  ['/', '重定向到当前团队首页'],
  ['/config', 'Config 分组布局（只渲染 Outlet）'],
  ['/config/', 'Config 分支首页：重定向到第一个有权访问的配置页'],
  ['/favorites', 'v0.5.0 旧路径重定向桩 → /t/{slug}/favorites'],
  ['/recents', 'v0.5.0 旧路径重定向桩 → /t/{slug}/recents'],
  ['/workbooks', 'v0.5.0 旧路径重定向桩 → /t/{slug}/workbooks'],
  ['/views', 'v0.5.0 旧路径重定向桩 → /t/{slug}/views'],
])

/** 去掉末尾斜杠（根路径除外）—— 目录里写 `/t/$teamSlug`，TanStack 的 index 路由写 `/t/$teamSlug/` */
function normalize(path) {
  if (path.length > 1 && path.endsWith('/')) return path.replace(/\/+$/, '')
  return path
}

/* ============================== 1. 扫描路由文件 ============================== */

const declared = []
for (const file of readdirSync(ROUTES_DIR).sort()) {
  if (!file.endsWith('.tsx')) continue
  const source = readFileSync(join(ROUTES_DIR, file), 'utf8')
  // __root.tsx 用的是 createRootRoute()，不参与目录比对
  const match = source.match(/createFileRoute\(\s*'([^']+)'\s*\)/)
  if (!match) continue
  declared.push({ path: normalize(match[1]), file: `src/routes/${file}` })
}

/* ============================== 2. 比对 ============================== */

const catalogPaths = new Set(ROUTE_CATALOG.map((e) => normalize(e.to)))
const declaredPaths = new Set(declared.map((d) => d.path))

const failures = []

// (a) 有路由文件但不在目录、也不在白名单 → fail-open 的权限盲区
for (const { path, file } of declared) {
  if (catalogPaths.has(path) || ALLOWED_WITHOUT_CATALOG.has(path)) continue
  failures.push(
    `${file} 声明了 ${path}，但 ROUTE_CATALOG 里没有登记 —— 该页面不受权限约束（fail-open）。` +
      `请在 src/config/permissions.ts 登记一行；若它确实不是页面（布局/重定向/404），加进本脚本的白名单并写明理由。`,
  )
}

// (b) 目录登记了不存在的路由 → 死条目（侧边栏会出现点不开的入口）
for (const entry of ROUTE_CATALOG) {
  const path = normalize(entry.to)
  if (declaredPaths.has(path)) continue
  failures.push(
    `ROUTE_CATALOG 的 ${entry.key}（to: ${entry.to}）在 src/routes/ 下找不到对应路由文件 —— 死条目。`,
  )
}

// (c) 白名单里的路径若已消失，提醒清理（避免白名单腐烂成"什么都放行"）。
//     注意：按**归一化**后的路径判断 —— `/config`（布局文件）与 `/config/`（分支首页文件）
//     归一化后相同，但两者确实是不同文件，这里只关心"至少还有一个文件存在"。
for (const [path, reason] of ALLOWED_WITHOUT_CATALOG) {
  if (!declaredPaths.has(normalize(path))) {
    failures.push(`白名单中的 ${path}（${reason}）已无对应路由文件 —— 请从本脚本白名单里删除。`)
  }
}

/* ============================== 3. 输出 ============================== */

console.log(`[routes] 扫描 ${declared.length} 个路由文件 / 目录 ${ROUTE_CATALOG.length} 条`)
console.log(
  `[routes] 白名单 ${ALLOWED_WITHOUT_CATALOG.size} 条（布局 / 重定向桩 / 404，均非内容页）`,
)

if (failures.length > 0) {
  console.error('\n[routes] FAILED：')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}

console.log('[routes] OK：每个路由文件都已登记（或属于白名单），目录里也没有死条目')
