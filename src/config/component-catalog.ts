/**
 * 组件目录 —— 「公共件总览」页（/components）的**唯一数据源**
 *
 * 为什么单独开一个文件（而不是把清单写在页面里）：
 *   1. 页面只负责「渲染 + 预览」，清单只负责「有什么、在哪、干什么」—— 加一个公共件 = 加一行；
 *   2. 本文件不依赖 React / zustand / window（同 `src/config/permissions.ts` 的做法），
 *      因此 `scripts/check-*.mjs` 这类 node 脚本可以直接 import 它做静态校验
 *      （例如断言 `src/components/ui/*.tsx` 全部已登记，避免目录腐烂）；
 *   3. 组件页、文档、未来的检查脚本读同一份清单，不会各写一套。
 *
 * 新增公共件时的步骤：
 *   1. 在 `COMPONENT_CATALOG` 里登记一行（id 唯一、importPath 写真实路径）；
 *   2. 在 `src/i18n/locales/en-US/common.json` 的 `components.desc.<id>` 补一句话用途；
 *   3. 需要预览的话，在 `src/features/components/*-sections.tsx` 的 DEMOS 里加一个同名 id 的演示组件
 *      （不加也能渲染，页面会显示「无实时预览」并指向它的真实用法）。
 */

/** 组件在页面上的分组顺序（页面按此顺序渲染章节） */
export type ComponentSection =
  | 'layout'
  | 'actions'
  | 'forms'
  | 'data'
  | 'filters'
  | 'overlays'
  | 'feedback'
  | 'hooks'

export interface ComponentEntry {
  /** 唯一 id：同时是 i18n 后缀（`components.desc.<id>`）与预览组件的查找键 */
  readonly id: string
  /** 代码里的名字（不翻译 —— 它就是 import 时要写的东西） */
  readonly name: string
  /** 真实 import 路径，例如 `@/components/filter-bar` */
  readonly importPath: string
  readonly section: ComponentSection
  /** 一句话用途的 i18n key */
  readonly descKey: string
  /** 可选：典型用法片段（纯展示；**片段里不要出现真实的 t 调用**，会被 i18n 检查脚本当成在用 key） */
  readonly snippet?: string
}

export interface ComponentSectionMeta {
  readonly id: ComponentSection
  readonly titleKey: string
  readonly hintKey: string
}

/** 章节元信息：标题与一句话说明（顺序 = 页面顺序） */
export const COMPONENT_SECTION_META: readonly ComponentSectionMeta[] = [
  { id: 'layout', titleKey: 'components.section.layout', hintKey: 'components.section.layoutHint' },
  { id: 'actions', titleKey: 'components.section.actions', hintKey: 'components.section.actionsHint' },
  { id: 'forms', titleKey: 'components.section.forms', hintKey: 'components.section.formsHint' },
  { id: 'data', titleKey: 'components.section.data', hintKey: 'components.section.dataHint' },
  { id: 'filters', titleKey: 'components.section.filters', hintKey: 'components.section.filtersHint' },
  { id: 'overlays', titleKey: 'components.section.overlays', hintKey: 'components.section.overlaysHint' },
  { id: 'feedback', titleKey: 'components.section.feedback', hintKey: 'components.section.feedbackHint' },
  { id: 'hooks', titleKey: 'components.section.hooks', hintKey: 'components.section.hooksHint' },
]

/**
 * 公共件清单。
 *
 * 收录口径：**项目里可以拿来直接搭页面**的东西 ——
 *   · 自研通用件（components/*.tsx）：表单、筛选、操作栏、摘要、提示块…
 *   · UI 原语（components/ui/*.tsx）：shadcn/Radix 基座
 *   · 配套 hook（hooks/*.ts）
 * 不收录：应用外壳与页面私有件（app-sidebar / header / theme-provider / org/* / tableau/*）——
 * 它们是「某处的实现」，不是「可复用的零件」；外壳的规格见页面上的 App shell 章节。
 */
export const COMPONENT_CATALOG = [
  /* ------------------------------ 布局与卡片 ------------------------------ */
  {
    id: 'pageContainer',
    name: 'PageContainer',
    importPath: '@/components/page-container',
    section: 'layout',
    descKey: 'components.desc.pageContainer',
    snippet: '<PageContainer>\n  <Card>…</Card>\n</PageContainer>',
  },
  {
    id: 'card',
    name: 'Card / CardHeader / CardContent / CardFooter',
    importPath: '@/components/ui/card',
    section: 'layout',
    descKey: 'components.desc.card',
  },
  {
    id: 'separator',
    name: 'Separator',
    importPath: '@/components/ui/separator',
    section: 'layout',
    descKey: 'components.desc.separator',
  },
  {
    id: 'tabs',
    name: 'Tabs / TabsList / TabsTrigger / TabsContent',
    importPath: '@/components/ui/tabs',
    section: 'layout',
    descKey: 'components.desc.tabs',
  },
  {
    id: 'collapsible',
    name: 'Collapsible',
    importPath: '@/components/ui/collapsible',
    section: 'layout',
    descKey: 'components.desc.collapsible',
  },

  /* ------------------------------ 操作与菜单 ------------------------------ */
  {
    id: 'button',
    name: 'Button',
    importPath: '@/components/ui/button',
    section: 'actions',
    descKey: 'components.desc.button',
  },
  {
    id: 'actionBar',
    name: 'ActionBar / ActionButtons',
    importPath: '@/components/action-bar',
    section: 'actions',
    descKey: 'components.desc.actionBar',
    snippet:
      '<ActionButtons\n  cancelLabel={t(...)} onCancel={close}\n  confirmLabel={t(...)} onConfirm={save}\n/>',
  },
  {
    id: 'dropdownMenu',
    name: 'DropdownMenu',
    importPath: '@/components/ui/dropdown-menu',
    section: 'actions',
    descKey: 'components.desc.dropdownMenu',
  },
  {
    id: 'toggle',
    name: 'Toggle',
    importPath: '@/components/ui/toggle',
    section: 'actions',
    descKey: 'components.desc.toggle',
  },

  /* ------------------------------ 表单与输入 ------------------------------ */
  {
    id: 'formField',
    name: 'FormGrid / FormField',
    importPath: '@/components/form-field',
    section: 'forms',
    descKey: 'components.desc.formField',
    snippet:
      '<FormGrid columns={2}>\n  <FormField id="name" label={t(...)} hint={t(...)}\n             issue={form.shows(\'name\') ? nameIssue : null}>\n    <Input onBlur={() => form.touch(\'name\')} />\n  </FormField>\n</FormGrid>',
  },
  {
    id: 'label',
    name: 'Label',
    importPath: '@/components/ui/label',
    section: 'forms',
    descKey: 'components.desc.label',
  },
  {
    id: 'input',
    name: 'Input',
    importPath: '@/components/ui/input',
    section: 'forms',
    descKey: 'components.desc.input',
  },
  {
    id: 'textarea',
    name: 'Textarea',
    importPath: '@/components/ui/textarea',
    section: 'forms',
    descKey: 'components.desc.textarea',
  },
  {
    id: 'inputGroup',
    name: 'InputGroup',
    importPath: '@/components/ui/input-group',
    section: 'forms',
    descKey: 'components.desc.inputGroup',
  },
  {
    id: 'select',
    name: 'Select',
    importPath: '@/components/ui/select',
    section: 'forms',
    descKey: 'components.desc.select',
  },
  {
    id: 'checkbox',
    name: 'Checkbox',
    importPath: '@/components/ui/checkbox',
    section: 'forms',
    descKey: 'components.desc.checkbox',
  },
  {
    id: 'switch',
    name: 'Switch',
    importPath: '@/components/ui/switch',
    section: 'forms',
    descKey: 'components.desc.switch',
  },

  /* ------------------------------ 数据展示 ------------------------------ */
  {
    id: 'table',
    name: 'Table',
    importPath: '@/components/ui/table',
    section: 'data',
    descKey: 'components.desc.table',
  },
  {
    id: 'badge',
    name: 'Badge',
    importPath: '@/components/ui/badge',
    section: 'data',
    descKey: 'components.desc.badge',
  },
  {
    id: 'avatar',
    name: 'Avatar',
    importPath: '@/components/ui/avatar',
    section: 'data',
    descKey: 'components.desc.avatar',
  },
  {
    id: 'descriptionList',
    name: 'DescriptionList',
    importPath: '@/components/description-list',
    section: 'data',
    descKey: 'components.desc.descriptionList',
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    importPath: '@/components/ui/skeleton',
    section: 'data',
    descKey: 'components.desc.skeleton',
  },
  {
    id: 'breadcrumb',
    name: 'Breadcrumb',
    importPath: '@/components/ui/breadcrumb',
    section: 'data',
    descKey: 'components.desc.breadcrumb',
  },

  /* ------------------------------ 列表筛选 ------------------------------ */
  {
    id: 'filterBar',
    name: 'FilterBar / FilterSearch / FilterSelect',
    importPath: '@/components/filter-bar',
    section: 'filters',
    descKey: 'components.desc.filterBar',
    snippet:
      'const filters = useListFilters({ q: \'\', status: \'all\' })\n\n<FilterBar activeCount={filters.activeCount} onReset={filters.reset}\n           shown={rows.length} total={all.length}>\n  <FilterSearch value={filters.values.q}\n                onChange={(v) => filters.set(\'q\', v)} />\n  <FilterSelect id="status" label={t(...)} value={filters.values.status}\n                onChange={(v) => filters.set(\'status\', v)} options={options} />\n</FilterBar>',
  },

  /* ------------------------------ 浮层 ------------------------------ */
  {
    id: 'dialog',
    name: 'Dialog',
    importPath: '@/components/ui/dialog',
    section: 'overlays',
    descKey: 'components.desc.dialog',
  },
  {
    id: 'sheet',
    name: 'Sheet',
    importPath: '@/components/ui/sheet',
    section: 'overlays',
    descKey: 'components.desc.sheet',
  },
  {
    id: 'popover',
    name: 'Popover',
    importPath: '@/components/ui/popover',
    section: 'overlays',
    descKey: 'components.desc.popover',
  },
  {
    id: 'tooltip',
    name: 'Tooltip',
    importPath: '@/components/ui/tooltip',
    section: 'overlays',
    descKey: 'components.desc.tooltip',
  },
  {
    id: 'command',
    name: 'Command',
    importPath: '@/components/ui/command',
    section: 'overlays',
    descKey: 'components.desc.command',
  },

  /* ------------------------------ 反馈与状态 ------------------------------ */
  {
    id: 'noteCallout',
    name: 'NoteCallout',
    importPath: '@/components/note-callout',
    section: 'feedback',
    descKey: 'components.desc.noteCallout',
  },
  {
    id: 'toast',
    name: 'toast（Sonner）',
    importPath: '@/components/ui/sonner',
    section: 'feedback',
    descKey: 'components.desc.toast',
  },
  {
    id: 'guardCard',
    name: 'GuardCard',
    importPath: '@/components/route-guard',
    section: 'feedback',
    descKey: 'components.desc.guardCard',
  },
  {
    id: 'configStatusCard',
    name: 'ConfigStatusCard',
    importPath: '@/components/config-status-card',
    section: 'feedback',
    descKey: 'components.desc.configStatusCard',
  },
  {
    id: 'thumbnailCard',
    name: 'ThumbnailCard',
    importPath: '@/components/thumbnail-card',
    section: 'feedback',
    descKey: 'components.desc.thumbnailCard',
  },
  {
    id: 'listState',
    name: 'ListState',
    importPath: '@/components/list-state',
    section: 'feedback',
    descKey: 'components.desc.listState',
    snippet:
      '<ListState status={query.status} isEmpty={rows.length === 0}\n           errorTitle="Failed to load" onRetry={refetch}>\n  <Table>…</Table>\n</ListState>',
  },

  /* ------------------------------ 配套 hook ------------------------------ */
  {
    id: 'useListFilters',
    name: 'useListFilters',
    importPath: '@/hooks/use-list-filters',
    section: 'hooks',
    descKey: 'components.desc.useListFilters',
    snippet:
      'const DEFAULTS = { q: \'\', status: \'all\' }\nconst filters = useListFilters(DEFAULTS)\nfilters.values.q      // 当前值\nfilters.activeCount   // > 0 才显示「重置」\nfilters.reset()',
  },
  {
    id: 'useFormTouch',
    name: 'useFormTouch',
    importPath: '@/hooks/use-form-touch',
    section: 'hooks',
    descKey: 'components.desc.useFormTouch',
    snippet:
      'const form = useFormTouch<\'name\' | \'slug\'>()\nform.shows(\'name\')  // 碰过该字段，或点过主操作\nform.touch(\'name\')  // 接到 onBlur\nform.submit()        // 主操作被点击：全部显示\nform.reset()         // 保存成功/放弃改动',
  },
] as const satisfies readonly ComponentEntry[]

/** 按章节取条目（保持 COMPONENT_CATALOG 里的书写顺序） */
export function componentsOf(section: ComponentSection): readonly ComponentEntry[] {
  return COMPONENT_CATALOG.filter((entry) => entry.section === section)
}
