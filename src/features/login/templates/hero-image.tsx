import { useState } from 'react'

import { DEFAULT_HERO_IMAGE_URL } from '@/lib/login'
import { cn } from '@/lib/utils'

/**
 * 宣传图（模板共用）：配置为空时用内置图（由 `resolveHeroImageUrl` 解析好传进来）。
 *
 * **加载失败兜底**：配置的远程图挂了（404 / 域名不可达 / 被墙）时退回内置图，
 * 而不是留给用户一块空白 —— 登录页是访客看到的第一屏，它不能因为一张图失败而破相。
 */
export function HeroImage({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const resolved = failed && src !== DEFAULT_HERO_IMAGE_URL ? DEFAULT_HERO_IMAGE_URL : src

  return (
    <img
      // data-login-hero 记录的是**配置里请求的地址**（不含兜底），便于用例断言配置真的传到了模板
      data-login-hero={src}
      src={resolved}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  )
}
