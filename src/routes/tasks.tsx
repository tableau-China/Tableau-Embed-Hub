import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

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

export const Route = createFileRoute('/tasks')({
  component: TasksPage,
})

const TASKS = [
  { id: 1, task: 'Design landing page', assignee: 'Alice Chen', priority: 'high', status: 'inProgress' },
  { id: 2, task: 'Fix login flow', assignee: 'Bob Martin', priority: 'high', status: 'todo' },
  { id: 3, task: 'Write API docs', assignee: 'Carol White', priority: 'medium', status: 'done' },
  { id: 4, task: 'Review PR #124', assignee: 'Dave Kim', priority: 'low', status: 'inProgress' },
  { id: 5, task: 'Update dependencies', assignee: 'Eve Torres', priority: 'medium', status: 'todo' },
] as const

const PRIORITY_VARIANT = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
} as const

const STATUS_VARIANT = {
  todo: 'outline',
  inProgress: 'default',
  done: 'secondary',
} as const

function TasksPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('tasks.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('tasks.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('tasks.title')}</CardTitle>
          <CardDescription>{t('tasks.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tasks.task')}</TableHead>
                <TableHead>{t('tasks.assignee')}</TableHead>
                <TableHead>{t('tasks.priority')}</TableHead>
                <TableHead>{t('tasks.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TASKS.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.task}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.assignee}
                  </TableCell>
                  <TableCell>
                    <Badge variant={PRIORITY_VARIANT[item.priority]}>
                      {t(`tasks.${item.priority}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[item.status]}>
                      {t(`tasks.${item.status}`)}
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
