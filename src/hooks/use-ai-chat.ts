import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  AI_CONFIG,
  AiError,
  resolveAiProvider,
  type ChatMessage,
} from '@/lib/ai'

export interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
}

/**
 * AI 对话状态（页面直接用，不把逻辑写在 JSX 里）。
 *
 * 三件事刻意分开处理，因为它们的"重试语义"不同：
 *  - **流式增量**：`onDelta` 直接追加到那条 assistant 条目上（边生成边显示）；
 *  - **失败**：记 `error` 并**移除空的占位气泡**，避免界面上留一条空气泡；
 *  - **取消**：保留已经生成的部分（用户按 Stop 是想停下，不是想丢掉）。
 *
 * provider 只解析一次（`useMemo`）：它是构建期决定的常量，不需要随渲染变化。
 */
export function useAiChat() {
  const provider = useMemo(() => resolveAiProvider(), [])
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const seqRef = useRef(0)
  // 发送时要用"最新一条历史"，用 ref 镜像避免闭包拿到旧值
  const entriesRef = useRef<ChatEntry[]>([])

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  // 卸载时中断进行中的请求（否则流式请求会在组件消失后继续占用连接）
  useEffect(() => () => abortRef.current?.abort(), [])

  const nextId = useCallback(() => `m${++seqRef.current}`, [])

  /** 以给定历史跑一轮对话，并流式写入新的 assistant 条目 */
  const run = useCallback(
    async (history: readonly ChatEntry[]) => {
      const controller = new AbortController()
      abortRef.current = controller
      setError(null)
      setStreaming(true)

      const assistantId = nextId()
      setEntries([...history, { id: assistantId, role: 'assistant', content: '' }])

      const messages: ChatMessage[] = [
        { role: 'system', content: AI_CONFIG.systemPrompt },
        ...history.map((e) => ({ role: e.role, content: e.content }) as ChatMessage),
      ]

      try {
        const result = await provider.chat({
          messages,
          signal: controller.signal,
          onDelta: (delta) => {
            setEntries((prev) =>
              prev.map((e) => (e.id === assistantId ? { ...e, content: e.content + delta } : e)),
            )
          },
        })
        // 以返回值兜底：非流式实现（或代理没吐 delta）也能拿到完整内容
        setEntries((prev) =>
          prev.map((e) => (e.id === assistantId ? { ...e, content: result.content } : e)),
        )
      } catch (err) {
        const isAbort = err instanceof AiError && err.kind === 'aborted'
        if (isAbort) {
          // 取消：保留已生成的内容；整条都空就移除占位
          setEntries((prev) => prev.filter((e) => !(e.id === assistantId && e.content === '')))
        } else {
          setError(err instanceof Error ? err : new Error(String(err)))
          setEntries((prev) => prev.filter((e) => !(e.id === assistantId && e.content === '')))
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [nextId, provider],
  )

  /** 发送一条用户消息 */
  const send = useCallback(
    (text: string) => {
      const content = text.trim()
      if (content === '' || streaming) return
      const history = [...entriesRef.current, { id: nextId(), role: 'user' as const, content }]
      void run(history)
    },
    [nextId, run, streaming],
  )

  /** 重试：丢掉末尾的 assistant 回复，用同一段历史重跑（失败/不满意时用） */
  const retry = useCallback(() => {
    if (streaming) return
    const history = [...entriesRef.current]
    while (history.length > 0 && history[history.length - 1]!.role === 'assistant') history.pop()
    if (history.length === 0) return
    void run(history)
  }, [run, streaming])

  /** 停止生成（保留已有内容） */
  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  /** 清空会话 */
  const clear = useCallback(() => {
    abortRef.current?.abort()
    setEntries([])
    setError(null)
  }, [])

  return {
    provider,
    entries,
    streaming,
    error,
    send,
    retry,
    stop,
    clear,
    /** 是否还能重试（失败且有历史，或已有一轮对话） */
    canRetry: !streaming && entries.length > 0,
  }
}
