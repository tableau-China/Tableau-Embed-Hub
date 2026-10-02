/**
 * 内置**演示 provider** —— 不发任何外部请求，纯本地流式输出。
 *
 * 为什么要有它：模板 clone 下来时通常还没有 AI 网关。默认给一片空白页会让人以为"坏了"，
 * 给一个假装的"AI 已就绪"又是在骗人。折中：**明确标注这是演示实现**，并把"怎么接真模型"
 * 直接写在回复里 —— 页面因此既是可点可看的 demo，又是一份现场说明书。
 *
 * 刻意保持**确定性**（同样的输入得到同样的输出、无随机数），这样检查脚本可以对它下断言。
 */
import { AiError, type AiProvider, type ChatOptions, type ChatResult } from './types'

/** 可中断的等待：用户点 Stop / 组件卸载时立刻结束，不留下悬挂的定时器 */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AiError('已取消', 'aborted'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(new AiError('已取消', 'aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** 把整段文本切成固定长度的小块，模拟真实模型的增量输出 */
function chunkify(text: string, size: number): string[] {
  const out: string[] = []
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
  return out
}

const DEMO_NOTICE = [
  '**Demo provider** — this reply was produced locally, no model was called.',
  '',
  'To plug in a real model:',
  '',
  "1. Put a same-origin proxy in front of your model. It must expose the OpenAI-compatible",
  '   `POST /chat/completions` with `stream: true` (DeepSeek, OpenAI and most gateways speak it).',
  '2. Set `VITE_AI_PROXY_URL=/ai-proxy` and `VITE_AI_MODEL=deepseek-chat` in `.env`, then rebuild.',
  '3. Keep the provider API key on the server. Anything shipped to the browser is public.',
  '',
  'Full contract, an nginx sample and a ~30-line Node gateway: `docs/ai-integration.md`.',
].join('\n')

function buildReply(question: string): string {
  const asked = question.trim()
  if (asked === '') return DEMO_NOTICE
  return [`You asked: **${asked}**`, '', DEMO_NOTICE].join('\n')
}

export function createDemoProvider(): AiProvider {
  return {
    id: 'demo',
    isDemo: true,
    model: 'demo',
    async chat({ messages, signal, onDelta }: ChatOptions): Promise<ChatResult> {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      const reply = buildReply(lastUser?.content ?? '')

      // 逐块推送：长度固定 + 间隔固定 → 输出确定，检查脚本可断言
      for (const chunk of chunkify(reply, 24)) {
        await wait(16, signal)
        onDelta?.(chunk)
      }
      return { content: reply, model: 'demo' }
    },
  }
}
