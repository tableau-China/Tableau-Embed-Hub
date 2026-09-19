/**
 * 应用元信息（**版本号的唯一来源**）：侧边栏品牌注脚、Help 页的「关于」区都读这里。
 *
 * 跨文件核对约定（见 CHANGELOG.md 顶部）：`APP_VERSION` 必须与 `package.json` 的 `version`、
 * CHANGELOG 条目、PROGRESS.md 三处保持一致 —— 改版本时四处一起改。
 */

/** 应用名（品牌名，不翻译） */
export const APP_NAME = 'shadcn-admin-cn'

/** 应用版本（与 package.json 同步） */
export const APP_VERSION = '0.7.0'

/** 开发者 */
export const APP_AUTHOR = 'xilejun'

/** 开发者站点（Help 页与页脚外链，一律 https） */
export const APP_WEBSITE = 'https://xilejun.com'

/** 展示用的站点域名（省掉协议头，链接仍用 APP_WEBSITE） */
export const APP_WEBSITE_LABEL = 'xilejun.com'

/** 开源许可 */
export const APP_LICENSE = 'MIT'

export interface StackItem {
  /** 技术名（品牌名，不翻译） */
  name: string
  /** **主版本号**：只写主版本，避免每次升级依赖都要回来改这里；精确版本看 package.json */
  version: string
}

/** 技术栈（与 README 的「技术栈」表同源，Help 页展示用） */
export const APP_STACK: readonly StackItem[] = [
  { name: 'React', version: '19' },
  { name: 'TypeScript', version: '7' },
  { name: 'Vite', version: '8' },
  { name: 'Tailwind CSS', version: '4' },
  { name: 'shadcn/ui (Radix UI)', version: 'latest' },
  { name: 'TanStack Router', version: '1' },
  { name: 'TanStack Query', version: '5' },
  { name: 'i18next', version: '26' },
]
