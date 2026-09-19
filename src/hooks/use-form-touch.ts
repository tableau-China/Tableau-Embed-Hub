import { useCallback, useState } from 'react'

/**
 * 表单校验的显示时机（**表单页通用**）
 *
 * 要解决的问题：一进页面就满屏红字很吓人，但用户又必须知道「为什么我不能保存」。
 * 采用业界通行的两条规则：
 *   1. **碰过才报**：字段失焦（onBlur）后才显示它自己的校验结果；
 *   2. **点了才全报**：用户点主操作（保存）后，所有字段一起显示校验结果 —— 于是**保存按钮
 *      不该因为「有错误」而置灰**（置灰会让点不动也看不到原因），只在「没有改动」时才禁用。
 *
 * 用法：
 * ```tsx
 * const form = useFormTouch<'host' | 'port'>()
 * <FormField id="host" issue={form.shows('host') ? hostIssue : null} ... >
 *   <Input onBlur={() => form.touch('host')} />
 * </FormField>
 * const handleSave = () => {
 *   form.submit()
 *   if (hostIssue) { toast.error(...); return }
 *   save(); form.reset()
 * }
 * ```
 */
export interface FormTouch<F extends string> {
  /** 该字段现在是否应显示校验结果（碰过它，或已点过主操作） */
  shows: (field: F) => boolean
  /** 字段失焦时标记（接到控件的 onBlur） */
  touch: (field: F) => void
  /** 主操作被点击：此后所有字段都显示校验结果 */
  submit: () => void
  /** 保存成功或放弃改动后复位（回到「安静」状态） */
  reset: () => void
}

export function useFormTouch<F extends string>(): FormTouch<F> {
  const [touched, setTouched] = useState<ReadonlySet<F>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  const shows = useCallback((field: F) => submitted || touched.has(field), [submitted, touched])
  const touch = useCallback(
    (field: F) => setTouched((prev) => (prev.has(field) ? prev : new Set([...prev, field]))),
    [],
  )
  const submit = useCallback(() => setSubmitted(true), [])
  const reset = useCallback(() => {
    setTouched(new Set())
    setSubmitted(false)
  }, [])

  return { shows, touch, submit, reset }
}
