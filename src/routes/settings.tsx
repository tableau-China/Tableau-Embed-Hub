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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('settings.subtitle')}</p>
      </div>

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
              <div className="grid gap-2">
                <Label htmlFor="language">{t('settings.language')}</Label>
                <Select defaultValue="en-US">
                  <SelectTrigger id="language" className="w-full md:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">{t('settings.english')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
