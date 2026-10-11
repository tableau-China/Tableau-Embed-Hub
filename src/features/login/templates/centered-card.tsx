import { LoginForm } from '../login-form'
import type { LoginTemplateProps } from './registry'

/**
 * 样式一：居中登录框（最简）。
 *
 * 只有登录框（品牌标识 / 账号 / 密码 / 验证码占位 / 第三方入口）—— 不放宣传图，
 * 因此在任何屏幕尺寸下都完整可用，也是 `DEFAULT_LOGIN_TEMPLATE`。
 *
 * 表单外观是三套共用的「纸上语言」（见 `../login-form.tsx`）：2026-10-11 起不再套白卡盒子，
 * 宽度由 `LoginForm` 自己的 `max-w-[340px]` 决定，模板只负责摆放。
 */
export function CenteredCardTemplate({ config }: LoginTemplateProps) {
  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-4 sm:p-6">
      <LoginForm config={config} />
    </div>
  )
}
