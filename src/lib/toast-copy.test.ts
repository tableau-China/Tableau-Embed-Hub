import { describe, expect, it } from 'vitest'

import { toastCopyText } from './toast-copy'

describe('toastCopyText', () => {
  it('字符串标题原样返回', () => {
    expect(toastCopyText('User created')).toBe('User created')
  })

  it('标题与描述按换行拼接（用户看到的整条消息）', () => {
    expect(toastCopyText('Saved', '3 warnings')).toBe('Saved\n3 warnings')
  })

  it('数字标题转成字符串', () => {
    expect(toastCopyText(42)).toBe('42')
  })

  it('只有描述时也能复制', () => {
    expect(toastCopyText('', 'Only description')).toBe('Only description')
  })

  it('ReactNode / 函数标题没有可靠纯文本，返回 null', () => {
    expect(toastCopyText({ type: 'span' })).toBeNull()
    expect(toastCopyText(() => 'lazy')).toBeNull()
  })

  it('空白字符串不产生复制按钮', () => {
    expect(toastCopyText('   ')).toBeNull()
    expect(toastCopyText('', '')).toBeNull()
    expect(toastCopyText(undefined)).toBeNull()
  })
})
