import { describe, expect, it } from 'vitest'

import { resolveInitialViewSearch } from './view-entry'

const FALLBACK = '5959968c-c18b-4ada-bff1-99ac36af1dc1'

function recent(over: Partial<{ workbook: string; view: string; workbookId: string; viewId: string }>) {
  return { workbook: 'W', view: 'V', accessedAt: '2026-01-01T00:00:00.000Z', ...over }
}

/**
 * 「点 Views 落到哪」的纯函数用例。
 * 规则：上次打开的视图优先（UUID 优先于名称），没有最近记录才用固定兜底视图。
 */
describe('resolveInitialViewSearch（/views 的落点）', () => {
  it('有最近记录 → 用它的视图 UUID（最稳定）', () => {
    expect(
      resolveInitialViewSearch(
        [recent({ workbookId: 'wb-1', viewId: 'view-1' })],
        FALLBACK,
      ),
    ).toEqual({ view: 'view-1' })
  })

  it('只取第一条（recents 已按最近在前排序）', () => {
    expect(
      resolveInitialViewSearch(
        [
          recent({ viewId: 'newest' }),
          recent({ viewId: 'older' }),
        ],
        FALLBACK,
      ),
    ).toEqual({ view: 'newest' })
  })

  it('旧数据没有 UUID → 退回名称对（页面按名称解析）', () => {
    expect(
      resolveInitialViewSearch([recent({ workbook: 'Superstore', view: 'Overview' })], FALLBACK),
    ).toEqual({ workbook: 'Superstore', view: 'Overview' })
  })

  it('没有最近记录 → 固定兜底视图', () => {
    expect(resolveInitialViewSearch([], FALLBACK)).toEqual({ view: FALLBACK })
  })

  it('什么都没配 → 不跳转（返回 undefined）', () => {
    expect(resolveInitialViewSearch([], undefined)).toBeUndefined()
  })
})
