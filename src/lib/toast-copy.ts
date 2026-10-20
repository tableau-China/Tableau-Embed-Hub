/**
 * 从 toast 的标题 / 描述里解析「复制按钮」应该复制的纯文本。
 *
 * 几条刻意的规则：
 * - **只认字符串与数字**：标题可能是 ReactNode 或返回 ReactNode 的函数，这种内容没有可靠的
 *   纯文本表示；宁可不出复制按钮，也不要复制出 `[object Object]` 或空字符串。
 *   这种场景调用方可以传 `copyText` 选项显式指定文本。
 * - **标题 + 描述按换行拼接**：用户看到的整条消息就是复制出来的内容。
 * - **纯空白视为没有内容**：避免出现「点了复制、剪贴板却是空」的假按钮。
 */
export function toastCopyText(title: unknown, description?: unknown): string | null {
  const parts: string[] = []
  for (const value of [title, description]) {
    if (typeof value === 'string') {
      if (value.trim() !== '') parts.push(value)
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      parts.push(String(value))
    }
  }
  return parts.length > 0 ? parts.join('\n') : null
}
