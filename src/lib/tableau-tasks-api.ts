import { queryOptions } from '@tanstack/react-query'

import {
  apiGet,
  fetchAllPages,
  getAccessToken,
  TABLEAU_PAGE_SIZE,
  tableauRetry,
  type TableauPage,
} from '@/lib/tableau-rest'
import {
  parseBackgroundJob,
  parseExtractRefreshTask,
  parseJobDetail,
  parseSubscription,
  type BackgroundJob,
  type BackgroundJobDetail,
  type ExtractRefreshSubscription,
  type ExtractRefreshTask,
} from '@/lib/tableau-tasks'

/**
 * Tableau **定时计划与后台作业**（REST 能力域 `site-tasks`）。
 *
 * 三个数据源，各自一条 Query（刷新按钮一次性 refetch 三条）：
 *   · 提取刷新任务 GET /sites/{siteId}/tasks/extractRefreshes —— "计划了什么"
 *   · 后台作业     GET /sites/{siteId}/jobs                   —— "跑成什么样"
 *   · 订阅计划     GET /sites/{siteId}/subscriptions          —— "还在定时发什么"
 *
 * 为什么不用 `/schedules`：Tableau Cloud **不提供**该端点（实测 403 "此站点不支持管理员计划"），
 * 计划信息只能从提取刷新任务里内联的 schedule 节点读（见 lib/tableau-tasks.ts）。
 */

export const EXTRACT_TASKS_QUERY_KEY = ['tableau', 'extract-tasks'] as const
export const JOBS_QUERY_KEY = ['tableau', 'jobs'] as const
export const SUBSCRIPTIONS_QUERY_KEY = ['tableau', 'subscriptions'] as const

interface TasksBody {
  tasks?: { task?: Record<string, unknown>[] }
  pagination?: TableauPage<unknown>['pagination']
}

/** 站点全部提取刷新任务（自动翻页） */
export async function fetchExtractRefreshTasks(): Promise<ExtractRefreshTask[]> {
  const { siteId } = await getAccessToken('site-tasks')
  return fetchAllPages<ExtractRefreshTask>(
    'site-tasks',
    (page) =>
      `/sites/${siteId}/tasks/extractRefreshes?pageSize=${TABLEAU_PAGE_SIZE}&pageNumber=${page}`,
    (body) => {
      const data = body as TasksBody
      return { rows: (data.tasks?.task ?? []).map(parseExtractRefreshTask), pagination: data.pagination }
    },
  )
}

interface JobsBody {
  backgroundJobs?: { backgroundJob?: Record<string, unknown>[] }
  pagination?: TableauPage<unknown>['pagination']
}

/**
 * 站点后台作业（自动翻页）。
 *
 * ⚠️ 保留窗口由 Tableau 决定，官方 REST 引用页没有承诺任何时间范围
 * （Server 后台的 Jobs 页面只展示最近 24 小时统计，那是 UI 不是 API 契约）。
 * 因此本应用**不自加时间窗、也不过滤**：服务端给什么就展示什么 —— 少猜一个阈值，
 * 就少一次"为什么看不到上周的失败"。
 */
export async function fetchBackgroundJobs(): Promise<BackgroundJob[]> {
  const { siteId } = await getAccessToken('site-tasks')
  return fetchAllPages<BackgroundJob>(
    'site-tasks',
    (page) => `/sites/${siteId}/jobs?pageSize=${TABLEAU_PAGE_SIZE}&pageNumber=${page}`,
    (body) => {
      const data = body as JobsBody
      return {
        rows: (data.backgroundJobs?.backgroundJob ?? []).map(parseBackgroundJob),
        pagination: data.pagination,
      }
    },
  )
}

interface SubscriptionsBody {
  // 空站点回的是 \`"subscriptions": {}\`，所以这里每一层都要按"可能没有"处理
  subscriptions?: { subscription?: Record<string, unknown>[] }
  pagination?: TableauPage<unknown>['pagination']
}

export async function fetchSubscriptions(): Promise<ExtractRefreshSubscription[]> {
  const { siteId } = await getAccessToken('site-tasks')
  return fetchAllPages<ExtractRefreshSubscription>(
    'site-tasks',
    (page) => `/sites/${siteId}/subscriptions?pageSize=${TABLEAU_PAGE_SIZE}&pageNumber=${page}`,
    (body) => {
      const data = body as SubscriptionsBody
      return {
        rows: (data.subscriptions?.subscription ?? []).map(parseSubscription),
        pagination: data.pagination,
      }
    },
  )
}

/**
 * 单个作业详情（含作业对象名——列表里没有）。
 *
 * 为什么按需取：列表行不带对象名，只有详情有（runFlowJobType.flow.name 之类）。
 * 逐行预取会变成 N+1 次请求；这里只在用户展开某一行时才发一次，并由 Query 缓存住。
 */
export async function fetchJobDetail(jobId: string): Promise<BackgroundJobDetail> {
  const { siteId } = await getAccessToken('site-tasks')
  const body = await apiGet<Record<string, unknown>>('site-tasks', `/sites/${siteId}/jobs/${jobId}`)
  return parseJobDetail(body)
}

export function extractRefreshTasksQueryOptions() {
  return queryOptions({
    queryKey: EXTRACT_TASKS_QUERY_KEY,
    queryFn: fetchExtractRefreshTasks,
    retry: tableauRetry,
  })
}

export function backgroundJobsQueryOptions() {
  return queryOptions({
    queryKey: JOBS_QUERY_KEY,
    queryFn: fetchBackgroundJobs,
    retry: tableauRetry,
  })
}

export function subscriptionsQueryOptions() {
  return queryOptions({
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    queryFn: fetchSubscriptions,
    retry: tableauRetry,
  })
}

export function jobDetailQueryOptions(jobId: string) {
  return queryOptions({
    queryKey: ['tableau', 'job', jobId] as const,
    queryFn: () => fetchJobDetail(jobId),
    retry: tableauRetry,
  })
}
