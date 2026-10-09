/**
 * 一次性存储前缀迁移（`shadcn-admin-cn` → `tableau-embed-hub`）—— 项目更名的配套动作。
 *
 * ⚠️ **本模块带副作用：导入即执行迁移。** 这样任何 `import` 本模块的 store，
 * 都保证在自己 hydrate / 首次读盘之前完成迁移（zustand 的 persist 在模块求值时就会
 * 读 localStorage；view-store 也在首次读取时直接查盘）。晚一步的后果是
 * 「升级后收藏、最近浏览、团队、权限、SMTP 配置全部变空」，而且**不可逆**。
 * `src/main.tsx` 另有一次显式首行导入兜底。
 *
 * 设计取舍：
 * - **只复制、不删除旧 key**：回滚到旧版本时数据还在；代价是旧 key 留在浏览器里
 *   （个位数条数，量级可忽略）。这与 view-store 里 v0.3.x 那次「迁完即删」的策略不同，
 *   原因就是这次要留回滚余地。
 * - **新 key 已存在则跳过**：避免用旧数据盖掉用户在新版本里写过的数据，同时让本函数幂等。
 * - **永不抛错**：迁移失败最多是旧数据没搬过来，绝不能让应用起不来。
 */

/** 当前存储命名空间前缀（kebab-case，与仓库名一致；与 `src/config/app.ts` 的显示名无耦合） */
export const STORAGE_PREFIX = 'tableau-embed-hub'

/** 更名前的前缀（v0.12.0 及以前），只用于迁移 */
export const LEGACY_STORAGE_PREFIX = 'shadcn-admin-cn'

/** 只依赖 localStorage 的最小接口，便于在 node 环境下的用例里打桩 */
interface KeyValueStore {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** 取当前环境的 localStorage；SSR、隐私模式或被策略禁用时返回 null */
function safeStorage(): KeyValueStore | null {
  try {
    const g = globalThis as { localStorage?: KeyValueStore }
    return g.localStorage ?? null
  } catch {
    // Safari 隐私模式下，访问 localStorage 属性本身就可能抛错
    return null
  }
}

/**
 * 把 `from:` 前缀下的所有 key 复制到 `to:` 前缀（含 `:favorites:team-1` 这类分区 key）。
 *
 * @returns 实际复制的条目数；0 表示没有旧数据，或都已迁移过
 */
export function migrateStoragePrefix(
  from: string = LEGACY_STORAGE_PREFIX,
  to: string = STORAGE_PREFIX,
): number {
  const store = safeStorage()
  if (!store || from === to) return 0

  const sourcePrefix = `${from}:`
  const legacyKeys: string[] = []
  try {
    // 先枚举、后写入：边遍历边写会让新增的 key 混进遍历范围
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i)
      if (key !== null && key.startsWith(sourcePrefix)) legacyKeys.push(key)
    }
  } catch {
    return 0
  }

  let migrated = 0
  for (const legacyKey of legacyKeys) {
    const nextKey = `${to}:${legacyKey.slice(sourcePrefix.length)}`
    try {
      if (store.getItem(nextKey) !== null) continue // 新 key 已有数据：绝不覆盖
      const value = store.getItem(legacyKey)
      if (value === null) continue
      store.setItem(nextKey, value)
      migrated += 1
    } catch {
      // 配额不足 / 被禁用：跳过这一条，继续处理其余 key
    }
  }
  return migrated
}

migrateStoragePrefix()
