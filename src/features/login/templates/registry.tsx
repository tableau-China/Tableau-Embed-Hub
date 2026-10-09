import type { ReactNode } from 'react'

import type { LoginConfig, LoginTemplateId } from '@/lib/login'

import { CenteredCardTemplate } from './centered-card'
import { FullscreenCardTemplate } from './fullscreen-card'
import { SplitHeroTemplate } from './split-hero'

/**
 * 登录样式注册表：`LoginTemplateId` → 模板组件。
 *
 * **新增一个登录样式只要三步**：写一个模板文件 → 在本表登记一行 → 在 `lib/login.ts` 的
 * `LOGIN_TEMPLATES` 加一条（配置页的下拉与预览会自动多一项）。
 * `Record<LoginTemplateId, …>` 让漏登记在 tsc 阶段就报错（同 app-sidebar 的 ICONS 手法）。
 */

export interface LoginTemplateProps {
  /** 当前登录配置（模板可能关心 provider 启用状态等） */
  config: LoginConfig
  /** 宣传图地址（已解析：配置为空时 = 内置图） */
  heroImageUrl: string
}

export type LoginTemplateComponent = (props: LoginTemplateProps) => ReactNode

export const LOGIN_TEMPLATE_COMPONENTS: Record<LoginTemplateId, LoginTemplateComponent> = {
  'centered-card': CenteredCardTemplate,
  'split-hero': SplitHeroTemplate,
  'fullscreen-card': FullscreenCardTemplate,
}
