/**
 * 环境变量的**后处理**工具（`src/lib/env.ts`）。
 *
 * ⚠️ 这里刻意**不提供**「按名字读环境变量」的函数：Vite 只在**静态引用**时内联
 * `import.meta.env.VITE_X`，写成 `import.meta.env[key]` 在构建产物里拿不到值
 * （实测：产物中连键名都不存在）。因此各处仍然是逐项静态书写，本文件只负责
 * 「空串算未配置」和「取缺省值」这两件重复的事。
 */

/** 是否算「已配置」：非空字符串且去除首尾空白后仍有内容 */
export function configured(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

/** 取环境变量值；未配置时返回缺省值（返回值一律已 trim） */
export function envValue(value: string | undefined, fallback: string): string {
  return configured(value) ? value!.trim() : fallback
}

/** 取可选环境变量：未配置时返回 undefined（用于「留空 = 不启用」的开关型配置） */
export function envOptional(value: string | undefined): string | undefined {
  return configured(value) ? value!.trim() : undefined
}
