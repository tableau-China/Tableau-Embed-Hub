import { describe, expect, it } from 'vitest'

import common from '@/i18n/locales/en-US/common.json'
import {
  JOB_STATUS_LABEL_KEYS,
  JOB_TYPE_LABEL_KEYS,
  WEEKDAY_LABEL_KEYS,
  describeCadence,
  formatClock,
  formatDuration,
  jobStatusLabelKey,
  jobStatusTier,
  jobTypeLabelKey,
  parseBackgroundJob,
  parseExtractRefreshTask,
  parseJobDetail,
  parseSchedule,
  parseSubscription,
  sortJobsNewestFirst,
} from './tableau-tasks'

/**
 * 定时计划领域逻辑的纯函数用例。
 *
 * 夹具全部是**真实响应**（2026-10 对演示站点实测）或官方引用页给出的示例，
 * 不是照着自己的解析函数编的 —— 解析一旦与 Tableau 的真实形状脱节，用例就会红。
 */
function hasI18nKey(key: string): boolean {
  let node: unknown = common
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return false
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string'
}

/** 演示站点实测载荷：GET /sites/{id}/tasks/extractRefreshes */
const REAL_TASK = {
  extractRefresh: {
    schedule: {
      frequencyDetails: {
        intervals: {
          interval: [
            { hours: '24' },
            { weekDay: 'Sunday' },
            { weekDay: 'Monday' },
            { weekDay: 'Tuesday' },
            { weekDay: 'Wednesday' },
            { weekDay: 'Thursday' },
            { weekDay: 'Friday' },
            { weekDay: 'Saturday' },
          ],
        },
        start: '23:30:00',
        end: '23:30:00',
      },
      frequency: 'Daily',
      nextRunAt: '2026-10-09T15:30:00Z',
    },
    workbook: { id: '2627fba8-d0cd-4a62-80b1-4418d04f6987' },
    id: '9833c699-a75f-4f7b-ab11-3f1c8c726d6a',
    priority: '50',
    consecutiveFailedCount: '5',
    type: 'RefreshExtractTask',
  },
}

/** 演示站点实测载荷：GET /sites/{id}/jobs/{job-id}（runFlowJobType.flow 里带对象名） */
const REAL_JOB_DETAIL = {
  job: {
    runFlowJobType: {
      flow: { id: '416901fc-3eb6-4f45-9326-e5afbf9ae021', name: 'New Flow' },
      flowRunId: '06f48880-3a04-4df0-af73-e5a8ca838163',
    },
    id: 'd4250efc-b2b3-4a80-a3d0-b5f161882342',
    mode: 'Asynchronous',
    type: 'RunFlow',
    progress: '100',
    createdAt: '2026-10-05T14:45:05Z',
    startedAt: '2026-10-05T14:45:05Z',
    completedAt: '2026-10-05T14:45:12Z',
    finishCode: '0',
  },
}

/** 官方引用页的 Tableau Cloud 订阅示例（GET /sites/{id}/subscriptions） */
const DOC_SUBSCRIPTION = {
  id: '92cb4f51-7a15-41d4-bce4-a0fcce5fa985',
  subject: 'Subscription - postman',
  message: 'weekly report',
  attachImage: 'true',
  attachPdf: 'false',
  suspended: 'false',
  content: { id: 'be016ba6-d0a8-44ae-a057-b6df6931ccaa', type: 'Workbook' },
  schedule: {
    frequency: 'Weekly',
    nextRunAt: '2023-06-08T17:05:00-0700',
    frequencyDetails: { start: '17:05:00', intervals: { interval: [{ weekDay: 'Thursday' }] } },
  },
  user: { id: '14064b01-7d58-4978-bdeb-a5f8d7694863', name: 'me@mysite.com' },
}

describe('parseSchedule / describeCadence', () => {
  it('真实日更任务：frequency=Daily，interval 里的 hours 与 7 个 weekDay 都能取到', () => {
    const schedule = parseSchedule(REAL_TASK.extractRefresh.schedule)
    expect(schedule.frequency).toBe('Daily')
    expect(schedule.start).toBe('23:30:00')
    expect(schedule.hours).toBe(24)
    expect(schedule.weekDays).toHaveLength(7)
    expect(schedule.nextRunAt).toBe('2026-10-09T15:30:00Z')
  })

  it('Daily 只看时刻 —— interval 里的 weekDay 是 Tableau 的冗余字段，不当成每周七天', () => {
    const cadence = describeCadence(parseSchedule(REAL_TASK.extractRefresh.schedule))
    expect(cadence).toEqual({ kind: 'daily', time: '23:30', weekDays: [], hours: undefined })
  })

  it('单个 interval 时 Tableau 可能不包数组（XML 转 JSON 的老毛病）', () => {
    const schedule = parseSchedule({
      frequency: 'Weekly',
      frequencyDetails: { start: '17:05:00', intervals: { interval: { weekDay: 'Thursday' } } },
    })
    expect(schedule.weekDays).toEqual(['Thursday'])
    expect(describeCadence(schedule)).toEqual({
      kind: 'weekly',
      time: '17:05',
      weekDays: [4],
      hours: undefined,
    })
  })

  it('多个 weekDay 按周序升序（与 interval 里的书写顺序无关）', () => {
    const schedule = parseSchedule({
      frequency: 'Weekly',
      frequencyDetails: {
        intervals: { interval: [{ weekDay: 'Friday' }, { weekDay: 'Sunday' }] },
      },
    })
    expect(describeCadence(schedule).weekDays).toEqual([0, 5])
  })

  it('Hourly 给出小时间隔', () => {
    const schedule = parseSchedule({
      frequency: 'Hourly',
      frequencyDetails: { intervals: { interval: { hours: '2' } } },
    })
    const cadence = describeCadence(schedule)
    expect(cadence.kind).toBe('hourly')
    expect(cadence.hours).toBe(2)
  })

  it('没给 frequency 时只有 24 小时才推断成每天，其余一律 custom（不猜）', () => {
    const daily = parseSchedule({ frequencyDetails: { intervals: { interval: { hours: '24' } } } })
    const sixHourly = parseSchedule({ frequencyDetails: { intervals: { interval: { hours: '6' } } } })
    expect(describeCadence(daily).kind).toBe('daily')
    expect(describeCadence(sixHourly).kind).toBe('custom')
    expect(describeCadence(parseSchedule({})).kind).toBe('custom')
  })
})

describe('formatClock / formatDuration', () => {
  it('HH:MM:SS 转 HH:MM，并补齐前导零', () => {
    expect(formatClock('23:30:00')).toBe('23:30')
    expect(formatClock('7:05:00')).toBe('07:05')
    expect(formatClock(undefined)).toBeUndefined()
    expect(formatClock('23:30')).toBe('23:30')
  })

  it('耗时：秒 / 分秒 / 时分；缺一端或时间倒挂回破折号', () => {
    expect(formatDuration('2026-10-05T14:45:05Z', '2026-10-05T14:45:12Z')).toBe('7s')
    expect(formatDuration('2026-10-05T14:45:00Z', '2026-10-05T14:46:54Z')).toBe('1m 54s')
    expect(formatDuration('2026-10-05T12:00:00Z', '2026-10-05T14:05:00Z')).toBe('2h 05m')
    expect(formatDuration('2026-10-05T14:45:05Z', undefined)).toBe('—')
    expect(formatDuration('2026-10-05T14:45:12Z', '2026-10-05T14:45:05Z')).toBe('—')
  })
})

describe('作业状态与类型', () => {
  it('状态等级：成功 / 失败 / 进行中 / 其它', () => {
    expect(jobStatusTier('Success')).toBe('success')
    expect(jobStatusTier('Failed')).toBe('failed')
    expect(jobStatusTier('InProgress')).toBe('running')
    expect(jobStatusTier('Pending')).toBe('running')
    expect(jobStatusTier('Cancelled')).toBe('neutral')
    expect(jobStatusTier('')).toBe('neutral')
  })

  it('已知状态与类型都有文案；未知取值回 null（页面原样显示表值）', () => {
    expect(jobStatusLabelKey('success')).toBe('tableauSchedules.jobStatus.success')
    expect(jobStatusLabelKey('FAILED')).toBe('tableauSchedules.jobStatus.failed')
    expect(jobStatusLabelKey('weird')).toBeNull()
    expect(jobTypeLabelKey('run_flow')).toBe('tableauSchedules.jobType.runFlow')
    expect(jobTypeLabelKey('refresh_extracts')).toBe('tableauSchedules.jobType.refreshExtracts')
    expect(jobTypeLabelKey('weird')).toBeNull()
  })

  it('常量映射表里的每个 key 都在词典里（check-i18n-keys 看不到动态 key）', () => {
    const keys = [
      ...Object.values(JOB_STATUS_LABEL_KEYS),
      ...Object.values(JOB_TYPE_LABEL_KEYS),
      ...Object.values(WEEKDAY_LABEL_KEYS),
    ]
    for (const key of keys) {
      expect(hasI18nKey(key), key + ' 缺文案').toBe(true)
    }
  })
})

describe('sortJobsNewestFirst', () => {
  it('按 startedAt（缺则 createdAt）倒序，且不改动入参数组', () => {
    const jobs = [
      parseBackgroundJob({ id: 'a', status: 'Success', jobType: 'run_flow', startedAt: '2026-09-14T14:45:08Z' }),
      parseBackgroundJob({ id: 'b', status: 'Success', jobType: 'run_flow', startedAt: '2026-10-05T14:45:05Z' }),
      parseBackgroundJob({ id: 'c', status: 'Failed', jobType: 'refresh_extracts', createdAt: '2026-09-21T14:45:20Z' }),
    ]
    expect(sortJobsNewestFirst(jobs).map((job) => job.id)).toEqual(['b', 'c', 'a'])
    expect(jobs.map((job) => job.id)).toEqual(['a', 'b', 'c'])
  })

  it('没有时间的行沉底，不影响其它行', () => {
    const jobs = [
      parseBackgroundJob({ id: 'none', status: 'Success', jobType: 'run_flow' }),
      parseBackgroundJob({ id: 'new', status: 'Success', jobType: 'run_flow', startedAt: '2026-10-05T14:45:05Z' }),
    ]
    expect(sortJobsNewestFirst(jobs).map((job) => job.id)).toEqual(['new', 'none'])
  })
})

describe('解析真实载荷', () => {
  it('提取刷新任务', () => {
    const task = parseExtractRefreshTask(REAL_TASK)
    expect(task.id).toBe('9833c699-a75f-4f7b-ab11-3f1c8c726d6a')
    expect(task.type).toBe('RefreshExtractTask')
    expect(task.workbookId).toBe('2627fba8-d0cd-4a62-80b1-4418d04f6987')
    expect(task.datasourceId).toBeUndefined()
    // 字符串 '5' 转数字 5（Tableau 用字符串回数字，页面要按大于 0 判断）
    expect(task.consecutiveFailedCount).toBe(5)
  })

  it('缺 consecutiveFailedCount 时按 0（不显示成失败过）', () => {
    const task = parseExtractRefreshTask({ extractRefresh: { id: 'x' } })
    expect(task.consecutiveFailedCount).toBe(0)
  })

  it('作业详情：对象名藏在 JobType 包装里', () => {
    const detail = parseJobDetail(REAL_JOB_DETAIL)
    expect(detail.objectKind).toBe('flow')
    expect(detail.objectName).toBe('New Flow')
    expect(detail.type).toBe('RunFlow')
    expect(detail.progress).toBe('100')
    expect(detail.finishCode).toBe('0')
  })

  it('作业详情里没有对象时返回空值而不是崩溃', () => {
    const detail = parseJobDetail({ job: { id: 'x', type: 'RefreshExtract' } })
    expect(detail.objectName).toBeUndefined()
    expect(detail.objectKind).toBeUndefined()
  })

  it('订阅计划（Cloud 形状：内联 frequency 的 schedule）', () => {
    const subscription = parseSubscription(DOC_SUBSCRIPTION)
    expect(subscription.id).toBe('92cb4f51-7a15-41d4-bce4-a0fcce5fa985')
    expect(subscription.subject).toBe('Subscription - postman')
    expect(subscription.suspended).toBe(false)
    expect(subscription.contentType).toBe('Workbook')
    expect(subscription.userName).toBe('me@mysite.com')
    expect(describeCadence(subscription.schedule)).toEqual({
      kind: 'weekly',
      time: '17:05',
      weekDays: [4],
      hours: undefined,
    })
  })

  it('订阅为空对象（站点没有订阅时 Tableau 回 {}）不崩', () => {
    const subscription = parseSubscription({})
    expect(subscription.id).toBe('')
    expect(describeCadence(subscription.schedule).kind).toBe('custom')
  })
})
