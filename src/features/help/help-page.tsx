import { useTranslation } from 'react-i18next'
import {
  Building2,
  CircleHelp,
  Copyright,
  FlaskConical,
  Globe,
  Languages,
  Layers,
  Mail,
  MonitorPlay,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import { ConfigStatusCard } from '@/components/config-status-card'
import { DescriptionList } from '@/components/description-list'
import { NoteCallout } from '@/components/note-callout'
import { PageContainer } from '@/components/page-container'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  APP_AUTHOR,
  APP_LICENSE,
  APP_NAME,
  APP_STACK,
  APP_VERSION,
  APP_WEBSITE,
  APP_WEBSITE_LABEL,
} from '@/config/app'
import { THIRD_PARTY_NOTICES } from '@/config/third-party'

/**
 * 帮助页 `/help`（跨团队页面，无 slug）——「这个模板能做什么 + 谁做的 + 什么版本 + 用了谁的代码」。
 *
 * 四块内容对应四个问题：
 *   1. **核心功能**：本版真正落地了什么（不是路线图），每条都指向对应页面；
 *   2. **开发者 / 版本**：`src/config/app.ts` 是应用元信息的唯一来源（不在这里写死第二份，
 *      否则版本号会出现两个真相）；
 *   3. **边界提醒**：纯前端模板的安全边界与文档入口 —— 接手的人最容易在这里踩坑；
 *   4. **第三方版权**：随构建产物一起分发的第三方组件、许可与版权所有者（含商标归属）。
 *      数据来自 `src/config/third-party.ts`，与仓库根目录的 `THIRD-PARTY.md` 同源同改。
 *
 * 版面与其他页面一致（`<PageContainer>` 铺满内容区）；宽屏下让内容**用满**宽度
 * （功能网格 4 列、文档 3 列、技术栈为徽章流），只有键值摘要与长段落收在可读宽度内。
 */

/**
 * 核心功能条目（id 对应 i18n 的 `help.feature.<id>.title|body`，顺序即展示顺序）。
 *
 * ⚠️ 这里只列**公开线（main）真实存在**的功能。内部功能（FOC / AMRO / clean-layer 图集）只在
 * custom 分支有页面与文档，**不要写进本数组** —— 否则公开模板的 Help 页会宣传不存在的页面，
 * 并把内部代号漏出去（路径守卫只管路径，管不住文案）。custom 分支自行维护自己的那份列表。
 */
const FEATURES: readonly { id: string; Icon: LucideIcon }[] = [
  { id: 'teams', Icon: Building2 },
  { id: 'permissions', Icon: ShieldCheck },
  { id: 'tableau', Icon: MonitorPlay },
  { id: 'config', Icon: Mail },
  { id: 'profile', Icon: UserRound },
  { id: 'i18n', Icon: Languages },
  { id: 'quality', Icon: FlaskConical },
]

/** 文档入口（id 对应 i18n 的 `help.docs.<id>.path|body`）—— 同样只放 main 上确实存在的文件 */
const DOCS = ['tableau', 'ai', 'permissions', 'checks'] as const

export function HelpPage() {
  const { t } = useTranslation()

  return (
    <PageContainer>
      {/* ============================ 关于 ============================ */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <CircleHelp className="size-4" />
                {APP_NAME}
              </CardTitle>
              <CardDescription>{t('help.aboutSubtitle')}</CardDescription>
            </div>
            {/* 版本号唯一来源：src/config/app.ts（与 package.json / CHANGELOG / PROGRESS 同源） */}
            <Badge variant="outline" data-help-version>
              v{APP_VERSION}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground max-w-prose text-sm">{t('help.aboutBody')}</p>
          <Separator />
          <DescriptionList
            items={[
              { label: t('help.developer'), value: APP_AUTHOR },
              {
                label: t('help.website'),
                value: (
                  <a
                    href={APP_WEBSITE}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline underline-offset-4"
                    data-help-website
                  >
                    {APP_WEBSITE_LABEL}
                  </a>
                ),
                icon: <Globe className="size-3.5" />,
              },
              {
                label: t('help.version'),
                value: `v${APP_VERSION}`,
                icon: <CircleHelp className="size-3.5" />,
              },
              {
                label: t('help.license'),
                value: APP_LICENSE,
                icon: <ShieldCheck className="size-3.5" />,
              },
            ]}
          />
        </CardContent>
      </Card>

      {/* ============================ 环境自检 ============================ */}
      {/* clone 之后第一个问题「我现在连的是谁的站点」在这里回答；配置项见 .env.example */}
      <ConfigStatusCard />

      {/* ============================ 核心功能 ============================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-4" />
            {t('help.featuresTitle')}
          </CardTitle>
          <CardDescription>{t('help.featuresSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 宽屏 4 列（7 条 = 两行，末行留白）、窄屏 2 列 → 内容用满页面宽度 */}
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" data-help-features>
            {FEATURES.map(({ id, Icon }) => (
              <li key={id} className="flex gap-3" data-help-feature={id}>
                <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                {/* min-w-0：让长句在栅格单元里换行，而不是把单元顶宽 */}
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{t(`help.feature.${id}.title`)}</span>
                  <p className="text-muted-foreground text-xs">{t(`help.feature.${id}.body`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ============================ 技术栈（徽章流，宽屏自然铺满） ============================ */}
      <Card>
        <CardHeader>
          <CardTitle>{t('help.stackTitle')}</CardTitle>
          <CardDescription>{t('help.stackSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-2" data-help-stack>
            {APP_STACK.map((item) => (
              <li key={item.name}>
                <Badge variant="outline" className="gap-1.5 font-normal">
                  {item.name}
                  <span className="text-muted-foreground">{item.version}</span>
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ============================ 下一步看哪里 ============================ */}
      <Card>
        <CardHeader>
          <CardTitle>{t('help.docsTitle')}</CardTitle>
          <CardDescription>{t('help.docsSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="grid gap-4 sm:grid-cols-2">
            {DOCS.map((doc) => (
              <li key={doc} className="flex min-w-0 flex-col gap-1">
                <code className="text-xs font-medium break-all">{t(`help.docs.${doc}.path`)}</code>
                <span className="text-muted-foreground text-xs">{t(`help.docs.${doc}.body`)}</span>
              </li>
            ))}
          </ul>

          <NoteCallout tone="warning" title={t('help.securityTitle')}>
            <p className="text-muted-foreground max-w-prose">{t('help.securityNote')}</p>
          </NoteCallout>
        </CardContent>
      </Card>
      {/* ============================ 第三方版权 ============================ */}
      {/* 这一块是**发行物自带的版权说明**：不能只在仓库的 THIRD-PARTY.md 里写 —— 别人拿到的是
          构建产物，页面上必须自己能说清「里面有哪些第三方代码、什么许可、版权归谁」。 */}
      <Card data-help-third-party-card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copyright className="size-4" />
            {t('help.thirdPartyTitle')}
          </CardTitle>
          <CardDescription>{t('help.thirdPartySubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground max-w-prose text-sm">{t('help.thirdPartyIntro')}</p>

          {/* 表格：版权字段可能很长 → 显式 whitespace-normal，否则 TableCell 的默认 nowrap 会顶宽页面 */}
          <Table data-help-third-party>
            <TableHeader>
              <TableRow>
                <TableHead>{t('help.thirdPartyColName')}</TableHead>
                <TableHead>{t('help.thirdPartyColLicense')}</TableHead>
                <TableHead>{t('help.thirdPartyColCopyright')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {THIRD_PARTY_NOTICES.map((notice) => (
                <TableRow key={notice.name} data-help-third-party-row={notice.name}>
                  <TableCell className="font-medium whitespace-normal">{notice.name}</TableCell>
                  <TableCell>
                    <Badge variant={notice.caution ? 'destructive' : 'outline'} className="font-normal">
                      {notice.license}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-normal">
                    {notice.copyright}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <NoteCallout tone="warning" title={t('help.thirdPartyCautionTitle')}>
            <p className="text-muted-foreground max-w-prose">{t('help.thirdPartyCaution')}</p>
          </NoteCallout>

          <Separator />

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('help.trademarkTitle')}</span>
            <p className="text-muted-foreground max-w-prose text-xs" data-help-trademark>
              {t('help.trademarkBody')}
            </p>
          </div>

          <p className="text-muted-foreground max-w-prose text-xs">{t('help.thirdPartyMore')}</p>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
