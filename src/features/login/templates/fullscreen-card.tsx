import { LoginForm } from '../login-form'
import { HeroImage } from './hero-image'
import type { LoginTemplateProps } from './registry'

/**
 * 样式三：全屏背景图 + 居中登录框。
 *
 * 与样式二的区别是「图当背景、表单浮在上面」：整屏一张图 + 半透明遮罩，表单始终居中。
 * 遮罩是**必需**的（不是装饰）：宣传图可能很亮，没有遮罩时文字压在图上对比度不达标。
 *
 * 表单额外传 `surface="panel"`：设计稿的「全屏」摆放下 `.auth` 有一层半透明面板
 * （`backdrop-filter` + 描边 + 投影），因为背景是图、不是纸面 —— 这是三套里唯一需要面板的一套。
 */
export function FullscreenCardTemplate({ config, heroImageUrl }: LoginTemplateProps) {
  return (
    <div className="relative flex min-h-svh items-center justify-center p-4 sm:p-6">
      <HeroImage src={heroImageUrl} className="absolute inset-0 size-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/70" />
      <LoginForm config={config} surface="panel" className="relative" />
    </div>
  )
}
