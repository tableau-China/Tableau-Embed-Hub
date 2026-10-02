/**
 * AI 配置（环境变量 → 运行时配置）。
 *
 * ⚠️ 与 Tableau 那套同理：这些值在**构建时**内联进 bundle，所以
 * **只放"可以公开"的东西**（代理地址、模型名、系统提示词）。
 * 厂商 API Key **绝不能**出现在这里 —— 它必须留在服务端，见 docs/ai-integration.md。
 *
 * 留空 `VITE_AI_PROXY_URL` 时应用进入**演示模式**（内置演示 provider，不发任何外部请求），
 * 保证 clone 之后 AI 页也是"活的"，而不是一片空白。
 */
import { configured, envOptional, envValue } from '@/lib/env'

/** 默认系统提示词：说明这个模板的定位，便于使用者一眼改成自己的 */
const DEFAULT_SYSTEM_PROMPT =
  'You are the built-in assistant of the shadcn-admin-cn template. ' +
  'Answer concisely and concretely. When the user asks about this project, ' +
  'refer to the docs under docs/ (tableau-setup.md, route-permissions.md, ai-integration.md).'

/**
 * ⚠️ 逐项静态书写：Vite 只内联静态引用的键（见 src/lib/env.ts 的说明）。
 */
const raw = {
  proxyUrl: import.meta.env.VITE_AI_PROXY_URL,
  model: import.meta.env.VITE_AI_MODEL,
  systemPrompt: import.meta.env.VITE_AI_SYSTEM_PROMPT,
}

export const AI_CONFIG = {
  /**
   * 同源代理地址（如 `/ai-proxy`）。**留空 = 演示模式**。
   * 前端只认这个地址，不知道也不需要知道上游是哪家模型。
   */
  proxyUrl: envOptional(raw.proxyUrl) ?? '',
  /** 模型名（透传给上游，DeepSeek 默认 `deepseek-chat`） */
  model: envValue(raw.model, 'deepseek-chat'),
  /** 系统提示词（每次请求首条 system 消息） */
  systemPrompt: envValue(raw.systemPrompt, DEFAULT_SYSTEM_PROMPT),
} as const

/** 是否处于演示模式（未配置代理地址）—— UI 与 /help 环境自检共用 */
export const AI_USING_DEMO_PROVIDER = !configured(raw.proxyUrl)
