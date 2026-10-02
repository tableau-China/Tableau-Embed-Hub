import { describe, expect, it } from 'vitest'

import { configured, envOptional, envValue } from './env'

/**
 * 环境变量后处理（`src/lib/env.ts`）。
 *
 * 这些函数看着简单，但**「空串算不算配置」这个口径**决定了站点绑定与 AI 代理的默认行为：
 * `.env` 里写了 `VITE_AI_PROXY_URL=`（等于没填）必须落回演示模式，而不是变成空字符串代理地址。
 */
describe('configured', () => {
  it('未定义、空串、纯空白一律算未配置', () => {
    expect(configured(undefined)).toBe(false)
    expect(configured('')).toBe(false)
    expect(configured('   ')).toBe(false)
    expect(configured('\t\n')).toBe(false)
  })

  it('有内容（哪怕带空白）算已配置', () => {
    expect(configured('x')).toBe(true)
    expect(configured('  x  ')).toBe(true)
  })
})

describe('envValue', () => {
  it('已配置时返回 trim 后的值', () => {
    expect(envValue('  https://a.example.com  ', 'fallback')).toBe('https://a.example.com')
  })

  it('未配置时返回缺省值', () => {
    expect(envValue(undefined, 'fallback')).toBe('fallback')
    expect(envValue('', 'fallback')).toBe('fallback')
    expect(envValue('   ', 'fallback')).toBe('fallback')
  })
})

describe('envOptional', () => {
  it('未配置时返回 undefined（用于「留空 = 不启用」的开关型配置）', () => {
    expect(envOptional('')).toBeUndefined()
    expect(envOptional('  ')).toBeUndefined()
    expect(envOptional(undefined)).toBeUndefined()
  })

  it('已配置时返回值本身', () => {
    expect(envOptional(' /ai-proxy ')).toBe('/ai-proxy')
  })
})
