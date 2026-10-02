/**
 * AI 能力抽象层 —— **接口**（Provider 无关）。
 *
 * 设计原则（为什么长这样）：
 * 1. **Key 绝不下前端**：浏览器只 POST 到**同源代理**（默认 `/ai-proxy`），由服务端持有厂商 Key。
 *    纯前端无论如何都藏不住 Key（构建时内联进 bundle，与 Tableau 凭据同一个道理），
 *    所以这里把"怎么拿到模型"整个收敛到 `AiProvider.chat()`，前端只认代理地址。
 * 2. **流式优先**：`onDelta` 逐段回调，UI 才能做到"边生成边显示"；实现方必须支持 `signal` 取消。
 * 3. **可替换**：任何 OpenAI 兼容端点（DeepSeek / OpenAI / 自建网关）都只需实现本接口，
 *    页面与状态管理一行不用改。
 */

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ChatUsage {
  promptTokens?: number
  completionTokens?: number
}

export interface ChatResult {
  /** 完整回复文本（流式时与累积的 delta 一致） */
  content: string
  /** 实际使用的模型名 */
  model: string
  usage?: ChatUsage
}

export interface ChatOptions {
  messages: readonly ChatMessage[]
  /** 取消信号：组件卸载 / 用户点「Stop」时必须能中断请求 */
  signal?: AbortSignal
  /** 每收到一段增量就回调（非流式实现只回调一次） */
  onDelta?: (delta: string) => void
}

/** 可替换的对话能力提供方 */
export interface AiProvider {
  /** 稳定标识：`demo` = 内置演示（不发外部请求），`proxy` = 走同源代理的真实模型 */
  readonly id: 'demo' | 'proxy'
  /** 是否演示实现（UI 据此显示徽章与接入提示） */
  readonly isDemo: boolean
  /** 展示用模型名（演示实现为 `demo`） */
  readonly model: string
  /** 执行一次对话；失败一律抛 `AiError` */
  chat(options: ChatOptions): Promise<ChatResult>
}

/** 错误分类：UI 据此决定"重试有用吗"以及提示文案 */
export type AiErrorKind =
  /** 配置缺失（如没配代理地址） */
  | 'config'
  /** HTTP 状态异常（4xx/5xx）—— 401/403 重试无用，429/5xx 可重试 */
  | 'http'
  /** 网络层失败（断网、DNS、CORS） */
  | 'network'
  /** 用户/组件主动取消 */
  | 'aborted'
  /** 响应格式无法解析（代理不是 OpenAI 兼容协议？） */
  | 'parse'

export class AiError extends Error {
  readonly kind: AiErrorKind
  readonly status?: number

  constructor(message: string, kind: AiErrorKind, status?: number) {
    super(message)
    this.name = 'AiError'
    this.kind = kind
    this.status = status
  }

  /** 这类失败重试有意义吗（鉴权/配置类问题重试只会重复失败） */
  get retryable(): boolean {
    if (this.kind === 'network' || this.kind === 'parse') return true
    if (this.kind === 'http') return this.status === 429 || (this.status ?? 0) >= 500
    return false
  }
}
