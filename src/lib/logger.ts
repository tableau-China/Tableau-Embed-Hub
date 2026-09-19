/**
 * 统一诊断日志出口。
 *
 * 为什么存在：
 * - 全局 ESLint 规则 `no-console: error` 禁止业务代码直接调用 console（保持模板干净、
 *   避免生产环境控制台噪声）；
 * - 但错误路径（Tableau 令牌刷新、图片导出、内置凭据提示）确实需要开发期诊断信息，
 *   直接在业务代码里写 console 会违反规则。
 *
 * 约定：
 * - 业务代码一律 `import { logger } from '@/lib/logger'`，不要在别处调用 console；
 * - 仅开发构建输出（`import.meta.env.DEV`），生产构建静默，不污染用户控制台；
 * - 本文件是全仓库唯一允许出现 console 的位置（例外在 eslint.config.js 中声明，
 *   而不是散落的 inline eslint-disable）。
 */
const devOnly = import.meta.env.DEV

export const logger = {
  /** 开发期警告：配置缺失、降级行为等 */
  warn(...args: unknown[]): void {
    if (devOnly) console.warn(...args)
  },
  /** 开发期错误：异常/失败路径（用户可见的错误仍应由 UI 呈现，这里只补充诊断信息） */
  error(...args: unknown[]): void {
    if (devOnly) console.error(...args)
  },
}
