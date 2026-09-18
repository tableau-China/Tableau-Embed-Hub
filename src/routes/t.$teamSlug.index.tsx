import { createFileRoute } from '@tanstack/react-router'
import { Activity, ClipboardList, DollarSign, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/t/$teamSlug/')({
  component: DashboardPage,
})

const RECENT_ACTIVITY = [
  { id: 1, name: 'Alice Chen', initials: 'AC', action: 'dashboard.activity.userCreated' },
  { id: 2, name: 'Bob Martin', initials: 'BM', action: 'dashboard.activity.taskCompleted' },
  { id: 3, name: 'Carol White', initials: 'CW', action: 'dashboard.activity.settingsChanged' },
  { id: 4, name: 'Dave Kim', initials: 'DK', action: 'dashboard.activity.login' },
]

function DashboardPage() {
  const { t } = useTranslation()

  const stats = [
    { label: t('dashboard.totalUsers'), value: '2,431', icon: Users },
    { label: t('dashboard.activeTasks'), value: '128', icon: ClipboardList },
    { label: t('dashboard.revenue'), value: '$48,290', icon: DollarSign },
    { label: t('dashboard.uptime'), value: '99.98%', icon: Activity },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
          <CardDescription>{t('dashboard.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RECENT_ACTIVITY.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage src="" alt={item.name} />
                        <AvatarFallback>{item.initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t(item.action)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
