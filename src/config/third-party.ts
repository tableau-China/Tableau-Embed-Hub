/**
 * 第三方组件与版权说明 —— 应用内 `/help` 页「第三方版权」区块的**唯一数据来源**。
 *
 * 收录范围：`package.json` 的 **dependencies**（会随构建产物一起分发给你和你的用户）
 * 加 `tailwindcss`（它的产出会被打进 CSS）。devDependencies 不进发行物，故不列。
 *
 * ⚠️ 许可与版权字段取自 node_modules 里各包的 LICENSE / package.json（2026-10-09 核对）。
 * 升级依赖后应重新核对；仓库里的 [THIRD-PARTY.md](../../THIRD-PARTY.md) 是同一份说明的文字版
 * （含 @tableau/embedding-api 的完整限制与迁移计划），**改这里时两处一起改**。
 * 含传递依赖的完整清单：\`pnpm licenses list\`。
 */

export interface ThirdPartyNotice {
  /** 包名（不翻译） */
  name: string
  /** 许可标识：SPDX 或官方许可名（不翻译） */
  license: string
  /** 版权所有者（不翻译） */
  copyright: string
  /**
   * 需要使用者特别注意的许可（非开源、或带额外限制）。
   * UI 上高亮该行，并在表格下方给出警示块。
   */
  caution?: boolean
}

/** 直接依赖清单（按包名排序；带 caution 的排在最前） */
export const THIRD_PARTY_NOTICES: readonly ThirdPartyNotice[] = [
  {
    name: '@tableau/embedding-api',
    license: 'Salesforce Binary Code License Agreement',
    copyright: 'Salesforce, Inc.',
    caution: true,
  },
  { name: '@fontsource-variable/geist', license: 'OFL-1.1', copyright: 'The Geist Project Authors' },
  { name: '@tanstack/react-query', license: 'MIT', copyright: 'Tanner Linsley' },
  { name: '@tanstack/react-router', license: 'MIT', copyright: 'Tanner Linsley' },
  { name: 'class-variance-authority', license: 'Apache-2.0', copyright: 'Joe Bell' },
  { name: 'clsx', license: 'MIT', copyright: 'Luke Edwards' },
  { name: 'cmdk', license: 'MIT', copyright: 'Paco Coursey' },
  { name: 'i18next', license: 'MIT', copyright: 'i18next' },
  { name: 'i18next-browser-languagedetector', license: 'MIT', copyright: 'i18next' },
  { name: 'jose', license: 'MIT', copyright: 'Filip Skokan' },
  { name: 'lucide-react', license: 'ISC', copyright: 'Lucide Icons and Contributors' },
  { name: 'next-themes', license: 'MIT', copyright: 'Paco Coursey' },
  { name: 'radix-ui', license: 'MIT', copyright: 'WorkOS' },
  { name: 'react', license: 'MIT', copyright: 'Meta Platforms, Inc. and affiliates' },
  { name: 'react-dom', license: 'MIT', copyright: 'Meta Platforms, Inc. and affiliates' },
  { name: 'react-i18next', license: 'MIT', copyright: 'i18next' },
  { name: 'sonner', license: 'MIT', copyright: 'Emil Kowalski' },
  { name: 'tailwind-merge', license: 'MIT', copyright: 'Dany Castillo' },
  { name: 'tailwindcss', license: 'MIT', copyright: 'Tailwind Labs, Inc.' },
  { name: 'tw-animate-css', license: 'MIT', copyright: 'Wombosvideo' },
  { name: 'zustand', license: 'MIT', copyright: 'Paul Henschel' },
]
