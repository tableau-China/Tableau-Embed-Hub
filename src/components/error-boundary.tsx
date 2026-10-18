/**
 * 全局错误边界 + 路由错误兜底页（运维闭环里「不让用户看到白屏」这一环）。
 *
 * 两层防线：
 * 1. `AppErrorBoundary` —— class 组件，包在 `main.tsx` 的 `<RouterProvider>` 外层，
 *    捕获「路由系统之外」的渲染异常（Provider、RouterProvider 自身等）。
 * 2. `RouteErrorFallback` —— TanStack Router 的 `errorComponent` 形态：
 *    - 根路由（`routes/__root.tsx`）的 `errorComponent`：根布局异常；
 *    - `createRouter({ defaultErrorComponent })`（`main.tsx`）：所有未单独配置的子路由异常。
 *    TanStack 不会把 errorComponent 从父路由继承给子路由（每个路由各用自己的 CatchBoundary），
 *    所以两处都要接，否则页面级异常会落到框架内置的错误页（没有 errorId、不上报）。
 *
 * 两者都：
 * - 展示与 app 一致的兜底页（GuardCard + EmptyState，token 配色，暗色模式自动生效）；
 * - 提供「重试 / 重新加载 / 回首页 / 复制错误 ID」出口；
 * - 调用 `reportError` 上报，页面显著展示 errorId —— 用户只要报这一个值，
 *   运维就能在收集端点/日志里定位（字段形状见 `src/lib/error-reporting.ts`）。
 *
 * 为什么「回首页」用 `<a href="/">` 而不是 `<Link>`：错误后路由状态可能已损坏，
 * 整页跳转能保证回到干净状态；且 class 边界在没有 Router 上下文时也能渲染。
 */

import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, Copy, Home, RefreshCw, RotateCw } from 'lucide-react'

import { GuardCard } from '@/components/route-guard'
import { Button } from '@/components/ui/button'
import { APP_VERSION } from '@/config/app'
import { reportError } from '@/lib/error-reporting'

/** 复制文本：优先 Clipboard API（需安全上下文），回退旧式 execCommand（内网 http 部署仍可用） */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 继续走兜底
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '0'
    area.style.left = '0'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

/** 复制错误 ID 的小按钮（就地反馈，不依赖 Toaster——错误页要能在最差环境下工作） */
function CopyErrorIdButton({ errorId }: { errorId: string }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (status === 'idle') return
    const timer = window.setTimeout(() => setStatus('idle'), 2_000)
    return () => window.clearTimeout(timer)
  }, [status])

  const label =
    status === 'copied'
      ? t('errors.copied')
      : status === 'failed'
        ? t('errors.copyFailed')
        : t('errors.copyId')

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      className={status === 'failed' ? 'text-destructive' : undefined}
      onClick={() => {
        void copyText(errorId).then((ok) => setStatus(ok ? 'copied' : 'failed'))
      }}
    >
      {status === 'copied' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  )
}

/** 错误 ID 展示条：monospace、可整段选中；上报尚未完成时显示占位文案 */
function ErrorIdRow({ errorId }: { errorId: string | null }) {
  const { t } = useTranslation()

  if (!errorId) {
    return (
      <div className="bg-muted/40 text-muted-foreground flex w-full max-w-sm items-center justify-center rounded-md border px-3 py-2 font-mono text-xs">
        {t('errors.errorIdPending')}
      </div>
    )
  }

  return (
    <div
      className="bg-muted/40 flex w-full max-w-sm items-center gap-2 rounded-md border px-3 py-2"
      data-error-id={errorId}
    >
      <span className="text-muted-foreground shrink-0 text-xs">{t('errors.errorId')}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-xs font-medium select-all">
        {errorId}
      </code>
      <CopyErrorIdButton errorId={errorId} />
    </div>
  )
}

/** 错误页本体：异常边界与路由兜底共用，只有标题/说明与按钮组合不同 */
function ErrorPage({
  error,
  errorId,
  onRetry,
  onReload,
}: {
  error: unknown
  errorId: string | null
  /** 路由兜底：交给 TanStack Router 的 reset 重新渲染当前路由 */
  onRetry?: () => void
  /** 全局边界：整页重新加载 */
  onReload?: () => void
}) {
  const { t } = useTranslation()

  // 生产环境不把原始 message 抛给用户（可能含内部信息）；dev 方便排查才展示
  const detail = import.meta.env.DEV
    ? error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : null
    : null

  return (
    <GuardCard
      icon={<AlertTriangle className="size-6" />}
      title={onRetry ? t('errors.routeTitle') : t('errors.boundaryTitle')}
      description={onRetry ? t('errors.routeDescription') : t('errors.boundaryDescription')}
    >
      <ErrorIdRow errorId={errorId} />
      <div className="flex flex-wrap justify-center gap-2">
        {onRetry && (
          <Button type="button" onClick={onRetry}>
            <RotateCw className="size-4" />
            {t('errors.retry')}
          </Button>
        )}
        {onReload && (
          <Button type="button" onClick={onReload}>
            <RefreshCw className="size-4" />
            {t('errors.reload')}
          </Button>
        )}
        <Button type="button" variant="outline" asChild>
          {/* 错误后路由状态可能已坏，用整页跳转回首页（见文件头说明） */}
          <a href="/">
            <Home className="size-4" />
            {t('errors.backHome')}
          </a>
        </Button>
      </div>
      {detail && (
        <p className="text-muted-foreground w-full max-w-sm font-mono text-[11px] break-words">
          {detail}
        </p>
      )}
      <p className="text-muted-foreground w-full text-center text-[11px]">v{APP_VERSION}</p>
    </GuardCard>
  )
}

interface AppErrorBoundaryState {
  hasError: boolean
  error: unknown
  errorId: string | null
}

/**
 * 应用级错误边界：包住 `<RouterProvider>`（见 src/main.tsx）。
 *
 * 注意：ErrorBoundary **不能**捕获事件回调 / 异步里的异常（React 只捕获渲染路径），
 * 那类异常由 `installGlobalErrorReporting()` 装的 window 监听兜住。
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false, error: null, errorId: null }

  static getDerivedStateFromError(error: unknown): Partial<AppErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const errorId = reportError(error, {
      source: 'error-boundary',
      componentStack: info.componentStack ?? '',
    })
    this.setState({ errorId })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        className="bg-background text-foreground flex min-h-dvh flex-col p-4 md:p-8"
        role="alert"
        data-error-boundary
      >
        <ErrorPage
          error={this.state.error}
          errorId={this.state.errorId}
          onReload={this.handleReload}
        />
      </div>
    )
  }
}

/**
 * TanStack Router 的 `errorComponent`：根路由（及未单独配置的子路由）渲染异常时展示。
 *
 * `reset` 由路由器提供，点击「重试」会重新渲染当前路由；若错误是确定性的，
 * 会再次进入这里（错误页本身不会白屏）。
 */
export function RouteErrorFallback({ error, reset }: ErrorComponentProps) {
  const [errorId, setErrorId] = useState<string | null>(null)

  useEffect(() => {
    // StrictMode 下可能执行两次：reportError 内部按 fingerprint 去重，返回同一个 ID。
    // 上报是「外部系统同步」类副作用，必须等错误页真正提交后再做（不在 render 里发请求）。
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 上报结果（errorId）只能在上报后才能确定，且每次错误只触发一次渲染
    setErrorId(reportError(error, { source: 'route-error' }))
  }, [error])

  return (
    // 高度用 60vh 而不是 100dvh：本组件同时服务两种挂载位置——
    // 根路由 errorComponent（替换整个 app，独立成页）与 router defaultErrorComponent
    // （渲染在 <main> 内，侧边栏/顶栏还在）。60vh 在两种位置都是「可用的居中区域」。
    <div
      className="bg-background text-foreground flex min-h-[60vh] flex-col p-4 md:p-8"
      role="alert"
      data-route-error
    >
      <ErrorPage error={error} errorId={errorId} onRetry={reset} />
    </div>
  )
}
