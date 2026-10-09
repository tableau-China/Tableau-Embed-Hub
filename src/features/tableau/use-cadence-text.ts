import { useTranslation } from 'react-i18next'

import { WEEKDAY_LABEL_KEYS, describeCadence, type TaskSchedule } from '@/lib/tableau-tasks'

/**
 * 把 Tableau 的 schedule 频率翻成一句人话（提取任务表与订阅表共用）。
 *
 * 为什么返回函数而不是组件：两处用法都是往表格单元格里塞一行文字，
 * 包成组件只会多一层 DOM 与 props 传递。
 * 句子结构留在 i18n 模板里（cadence.*），这里只负责挑模板与填参数 ——
 * 中文语序与英文不同，把 "Daily at {{time}}" 写死在代码里就等于放弃翻译。
 */
export function useCadenceText() {
  const { t } = useTranslation()
  return (schedule: TaskSchedule): string => {
    const cadence = describeCadence(schedule)
    if (cadence.kind === 'daily') {
      return t('tableauSchedules.cadence.daily', { time: cadence.time ?? '—' })
    }
    if (cadence.kind === 'weekly') {
      return t('tableauSchedules.cadence.weekly', {
        days: cadence.weekDays.map((day) => t(WEEKDAY_LABEL_KEYS[day])).join(', '),
        time: cadence.time ?? '—',
      })
    }
    if (cadence.kind === 'hourly') {
      return t('tableauSchedules.cadence.hourly', { hours: cadence.hours ?? '—' })
    }
    return t('tableauSchedules.cadence.custom')
  }
}
