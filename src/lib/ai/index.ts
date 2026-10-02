/**
 * AI 能力入口（`src/lib/ai`）—— 页面只从这里取 provider，不直接碰具体实现。
 *
 * 换上游/换协议时只改这里；页面、状态管理、检查脚本都不用动。
 */
import { AI_CONFIG, AI_USING_DEMO_PROVIDER } from './config'
import { createProxyProvider } from './deepseek'
import { createDemoProvider } from './demo'
import type { AiProvider } from './types'

export type {
  AiProvider,
  AiErrorKind,
  ChatMessage,
  ChatOptions,
  ChatResult,
  ChatRole,
  ChatUsage,
} from './types'
export { AiError } from './types'
export { AI_CONFIG, AI_USING_DEMO_PROVIDER } from './config'

/**
 * 解析当前应使用的 provider：
 *  - 未配 `VITE_AI_PROXY_URL` → 内置演示实现（零配置可跑，且明确标注是演示）；
 *  - 已配 → 走同源代理的真实模型（OpenAI 兼容协议）。
 */
export function resolveAiProvider(): AiProvider {
  if (AI_USING_DEMO_PROVIDER) return createDemoProvider()
  return createProxyProvider({ proxyUrl: AI_CONFIG.proxyUrl, model: AI_CONFIG.model })
}
