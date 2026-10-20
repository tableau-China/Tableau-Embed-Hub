/**
 * 复制文本到剪贴板（Clipboard API 优先，旧式 execCommand 兜底）。
 *
 * 为什么需要兜底：`navigator.clipboard` 只在**安全上下文**可用（https / localhost）。
 * 本项目按 README 的内网部署方式跑在 http 上时它是 `undefined`，只写 Clipboard API
 * 会让「复制」按钮静默失效。execCommand('copy') 已标记废弃，但仍是 http 场景唯一可用的通道。
 *
 * 抽到 lib 里的原因：全局错误页（`components/error-boundary.tsx`，复制 Error ID）与
 * Toast 复制按钮需要**同一口径**（同一套降级顺序、同样的失败返回），不要各写一份。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      navigator.clipboard
    ) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Clipboard API 被权限/浏览器策略拒绝时继续走兜底
  }

  try {
    if (typeof document === 'undefined') return false
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
