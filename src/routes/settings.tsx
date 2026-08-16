import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t('settings.profile')}</TabsTrigger>
          <TabsTrigger value="general">{t('settings.general')}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.profile')}</CardTitle>
              <CardDescription>{t('settings.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="display-name">{t('settings.displayName')}</Label>
                <Input id="display-name" placeholder={t('settings.displayNamePlaceholder')} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">{t('settings.email')}</Label>
                <Input id="email" type="email" placeholder={t('settings.emailPlaceholder')} />
              </div>
              {/* 语言选择已移至 Header 右上角（LanguageToggle），见 components/language-toggle.tsx */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="text-sm font-medium">{t('settings.notifications')}</div>
                  <div className="text-muted-foreground text-sm">
                    {t('settings.notificationsHint')}
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
              <div>
                <Button onClick={() => toast.success(t('settings.saved'))}>
                  {t('settings.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.general')}</CardTitle>
              <CardDescription>{t('settings.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <Input id="workspace-name" placeholder="shadcn-admin" />
              </div>
              <div>
                <Button onClick={() => toast.success(t('settings.saved'))}>
                  {t('settings.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
