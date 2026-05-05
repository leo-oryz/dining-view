export type Locale = 'vi' | 'en' | 'zh-TW'

export const locales: Locale[] = ['vi', 'en', 'zh-TW']
export const defaultLocale: Locale = 'vi'

export const localeLabels: Record<Locale, string> = {
  vi: 'VI',
  en: 'EN',
  'zh-TW': '中文',
}
