import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const localesDir = join(root, 'src', 'i18n', 'locales')

let locales = []
try {
  locales = readdirSync(localesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
} catch {
  // locales 目录尚未创建（当前仅 en-US，应用代码阶段建立）
}

if (locales.length === 0) {
  console.log('[i18n] SKIP：暂无语言目录（当前仅 en-US，应用代码阶段创建）')
  process.exit(0)
}

function flatten(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? prefix + '.' + k : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return { ...acc, ...flatten(v, key) }
    }
    acc[key] = v
    return acc
  }, {})
}

const sets = {}
for (const l of locales) {
  const file = join(localesDir, l, 'common.json')
  const data = JSON.parse(readFileSync(file, 'utf8'))
  sets[l] = new Set(Object.keys(flatten(data)))
}

const base = locales[0]
let failed = false
for (const l of locales.slice(1)) {
  const missing = [...sets[base]].filter((k) => !sets[l].has(k))
  const extra = [...sets[l]].filter((k) => !sets[base].has(k))
  if (missing.length || extra.length) {
    failed = true
    console.error('[i18n] ' + l + ' 与基准语言 ' + base + ' 不一致：')
    if (missing.length) console.error('  缺少 key: ' + missing.join(', '))
    if (extra.length) console.error('  多余 key: ' + extra.join(', '))
  }
}

if (failed) {
  console.error('[i18n] FAILED：请补齐或删除不一致的 key')
  process.exit(1)
}
console.log('[i18n] OK：' + locales.length + ' 个语言文件 key 完全对齐（' + sets[base].size + ' 个 key）')

