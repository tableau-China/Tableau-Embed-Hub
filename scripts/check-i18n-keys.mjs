#!/usr/bin/env node
/**
 * check-i18n-keys.mjs —— **反向**校验：代码里在用的 key，词典里是否真的存在。
 *
 * 为什么需要它：`scripts/check-i18n.mjs`（`pnpm check:i18n`）只比对**各语言之间**的 key 是否对齐，
 * 它发现不了「代码用了 `t('teams.slugLabel')`，但词典里根本没有这个 key」——
 * 这种漏键在界面上表现为**直接把 key 名渲染出来**（`teams.slugLabel`），
 * 而因为只有一种语言、两侧一致，CI 全绿也照样漏。
 *
 * 覆盖范围（字面量 key）：
 *   - `t('a.b')` / `t("a.b")`
 *   - 复数键：代码写 `t('x.y')`，词典里是 `x.y_one` / `x.y_other`，视为存在
 * 不覆盖（会误报，故刻意跳过）：
 *   - 模板拼接的动态 key（如 t(`users.${status}`)）—— 这类 key 请改用常量映射表
 *     （参考 `USER_STATUS_LABEL_KEYS` / `TEAM_ROLE_LABEL_KEYS`），既好检索也不会漏
 *
 * 用法：
 *   node scripts/check-i18n-keys.mjs            # 只报缺失，缺失则退出码 1
 *   node scripts/check-i18n-keys.mjs --unused   # 额外列出「词典里有、代码没用到」的 key（仅提示）
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const localesDir = join(root, 'src', 'i18n', 'locales')
const srcDir = join(root, 'src')
const showUnused = process.argv.includes('--unused')

/** 拍平词典：{ 'teams.slugLabel': 'URL slug', ... } */
function flatten(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(acc, flatten(v, key))
    else acc[key] = v
    return acc
  }, {})
}

/** 递归收集源码文件 */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'i18n' || entry === 'node_modules') continue
      walk(full, out)
    } else if (['.ts', '.tsx'].includes(extname(entry))) {
      out.push(full)
    }
  }
  return out
}

let locales = []
try {
  locales = readdirSync(localesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
} catch {
  console.log('[i18n-keys] SKIP：暂无语言目录')
  process.exit(0)
}

if (locales.length === 0) {
  console.log('[i18n-keys] SKIP：暂无语言目录')
  process.exit(0)
}

let failed = false
for (const locale of locales) {
  const dictPath = join(localesDir, locale, 'common.json')
  const flat = new Set(Object.keys(flatten(JSON.parse(readFileSync(dictPath, 'utf8')))))

  /** key -> 出现它的文件（去重后最多展示 2 个） */
  const used = new Map()
  for (const file of walk(srcDir)) {
    const code = readFileSync(file, 'utf8')
    for (const m of code.matchAll(/\bt\(\s*(['"])([A-Za-z0-9_.]+)\1/g)) {
      const key = m[2]
      if (!used.has(key)) used.set(key, new Set())
      used.get(key).add(file.replace(root + '/', ''))
    }
  }

  const exists = (key) =>
    flat.has(key) || flat.has(`${key}_one`) || flat.has(`${key}_other`)

  const missing = [...used.entries()]
    .filter(([key]) => !exists(key))
    .map(([key, files]) => ({ key, files: [...files].slice(0, 2) }))
    .sort((a, b) => a.key.localeCompare(b.key))

  if (missing.length > 0) {
    failed = true
    console.error(`[i18n-keys] ${locale}：代码在用、词典缺失 ${missing.length} 个 key`)
    for (const { key, files } of missing) {
      console.error(`   缺少 ${key}    <- ${files.join(', ')}`)
    }
  } else {
    console.log(`[i18n-keys] ${locale}：${used.size} 个字面量 key 全部存在于词典 ✅`)
  }

  if (showUnused) {
    const unused = [...flat].filter((key) => {
      const base = key.replace(/_(one|other)$/, '')
      return !used.has(key) && !used.has(base)
    })
    if (unused.length > 0) {
      console.log(`[i18n-keys] ${locale}：词典中未被引用的 key ${unused.length} 个（仅提示，可能是动态 key）`)
      for (const key of unused.sort()) console.log(`   ${key}`)
    }
  }
}

if (failed) {
  console.error('[i18n-keys] FAILED：补上缺失的 key，或改用常量映射表避免动态拼接')
  process.exit(1)
}
console.log('[i18n-keys] OK')
