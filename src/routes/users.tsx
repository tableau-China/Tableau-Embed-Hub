import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/users')({
  component: UsersPage,
})

const USERS = [
  { id: 1, name: 'Alice Chen', initials: 'AC', email: 'alice@example.com', role: 'Admin', active: true },
  { id: 2, name: 'Bob Martin', initials: 'BM', email: 'bob@example.com', role: 'Editor', active: true },
  { id: 3, name: 'Carol White', initials: 'CW', email: 'carol@example.com', role: 'Viewer', active: false },
  { id: 4, name: 'Dave Kim', initials: 'DK', email: 'dave@example.com', role: 'Editor', active: true },
  { id: 5, name: 'Eve Torres', initials: 'ET', email: 'eve@example.com', role: 'Viewer', active: false },
]

function UsersPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('users.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('users.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('users.title')}</CardTitle>
          <CardDescription>{t('users.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('users.name')}</TableHead>
                <TableHead>{t('users.email')}</TableHead>
                <TableHead>{t('users.role')}</TableHead>
                <TableHead>{t('users.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {USERS.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage src="" alt={user.name} />
                        <AvatarFallback>{user.initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.active ? 'default' : 'outline'}>
                      {user.active ? t('users.active') : t('users.inactive')}
                    </Badge>
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
