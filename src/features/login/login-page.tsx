import { useConfigStore } from '@/stores/config-store'
import { resolveHeroImageUrl } from '@/lib/login'

import { LOGIN_TEMPLATE_COMPONENTS } from './templates/registry'

/**
 * 登录页 `/login`（跨出 App shell 的**裸布局**页面，见 routes/__login 的 staticData）。
 *
 * 职责只有三件：读登录配置 → 取对应样式模板 → 把本地化好的输入交给模板。
 * 布局全在 `templates/` 里，这里不写版面。
 *
 * 当前是「UI 模板」阶段：`/login` 可直达、可预览，**不拦截**应用内其它页面
 *（纯前端伪造会话是安全剧场，本模板不做 —— 见 docs/login-setup.md）。
 */
export function LoginPage() {
  const config = useConfigStore((s) => s.login)
  const Template = LOGIN_TEMPLATE_COMPONENTS[config.template]

  return (
    <div data-login-page data-login-template={config.template}>
      <Template config={config} heroImageUrl={resolveHeroImageUrl(config)} />
    </div>
  )
}
