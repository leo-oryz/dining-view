'use client'

import { useI18n } from '@/lib/i18n/context'
import { locales, localeLabels, type Locale } from '@/lib/i18n/locales'
import clsx from 'clsx'

export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n()

  return (
    <div className={clsx('flex items-center gap-1 text-xs', className)}>
      {locales.map((l: Locale) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={clsx(
            'px-2 py-1 rounded transition-colors',
            locale === l
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-600'
          )}
        >
          {localeLabels[l]}
        </button>
      ))}
    </div>
  )
}
