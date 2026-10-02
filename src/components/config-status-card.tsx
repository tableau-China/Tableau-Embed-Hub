import { useTranslation } from 'react-i18next'
import { Bot, FlaskConical, MonitorPlay, PlugZap, Route } from 'lucide-react'

import { DescriptionList } from '@/components/description-list'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AI_CONFIG, AI_USING_DEMO_PROVIDER } from '@/lib/ai'
import {
  TABLEAU_CONFIG,
  TABLEAU_USING_DEMO_CREDENTIALS,
  TABLEAU_USING_DEMO_SITE,
} from '@/config/tableau'

/**
 * 环境自检卡（放在 /help）—— 回答 clone 之后的第一个问题：**我现在连的是谁的站点？**
 *
 * 存在的理由：站点绑定现在全部走 `.env`（见 `src/config/tableau.ts` 与 `.env.example`），
 * 但"配了没有 / 值对不对"在界面上原本没有任何反馈 —— 新人只会看到"只有两个工作簿"这类
 * 难以归因的现象。这里把**实际生效的值**直接摊开：站点、凭据来源、项目过滤、代理路径。
 *
 * 不显示任何凭据内容本身（只显示"来源"），避免把密钥二次暴露在界面上。
 */
export function ConfigStatusCard() {
  const { t } = useTranslation()

  /** 只取主机名用于展示；配置写错时不要把整页炸掉 */
  function hostOf(url: string): string {
    try {
      return new URL(url).host
    } catch {
      return url
    }
  }

  const site = `${hostOf(TABLEAU_CONFIG.serverUrl)} · ${TABLEAU_CONFIG.siteContentUrl}`
  const project = TABLEAU_CONFIG.restrictedProjectName

  return (
    <Card data-config-card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlugZap className="size-4" />
          {t('help.config.title')}
        </CardTitle>
        <CardDescription>{t('help.config.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <DescriptionList
          columns={2}
          items={[
            {
              label: t('help.config.tableauSite'),
              icon: <MonitorPlay className="size-3.5" />,
              value: (
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span data-config-tableau-site>{site}</span>
                  <Badge
                    variant={TABLEAU_USING_DEMO_SITE ? 'secondary' : 'default'}
                    data-config-tableau-site-source={TABLEAU_USING_DEMO_SITE ? 'demo' : 'own'}
                  >
                    {TABLEAU_USING_DEMO_SITE ? t('help.config.demoSite') : t('help.config.ownSite')}
                  </Badge>
                </span>
              ),
            },
            {
              label: t('help.config.tableauCredentials'),
              icon: <FlaskConical className="size-3.5" />,
              value: (
                <Badge
                  variant={TABLEAU_USING_DEMO_CREDENTIALS ? 'secondary' : 'default'}
                  data-config-tableau-credentials={
                    TABLEAU_USING_DEMO_CREDENTIALS ? 'demo' : 'env'
                  }
                >
                  {TABLEAU_USING_DEMO_CREDENTIALS
                    ? t('help.config.demoCredentials')
                    : t('help.config.envCredentials')}
                </Badge>
              ),
            },
            {
              label: t('help.config.projectFilter'),
              value: (
                <span data-config-tableau-project={project ?? 'all'}>
                  {project
                    ? t('help.config.projectLimited', { project })
                    : t('help.config.projectAll')}
                </span>
              ),
            },
            {
              label: t('help.config.apiProxy'),
              icon: <Route className="size-3.5" />,
              value: <span data-config-tableau-proxy>{TABLEAU_CONFIG.apiBaseUrl}</span>,
            },
            {
              label: t('help.config.aiProvider'),
              icon: <Bot className="size-3.5" />,
              value: (
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <Badge
                    variant={AI_USING_DEMO_PROVIDER ? 'secondary' : 'default'}
                    data-config-ai-provider={AI_USING_DEMO_PROVIDER ? 'demo' : 'proxy'}
                  >
                    {AI_USING_DEMO_PROVIDER ? t('help.config.aiDemo') : t('help.config.aiProxy')}
                  </Badge>
                  <span className="text-muted-foreground" data-config-ai-model>
                    {AI_USING_DEMO_PROVIDER ? '—' : `${AI_CONFIG.model} · ${AI_CONFIG.proxyUrl}`}
                  </span>
                </span>
              ),
            },
          ]}
        />
        <p className="text-muted-foreground max-w-prose text-sm">{t('help.config.hint')}</p>
      </CardContent>
    </Card>
  )
}
