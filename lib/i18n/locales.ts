export type Locale = 'zh-TW' | 'en'

export const locales: Locale[] = ['zh-TW', 'en']
export const defaultLocale: Locale = 'zh-TW'

export const localeLabels: Record<Locale, string> = {
  'zh-TW': '中文',
  en: 'EN',
}
