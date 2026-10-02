/**
 * 走**同源代理**的真实模型客户端（OpenAI 兼容协议，默认对接 DeepSeek）。
 *
 * ⚠️ 关键约束：本文件**只**POST 到 `AI_CONFIG.proxyUrl`（同源），请求里**不带任何 Key**。
 * 上游凭据由代理（你自己的服务端）持有。把 Key 放前端 = 把 Key 公开（构建即内联）。
 *
 * 协议（代理必须实现，见 docs/ai-integration.md）：
 *   POST {proxyUrl}/chat/completions
 *   body: { model, messages, stream: true }
 *   → text/event-stream，逐行 `data: {"choices":[{"delta":{"content":"…"}}]}`，以 `data: [DONE]` 结束
 */
import { AiError, type AiProvider, type ChatOptions, type ChatResult } from './types'

/** 去掉结尾斜杠，避免拼出 `//chat/completions` */
function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`
}

export function createProxyProvider(options: { proxyUrl: string; model: string }): AiProvider {
  const { proxyUrl, model } = options

  return {
    id: 'proxy',
    isDemo: false,
    model,

    async chat({ messages, signal, onDelta }: ChatOptions): Promise<ChatResult> {
      let res: Response
      try {
        res = await fetch(joinUrl(proxyUrl, '/chat/completions'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model, messages, stream: true }),
          signal,
        })
      } catch (err) {
        // fetch 只在网络层失败时 reject；用户取消会以 AbortError 形式出现，要分开报
        if (signal?.aborted) throw new AiError('已取消', 'aborted')
        throw new AiError(
          `无法连接 AI 代理（${proxyUrl}）：${err instanceof Error ? err.message : String(err)}`,
          'network',
        )
      }

      if (!res.ok) {
        // 读一小段错误体，便于把上游的报错（如模型名写错）透出来
        const detail = await res.text().catch(() => '')
        throw new AiError(
          `AI 代理返回 ${res.status}${detail ? `：${detail.slice(0, 200)}` : ''}`,
          'http',
          res.status,
        )
      }
      if (!res.body) throw new AiError('AI 代理响应没有可读流（代理是否关闭了缓冲？）', 'parse')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let content = ''

      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // SSE 以「空行」分隔事件；这里按行处理，最后一段可能不完整，留到下一轮
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed === '' || !trimmed.startsWith('data:')) continue
            const payload = trimmed.slice(5).trim()
            if (payload === '[DONE]') break
            try {
              const parsed = JSON.parse(payload) as {
                choices?: { delta?: { content?: unknown } }[]
              }
              const delta = parsed.choices?.[0]?.delta?.content
              if (typeof delta === 'string' && delta !== '') {
                content += delta
                onDelta?.(delta)
              }
            } catch {
              // 单行解析失败不致命（可能是心跳/注释行），跳过继续读
            }
          }
        }
      } catch (err) {
        if (signal?.aborted) throw new AiError('已取消', 'aborted')
        throw new AiError(
          `读取流式响应失败：${err instanceof Error ? err.message : String(err)}`,
          'network',
        )
      } finally {
        reader.releaseLock()
      }

      if (content === '') {
        throw new AiError(
          'AI 代理没有返回任何内容（检查代理是否按 OpenAI 兼容协议返回 SSE，且未开启响应缓冲）',
          'parse',
        )
      }
      return { content, model }
    },
  }
}
