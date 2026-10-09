import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * ISO 时间串 → 浏览器本地时间。
 * @param value ISO 8601（Tableau 一律回 ISO），空值/非法值一律 '—' 而不抛错。
 * 共享它（而不是各页面自己 new Date）是为了让「空值怎么显示」只有一个口径。
 */
export function formatDateTime(value?: string): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}
