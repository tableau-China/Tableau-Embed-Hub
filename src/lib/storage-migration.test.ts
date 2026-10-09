import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 存储前缀迁移用例（项目更名：`shadcn-admin-cn` → `tableau-embed-hub`）。
 *
 * vitest 跑在 node 环境（见 vitest.config.ts），且本用例需要**枚举** key
 * （`length` + `key(i)`），所以自建一个内存 localStorage —— src/stores/org-store.test.ts
 * 里那份打桩的 key() 恒为 null，覆盖不到枚举路径。
 *
 * `vi.hoisted` 在 import 之前执行：storage-migration 是**副作用模块**（导入即迁移），
 * 存储必须已经就位，否则它拿不到 `globalThis.localStorage`。
 */
const { memory } = vi.hoisted(() => {
  const m = new Map<string, string>()
  const st = {
    get length() {
      return m.size
    },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  } as unknown as Storage
  const g = globalThis as unknown as { localStorage: Storage; window: unknown }
  g.localStorage = st
  g.window = { localStorage: st }
  return { memory: m }
})

const { LEGACY_STORAGE_PREFIX, STORAGE_PREFIX, migrateStoragePrefix } = await import(
  './storage-migration'
)

beforeEach(() => {
  memory.clear()
})

describe('存储前缀迁移', () => {
  it('前缀常量必须是约定的值（防手滑改回旧名）', () => {
    expect(STORAGE_PREFIX).toBe('tableau-embed-hub')
    expect(LEGACY_STORAGE_PREFIX).toBe('shadcn-admin-cn')
  })

  it('把旧前缀 key 复制到新前缀，含团队分区 key', () => {
    memory.set('shadcn-admin-cn:favorites:team-1', '["a"]')
    memory.set('shadcn-admin-cn:config', '{"smtp":{}}')
    memory.set('unrelated-key', 'keep-me')

    expect(migrateStoragePrefix()).toBe(2)
    expect(memory.get('tableau-embed-hub:favorites:team-1')).toBe('["a"]')
    expect(memory.get('tableau-embed-hub:config')).toBe('{"smtp":{}}')
    expect(memory.has('unrelated-key')).toBe(true)
    expect(memory.has('tableau-embed-hub:unrelated-key')).toBe(false)
  })

  it('旧 key 一律保留（回滚旧版本时数据还在）', () => {
    memory.set('shadcn-admin-cn:org', '{"state":{}}')

    migrateStoragePrefix()

    expect(memory.get('shadcn-admin-cn:org')).toBe('{"state":{}}')
  })

  it('新 key 已有数据时不覆盖（用户已在新版本里写过）', () => {
    memory.set('shadcn-admin-cn:permissions', 'old')
    memory.set('tableau-embed-hub:permissions', 'new')

    expect(migrateStoragePrefix()).toBe(0)
    expect(memory.get('tableau-embed-hub:permissions')).toBe('new')
  })

  it('幂等：连跑两次，第二次为 0', () => {
    memory.set('shadcn-admin-cn:recents', '[]')

    expect(migrateStoragePrefix()).toBe(1)
    expect(migrateStoragePrefix()).toBe(0)
  })

  it('可以指定前后缀（便于将来再做一次更名）', () => {
    memory.set('a:x', '1')

    expect(migrateStoragePrefix('a', 'b')).toBe(1)
    expect(memory.get('b:x')).toBe('1')
  })
})
