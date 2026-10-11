/**
 * alias-loader.mjs —— 让 `@/` 别名在**纯 node 脚本**里也能解析（副作用导入：`import` 即生效）
 *
 * 为什么需要它：`@/` 是 vite／tsconfig 的别名，vite 构建时解析、tsc 类型检查时解析，
 * 但 `node scripts/check-*.mjs` 直接 import `src/**` 时**没有别名解析** —— 只要被引模块里有一句
 * 运行时的 `import … from '@/lib/…'`，脚本就报 `ERR_MODULE_NOT_FOUND: Cannot find package '@/lib'`。
 * 这类失败只影响校验脚本（应用本身跑得好好的），所以最容易被忽略：v0.13.0 改名引入
 * `lib/storage-migration` 后，`check:filters` 就这样红了一版（见 CHANGELOG）。
 *
 * 用法（在被引模块**之前**先让本模块执行 —— 静态 import 会先于模块体求值，所以写在文件顶部即可）：
 *
 *     import '../lib/alias-loader.mjs'                        // ← 先注册
 *     const { USER_STATUSES } = await import('../src/stores/org-store.ts')   // ← 再动态导入
 *
 * 为什么要用动态导入：ESM 的静态 import 全部先于模块体求值，写在模块体里的 registerHooks 拦不住同一个
 * 文件顶部的静态 import；只有动态 `import()` 才发生在注册之后。
 *
 * 规则与 vite.config.ts 的 `resolve.alias` 一致：`@/x` → `src/x`，并按 node 的 ESM 规矩补全扩展名
 * （`x` → `x.ts` → `x.tsx` → `x/index.ts` → `x/index.tsx`；node ESM 不做扩展名推断）。
 */
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

/** `src/` 目录（本文件位于 scripts/lib/ 下） */
const SRC = new URL('../../src/', import.meta.url)

/** 候选路径：node ESM 不会自动补扩展名，这里按 vite 的解析习惯逐个试 */
const withExtensions = (href) => [href, `${href}.ts`, `${href}.tsx`, `${href}/index.ts`, `${href}/index.tsx`]

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('@/')) return nextResolve(specifier, context)

    const target = new URL(specifier.slice(2), SRC).href
    const hit = withExtensions(target).find((href) => existsSync(fileURLToPath(href)))
    if (!hit) {
      // 宁可立刻报错并给出全部候选，也不要让 node 抛它自己那句只提到 `@/lib` 的误导性报错
      throw new Error(`@/ 别名解析失败：${specifier}（已尝试 ${withExtensions(target).join('、')}）`)
    }
    return nextResolve(hit, context)
  },
})
