import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches
}

/**
 * 是否移动端视口。
 *
 * 用 useSyncExternalStore 订阅 matchMedia：首帧即为真实值，且无需在 effect 里 setState
 * （旧写法首帧 undefined→false 再翻转，会触发 react-hooks/set-state-in-effect 与级联渲染）。
 * 服务端渲染（无 window）返回 false。
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}
