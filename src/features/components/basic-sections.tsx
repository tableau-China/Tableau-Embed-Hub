import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bold, ChevronDown, Copy, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { ActionButtons } from '@/components/action-bar'
import { FormField, FormGrid, type FieldIssue } from '@/components/form-field'
import { PageContainer } from '@/components/page-container'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import { GallerySection, type DemoMap } from '@/features/components/gallery-kit'
import { useFormTouch } from '@/hooks/use-form-touch'

/**
 * 「布局与卡片」「操作与菜单」「表单与输入」三章的预览组件
 *
 * 约定：预览**只用公共件与真实类名** —— 参数里的 Tailwind 类就是页面里该怎么用。
 * 单个演示组件只做一件事，出问题时一眼能定位是哪个件的行为变了。
 */

/* ============================== 布局与卡片 ============================== */

function PageContainerDemo() {
  const { t } = useTranslation()
  return (
    <PageContainer>
      <div className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
        {t('components.demo.blockA')}
      </div>
      <div className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
        {t('components.demo.blockB')}
      </div>
    </PageContainer>
  )
}

function CardDemo() {
  const { t } = useTranslation()
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>{t('components.demo.cardTitle')}</CardTitle>
        <CardDescription>{t('components.demo.cardBody')}</CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        {t('components.demo.cardContent')}
      </CardContent>
      <CardFooter className="text-muted-foreground text-xs">
        {t('components.demo.cardFooter')}
      </CardFooter>
    </Card>
  )
}

function SeparatorDemo() {
  const { t } = useTranslation()
  return (
    <div className="flex max-w-md flex-col gap-3">
      <span className="text-sm">{t('components.demo.separatorTop')}</span>
      <Separator />
      <div className="flex h-5 items-center gap-3 text-sm">
        <span>{t('components.demo.separatorLeft')}</span>
        <Separator orientation="vertical" />
        <span>{t('components.demo.separatorRight')}</span>
      </div>
    </div>
  )
}

function TabsDemo() {
  const { t } = useTranslation()
  return (
    <Tabs defaultValue="overview" className="max-w-md">
      <TabsList>
        <TabsTrigger value="overview">{t('components.demo.tabOverview')}</TabsTrigger>
        <TabsTrigger value="details">{t('components.demo.tabDetails')}</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-muted-foreground text-sm">
        {t('components.demo.tabOverviewBody')}
      </TabsContent>
      <TabsContent value="details" className="text-muted-foreground text-sm">
        {t('components.demo.tabDetailsBody')}
      </TabsContent>
    </Tabs>
  )
}

function CollapsibleDemo() {
  const { t } = useTranslation()
  return (
    <Collapsible className="max-w-md rounded-lg border p-3">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          {t('components.demo.collapsibleTrigger')}
          <ChevronDown />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="text-muted-foreground px-2 pt-2 text-sm">
        {t('components.demo.collapsibleBody')}
      </CollapsibleContent>
    </Collapsible>
  )
}

/* ============================== 操作与菜单 ============================== */

function ButtonDemo() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button>{t('components.demo.btnPrimary')}</Button>
        <Button variant="secondary">{t('components.demo.btnSecondary')}</Button>
        <Button variant="outline">{t('components.demo.btnOutline')}</Button>
        <Button variant="ghost">{t('components.demo.btnGhost')}</Button>
        <Button variant="destructive">{t('components.demo.btnDanger')}</Button>
        <Button variant="link">{t('components.demo.btnLink')}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm">{t('components.demo.btnSmall')}</Button>
        <Button size="lg">{t('components.demo.btnLarge')}</Button>
        <Button size="icon" aria-label={t('components.demo.btnIconLabel')}>
          <Plus />
        </Button>
        <Button disabled>{t('components.demo.btnDisabled')}</Button>
      </div>
    </div>
  )
}

function ActionBarDemo() {
  const { t } = useTranslation()
  return (
    <div className="flex max-w-md flex-col gap-3">
      <ActionButtons
        cancelLabel={t('common.cancel')}
        onCancel={() => toast(t('components.demo.toastCancelled'))}
        confirmLabel={t('common.save')}
        onConfirm={() => toast.success(t('components.demo.toastSaved'))}
      />
      <ActionButtons
        cancelLabel={t('common.close')}
        onCancel={() => toast(t('components.demo.toastCancelled'))}
        confirmLabel={t('components.demo.btnDanger')}
        confirmVariant="destructive"
        onConfirm={() => toast.error(t('components.demo.toastDeleted'))}
      />
    </div>
  )
}

function DropdownMenuDemo() {
  const { t } = useTranslation()
  const [showHidden, setShowHidden] = useState(true)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {t('components.demo.menuTrigger')}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>{t('components.demo.menuSection')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Pencil />
          {t('components.demo.menuEdit')}
          <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Copy />
          {t('components.demo.menuDuplicate')}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t('components.demo.menuMore')}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>{t('components.demo.menuExport')}</DropdownMenuItem>
            <DropdownMenuItem>{t('components.demo.menuShare')}</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={showHidden} onCheckedChange={setShowHidden}>
          {t('components.demo.menuToggleHidden')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem variant="destructive">
          <Trash2 />
          {t('components.demo.btnDanger')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ToggleDemo() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2">
      <Toggle aria-label={t('components.demo.toggleBold')}>
        <Bold />
      </Toggle>
      <Toggle variant="outline" defaultPressed aria-label={t('components.demo.toggleBold')}>
        <Bold />
        {t('components.demo.toggleBold')}
      </Toggle>
      <Toggle disabled aria-label={t('components.demo.toggleBold')}>
        <Bold />
      </Toggle>
    </div>
  )
}

/* ============================== 表单与输入 ============================== */

function FormFieldDemo() {
  const { t } = useTranslation()
  const form = useFormTouch<'name' | 'slug'>()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  const nameIssue: FieldIssue | null =
    name.trim() === '' ? { level: 'error', message: t('components.demo.errorName') } : null
  const slugIssue: FieldIssue | null =
    slug === '' ? { level: 'warning', message: t('components.demo.warningSlug') } : null

  const submit = () => {
    form.submit()
    if (nameIssue) {
      toast.error(t('components.demo.errorName'))
      return
    }
    toast.success(t('components.demo.toastSaved'))
    form.reset()
  }

  return (
    <FormGrid columns={2}>
      <FormField
        id="gallery-name"
        label={t('components.demo.fieldName')}
        hint={t('components.demo.fieldNameHint')}
        issue={form.shows('name') ? nameIssue : null}
      >
        <Input
          value={name}
          placeholder={t('components.demo.fieldPlaceholder')}
          onBlur={() => form.touch('name')}
          onChange={(event) => setName(event.target.value)}
        />
      </FormField>
      <FormField
        id="gallery-slug"
        label={t('components.demo.fieldSlug')}
        hint={t('components.demo.fieldSlugHint')}
        issue={form.shows('slug') ? slugIssue : null}
      >
        <Input
          value={slug}
          placeholder={t('components.demo.fieldPlaceholder')}
          onBlur={() => form.touch('slug')}
          onChange={(event) => setSlug(event.target.value)}
        />
      </FormField>
      <div className="sm:col-span-2">
        <ActionButtons
          cancelLabel={t('common.clear')}
          onCancel={() => {
            setName('')
            setSlug('')
            form.reset()
          }}
          confirmLabel={t('components.demo.submit')}
          onConfirm={submit}
        />
      </div>
    </FormGrid>
  )
}

function LabelDemo() {
  const { t } = useTranslation()
  const [checked, setChecked] = useState(false)
  return (
    <div className="flex max-w-md flex-col gap-3">
      <div className="grid gap-2">
        <Label htmlFor="gallery-label-input">{t('components.demo.fieldName')}</Label>
        <Input id="gallery-label-input" placeholder={t('components.demo.fieldPlaceholder')} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="gallery-label-check"
          checked={checked}
          onCheckedChange={(value) => setChecked(value === true)}
        />
        <Label htmlFor="gallery-label-check">{t('components.demo.labelCheckbox')}</Label>
      </div>
    </div>
  )
}

function InputDemo() {
  const { t } = useTranslation()
  return (
    <div className="flex max-w-md flex-col gap-3">
      <Input placeholder={t('components.demo.fieldPlaceholder')} />
      <Input type="email" placeholder={t('components.demo.emailPlaceholder')} />
      <Input disabled defaultValue={t('components.demo.inputDisabled')} />
      <Input aria-invalid defaultValue={t('components.demo.inputInvalid')} />
    </div>
  )
}

function TextareaDemo() {
  const { t } = useTranslation()
  return (
    <div className="max-w-md">
      <Textarea rows={3} placeholder={t('components.demo.notesPlaceholder')} />
    </div>
  )
}

function InputGroupDemo() {
  const { t } = useTranslation()
  return (
    <div className="flex max-w-md flex-col gap-3">
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput placeholder={t('components.demo.searchPlaceholder')} />
      </InputGroup>
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="example.com" />
      </InputGroup>
    </div>
  )
}

function SelectDemo() {
  const { t } = useTranslation()
  return (
    <Select defaultValue="active">
      <SelectTrigger className="w-56" aria-label={t('components.demo.statusLabel')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">{t('components.demo.statusActive')}</SelectItem>
        <SelectItem value="paused">{t('components.demo.statusPaused')}</SelectItem>
        <SelectItem value="frozen" disabled>
          {t('components.demo.statusFrozen')}
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

function CheckboxDemo() {
  const { t } = useTranslation()
  const [checked, setChecked] = useState(true)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id="gallery-checkbox"
          checked={checked}
          onCheckedChange={(value) => setChecked(value === true)}
        />
        <Label htmlFor="gallery-checkbox">{t('components.demo.labelCheckbox')}</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="gallery-checkbox-disabled" disabled />
        <Label htmlFor="gallery-checkbox-disabled">{t('components.demo.checkboxDisabled')}</Label>
      </div>
    </div>
  )
}

function SwitchDemo() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3">
      <Switch id="gallery-switch" defaultChecked />
      <Label htmlFor="gallery-switch">{t('components.demo.switchLabel')}</Label>
    </div>
  )
}

/* ============================== 章节装配 ============================== */

const LAYOUT_DEMOS: DemoMap = {
  pageContainer: PageContainerDemo,
  card: CardDemo,
  separator: SeparatorDemo,
  tabs: TabsDemo,
  collapsible: CollapsibleDemo,
}

const ACTIONS_DEMOS: DemoMap = {
  button: ButtonDemo,
  actionBar: ActionBarDemo,
  dropdownMenu: DropdownMenuDemo,
  toggle: ToggleDemo,
}

const FORMS_DEMOS: DemoMap = {
  formField: FormFieldDemo,
  label: LabelDemo,
  input: InputDemo,
  textarea: TextareaDemo,
  inputGroup: InputGroupDemo,
  select: SelectDemo,
  checkbox: CheckboxDemo,
  switch: SwitchDemo,
}

export function LayoutSection() {
  return <GallerySection section="layout" demos={LAYOUT_DEMOS} />
}

export function ActionsSection() {
  return <GallerySection section="actions" demos={ACTIONS_DEMOS} />
}

export function FormsSection() {
  return <GallerySection section="forms" demos={FORMS_DEMOS} />
}
