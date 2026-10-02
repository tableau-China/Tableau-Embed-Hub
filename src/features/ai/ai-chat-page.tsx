import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Bot, Eraser, Loader2, RotateCcw, SendHorizontal, Sparkles, Square } from 'lucide-react'

import { NoteCallout } from '@/components/note-callout'
import { PageContainer } from '@/components/page-container'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useAiChat } from '@/hooks/use-ai-chat'
import { cn } from '@/lib/utils'

/**
 * AI 对话页 `/ai`（跨团队页面，无 slug）。
 *
 * 这是「AI 应用起点」的样板页，刻意把四件事做全，让接手的人照着改就行：
 *  1. **provider 可换**：页面只认 `useAiChat()` 给出的 provider，换上游不用改这个文件
 *     （未配置代理时是内置演示实现，见 src/lib/ai/demo.ts）；
 *  2. **流式 + 可中断**：边生成边显示，`Stop` 立即中断且保留已生成内容；
 *  3. **失败可归因**：按错误类型区分"重试有用/无用"（`AiError.retryable`）；
 *  4. **零配置可演示**：演示模式下页面照常工作，并明确标注"这是演示" + 接入指引。
 *
 * 权限：本页是 `ROUTE_CATALOG` 里的 `page.ai`（默认授权给 member），
 * 因此侧边栏入口、URL 直达拦截、权限页勾选三处自动生效 —— 不需要在这里写任何守卫。
 */
export function AiChatPage() {
  const { t } = useTranslation()
  const { provider, entries, streaming, error, send, retry, stop, clear, canRetry } = useAiChat()
  const [draft, setDraft] = useState('')

  const submit = useCallback(() => {
    const text = draft
    if (text.trim() === '' || streaming) return
    setDraft('')
    send(text)
  }, [draft, send, streaming])

  const starters = ['explain', 'tableau', 'ai'] as const

  return (
    <PageContainer>
      <Card className="flex min-h-0 flex-col" data-ai-card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4" />
                {t('ai.title')}
              </CardTitle>
              <CardDescription>{t('ai.subtitle')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={provider.isDemo ? 'secondary' : 'default'}
                data-ai-provider={provider.id}
              >
                {provider.isDemo ? t('ai.demoBadge') : t('ai.proxyBadge')}
              </Badge>
              <span className="text-muted-foreground text-xs" data-ai-model>
                {provider.model}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-col gap-3">
          {/* 消息区：固定高度 + 内部滚动，避免生成过程中把整页撑长 */}
          <div
            className="flex h-[min(56vh,520px)] flex-col gap-3 overflow-y-auto rounded-lg border p-3"
            data-ai-messages
          >
            {entries.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <Bot className="text-muted-foreground size-8" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{t('ai.emptyTitle')}</p>
                  <p className="text-muted-foreground max-w-md text-xs">{t('ai.emptyBody')}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {starters.map((id) => (
                    <Button
                      key={id}
                      variant="outline"
                      size="sm"
                      data-ai-starter={id}
                      onClick={() => send(t(`ai.starter.${id}`))}
                    >
                      {t(`ai.starter.${id}`)}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  data-ai-entry={entry.role}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg px-3 py-2 text-sm',
                    entry.role === 'user'
                      ? 'bg-muted ml-auto max-w-[85%]'
                      : 'bg-background mr-auto max-w-[92%] border',
                  )}
                >
                  <span className="text-muted-foreground text-[11px] font-medium">
                    {entry.role === 'user' ? t('ai.you') : provider.model}
                  </span>
                  <p className="whitespace-pre-wrap">
                    {entry.content === '' && streaming ? (
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="size-3.5 animate-spin" />
                        {t('ai.thinking')}
                      </span>
                    ) : (
                      entry.content
                    )}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* 失败提示：按错误类型给出不同措辞，可重试的才显示 Retry */}
          {error && (
            <div
              className="text-destructive flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs"
              data-ai-error
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 break-words">
                {error.message}
                {error instanceof Error && 'retryable' in error && !(error as { retryable: boolean }).retryable
                  ? ` ${t('ai.errorNotRetryable')}`
                  : ''}
              </span>
            </div>
          )}

          {/* 输入区：Enter 发送 / Shift+Enter 换行 —— 与常见聊天工具一致 */}
          <div className="flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder={t('ai.placeholder')}
              rows={3}
              disabled={streaming}
              data-ai-input
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">{t('ai.inputHint')}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clear}
                  disabled={entries.length === 0}
                  data-ai-clear
                >
                  <Eraser className="size-4" />
                  {t('ai.clear')}
                </Button>
                {canRetry && !streaming && (
                  <Button variant="outline" size="sm" onClick={retry} data-ai-retry>
                    <RotateCcw className="size-4" />
                    {t('ai.retry')}
                  </Button>
                )}
                {streaming ? (
                  <Button variant="secondary" size="sm" onClick={stop} data-ai-stop>
                    <Square className="size-4" />
                    {t('ai.stop')}
                  </Button>
                ) : (
                  <Button size="sm" onClick={submit} disabled={draft.trim() === ''} data-ai-send>
                    <SendHorizontal className="size-4" />
                    {t('ai.send')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <NoteCallout
        tone={provider.isDemo ? 'info' : 'warning'}
        title={provider.isDemo ? t('ai.demoNoticeTitle') : t('ai.securityNoticeTitle')}
      >
        <p className="text-muted-foreground max-w-prose">
          {provider.isDemo ? t('ai.demoNotice') : t('ai.securityNotice')}
        </p>
      </NoteCallout>
    </PageContainer>
  )
}
