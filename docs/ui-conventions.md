# 页面与组件约定（UI Conventions）

> v0.7.0 起（v0.10.0 增补筛选栏）。适用对象：**在这个模板上新增页面 / 新增表单 / 新增列表的人**。
> 相关文件：`src/components/page-container.tsx`、`src/components/form-field.tsx`、`src/components/note-callout.tsx`、
> `src/components/description-list.tsx`、`src/components/action-bar.tsx`、`src/components/filter-bar.tsx`、
> `src/hooks/use-form-touch.ts`、`src/hooks/use-list-filters.ts`、`src/routes/__root.tsx`。

目标只有一个：**新增页面时不必重新发明版面、表单接线与筛选栏**。复制下面三个骨架，改内容即可。

## 1. 页面骨架

```tsx
import { PageContainer } from '@/components/page-container'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ExamplePage() {
  const { t } = useTranslation()
  return (
    <PageContainer>
      <Card>
        <CardHeader>
          <CardTitle>{t('example.title')}</CardTitle>
          <CardDescription>{t('example.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>{/* … */}</CardContent>
      </Card>
    </PageContainer>
  )
}
```

## 2. 宽度约定（最容易做错的一条）

| 层级 | 约定 | 理由 |
| --- | --- | --- |
| 页面（`<PageContainer>`） | **铺满内容区**，不写 `max-w-*` | 全站页面宽度一致（/users、/teams、/help… 的卡片左右边缘对齐） |
| 表单（`<FormGrid>`） | 默认 `max-w-3xl`（768px） | 输入框铺满整屏会宽到 600px+，难扫读；字段本身不需要那么宽 |
| 键值摘要（`<DescriptionList>`） | 默认 `max-w-3xl` | 同上（值是短文本） |
| 长段落 | `max-w-prose` | 每行 60–75 字符是舒适阅读区间 |
| 表格 / 列表 / 卡片 | 铺满，**不要**加 `whitespace-nowrap` 到长文案列 | 见下条 |

### 宽表格为什么会让整页出现横向滚动条

`src/components/ui/table.tsx` 的 `TableHead` / `TableCell` **默认 `whitespace-nowrap`**：一个长文案列
会让表格的「最小内容宽度」变得很大，而 `SidebarInset` / `<main>` 作为 flex 子项默认 `min-width: auto`
（= 内容最小宽度），于是整页被顶宽、底部冒出横向滚动条，各页面宽度也跟着不一致。

两道防线（都已就位，新增页面不用管）：

1. `src/routes/__root.tsx` 给 `SidebarInset` 与 `<main>` 加了 `min-w-0` → 过宽的内容被限制在**卡片内部**滚动；
2. 表格里的长文案列显式加 `whitespace-normal`（+ 列宽 `w-*` + 外层 `min-w-0`），让它换行而不是撑宽。

## 3. 表单骨架

```tsx
import { FormField, FormGrid, type FieldIssue } from '@/components/form-field'
import { useFormTouch } from '@/hooks/use-form-touch'

const form = useFormTouch<'host' | 'port'>()

const hostIssue: FieldIssue | null =
  host === '' ? { level: 'error', message: t('x.hostRequired') } : null

const handleSave = () => {
  form.submit()                       // ① 让所有字段开始显示校验结果
  if (hostIssue) { toast.error(t('x.fixErrors')); return }
  save(); form.reset()                // ② 成功后复位
}

<FormGrid columns={2}>
  <FormField id="host" label={t('x.host')} hint={t('x.hostHint')} issue={form.shows('host') ? hostIssue : null}>
    {/* id / aria-invalid / aria-describedby 由 FormField 注入，不用写第二遍 */}
    <Input value={host} onChange={...} onBlur={() => form.touch('host')} />
  </FormField>
</FormGrid>
```

三条固定规则：

- **`useFormTouch`**：字段失焦才显示该字段的校验结果；点主操作后全部显示。因此**主操作按钮不要因为
  「有校验错误」而置灰**（置灰会让用户点不动、也看不到哪里错了），只在「没有改动」时禁用；
- **复合控件**（Radix `Select`、`InputGroup`）自己不落 DOM，传 `injectProps={false}`，把 `id` / `aria-*`
  显式写到真正的 DOM 节点（`SelectTrigger` / `InputGroupInput`）上；
- 校验结果的呈现分两处：`issue.level = 'error'` 红字拦保存，`'warning'` 琥珀字放行但提醒。

## 4. 其他通用件

| 组件 | 用途 |
| --- | --- |
| `ActionBar` / `ActionButtons` | 页面与弹窗底部的操作按钮（主操作恒在最右，窄屏自动堆叠） |
| `NoteCallout` | 说明 / 注意事项块（`tone="info"`｜`"warning"`），长段落内层加 `max-w-prose` |
| `DescriptionList` | 「标签 + 值」摘要（关于页的开发者/版本、详情面板元信息…） |
| `FilterBar` / `FilterSearch` / `FilterSelect` | **列表页筛选栏**（搜索 / 下拉 / 结果计数 / 一键重置）—— 见 §5 |
| `Badge` | 状态、角色、服务商等短标记；技术栈这类列表用徽章流比表格更省空间 |
| `GuardCard`（route-guard） | 无权 / 未找到等兜底页的统一外壳 |

> **上面这些通用件（连同 UI 原语、App shell 规格与主题 token）的清单、import 路径与实时预览都在 `/components` 页** ——
> 数据源是 `src/config/component-catalog.ts`：新增通用件时在那里登记一行，页面与预览自动多一条。

## 5. 列表筛选栏（v0.10.0 起）

列表页要「按关键词搜、按字段筛」时**不要自己拼搜索框和下拉** —— 用
`components/filter-bar.tsx`（控件）+ `hooks/use-list-filters.ts`（状态），所有页面的筛选栏
才会长得一样、行为一样（有筛选才出现「重置」，空态与计数口径一致）。

```tsx
import { FilterBar, FilterSearch, FilterSelect } from '@/components/filter-bar'
import { useListFilters } from '@/hooks/use-list-filters'

// ① 默认值 = 「重置」的目标值，写模块级常量（它同时是「未筛选」的定义）
const DEFAULTS: UserFilterValues = { q: '', status: 'all', team: 'all' }

function ListPage() {
  const filters = useListFilters(DEFAULTS)
  const rows = useMemo(() => all.filter(/* 你的筛选口径 */), [all, filters.values])

  return (
    <CardContent>
      <FilterBar
        className="mb-4"                                   // 与表格之间的间距
        activeCount={filters.activeCount}                 // > 0 才出现计数与「重置」
        onReset={filters.reset}
        shown={rows.length}
        total={all.length}
      >
        <FilterSearch
          value={filters.values.q}
          onChange={(v) => filters.set('q', v)}
          placeholder={t('x.searchPlaceholder')}          // 写清「搜的是哪个字段」
        />
        <FilterSelect
          id="x-filter-status"                            // 必填：DOM id + data-filter-select 钩子
          label={t('x.status')}                           // 触发器上的灰色前缀
          value={filters.values.status}
          onChange={(v) => filters.set('status', v as StatusFilter)}
          options={statusOptions}                         // { value: string, label, icon? }[]
        />
      </FilterBar>
      <Table>{/* rows… */}</Table>
    </CardContent>
  )
}
```

四条固定规则：

- **受控**：控件不持有状态、不碰数据源 —— 「哪个字段、怎么匹配」是业务判断，留在页面里。
  好处是同一组控件也能用在弹窗/非路由场景；
- **值一律字符串**（数字 id 用 `String(id)`），「未筛选」用显式的 `'all'` 而不是空值，
  省掉每处 `undefined` 判断；
- **空态要分三种**（见 `/users`）：① 一条数据都没有；② 有数据但**被筛掉了**
  （文案要说清是筛选导致，并给「重置筛选」出口）；③ 无权限看不到。三者文案不能混用；
- **筛选是视图态**：默认不进 URL（刷新回默认）。需要「筛选结果可分享 / 刷新不丢」时，
  把同一组受控组件的 `value`/`onChange` 接到 TanStack Router 的 `useSearch` + `navigate({ search })`，
  **公共件本身一行都不用改**。

> 校验：`pnpm build && pnpm check:filters`（静态自检 i18n/选项来源 + 7 项页面用例：
> 搜索口径、组合筛选、计数、重置、三种空态、宽窄屏几何断言）。

## 6. 新增页面的完整清单

1. 建路由文件 `src/routes/<name>.tsx`（页面主体放 `src/features/<feature>/`）；
2. 在 `src/config/permissions.ts` 的 `ROUTE_CATALOG` 登记一行（`key` / `to` / `scope` / `group` /
   `labelKey` / `defaultRoles`；入口不在侧边栏时加 `navHidden: true`）；
3. `src/components/app-sidebar.tsx` 的 `ICONS` 补图标（漏配 tsc 直接报错）；
4. `src/components/header.tsx` 的段映射补标题/副标题；
5. `src/i18n/locales/en-US/common.json` 补文案（`pnpm check:i18n` 把关）；
6. 页面用 `<PageContainer>` + `<Card>` 组织，表单用 `<FormGrid>` / `<FormField>`，
   列表筛选用 `<FilterBar>` / `<FilterSearch>` / `<FilterSelect>` + `useListFilters`。

→ 侧边栏入口、URL 直达拦截、权限页勾选行三处**同时生效**（详见 [route-permissions.md](./route-permissions.md)）。
