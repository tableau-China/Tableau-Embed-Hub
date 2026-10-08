import { describe, expect, it } from 'vitest'

import dict from '@/i18n/locales/en-US/common.json'
import { COMPONENT_CATALOG, COMPONENT_SECTION_META } from '@/config/component-catalog'

/**
 * 组件目录（/components 页的数据源）的不变量 —— 纯数据检查，毫秒级、不需要浏览器。
 *
 * 这个页面最容易腐烂的两处：
 *   1. 加了公共件忘了登记 → 页面越看越不准，最后没人信它；
 *   2. 登记了却漏 i18n key（descKey 是动态拼接的，check-i18n-keys 看不到）→ 界面上直接渲染 key 名。
 * 两者都在这里兜住：`pnpm test`（CI 第一段，与权限目录的纯函数用例同一批）就会跑。
 *
 * 注意：本文件由 **app 的 tsconfig** 一起类型检查（include: ["src"]，只有浏览器类型），
 * 所以刻意不碰 node:fs —— 用 Vite 的 import.meta.glob 与 JSON 导入拿"真实存在的模块"。
 */

/** '@/components/ui/card' 形式的模块键（真实存在的文件） */
const MODULE_KEYS = new Set(
  Object.keys(import.meta.glob(['../components/**/*.{ts,tsx}', '../hooks/*.ts'])).map(
    (key) => '@/' + key.replace(/^\.\.\//, '').replace(/\.(tsx|ts)$/, '').replace(/\/index$/, ''),
  ),
)

/** src/components/ui 下真实存在的原语名 */
const UI_PRIMITIVES = Object.keys(import.meta.glob('../components/ui/*.tsx')).map((key) =>
  key.replace(/^\.\.\/components\/ui\//, '').replace(/\.tsx$/, ''),
)

/** 不计入组件页的 ui 原语：它们是应用外壳的实现，规格在页面的 App shell 章节里讲 */
const SHELL_ONLY = new Set(['sidebar'])

/** 拍平词典 → 全部叶子 key */
function dictKeys(): Set<string> {
  const out = new Set<string>()
  const walk = (node: Record<string, unknown>, prefix: string) => {
    for (const [key, value] of Object.entries(node)) {
      const full = prefix === '' ? key : prefix + '.' + key
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, full)
      } else {
        out.add(full)
      }
    }
  }
  walk(dict as Record<string, unknown>, '')
  return out
}

describe('组件目录（/components 的数据源）', () => {
  it('id 唯一', () => {
    const ids = COMPONENT_CATALOG.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每个 descKey 都在词典里', () => {
    const keys = dictKeys()
    const missing = COMPONENT_CATALOG.filter((entry) => !keys.has(entry.descKey)).map(
      (entry) => entry.id + ' → ' + entry.descKey,
    )
    expect(missing).toEqual([])
  })

  it('章节都是已知章节，且每一章都有条目', () => {
    const known = new Set(COMPONENT_SECTION_META.map((meta) => meta.id))
    expect(COMPONENT_CATALOG.filter((entry) => !known.has(entry.section))).toEqual([])
    for (const meta of COMPONENT_SECTION_META) {
      expect(COMPONENT_CATALOG.some((entry) => entry.section === meta.id)).toBe(true)
    }
  })

  it('importPath 指向真实存在的模块', () => {
    const broken = COMPONENT_CATALOG.filter((entry) => !MODULE_KEYS.has(entry.importPath)).map(
      (entry) => entry.id + ' → ' + entry.importPath,
    )
    expect(broken).toEqual([])
  })

  it('src/components/ui 下的原语都已登记（外壳件除外）', () => {
    const covered = new Set(
      COMPONENT_CATALOG.map((entry) => entry.importPath)
        .filter((path) => path.startsWith('@/components/ui/'))
        .map((path) => path.slice('@/components/ui/'.length)),
    )
    const undocumented = UI_PRIMITIVES.filter(
      (name) => !covered.has(name) && !SHELL_ONLY.has(name),
    )
    expect(undocumented).toEqual([])
  })
})
