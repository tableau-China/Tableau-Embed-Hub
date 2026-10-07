#!/usr/bin/env node
/**
 * check-versions.mjs — 依赖版本巡检（只读，不写任何文件）
 *
 * 作用：把 package.json 里的全部依赖，跟 npm registry 上的 latest 逐个比对，
 *      并判断「升到 latest 是否还在 package.json 声明的 semver 范围内」，
 *      以此区分「pnpm update 即可」和「要改 package.json、可能破坏兼容」两类升级。
 *
 * 用法：
 *   node scripts/check-versions.mjs              # 终端可读报告
 *   node scripts/check-versions.mjs --md         # Markdown 表格（贴文档/周报）
 *   node scripts/check-versions.mjs --json       # 机器可读，供 agent 汇总
 *   node scripts/check-versions.mjs --strict     # 有跨范围升级时退出码 1
 *   node scripts/check-versions.mjs --registry=https://registry.npmjs.org
 *   node scripts/check-versions.mjs --concurrency=16
 *
 * 退出码：0 正常；1 = --strict 且存在待升级项；2 = 脚本自身出错。
 * 依赖：仅 Node 内置能力（fetch / fs），不引入任何第三方包。
 *
 * 已知暂缓的包写在 package.json 的 checkVersions.hold 里（包名 → 理由），
 * 这类包不再出现在「待升级」清单里，改为单独列出，避免每周重复误报。
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TIMEOUT_MS = 25_000
const RETRIES = 2

/* ------------------------------------------------------------------ *
 * CLI 参数
 * ------------------------------------------------------------------ */

const flags = new Map()
for (const raw of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(raw)
  if (m) flags.set(m[1], m[2] ?? true)
}
const asJson = flags.has('json')
const asMarkdown = flags.has('md')
const strict = flags.has('strict')
const concurrency = Math.max(1, Math.min(32, Number(flags.get('concurrency')) || 10))

/* ------------------------------------------------------------------ *
 * semver：最小实现，够用即可，不引第三方
 * ------------------------------------------------------------------ */

function parseVersion(input) {
  if (typeof input !== 'string') return null
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(input.trim())
  if (!m) return null
  return {
    major: +m[1],
    minor: +m[2],
    patch: +m[3],
    pre: m[4] ? m[4].split('.') : null,
  }
}

function parsePartial(input) {
  const m = /^(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    String(input).trim(),
  )
  if (!m) return null
  const num = (t) => (t === undefined || t === 'x' || t === 'X' || t === '*' ? null : +t)
  return {
    major: num(m[1]),
    minor: num(m[2]),
    patch: num(m[3]),
    pre: m[4] ? m[4].split('.') : null,
  }
}

function comparePre(a, b) {
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i]
    const y = b[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const nx = /^\d+$/.test(x)
    const ny = /^\d+$/.test(y)
    if (nx && ny) {
      if (+x !== +y) return +x < +y ? -1 : 1
      continue
    }
    if (nx) return -1
    if (ny) return 1
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

/** a < b → -1，a === b → 0，a > b → 1；无法比较 → null */
function compare(a, b) {
  if (!a || !b) return null
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1
  }
  const ap = a.pre
  const bp = b.pre
  if (!ap && !bp) return 0
  if (!ap) return 1
  if (!bp) return -1
  return comparePre(ap, bp)
}

function singleComparator(part) {
  const m = /^(\^|~|>=|<=|>|<|=)?\s*(.+)$/.exec(part)
  if (!m) return null
  const op = m[1] ?? ''
  const p = parsePartial(m[2])
  if (!p) return null
  if (p.major === null) return [] // '*'
  const lo = { major: p.major, minor: p.minor ?? 0, patch: p.patch ?? 0, pre: p.pre }
  const wildcardMinor = p.minor === null
  const wildcardPatch = p.patch === null
  const upper = (major, minor) => ({ major, minor, patch: 0, pre: null })

  if (op === '^') {
    let hi
    if (p.major > 0) hi = upper(p.major + 1, 0)
    else if ((p.minor ?? 0) > 0) hi = upper(0, p.minor + 1)
    else hi = { major: 0, minor: 0, patch: (p.patch ?? 0) + 1, pre: null }
    return [
      { op: '>=', v: lo },
      { op: '<', v: hi },
    ]
  }
  if (op === '~') {
    const hi = wildcardMinor ? upper(p.major + 1, 0) : upper(p.major, p.minor + 1)
    return [
      { op: '>=', v: lo },
      { op: '<', v: hi },
    ]
  }
  if (op === '' || op === '=') {
    if (!wildcardMinor && !wildcardPatch) {
      // 预发布版本按 >= 处理，避免把「固定到 nightly」误判成过期
      return p.pre ? [{ op: '>=', v: lo }] : [{ op: '=', v: lo }]
    }
    if (wildcardMinor) {
      return [
        { op: '>=', v: lo },
        { op: '<', v: upper(p.major + 1, 0) },
      ]
    }
    return [
      { op: '>=', v: lo },
      { op: '<', v: upper(p.major, p.minor + 1) },
    ]
  }
  if (wildcardMinor || wildcardPatch) return [{ op: '>=', v: lo }]
  return [{ op, v: lo }]
}

function satisfiesSet(parts, v) {
  const comps = []
  for (const part of parts) {
    const cs = singleComparator(part)
    if (cs === null) return null
    comps.push(...cs)
  }
  for (const c of comps) {
    const d = compare(v, c.v)
    if (d === null) return null
    if (c.op === '>=' && d < 0) return false
    if (c.op === '>' && d <= 0) return false
    if (c.op === '<=' && d > 0) return false
    if (c.op === '<' && d >= 0) return false
    if (c.op === '=' && d !== 0) return false
  }
  return true
}

/** true / false / null（无法判定） */
function satisfiesRange(range, version) {
  const v = parseVersion(version)
  if (!v) return null
  const r = String(range ?? '').trim()
  if (!r || r === '*' || r === 'x' || r === 'latest') return true
  if (/^(file:|link:|portal:|workspace:|git\+|git:|https?:)/i.test(r)) return null
  const alias = /^npm:(?:@[^/@]+\/)?[^@/]+@(.+)$/.exec(r)
  if (alias) return satisfiesRange(alias[1], version)
  if (r.includes('||')) {
    const results = r.split('||').map((p) => satisfiesRange(p.trim(), version))
    if (results.includes(true)) return true
    return results.every((x) => x === false) ? false : null
  }
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(r)
  const parts = hyphen ? [`>=${hyphen[1]}`, `<=${hyphen[2]}`] : r.split(/\s+/).filter(Boolean)
  return satisfiesSet(parts, v)
}

function levelOf(from, to) {
  if (from.major !== to.major) return 'major'
  if (from.minor !== to.minor) return 'minor'
  if (from.patch !== to.patch) return 'patch'
  return 'prerelease'
}

/* ------------------------------------------------------------------ *
 * registry 与依赖解析
 * ------------------------------------------------------------------ */

async function readRegistryFromNpmrc(file) {
  try {
    const txt = await readFile(file, 'utf8')
    const m = /^\s*registry\s*=\s*(\S+)\s*$/m.exec(txt)
    return m ? m[1].replace(/\/+$/, '') : null
  } catch {
    return null
  }
}

async function resolveRegistry() {
  if (flags.get('registry')) return String(flags.get('registry')).replace(/\/+$/, '')
  if (process.env.npm_config_registry) return process.env.npm_config_registry.replace(/\/+$/, '')
  for (const f of [path.join(ROOT, '.npmrc'), path.join(os.homedir(), '.npmrc')]) {
    const found = await readRegistryFromNpmrc(f)
    if (found) return found
  }
  return 'https://registry.npmjs.org'
}

function aliasTarget(spec) {
  if (typeof spec !== 'string' || !spec.startsWith('npm:')) return null
  const rest = spec.slice(4)
  const at = rest.lastIndexOf('@')
  if (at <= 0) return { name: rest, range: '*' }
  return { name: rest.slice(0, at), range: rest.slice(at + 1) }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url, attempt = 0) {
  try {
    const res = await fetch(url, {
      headers: {
        accept: 'application/vnd.npm.install-v1+json, application/json',
        'user-agent': 'shadcn-admin-cn/check-versions',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 404) return { ok: false, error: '404 未找到该包' }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { ok: true, data: await res.json() }
  } catch (err) {
    if (attempt < RETRIES) {
      await sleep(700 * (attempt + 1))
      return fetchJson(url, attempt + 1)
    }
    return { ok: false, error: err?.name === 'TimeoutError' ? `超时 >${TIMEOUT_MS}ms` : String(err?.message ?? err) }
  }
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

async function installedVersion(name) {
  try {
    const txt = await readFile(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8')
    return JSON.parse(txt).version ?? null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

async function main() {
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  const registry = await resolveRegistry()

  const deps = []
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, spec] of Object.entries(pkg[section] ?? {})) {
      const alias = aliasTarget(spec)
      deps.push({ name, spec, section, fetchName: alias?.name ?? name, range: alias?.range ?? spec })
    }
  }

  process.stderr.write(
    `check-versions: ${deps.length} 个依赖，registry=${registry}，并发=${concurrency}\n`,
  )

  const results = await mapPool(deps, concurrency, async (dep) => {
    const [installed, meta] = await Promise.all([
      // 别名依赖（npm:xxx@y）在 node_modules 里是「别名」那一层的目录名，
      // 真正的包名只用于查 registry。
      installedVersion(dep.name),
      fetchJson(`${registry}/${dep.fetchName.startsWith('@') ? dep.fetchName.replace('/', '%2F') : dep.fetchName}/latest`),
    ])

    const row = {
      name: dep.name,
      section: dep.section,
      spec: dep.spec,
      fetchName: dep.fetchName,
      alias: dep.fetchName !== dep.name ? dep.fetchName : null,
      installed,
      latest: meta.ok ? (meta.data.version ?? null) : null,
      status: 'unknown',
      level: null,
      inRange: null,
      note: '',
    }
    if (!meta.ok) {
      row.note = `registry 查询失败：${meta.error}`
      return row
    }
    if (!installed) {
      row.status = 'unknown'
      row.note = 'node_modules 中未找到（未安装？）'
      return row
    }

    const vi = parseVersion(installed)
    const vl = parseVersion(row.latest ?? '')
    if (!vi || !vl) {
      row.status = 'unknown'
      row.note = `版本号无法解析：installed=${installed} latest=${row.latest}`
      return row
    }

    const cmp = compare(vi, vl)
    if (cmp >= 0) {
      row.status = 'current'
      if (cmp > 0) row.note = '本地版本高于 registry latest（预发布/固定版）'
      return row
    }

    row.status = 'outdated'
    row.level = levelOf(vi, vl)
    row.inRange = satisfiesRange(dep.range, row.latest)
    if (row.inRange === true) row.note = '在声明范围内，pnpm update 即可'
    else if (row.inRange === false) row.note = '超出声明范围，需改 package.json，注意破坏性变更'
    else row.note = '范围无法解析，请人工确认'
    return row
  })

  // package.json → checkVersions.hold 里登记的包：已知暂缓，不当作待升级重复报
  const holds = pkg.checkVersions?.hold ?? {}
  for (const row of results) {
    if (row.status === 'outdated' && holds[row.name]) {
      row.status = 'held'
      row.holdReason = holds[row.name]
      row.note = `已登记暂缓：${holds[row.name]}`
    }
  }

  const outdated = results.filter((r) => r.status === 'outdated')
  const held = results.filter((r) => r.status === 'held')
  const inRange = outdated.filter((r) => r.inRange === true)
  const outOfRange = outdated.filter((r) => r.inRange !== true)
  const summary = {
    total: results.length,
    outdated: outdated.length,
    held: held.length,
    inRange: inRange.length,
    outOfRange: outOfRange.length,
    current: results.filter((r) => r.status === 'current').length,
    unknown: results.filter((r) => r.status === 'unknown').length,
    byLevel: {
      major: outdated.filter((r) => r.level === 'major').length,
      minor: outdated.filter((r) => r.level === 'minor').length,
      patch: outdated.filter((r) => r.level === 'patch').length,
      prerelease: outdated.filter((r) => r.level === 'prerelease').length,
    },
  }

  const report = {
    generatedAt: new Date().toISOString(),
    project: pkg.name,
    projectVersion: pkg.version,
    registry,
    summary,
    outdated: outdated.sort(
      (a, b) => ['major', 'minor', 'patch', 'prerelease'].indexOf(a.level) - ['major', 'minor', 'patch', 'prerelease'].indexOf(b.level) || a.name.localeCompare(b.name),
    ),
    held,
    items: results.sort((a, b) => a.name.localeCompare(b.name)),
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else if (asMarkdown) {
    const row = (r) => `| ${r.name} | ${r.installed} | ${r.latest} | ${r.level ?? '-'} | ${r.spec} | ${r.note} |`
    const lines = [
      `### 依赖版本巡检 · ${pkg.name} v${pkg.version}`,
      '',
      `生成时间：${report.generatedAt}　registry：${registry}`,
      '',
      `共 ${summary.total} 个依赖：待升级 **${summary.outdated}**（major ${summary.byLevel.major} / minor ${summary.byLevel.minor} / patch ${summary.byLevel.patch}），` +
        `其中范围内 ${summary.inRange}、跨范围 ${summary.outOfRange}；已最新 ${summary.current}；无法判定 ${summary.unknown}。`,
      '',
      '| 包 | 当前 | latest | 跨度 | 声明 | 说明 |',
      '| --- | --- | --- | --- | --- | --- |',
      ...(outdated.length ? outdated.map(row) : ['| （无） | | | | | 全部为最新 |']),
    ]
    if (held.length) {
      lines.push('', '**已登记暂缓**（不算待升级）：', '')
      for (const r of held) lines.push(`- \`${r.name}\` ${r.installed} → ${r.latest}：${r.holdReason}`)
    }
    if (summary.unknown) {
      lines.push('', '**未能判定：**', '', ...results.filter((r) => r.status === 'unknown').map((r) => `- \`${r.name}\`：${r.note}`))
    }
    process.stdout.write(`${lines.join('\n')}\n`)
  } else {
    const displayWidth = (s) => [...String(s)].reduce((acc, c) => acc + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)
    const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - displayWidth(s)))
    const cols = [
      { key: 'name', label: '包' },
      { key: 'installed', label: '当前' },
      { key: 'latest', label: 'latest' },
      { key: 'level', label: '跨度' },
      { key: 'spec', label: '声明' },
    ]
    const rows = outdated.map((r) => ({ ...r, name: r.alias ? `${r.name} → ${r.alias}` : r.name }))
    const widths = cols.map((c) =>
      Math.max(displayWidth(c.label), ...rows.map((r) => displayWidth(String(r[c.key] ?? ''))), 0) + 2,
    )
    const header = cols.map((c, i) => pad(c.label, widths[i])).join('') + '说明'
    const lines = [
      `依赖版本巡检 · ${pkg.name} v${pkg.version}`,
      `registry: ${registry}`,
      '',
      header,
      '-'.repeat(displayWidth(header) + 30),
    ]
    if (!rows.length) lines.push('（无需升级，全部为最新）')
    for (const r of rows) {
      lines.push(cols.map((c, i) => pad(String(r[c.key] ?? ''), widths[i])).join('') + r.note)
    }
    if (held.length) {
      lines.push('', '已登记暂缓（不算待升级）：')
      for (const r of held) lines.push(`  - ${r.name}：${r.installed} → ${r.latest} — ${r.holdReason}`)
    }
    if (summary.unknown) {
      lines.push('', '未能判定：')
      for (const r of results.filter((x) => x.status === 'unknown')) lines.push(`  - ${r.name}：${r.note}`)
    }
    lines.push(
      '',
      `共 ${summary.total} 个依赖：待升级 ${summary.outdated}（major ${summary.byLevel.major} / minor ${summary.byLevel.minor} / patch ${summary.byLevel.patch}），` +
        `范围内 ${summary.inRange}、跨范围 ${summary.outOfRange}；暂缓 ${summary.held}；已最新 ${summary.current}；无法判定 ${summary.unknown}。`,
    )
    process.stdout.write(`${lines.join('\n')}\n`)
  }

  if (strict && outdated.some((r) => r.inRange !== true)) process.exit(1)
  process.exit(0)
}

main().catch((err) => {
  process.stderr.write(`check-versions 出错：${err?.stack ?? err}\n`)
  process.exit(2)
})
