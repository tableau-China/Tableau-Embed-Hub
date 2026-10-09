import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Info, RefreshCw, SearchX } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DescriptionList } from '@/components/description-list'
import { FilterBar, FilterSearch, FilterSelect } from '@/components/filter-bar'
import { ListState } from '@/components/list-state'
import { NoteCallout } from '@/components/note-callout'
import { PageContainer } from '@/components/page-container'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useListFilters } from '@/hooks/use-list-filters'
import { workbookRefQueryOptions } from '@/lib/tableau-api'
import {
  backgroundJobsQueryOptions,
  extractRefreshTasksQueryOptions,
  jobDetailQueryOptions,
  subscriptionsQueryOptions,
} from '@/lib/tableau-tasks-api'
import {
  formatDuration,
  jobStatusLabelKey,
  jobStatusTier,
  jobTypeLabelKey,
  sortJobsNewestFirst,
  type BackgroundJob,
  type ExtractRefreshTask,
  type JobStatusTier,
} from '@/lib/tableau-tasks'
import { formatDateTime } from '@/lib/utils'
import { useCadenceText } from '@/features/tableau/use-cadence-text'

/**
 * Tableau **定时计划与运行情况**页（/t/{slug}/tableau/schedules）
 *
 * 三个数据源（全部只读，全部来自 Tableau Cloud）：
 *   1. 提取刷新任务 —— "计划了什么"（含频率与下次运行；Tableau Cloud 没有 /schedules 端点，
 *      计划信息只能从这里内联的 schedule 节点读）；
 *   2. 后台作业     —— "最近跑成什么样"（状态、耗时；对象名要展开行才去取详情）；
 *   3. 订阅计划     —— "还在定时发什么邮件"。
 *
 * 页面刻意**不加时间窗、不截断条数**：作业保留多久由 Tableau 决定（官方 REST 引用页未承诺
 * 任何保留期），自己叠一个"只看最近 N 天"会让人把"看不到"误读成"没发生过"。
 */

interface TaskFilterValues extends Record<string, string> {
  q: string
}

interface JobFilterValues extends Record<string, string> {
  q: string
  status: string
  type: string
}

const TASK_FILTER_DEFAULTS: TaskFilterValues = { q: '' }
const JOB_FILTER_DEFAULTS: JobFilterValues = { q: '', status: 'all', type: 'all' }

/** 作业状态等级 → 徽章配色（等级判断在 lib/tableau-tasks.ts，这里只做映射） */
const JOB_STATUS_VARIANT: Record<JobStatusTier, 'default' | 'destructive' | 'secondary' | 'outline'> =
  {
    success: 'default',
    failed: 'destructive',
    running: 'secondary',
    neutral: 'outline',
  }

export function TableauSchedulesPage() {
  const { t } = useTranslation()
  const cadenceText = useCadenceText()

  const tasksQuery = useQuery(extractRefreshTasksQueryOptions())
  const jobsQuery = useQuery(backgroundJobsQueryOptions())
  const subsQuery = useQuery(subscriptionsQueryOptions())

  // 服务端不保证作业顺序（实测是按 createdAt 升序），这里统一成"最近的在最前"
  const jobs = useMemo(() => sortJobsNewestFirst(jobsQuery.data ?? []), [jobsQuery.data])
  // 兜底空数组一律 memo 化：`data ?? []` 每次渲染都是新数组，会让下游 useMemo 每次重算
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data])
  const subscriptions = useMemo(() => subsQuery.data ?? [], [subsQuery.data])

  /**
   * 任务里的 workbookId → 名字：**按 id 逐条解析**，不查 workbooks 列表
   * （列表带项目过滤，任务指向的内容可能不在该项目里；理由见 workbookRefQueryOptions）。
   * useQueries 按 queryKey 自动去重：同一 workbook 出现在多个任务里只请求一次。
   */
  const workbookIds = [
    ...new Set(tasks.map((task) => task.workbookId).filter((id): id is string => Boolean(id))),
  ]
  const workbookQueries = useQueries({
    queries: workbookIds.map((workbookId) => workbookRefQueryOptions(workbookId)),
  })
  const workbookNames = new Map<string, string>()
  workbookIds.forEach((workbookId, index) => {
    const name = workbookQueries[index]?.data?.name
    if (name) workbookNames.set(workbookId, name)
  })

  const taskFilters = useListFilters(TASK_FILTER_DEFAULTS)
  const jobFilters = useListFilters(JOB_FILTER_DEFAULTS)

  // 只按 id 匹配：名字是异步解析出来的，把它放进依赖会让筛选在名字到达时重算一次，
  // 而"搜内容 id"本来就是这一栏的语义（占位文案也这么写）
  const visibleTasks = useMemo(() => {
    const needle = taskFilters.values.q.trim().toLowerCase()
    if (needle === '') return tasks
    return tasks.filter((task) =>
      [task.id, task.workbookId ?? '', task.datasourceId ?? ''].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    )
  }, [tasks, taskFilters.values.q])

  const visibleJobs = useMemo(() => {
    const needle = jobFilters.values.q.trim().toLowerCase()
    return jobs.filter((job) => {
      if (jobFilters.values.status !== 'all' && job.status !== jobFilters.values.status) return false
      if (jobFilters.values.type !== 'all' && job.jobType !== jobFilters.values.type) return false
      if (needle !== '' && !job.id.toLowerCase().includes(needle) && !job.jobType.toLowerCase().includes(needle)) {
        return false
      }
      return true
    })
  }, [jobs, jobFilters.values.q, jobFilters.values.status, jobFilters.values.type])

  /** 状态/类型文案（未知取值原样显示 Tableau 的返回值） */
  const statusText = (status: string) => {
    const key = jobStatusLabelKey(status)
    return key ? t(key) : status
  }
  const typeText = (jobType: string) => {
    const key = jobTypeLabelKey(jobType)
    return key ? t(key) : jobType
  }

  // 下拉选项由**数据里出现过的取值**生成，不预置词汇表：Tableau 没承诺过状态/类型的全集
  const statusOptions = [...new Set(jobs.map((job) => job.status))]
    .filter((value) => value !== '')
    .map((value) => ({ value, label: statusText(value) }))
  const typeOptions = [...new Set(jobs.map((job) => job.jobType))]
    .filter((value) => value !== '')
    .map((value) => ({ value, label: typeText(value) }))

  const syncing =
    tasksQuery.isFetching ||
    jobsQuery.isFetching ||
    subsQuery.isFetching ||
    workbookQueries.some((query) => query.isFetching)
  const lastSyncedAt = Math.max(
    tasksQuery.dataUpdatedAt,
    jobsQuery.dataUpdatedAt,
    subsQuery.dataUpdatedAt,
  )
  const syncAll = () =>
    void Promise.all([
      tasksQuery.refetch(),
      jobsQuery.refetch(),
      subsQuery.refetch(),
      ...workbookQueries.map((query) => query.refetch()),
    ])

  return (
    <PageContainer>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle>{t('tableauSchedules.title')}</CardTitle>
              <CardDescription>{t('tableauSchedules.subtitle')}</CardDescription>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Button
                variant="outline"
                size="sm"
                data-tableau-sync="schedules"
                disabled={syncing}
                onClick={syncAll}
              >
                <RefreshCw className={syncing ? 'animate-spin' : undefined} />
                {t('tableauSchedules.sync')}
              </Button>
              {lastSyncedAt > 0 && (
                <span className="text-muted-foreground text-xs">
                  {t('tableauSchedules.lastSynced', {
                    time: formatDateTime(new Date(lastSyncedAt).toISOString()),
                  })}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <NoteCallout
            tone="info"
            title={
              <span className="flex items-center gap-1.5">
                <Info className="size-3.5 shrink-0" />
                {t('tableauSchedules.boundaryTitle')}
              </span>
            }
          >
            <p className="text-muted-foreground max-w-prose">
              {t('tableauSchedules.boundaryBody')}
            </p>
          </NoteCallout>
        </CardContent>
      </Card>

      {/* ---------------- 1. 提取刷新任务 ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t('tableauSchedules.extractTitle')}</CardTitle>
          <CardDescription>{t('tableauSchedules.extractSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length > 0 && (
            <FilterBar
              className="mb-4"
              activeCount={taskFilters.activeCount}
              onReset={taskFilters.reset}
              shown={visibleTasks.length}
              total={tasks.length}
            >
              <FilterSearch
                id="tableau-task-filter-search"
                value={taskFilters.values.q}
                onChange={(value) => taskFilters.set('q', value)}
                placeholder={t('tableauSchedules.extractSearchPlaceholder')}
              />
            </FilterBar>
          )}
          <ListState
            status={tasksQuery.status}
            isEmpty={tasks.length === 0}
            emptyMessage={t('tableauSchedules.extractEmpty')}
            errorTitle={t('tableauSchedules.loadFailed')}
            errorHint={t('tableauSchedules.loadFailedHint')}
            retryLabel={t('tableauSchedules.sync')}
            onRetry={() => void tasksQuery.refetch()}
          >
            <Table data-tableau-extract-tasks>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tableauSchedules.colObject')}</TableHead>
                  <TableHead>{t('tableauSchedules.colCadence')}</TableHead>
                  <TableHead>{t('tableauSchedules.colNextRun')}</TableHead>
                  <TableHead>{t('tableauSchedules.colFailures')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTasks.length === 0 && (
                  <TableRow data-tableau-tasks-empty="filtered">
                    <TableCell colSpan={4} className="py-8">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <SearchX className="text-muted-foreground size-6" />
                        <span className="text-muted-foreground text-sm">
                          {t('tableauSchedules.extractNoMatch')}
                        </span>
                        <Button variant="outline" size="sm" onClick={taskFilters.reset}>
                          {t('filters.clearAll')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {visibleTasks.map((task) => (
                  <TableRow key={task.id} data-tableau-task={task.id}>
                    <TableCell>
                      <TaskContentCell task={task} workbookNames={workbookNames} />
                    </TableCell>
                    <TableCell className="text-sm">{cadenceText(task.schedule)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(task.schedule.nextRunAt)}
                    </TableCell>
                    <TableCell>
                      {task.consecutiveFailedCount > 0 ? (
                        <Badge variant="destructive">
                          {t('tableauSchedules.consecutiveFailures', {
                            count: task.consecutiveFailedCount,
                          })}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ListState>
        </CardContent>
      </Card>

      {/* ---------------- 2. 后台作业 ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t('tableauSchedules.jobsTitle')}</CardTitle>
          <CardDescription>{t('tableauSchedules.jobsSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length > 0 && (
            <FilterBar
              className="mb-4"
              activeCount={jobFilters.activeCount}
              onReset={jobFilters.reset}
              shown={visibleJobs.length}
              total={jobs.length}
            >
              <FilterSearch
                id="tableau-job-filter-search"
                value={jobFilters.values.q}
                onChange={(value) => jobFilters.set('q', value)}
                placeholder={t('tableauSchedules.jobsSearchPlaceholder')}
              />
              <FilterSelect
                id="tableau-job-filter-status"
                label={t('tableauSchedules.filterStatus')}
                value={jobFilters.values.status}
                onChange={(value) => jobFilters.set('status', value)}
                options={statusOptions}
              />
              <FilterSelect
                id="tableau-job-filter-type"
                label={t('tableauSchedules.filterJobType')}
                value={jobFilters.values.type}
                onChange={(value) => jobFilters.set('type', value)}
                options={typeOptions}
              />
            </FilterBar>
          )}
          <ListState
            status={jobsQuery.status}
            isEmpty={jobs.length === 0}
            emptyMessage={t('tableauSchedules.jobsEmpty')}
            errorTitle={t('tableauSchedules.loadFailed')}
            errorHint={t('tableauSchedules.loadFailedHint')}
            retryLabel={t('tableauSchedules.sync')}
            onRetry={() => void jobsQuery.refetch()}
          >
            <Table data-tableau-jobs>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" aria-label={t('tableauSchedules.expandJob')} />
                  <TableHead>{t('tableauSchedules.colStatus')}</TableHead>
                  <TableHead>{t('tableauSchedules.colType')}</TableHead>
                  <TableHead>{t('tableauSchedules.colStarted')}</TableHead>
                  <TableHead>{t('tableauSchedules.colDuration')}</TableHead>
                  <TableHead>{t('tableauSchedules.colJob')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleJobs.length === 0 && (
                  <TableRow data-tableau-jobs-empty="filtered">
                    <TableCell colSpan={6} className="py-8">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <SearchX className="text-muted-foreground size-6" />
                        <span className="text-muted-foreground text-sm">
                          {t('tableauSchedules.jobsNoMatch')}
                        </span>
                        <Button variant="outline" size="sm" onClick={jobFilters.reset}>
                          {t('filters.clearAll')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {visibleJobs.map((job) => (
                  <JobRow key={job.id} job={job} statusText={statusText} typeText={typeText} />
                ))}
              </TableBody>
            </Table>
          </ListState>
        </CardContent>
      </Card>

      {/* ---------------- 3. 订阅计划 ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t('tableauSchedules.subsTitle')}</CardTitle>
          <CardDescription>{t('tableauSchedules.subsSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ListState
            status={subsQuery.status}
            isEmpty={subscriptions.length === 0}
            emptyMessage={t('tableauSchedules.subsEmpty')}
            errorTitle={t('tableauSchedules.loadFailed')}
            errorHint={t('tableauSchedules.loadFailedHint')}
            retryLabel={t('tableauSchedules.sync')}
            onRetry={() => void subsQuery.refetch()}
          >
            <Table data-tableau-subscriptions>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tableauSchedules.colSubject')}</TableHead>
                  <TableHead>{t('tableauSchedules.colRecipient')}</TableHead>
                  <TableHead>{t('tableauSchedules.colCadence')}</TableHead>
                  <TableHead>{t('tableauSchedules.colNextRun')}</TableHead>
                  <TableHead>{t('tableauSchedules.colSuspended')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <TableRow key={subscription.id} data-tableau-subscription={subscription.id}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{subscription.subject ?? '—'}</span>
                        {subscription.message && (
                          <span className="text-muted-foreground truncate text-xs">
                            {subscription.message}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {subscription.userName ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">{cadenceText(subscription.schedule)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(subscription.schedule.nextRunAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={subscription.suspended ? 'outline' : 'secondary'}>
                        {subscription.suspended
                          ? t('tableauSchedules.suspended')
                          : t('tableauSchedules.active')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ListState>
        </CardContent>
      </Card>
    </PageContainer>
  )
}

/** 提取任务的"内容"列：workbookId → 名字（解析不到就显示 id，并说明原因） */
function TaskContentCell({
  task,
  workbookNames,
}: {
  task: ExtractRefreshTask
  workbookNames: Map<string, string>
}) {
  const { t } = useTranslation()
  const contentId = task.workbookId ?? task.datasourceId ?? ''
  const name = task.workbookId ? workbookNames.get(task.workbookId) : undefined
  if (name) return <span className="font-medium">{name}</span>
  return (
    <span
      className="text-muted-foreground font-mono text-xs"
      title={t('tableauSchedules.objectUnresolved')}
    >
      {contentId || '—'}
    </span>
  )
}

/**
 * 后台作业行 + 可展开的详情。
 *
 * 详情**按需取**（GET /sites/{id}/jobs/{job-id}）：列表行里没有作业对象名，
 * 逐行预取就是 N+1 次请求。展开时才发一次，结果由 Query 缓存（收起再展开不重发）。
 */
function JobRow({
  job,
  statusText,
  typeText,
}: {
  job: BackgroundJob
  statusText: (status: string) => string
  typeText: (jobType: string) => string
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const detailQuery = useQuery({ ...jobDetailQueryOptions(job.id), enabled: expanded })

  return (
    <>
      <TableRow data-tableau-job={job.id}>
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            data-tableau-job-toggle={job.id}
            aria-expanded={expanded}
            aria-label={expanded ? t('tableauSchedules.collapseJob') : t('tableauSchedules.expandJob')}
            title={expanded ? t('tableauSchedules.collapseJob') : t('tableauSchedules.expandJob')}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </TableCell>
        <TableCell>
          <Badge variant={JOB_STATUS_VARIANT[jobStatusTier(job.status)]}>
            {statusText(job.status)}
          </Badge>
        </TableCell>
        <TableCell className="text-sm">{typeText(job.jobType)}</TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {formatDateTime(job.startedAt ?? job.createdAt)}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm tabular-nums">
          {formatDuration(job.startedAt, job.endedAt)}
        </TableCell>
        <TableCell className="text-muted-foreground max-w-64 truncate font-mono text-xs">
          {job.id}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow data-tableau-job-detail={job.id}>
          <TableCell colSpan={6} className="bg-muted/30">
            <ListState
              status={detailQuery.status}
              errorTitle={t('tableauSchedules.detailFailed')}
              loadingClassName="py-4"
              onRetry={() => void detailQuery.refetch()}
            >
              <DescriptionList
                columns={3}
                className="max-w-none py-1"
                items={[
                  {
                    label: t('tableauSchedules.detailObject'),
                    value: detailQuery.data?.objectName ?? '—',
                  },
                  {
                    label: t('tableauSchedules.detailObjectKind'),
                    value: detailQuery.data?.objectKind ?? '—',
                  },
                  {
                    label: t('tableauSchedules.detailProgress'),
                    value: detailQuery.data?.progress ? `${detailQuery.data.progress}%` : '—',
                  },
                  {
                    label: t('tableauSchedules.detailFinishCode'),
                    value: detailQuery.data?.finishCode ?? '—',
                  },
                  {
                    label: t('tableauSchedules.detailCreated'),
                    value: formatDateTime(detailQuery.data?.createdAt),
                  },
                  {
                    label: t('tableauSchedules.detailCompleted'),
                    value: formatDateTime(detailQuery.data?.completedAt),
                  },
                ]}
              />
            </ListState>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
