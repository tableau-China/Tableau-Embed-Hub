import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from './locales/en-US/common.json'

// English-only for now; zh-CN / zh-TW / ja-JP will be added later.
void i18n.use(initReactI18next).init({
  resources: {
    'en-US': { common },
  },
  lng: 'en-US',
  fallbackLng: 'en-US',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

export default i18n
