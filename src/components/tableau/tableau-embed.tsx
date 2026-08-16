import { useEffect, useRef, useState } from 'react'
import { TableauViz } from '@tableau/embedding-api'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'

import { TABLEAU_CONFIG } from '@/config/tableau'
import { cn } from '@/lib/utils'
import { createTableauJwt } from '@/lib/tableau-jwt'

type EmbedStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Tableau 视图嵌入容器 —— 官方 Embedding API v3。
 *
 * v3 规范要点：
 * - <tableau-viz> web component（new TableauViz()）
 * - 认证：Connected App JWT 经 token 属性传入（v3 官方认证方式）
 * - src + token 同时就位后才创建组件（避免认证竞态）
 * - token 每 4 分钟刷新（JWT 有效期 5 分钟）：仅热更新属性，不重建 viz（避免闪烁）
 * - v3 事件：tableauvizload / firstinteractive / vizloaderror
 */
export function TableauEmbed({ src, className }: { src?: string; className?: string }) {
  const { t } = useTranslation()
  const embedRef = useRef<HTMLDivElement>(null)
  const vizRef = useRef<TableauViz | null>(null)
  const tokenRef = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [status, setStatus] = useState<EmbedStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // 令牌生成 + 定时刷新
  useEffect(() => {
    let alive = true
    const refresh = async () => {
      try {
        const tkn = await createTableauJwt(['tableau:views:embed', 'tableau:content:read'])
        if (alive) setToken(tkn)
      } catch (err) {
        console.error('[Tableau] token refresh failed:', err)
      }
    }
    void refresh()
    const id = window.setInterval(refresh, TABLEAU_CONFIG.refreshIntervalSeconds * 1000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  // token 变化：记录到 ref；若 viz 已存在则仅热更新属性，不重建（避免闪烁）
  useEffect(() => {
    tokenRef.current = token
    if (vizRef.current && token) {
      vizRef.current.setAttribute('token', token)
    }
  }, [token])

  const hasToken = token !== null

  // src/token 就绪：创建 v3 组件（hasToken 翻转只发生一次，token 刷新不会重建 viz）
  useEffect(() => {
    const host = embedRef.current
    if (!src || !hasToken || !host) {
      setStatus('idle')
      return
    }
    let cancelled = false
    setStatus('loading')
    setError(null)

    const viz = new TableauViz()
    viz.setAttribute('src', src)
    if (tokenRef.current) viz.setAttribute('token', tokenRef.current)
    viz.setAttribute('toolbar', 'hidden')
    viz.setAttribute('hide-tabs', 'true')
    // 与 pg-explorer 一致：width/height 属性必须显式设置，否则 v3 组件尺寸塌缩
    viz.setAttribute('width', '100%')
    viz.setAttribute('height', '100%')
    Object.assign(viz.style, { width: '100%', height: '100%', display: 'block' })

    viz.addEventListener('tableauvizload', () => {
      if (!cancelled) {
        setStatus('ready')
        setError(null)
      }
    })
    viz.addEventListener('firstinteractive', () => {
      if (!cancelled) {
        setStatus('ready')
        setError(null)
      }
    })
    viz.addEventListener('vizloaderror', ((event: Event) => {
      if (cancelled) return
      const detail = (event as CustomEvent<{ message?: string }>).detail
      setStatus('error')
      setError(detail?.message ?? t('views.embedError'))
    }) as EventListener)

    host.appendChild(viz)
    vizRef.current = viz

    return () => {
      cancelled = true
      viz.remove()
      vizRef.current = null
    }
    // token 刷新不重建（hasToken 稳定），token 值经上方独立 effect 热更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, hasToken])

  return (
    <div
      className={cn(
        'relative h-[70vh] w-full overflow-hidden rounded-lg border bg-muted/10',
        className,
      )}
    >
      {!src && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          {t('views.embedEmpty')}
        </div>
      )}
      {/* 加载中不再叠加自定义遮罩层：iframe 内 Tableau 自带加载指示，
          叠加层会造成"双层 loading"（遮罩 + 原生 spinner 同时可见） */}
      {status === 'error' && (
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span className="min-w-0 truncate">{error}</span>
        </div>
      )}
      <div ref={embedRef} className="h-full w-full" />
    </div>
  )
}
