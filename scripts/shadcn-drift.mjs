#!/usr/bin/env node
/**
 * shadcn-drift.mjs — 只读巡检 src/components/ui/* 与上游 registry 的差异
 *
 * 过滤掉本项目**故意的本地约定**（不算待升级）：
 *   1. `import { cn } from "@/lib/utils"` ↔ 上游 `from "cn"`
 *   2. `"use client"` 指令（Vite SPA 不需要，上游模板带 Next.js 语义）
 *
 * 剩下的才算真正的功能性漂移，按文件列出 +/- 行。
 * 只读：不写任何文件。依赖 node_modules/.bin/shadcn（--diff 即 dry run）。
 *
 * 用法：node scripts/shadcn-drift.mjs [组件名...]
 */

import { readdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import process from 'node:process'

const exec = promisify(execFile)
const ROOT = path.resolve(import.meta.dirname, '..')
const UI_DIR = path.join(ROOT, 'src/components/ui')
const SHADCN = path.join(ROOT, 'node_modules/.bin/shadcn')

const IGNORE_LINE = /^\s*(?:import \{ cn \} from "(?:@\/lib\/utils|cn)"|"use client"|)$/

async function diffOne(name) {
  let out
  try {
    const res = await exec(SHADCN, ['add', name, '--diff', '--yes'], {
      cwd: ROOT,
      maxBuffer: 32 * 1024 * 1024,
      timeout: 120_000,
    })
    out = res.stdout
  } catch (err) {
    out = `${err.stdout ?? ''}${err.stderr ?? ''}`
  }
  if (!/\boverwrite\b/.test(out)) return { name, drift: [], raw: out }

  // 取 diff 正文行：以 │ 开头的面板内容
  const lines = out
    .split('\n')
    .filter((l) => /^\s*│/.test(l))
    .map((l) => l.replace(/^\s*│\s?/, ''))

  const meaningful = lines.filter((l) => {
    if (!/^[+-]/.test(l)) return false // 只关心 +/- 行
    if (/^(\+\+\+|---)/.test(l)) return false // 文件头
    const body = l.slice(1)
    if (IGNORE_LINE.test(body)) return false // 本地约定噪音
    return true
  })
  return { name, drift: meaningful, raw: out }
}

const names = process.argv.slice(2)
const list =
  names.length > 0
    ? names
    : (await readdir(UI_DIR)).filter((f) => f.endsWith('.tsx')).map((f) => f.replace(/\.tsx$/, ''))

let drifted = 0
for (const name of list) {
  const { drift } = await diffOne(name)
  if (drift.length === 0) continue
  drifted += 1
  console.log(`\n### ${name} — ${drift.length} 行实质差异`)
  for (const l of drift) console.log(`  ${l}`)
}
console.log(`\n共 ${list.length} 个组件，实质漂移 ${drifted} 个。`)
