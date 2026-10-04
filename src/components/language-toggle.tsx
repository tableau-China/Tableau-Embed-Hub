import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** 支持的语言（当前仅 en-US；后续添加 zh-CN / zh-TW / ja-JP 时在此追加并补充 locale 资源） */
const LANGUAGES = [{ code: 'en-US', labelKey: 'settings.english' }] as const

/** 语言切换按钮（位于 Header 右上角，主题切换旁） */
export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const current = i18n.language

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t('profile.language')}>
          <Languages className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            disabled={current === lang.code}
            onClick={() => void i18n.changeLanguage(lang.code)}
          >
            {t(lang.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
