import type { ComponentType } from 'react'
import {
  AudioWaveform,
  Blocks,
  Briefcase,
  Building2,
  Command,
  Cpu,
  GalleryVerticalEnd,
  Globe,
  LayoutGrid,
  MonitorPlay,
  Shield,
  Star,
  Workflow,
  Zap,
  type LucideProps,
} from 'lucide-react'

import { TEAM_LOGO_KEYS } from '@/stores/org-store'

/**
 * Team 图标注册表：OrgTeam.logo 存字符串 key（持久化友好），渲染时映射到 lucide 组件。
 * key 集合与 stores/org-store.ts 的 TEAM_LOGO_KEYS 保持一致。
 */

const LOGO_ICONS: Record<string, ComponentType<LucideProps>> = {
  building2: Building2,
  briefcase: Briefcase,
  'monitor-play': MonitorPlay,
  workflow: Workflow,
  globe: Globe,
  command: Command,
  'audio-waveform': AudioWaveform,
  'gallery-vertical-end': GalleryVerticalEnd,
  zap: Zap,
  star: Star,
  shield: Shield,
  cpu: Cpu,
  blocks: Blocks,
  'layout-grid': LayoutGrid,
}

const FALLBACK_ICON = Building2

export function TeamLogo({ logo, className }: { logo: string; className?: string }) {
  const Icon = LOGO_ICONS[logo] ?? FALLBACK_ICON
  return <Icon className={className} />
}

/** 图标选择器数据（新建/编辑团队时用） */
export const TEAM_LOGO_OPTIONS = TEAM_LOGO_KEYS.map((key) => ({
  key,
  Icon: LOGO_ICONS[key] ?? FALLBACK_ICON,
}))
