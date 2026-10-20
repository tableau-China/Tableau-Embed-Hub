import { afterEach, describe, expect, it, vi } from 'vitest'

import { copyText } from './clipboard'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('copyText', () => {
  it('安全上下文下优先使用 Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('window', { isSecureContext: true })

    await expect(copyText('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('Clipboard API 失败时回退 execCommand', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    const select = vi.fn()
    const textarea = {
      value: '',
      setAttribute: vi.fn(),
      style: {} as CSSStyleDeclaration,
      select,
    }
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const execCommand = vi.fn().mockReturnValue(true)

    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('window', { isSecureContext: true })
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue(textarea),
      body: { appendChild, removeChild },
      execCommand,
    })

    await expect(copyText('fallback')).resolves.toBe(true)
    expect(textarea.value).toBe('fallback')
    expect(select).toHaveBeenCalledOnce()
    expect(appendChild).toHaveBeenCalledWith(textarea)
    expect(removeChild).toHaveBeenCalledWith(textarea)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('http（非安全上下文）直接走 execCommand', async () => {
    const writeText = vi.fn()
    const execCommand = vi.fn().mockReturnValue(true)

    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('window', { isSecureContext: false })
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue({
        value: '',
        setAttribute: vi.fn(),
        style: {} as CSSStyleDeclaration,
        select: vi.fn(),
      }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      execCommand,
    })

    await expect(copyText('insecure')).resolves.toBe(true)
    expect(writeText).not.toHaveBeenCalled()
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('两条通道都不可用时返回 false（不抛错）', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', { isSecureContext: false })

    await expect(copyText('nowhere')).resolves.toBe(false)
  })

  it('execCommand 返回 false 时如实返回失败', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', { isSecureContext: false })
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue({
        value: '',
        setAttribute: vi.fn(),
        style: {} as CSSStyleDeclaration,
        select: vi.fn(),
      }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      execCommand: vi.fn().mockReturnValue(false),
    })

    await expect(copyText('nope')).resolves.toBe(false)
  })
})
