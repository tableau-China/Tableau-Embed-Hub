import { LoginForm } from '../login-form'
import type { LoginTemplateProps } from './registry'

/**
 * 样式一：居中卡片（最简）。
 *
 * 只有品牌标识、登录框（用户名 / 密码 / 验证码占位）与第三方入口 —— 不放宣传图，
 * 因此在任何屏幕尺寸下都完整可用，也是 `DEFAULT_LOGIN_TEMPLATE`。
 */
export function CenteredCardTemplate({ config }: LoginTemplateProps) {
  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-4 sm:p-6">
      <LoginForm config={config} className="max-w-sm" />
    </div>
  )
}
