import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * 单元测试配置（`pnpm test`）。
 *
 * 为什么单独一份而不是复用 vite.config.ts：那份挂了 `tanstackRouter()` 插件（会生成路由树、
 * 面向浏览器打包），跑纯函数用例既慢又引入无关依赖。这里只保留 `@` 别名与测试范围。
 *
 * 分工：**纯函数/目录不变量**放这里（毫秒级、无需浏览器）；
 * **页面行为**继续由 `scripts/check-*.mjs` 用真实 Chrome 驱动（那才是它该管的层）。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 输出精简，失败时仍会打印用例名与断言差异
    reporters: 'dot',
  },
})
