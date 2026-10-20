import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import {
  Toaster as Sonner,
  toast as sonnerToast,
  type ExternalToast,
  type ToasterProps,
} from "sonner"
import {
  CheckIcon,
  CircleCheckIcon,
  CopyIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { copyText } from "@/lib/clipboard"
import { toastCopyText } from "@/lib/toast-copy"

/**
 * 可复制的 Toast（右下角消息）。
 *
 * 为什么要包一层 `toast`：Sonner 没有「全局 action」配置，复制按钮只能逐条挂在 toast 上。
 * 与其在几十个调用点各写一遍，不如统一从**本模块**导入 `toast` —— 它会在原 API 之上自动
 * 补一个复制图标，调用方写法和 `sonner` 完全一致。**新增页面请从这里导入，不要直接 import 'sonner'。**
 *
 * 行为约定：
 * - 常规 toast（默认 / success / info / warning / error / message）都在右侧多一个复制按钮；
 * - `loading` / `promise` / `custom` 透传（加载中的消息没有稳定内容可复制）；
 * - 标题是 ReactNode（拿不到纯文本）时不显示按钮，调用方可传 `copyText` 显式指定；
 * - 调用方自己传了 `action` 时不追加，避免出现两个按钮；
 * - 点击复制**不会**让 toast 消失（复制按钮是普通元素，不走 Sonner 的 action 自动关闭逻辑），
 *   图标在复制成功 / 失败后短暂切换，给用户就地反馈。
 */

/** 复制成功 / 失败的图标停留时长 */
const COPY_FEEDBACK_MS = 1600

/** 复制按钮的临时状态：idle → copied / failed → idle */
type CopyStatus = "idle" | "copied" | "failed"

/**
 * Toast 右侧的复制按钮。
 *
 * 注意它渲染成 `toast.action` 的 **React 元素**而不是 Sonner 的 `{ label, onClick }` Action：
 * 后者点击后会关闭 toast，而这里需要「复制完消息还在、图标变成对勾」。
 */
function ToastCopyButton({ text }: { text: string }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<CopyStatus>("idle")
  const resetTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    }
  }, [])

  const label =
    status === "copied"
      ? t("toast.copied")
      : status === "failed"
        ? t("toast.copyFailed")
        : t("toast.copy")

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="text-muted-foreground hover:text-foreground"
      aria-label={label}
      title={label}
      onClick={async (event) => {
        // 不让点击冒泡到 toast 的拖拽/关闭逻辑
        event.stopPropagation()
        const copied = await copyText(text)
        setStatus(copied ? "copied" : "failed")
        if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
        resetTimer.current = window.setTimeout(() => setStatus("idle"), COPY_FEEDBACK_MS)
      }}
    >
      {status === "copied" ? (
        <CheckIcon className="text-emerald-600 dark:text-emerald-400" />
      ) : status === "failed" ? (
        <XIcon className="text-destructive" />
      ) : (
        <CopyIcon />
      )}
    </Button>
  )
}

/** `toast` 的选项：在 Sonner 原有选项上增加复制文本的逃生口 */
export interface CopyableToastOptions extends ExternalToast {
  /**
   * 覆盖要复制的文本；传 `false` 关闭这条 toast 的复制按钮。
   * 标题是 ReactNode、但需要复制时用它指定纯文本。
   */
  copyText?: string | false
}

/** 与 `sonnerToast.success` 等方法的入参保持一致（标题可以是字符串 / ReactNode / 函数） */
type ToastMessage = Parameters<typeof sonnerToast.success>[0]

/**
 * 给一条 toast 补上复制按钮（或不补）。
 * @param message toast 标题
 * @param options 调用方选项（`copyText` 会被剥离，不传给 Sonner）
 */
function withCopy(message: ToastMessage, options?: CopyableToastOptions): ExternalToast | undefined {
  if (options === undefined) {
    const text = toastCopyText(message)
    return text === null ? undefined : { action: <ToastCopyButton text={text} /> }
  }

  const { copyText: explicitCopyText, ...rest } = options

  if (explicitCopyText === false) return rest
  // 调用方自定义 action 优先，避免出现两个按钮
  if (rest.action !== undefined && rest.action !== null) return rest

  const explicit =
    typeof explicitCopyText === "string" && explicitCopyText.trim() !== "" ? explicitCopyText : null
  const text = explicit ?? toastCopyText(message, rest.description)

  return text === null ? rest : { ...rest, action: <ToastCopyButton text={text} /> }
}

/** 复制感知的 toast 方法签名（比 Sonner 多一个 `copyText` 选项） */
type CopyableToastMethod = (message: ToastMessage, options?: CopyableToastOptions) => string | number

/**
 * 对外暴露的 `toast` 类型：在 Sonner 原 API 上把常规方法的第二参数换成 `CopyableToastOptions`。
 * 其余方法（`loading` / `promise` / `custom` / `dismiss` / `getHistory`…）保持 Sonner 原签名。
 */
export type CopyableToast = Omit<
  typeof sonnerToast,
  "success" | "info" | "warning" | "error" | "message"
> & {
  (message: ToastMessage, options?: CopyableToastOptions): string | number
  success: CopyableToastMethod
  info: CopyableToastMethod
  warning: CopyableToastMethod
  error: CopyableToastMethod
  message: CopyableToastMethod
}

/**
 * 复制感知的 `toast`：API 与 `sonner` 的 `toast` 完全一致，额外支持 `copyText` 选项。
 *
 * `loading` / `promise` / `custom` 原样透传 —— 它们的内容多为异步或自定义 JSX，
 * 强行挂复制按钮没有意义（需要的话在成功 / 失败回调里用普通 toast 展示）。
 */
const toast: CopyableToast = Object.assign(
  (message: ToastMessage, options?: CopyableToastOptions) =>
    sonnerToast(message, withCopy(message, options)),
  {
    ...sonnerToast,
    success: (message: ToastMessage, options?: CopyableToastOptions) =>
      sonnerToast.success(message, withCopy(message, options)),
    info: (message: ToastMessage, options?: CopyableToastOptions) =>
      sonnerToast.info(message, withCopy(message, options)),
    warning: (message: ToastMessage, options?: CopyableToastOptions) =>
      sonnerToast.warning(message, withCopy(message, options)),
    error: (message: ToastMessage, options?: CopyableToastOptions) =>
      sonnerToast.error(message, withCopy(message, options)),
    message: (message: ToastMessage, options?: CopyableToastOptions) =>
      sonnerToast.message(message, withCopy(message, options)),
  },
)

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
