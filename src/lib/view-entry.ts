import type { ViewRef } from '@/lib/view-store'

/**
 * 「无参数打开 /views」时的落点解析（纯函数，便于单测）。
 *
 * 规则（与用户确认过的行为一致）：
 *   1. **上次打开的视图**（recents 第一条）—— 有视图 UUID 就用 UUID（最稳定，
 *      页面只带 UUID 即可解析出所属工作簿与展示名）；只有旧数据时才退回名称对；
 *   2. 没有最近记录 → **固定兜底视图**（VITE_TABLEAU_FALLBACK_VIEW，站点绑定项）；
 *   3. 两者都没有 → undefined（调用方不跳转）。
 *
 * 这里只算"落点参数"，不碰 router / localStorage：调用方给 recents 与兜底 id，
 * 于是"点 Views 会落到哪"可以用毫秒级单测钉住，不需要起浏览器。
 */
export interface ViewSearch {
  workbook?: string
  view?: string
}

export function resolveInitialViewSearch(
  recents: readonly ViewRef[],
  fallbackViewId?: string,
): ViewSearch | undefined {
  const last = recents[0]
  if (last) {
    if (last.viewId) return { view: last.viewId }
    // 旧数据（v0.5.0 之前没有 UUID）：退回名称对，交给页面按名称解析
    if (last.workbook && last.view) return { workbook: last.workbook, view: last.view }
  }
  return fallbackViewId ? { view: fallbackViewId } : undefined
}
