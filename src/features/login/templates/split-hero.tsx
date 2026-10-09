import { APP_NAME } from '@/config/app'

import { LoginForm } from '../login-form'
import { HeroImage } from './hero-image'
import type { LoginTemplateProps } from './registry'

/**
 * 样式二：左侧 2/3 宣传图 + 右侧 1/3 登录内容。
 *
 * - **2/3 : 1/3** 用 `lg:grid-cols-3` + `lg:col-span-2` 表达（不是 66%/33% 的魔法数字）；
 * - 窄屏（< lg）**收起宣传图**、表单居中：手机上一张 2/3 宽的图只会把登录框挤到屏幕外；
 * - 图上压一层渐变遮罩，避免浅色图片让左上角的内容（站点名）读不清。
 */
export function SplitHeroTemplate({ config, heroImageUrl }: LoginTemplateProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-3">
      <div className="relative hidden lg:col-span-2 lg:block">
        <HeroImage src={heroImageUrl} className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="text-primary-foreground absolute bottom-10 left-10 max-w-md">
          <p className="text-2xl font-semibold tracking-tight">{APP_NAME}</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-4 sm:p-6">
        <LoginForm config={config} className="max-w-sm" />
      </div>
    </div>
  )
}
